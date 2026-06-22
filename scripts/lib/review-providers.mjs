const GEMINI_RETRIES = 3;
// Keep a single call comfortably under undici's ~300s headers timeout. A full
// 65536-token generation over the full doc was observed to exceed it ("fetch
// failed" at ~301s). The catalog-slice bisect handles any resulting truncation.
const MAX_OUTPUT_TOKENS = 16384;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Builds the Gemini generateContent request body. Flash / Flash-Lite default to
// dynamic "thinking", which on a full-doc prompt can push one call past the
// ~300s socket timeout. Disable thinking for flash models (Pro cannot disable
// it — min budget 128 — so leave it unset there and rely on smaller slices).
export function buildGeminiBody(model, prompt, schema) {
  const generationConfig = {
    temperature: 0.3,
    responseMimeType: "application/json",
    responseSchema: schema,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  };
  if (String(model).includes("flash")) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }
  return {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig,
  };
}

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

// Single model-call seam. `model` selects the provider. `fetchImpl` is
// injectable so unit tests run without network. Returns { data, finishReason }.
// gemini-2.5-pro has thinking on by default; maxOutputTokens is set high so
// thinking tokens (counted against output) don't starve the JSON response.
export async function extract({ model, prompt, schema, apiKey, fetchImpl = globalThis.fetch }) {
  if (!String(model).startsWith("gemini-")) {
    throw new Error(`Provider for model "${model}" is not wired yet (only gemini-* supported in v1).`);
  }
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = buildGeminiBody(model, prompt, schema);

  for (let attempt = 0; attempt <= GEMINI_RETRIES; attempt++) {
    let res;
    try {
      res = await fetchImpl(`${endpoint}?key=${apiKey}`, {
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
      const json = await res.json();
      const finishReason = json?.candidates?.[0]?.finishReason;
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error(`Gemini returned no text (finishReason=${finishReason}): ${JSON.stringify(json).slice(0, 600)}`);
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Gemini returned non-JSON (finishReason=${finishReason}): ${text.slice(0, 300)}`);
      }
      return { data, finishReason };
    }

    const errText = await res.text();
    const retriable = res.status === 429 || (res.status >= 500 && res.status < 600);
    if (!retriable || attempt === GEMINI_RETRIES) {
      throw new Error(`Gemini call failed: ${res.status} ${errText.slice(0, 300)}`);
    }
    await sleep((parseRetryDelayMs(errText) ?? Math.min(30000, 1000 * 2 ** attempt)) + 500);
  }
  throw new Error("Gemini retry loop exhausted");
}
