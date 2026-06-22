import assert from "node:assert/strict";
import test from "node:test";
import { extract, parseRetryDelayMs } from "./review-providers.mjs";

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
