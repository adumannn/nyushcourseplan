import assert from "node:assert/strict";
import test from "node:test";
import { extract, parseRetryDelayMs, buildGeminiBody } from "./review-providers.mjs";

function geminiOk(obj, finishReason = "STOP") {
  return {
    ok: true,
    json: async () => ({ candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(obj) }] } }] }),
  };
}

test("extract returns parsed data + finishReason on success", async () => {
  const fetchImpl = async () => geminiOk({ courses: [] }, "STOP");
  const { data, finishReason } = await extract({
    model: "gemini-2.5-pro", prompt: "p", schema: {}, apiKey: "k", fetchImpl,
  });
  assert.deepEqual(data, { courses: [] });
  assert.equal(finishReason, "STOP");
});

test("extract surfaces MAX_TOKENS finishReason", async () => {
  const fetchImpl = async () => geminiOk({ courses: [] }, "MAX_TOKENS");
  const { finishReason } = await extract({ model: "gemini-2.5-pro", prompt: "p", schema: {}, apiKey: "k", fetchImpl });
  assert.equal(finishReason, "MAX_TOKENS");
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
    extract({ model: "claude-sonnet-4-6", prompt: "p", schema: {}, apiKey: "k", fetchImpl: async () => geminiOk({}) }),
    /not wired/,
  );
});

test("parseRetryDelayMs reads RetryInfo seconds", () => {
  const body = JSON.stringify({ error: { details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "7s" }] } });
  assert.equal(parseRetryDelayMs(body), 7000);
  assert.equal(parseRetryDelayMs("not json"), null);
});

test("buildGeminiBody disables thinking for flash, leaves it unset for pro", () => {
  const flash = buildGeminiBody("gemini-2.5-flash", "p", { type: "object" });
  assert.equal(flash.generationConfig.thinkingConfig.thinkingBudget, 0);
  assert.equal(flash.generationConfig.maxOutputTokens, 16384);
  assert.equal(flash.contents[0].parts[0].text, "p");

  const pro = buildGeminiBody("gemini-2.5-pro", "p", { type: "object" });
  assert.equal(pro.generationConfig.thinkingConfig, undefined);
});

test("extract retries a network-level failure then succeeds", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("fetch failed");
    return geminiOk({ courses: [] }, "STOP");
  };
  const { data } = await extract({ model: "gemini-2.5-flash", prompt: "p", schema: {}, apiKey: "k", fetchImpl });
  assert.equal(calls, 2);
  assert.deepEqual(data, { courses: [] });
});
