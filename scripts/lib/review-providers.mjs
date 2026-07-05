const GEMINI_RETRIES = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function parseRetryDelayMs(errText) {
  try {
    const parsed = JSON.parse(errText);
    for (const d of parsed?.error?.details ?? []) {
      if (d["@type"]?.includes("RetryInfo") && typeof d.retryDelay === "string") {
        const m = d.retryDelay.match(/^([\d.]+)s$/);
        if (m) return Math.ceil(parseFloat(m[1]) * 1000);
      }
    }
  } catch {
    // not JSON
  }
  return null;
}

// Builds the Gemini generateContent request body, model-aware:
// - maxOutputTokens: the 2.5 family supports 65536; older models cap at 8192.
//   Large outputs are safe because we STREAM the response (see extract) — the
//   undici ~300s headers timeout never fires on a streaming body, so one call
//   can generate for many minutes. Fewer, larger calls matter more than speed:
//   this key's free tier is 20 requests/day/model.
// - thinking: only the 2.5 flash family supports disabling it (budget 0);
//   2.5-pro's minimum budget is 128 (leave unset); 2.0 models reject
//   thinkingConfig entirely with a 400.
export function buildGeminiBody(model, prompt, schema) {
  const m = String(model);
  const generationConfig = {
    temperature: 0.3,
    responseMimeType: "application/json",
    responseSchema: schema,
    maxOutputTokens: m.includes("2.5") ? 65536 : 8192,
  };
  if (m.includes("2.5-flash")) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }
  return {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig,
  };
}

// Parses a Gemini `streamGenerateContent?alt=sse` payload: one `data: {json}`
// frame per chunk. Text parts are concatenated in order; finishReason comes
// from the last frame that carries one; an `error` frame (Gemini can abort a
// stream mid-generation) is surfaced instead of silently skipped. Malformed
// frames are skipped (JSON strings never contain raw newlines, so
// line-splitting is safe).
export function parseSseResponse(raw) {
  let text = "";
  let finishReason;
  let error;
  for (const line of String(raw).split(/\r?\n/)) {
    if (!line.startsWith("data: ")) continue;
    let chunk;
    try {
      chunk = JSON.parse(line.slice(6));
    } catch {
      continue;
    }
    if (chunk?.error && !error) error = chunk.error;
    const cand = chunk?.candidates?.[0];
    for (const part of cand?.content?.parts ?? []) {
      if (typeof part.text === "string") text += part.text;
    }
    if (cand?.finishReason) finishReason = cand.finishReason;
  }
  return { text, finishReason, error };
}

// Single model-call seam. `model` selects the provider. `fetchImpl` is
// injectable so unit tests run without network. Returns { data, finishReason }.
export async function extract({ model, prompt, schema, apiKey, fetchImpl = globalThis.fetch }) {
  if (!String(model).startsWith("gemini-")) {
    throw new Error(`Provider for model "${model}" is not wired yet (only gemini-* supported in v1).`);
  }
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`;
  const body = buildGeminiBody(model, prompt, schema);
  let streamCutRetried = false;

  for (let attempt = 0; attempt <= GEMINI_RETRIES; attempt++) {
    let res;
    try {
      res = await fetchImpl(`${endpoint}?alt=sse&key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      // Network-level failure (reset, DNS, undici timeout → "fetch failed").
      // Treat as retriable rather than aborting the whole run.
      if (attempt === GEMINI_RETRIES) {
        throw new Error(`Gemini fetch failed after retries: ${err?.message || err}`);
      }
      await sleep(Math.min(30000, 1000 * 2 ** attempt) + 500);
      continue;
    }

    if (res.ok) {
      // Consuming the SSE stream chunk-by-chunk resets undici's idle body
      // timeout, so long generations don't die at the ~300s socket limit.
      const raw = await res.text();
      const { text, finishReason, error: streamError } = parseSseResponse(raw);
      if (streamError) {
        const code = Number(streamError.code) || 0;
        const retriable = code === 429 || (code >= 500 && code < 600);
        if (retriable && attempt < GEMINI_RETRIES) {
          await sleep((parseRetryDelayMs(JSON.stringify({ error: streamError })) ?? Math.min(30000, 1000 * 2 ** attempt)) + 500);
          continue;
        }
        throw new Error(`Gemini stream error: ${JSON.stringify(streamError).slice(0, 1500)}`);
      }
      if (!text) {
        throw new Error(`Gemini returned no text (finishReason=${finishReason}): ${String(raw).slice(0, 600)}`);
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        // Truncated output (hit the token cap) is invalid JSON. Don't fail the
        // run — surface MAX_TOKENS with empty data so the caller bisects the
        // slice and retries smaller.
        if (finishReason === "MAX_TOKENS") {
          return { data: { courses: [] }, finishReason };
        }
        // No finishReason at all = the stream was cut mid-generation (transport
        // drop or server abort without an error frame). Retry once — transient
        // cuts usually clear — then let the caller bisect: halved slices stream
        // for less time and are less exposed. Never kill the whole run for it.
        if (!finishReason) {
          if (!streamCutRetried) {
            streamCutRetried = true;
            console.warn("Gemini stream cut mid-generation; retrying once…");
            await sleep(1500);
            continue;
          }
          return { data: { courses: [] }, finishReason: "MAX_TOKENS" };
        }
        // finishReason present (e.g. STOP) but unparseable JSON — a real bug.
        throw new Error(`Gemini returned non-JSON (finishReason=${finishReason}): ${text.slice(0, 300)}`);
      }
      return { data, finishReason };
    }

    const errText = await res.text();
    const retriable = res.status === 429 || (res.status >= 500 && res.status < 600);
    if (!retriable || attempt === GEMINI_RETRIES) {
      throw new Error(`Gemini call failed: ${res.status} ${errText.slice(0, 1500)}`);
    }
    await sleep((parseRetryDelayMs(errText) ?? Math.min(30000, 1000 * 2 ** attempt)) + 500);
  }
  throw new Error("Gemini retry loop exhausted");
}
