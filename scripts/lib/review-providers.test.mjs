import assert from "node:assert/strict";
import test from "node:test";
import { extract, parseRetryDelayMs, buildGeminiBody, parseSseResponse } from "./review-providers.mjs";

// Builds a mocked SSE response the way Gemini's streamGenerateContent?alt=sse
// emits it: one `data: {chunk}` line per token batch, finishReason on the last.
function sseChunk(text, finishReason = null) {
  return `data: ${JSON.stringify({
    candidates: [{
      ...(finishReason ? { finishReason } : {}),
      content: { parts: [{ text }] },
    }],
  })}\n\n`;
}

function sseOk(obj, finishReason = "STOP") {
  return { ok: true, text: async () => sseChunk(JSON.stringify(obj), finishReason) };
}

test("parseSseResponse accumulates text across chunks and takes last finishReason", () => {
  const raw =
    sseChunk('{"courses":[{"course_') +
    sseChunk('id":"X"}]}', "STOP") +
    "data: not-json\n\n"; // malformed frame is skipped
  const { text, finishReason } = parseSseResponse(raw);
  assert.equal(text, '{"courses":[{"course_id":"X"}]}');
  assert.equal(finishReason, "STOP");
});

test("parseSseResponse surfaces a mid-stream error frame", () => {
  const raw =
    sseChunk('{"courses":') +
    `data: ${JSON.stringify({ error: { code: 429, message: "quota" } })}\n\n`;
  const { error } = parseSseResponse(raw);
  assert.equal(error.code, 429);
  assert.match(error.message, /quota/);
});

test("extract retries once on a cut stream, then succeeds", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      // stream dies mid-JSON: no finishReason frame ever arrives
      return { ok: true, text: async () => sseChunk('{"courses":[{"cou') };
    }
    return sseOk({ courses: [] }, "STOP");
  };
  const { data, finishReason } = await extract({ model: "gemini-2.5-flash", prompt: "p", schema: {}, apiKey: "k", fetchImpl });
  assert.equal(calls, 2);
  assert.equal(finishReason, "STOP");
  assert.deepEqual(data, { courses: [] });
});

test("extract hands a repeatedly-cut stream to the caller as MAX_TOKENS (bisect)", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, text: async () => sseChunk('{"courses":[{"cou') };
  };
  const { data, finishReason } = await extract({ model: "gemini-2.5-flash", prompt: "p", schema: {}, apiKey: "k", fetchImpl });
  assert.equal(calls, 2); // one retry, then give up and let the caller bisect
  assert.equal(finishReason, "MAX_TOKENS");
  assert.deepEqual(data, { courses: [] });
});

test("extract throws on a non-retriable mid-stream error frame", async () => {
  const fetchImpl = async () => ({
    ok: true,
    text: async () =>
      sseChunk('{"cour') +
      `data: ${JSON.stringify({ error: { code: 400, message: "bad schema" } })}\n\n`,
  });
  await assert.rejects(
    extract({ model: "gemini-2.5-flash", prompt: "p", schema: {}, apiKey: "k", fetchImpl }),
    /Gemini stream error.*bad schema/,
  );
});

test("extract returns parsed data + finishReason on success", async () => {
  const fetchImpl = async (url) => {
    assert.match(url, /streamGenerateContent\?alt=sse/);
    return sseOk({ courses: [] }, "STOP");
  };
  const { data, finishReason } = await extract({
    model: "gemini-2.5-flash", prompt: "p", schema: {}, apiKey: "k", fetchImpl,
  });
  assert.deepEqual(data, { courses: [] });
  assert.equal(finishReason, "STOP");
});

test("extract assembles JSON split across many SSE chunks", async () => {
  const fetchImpl = async () => ({
    ok: true,
    text: async () => sseChunk('{"cour') + sseChunk('ses":') + sseChunk("[]}", "STOP"),
  });
  const { data } = await extract({ model: "gemini-2.5-flash", prompt: "p", schema: {}, apiKey: "k", fetchImpl });
  assert.deepEqual(data, { courses: [] });
});

test("extract returns empty + MAX_TOKENS on truncated JSON (lets caller bisect)", async () => {
  const fetchImpl = async () => ({
    ok: true,
    text: async () => sseChunk('{"courses":[{"course_id":"X', "MAX_TOKENS"),
  });
  const { data, finishReason } = await extract({ model: "gemini-2.5-flash", prompt: "p", schema: {}, apiKey: "k", fetchImpl });
  assert.equal(finishReason, "MAX_TOKENS");
  assert.deepEqual(data, { courses: [] });
});

test("extract still throws on malformed JSON when not truncated", async () => {
  const fetchImpl = async () => ({
    ok: true,
    text: async () => sseChunk("not json at all", "STOP"),
  });
  await assert.rejects(
    extract({ model: "gemini-2.5-flash", prompt: "p", schema: {}, apiKey: "k", fetchImpl }),
    /non-JSON/,
  );
});

test("extract throws on non-retriable HTTP error", async () => {
  const fetchImpl = async () => ({ ok: false, status: 400, text: async () => "bad request" });
  await assert.rejects(
    extract({ model: "gemini-2.5-pro", prompt: "p", schema: {}, apiKey: "k", fetchImpl }),
    /Gemini call failed: 400/,
  );
});

test("extract refuses unwired providers", async () => {
  await assert.rejects(
    extract({ model: "claude-sonnet-4-6", prompt: "p", schema: {}, apiKey: "k", fetchImpl: async () => sseOk({}) }),
    /not wired/,
  );
});

test("extract retries a network-level failure then succeeds", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("fetch failed");
    return sseOk({ courses: [] }, "STOP");
  };
  const { data } = await extract({ model: "gemini-2.5-flash", prompt: "p", schema: {}, apiKey: "k", fetchImpl });
  assert.equal(calls, 2);
  assert.deepEqual(data, { courses: [] });
});

test("parseRetryDelayMs reads RetryInfo seconds", () => {
  const body = JSON.stringify({ error: { details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "7s" }] } });
  assert.equal(parseRetryDelayMs(body), 7000);
  assert.equal(parseRetryDelayMs("not json"), null);
});

test("buildGeminiBody is model-aware: thinking + 65k only for 2.5 family", () => {
  const flash25 = buildGeminiBody("gemini-2.5-flash", "p", { type: "object" });
  assert.equal(flash25.generationConfig.thinkingConfig.thinkingBudget, 0);
  assert.equal(flash25.generationConfig.maxOutputTokens, 65536);
  assert.equal(flash25.contents[0].parts[0].text, "p");

  const lite25 = buildGeminiBody("gemini-2.5-flash-lite", "p", {});
  assert.equal(lite25.generationConfig.thinkingConfig.thinkingBudget, 0);

  // Pro cannot disable thinking (min budget 128) — leave unset.
  const pro = buildGeminiBody("gemini-2.5-pro", "p", {});
  assert.equal(pro.generationConfig.thinkingConfig, undefined);
  assert.equal(pro.generationConfig.maxOutputTokens, 65536);

  // 2.0 family: no thinking support (sending thinkingConfig would 400) and 8k max output.
  const flash20 = buildGeminiBody("gemini-2.0-flash", "p", {});
  assert.equal(flash20.generationConfig.thinkingConfig, undefined);
  assert.equal(flash20.generationConfig.maxOutputTokens, 8192);
});
