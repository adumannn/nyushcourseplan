// Standalone review ingestion (replaces the ingest-reviews edge function).
// Fetches the community Google Doc, gates on a SHA-256 hash, and asks Gemini
// to extract course + professor reviews against the full catalog. Slices the
// catalog only to bound model output; the FULL doc is sent on every call.
//
// Usage:
//   node scripts/ingest-reviews.mjs            # gated run
//   node scripts/ingest-reviews.mjs --force    # ignore the hash gate
//   node scripts/ingest-reviews.mjs --dry-run  # print rows, write nothing
//
// Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY,
//      REVIEW_DOC_ID, [REVIEW_MODEL=gemini-2.5-pro], [REVIEW_CATALOG_SLICES=4]

import { createClient } from "@supabase/supabase-js";
import {
  sha256Hex, buildCatalogSlices, COMBINED_SCHEMA, buildPrompt,
  normalizeCourses, mergeCourses, buildIdResolver, buildRows,
} from "./lib/review-extract.mjs";
import { extract } from "./lib/review-providers.mjs";

const MODEL = process.env.REVIEW_MODEL || "gemini-2.5-flash";
// This key's free tier allows only 20 requests/DAY per model
// (GenerateRequestsPerDayPerProjectPerModel-FreeTier), so a run must fit in a
// handful of calls: 2 large streamed slices, bisecting only when truncated.
const SLICES = Number(process.env.REVIEW_CATALOG_SLICES || "2");
const MIN_CALL_INTERVAL_MS = 4000;   // also stay far under any per-minute cap
const MAX_BISECT_DEPTH = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Global throttle: enforces a minimum gap between ANY two Gemini calls, so a
// burst of bisect calls can't exceed the per-minute request quota.
let lastCallAt = 0;
async function throttle() {
  const wait = lastCallAt + MIN_CALL_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastCallAt = Date.now();
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function fetchDocPlainText(docId) {
  const url = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Doc fetch failed: ${res.status} ${res.statusText}`);
  return res.text();
}

// One combined extraction over the full doc for a catalog slice. If the model
// truncates (MAX_TOKENS), bisect the slice's catalog and recurse — the full
// doc is re-sent each time, so nothing is lost; only output is split.
async function extractSlice(slice, docText, apiKey, depth = 0) {
  const prompt = buildPrompt(slice, docText);
  await throttle();
  const { data, finishReason } = await extract({ model: MODEL, prompt, schema: COMBINED_SCHEMA, apiKey });
  const courses = normalizeCourses(data);
  console.log(`  call: ${slice.length}-course slice (depth ${depth}) → ${finishReason ?? "?"}, extracted ${courses.length}`);
  if (finishReason === "MAX_TOKENS" && slice.length > 1 && depth < MAX_BISECT_DEPTH) {
    const mid = Math.ceil(slice.length / 2);
    const left = await extractSlice(slice.slice(0, mid), docText, apiKey, depth + 1);
    const right = await extractSlice(slice.slice(mid), docText, apiKey, depth + 1);
    return [...left, ...right];
  }
  return courses;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");

  const supabase = createClient(
    requireEnv("VITE_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
  const runStartedAt = new Date().toISOString();
  let docHash = null;

  try {
    const apiKey = requireEnv("GEMINI_API_KEY");
    const docId = requireEnv("REVIEW_DOC_ID");

    const docText = await fetchDocPlainText(docId);
    docHash = sha256Hex(docText);

    if (!force) {
      const { data: last } = await supabase
        .from("review_ingest_runs")
        .select("doc_hash, error")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last?.doc_hash === docHash && !last?.error) {
        console.log(`Doc unchanged (hash ${docHash.slice(0, 12)}…); skipping. Use --force to override.`);
        if (!dryRun) {
          await supabase.from("review_ingest_runs").insert({
            started_at: runStartedAt, finished_at: new Date().toISOString(),
            sections_total: 0, sections_resummarized: 0, unknown_course_codes: [], doc_hash: docHash,
          });
        }
        return;
      }
    }

    const { data: catRows, error: catErr } = await supabase
      .from("catalog_courses").select("id, code, name");
    if (catErr) throw catErr;
    const catalog = (catRows ?? []).filter((r) => r?.id && r?.code && r?.name);
    if (!catalog.length) throw new Error("catalog_courses is empty");

    const slices = buildCatalogSlices(catalog, SLICES);
    console.log(`Catalog ${catalog.length} courses → ${slices.length} slices; model=${MODEL}`);

    const perSlice = [];
    for (let i = 0; i < slices.length; i++) {
      console.log(`Slice ${i + 1}/${slices.length} (${slices[i].length} courses)…`);
      perSlice.push(await extractSlice(slices[i], docText, apiKey));
    }

    const merged = mergeCourses(perSlice);
    const resolveId = buildIdResolver(catalog);
    const nowIso = new Date().toISOString();
    const { courseRows, profRows, droppedIds } = buildRows(merged, resolveId, nowIso);

    console.log(`Extracted ${merged.length} courses → ${courseRows.length} course rows, ${profRows.length} professor rows; dropped ${droppedIds.length} unknown ids`);

    if (dryRun) {
      console.log(JSON.stringify({ courseRows, profRows, droppedIds }, null, 2));
      console.log("--dry-run: nothing written.");
      return;
    }

    if (courseRows.length) {
      const { error } = await supabase.from("course_reviews").upsert(courseRows, { onConflict: "course_id" });
      if (error) throw error;
    }
    if (profRows.length) {
      const { error } = await supabase.from("course_professor_reviews").upsert(profRows, { onConflict: "course_id,professor_name" });
      if (error) throw error;
    }

    await supabase.from("review_ingest_runs").insert({
      started_at: runStartedAt, finished_at: new Date().toISOString(),
      sections_total: merged.length, sections_resummarized: courseRows.length + profRows.length,
      unknown_course_codes: droppedIds, doc_hash: docHash,
    });
    console.log("Done.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!dryRun) {
      await supabase.from("review_ingest_runs").insert({
        started_at: runStartedAt, finished_at: new Date().toISOString(),
        sections_total: 0, sections_resummarized: 0, unknown_course_codes: [],
        doc_hash: docHash, error: message,
      });
    }
    throw err;
  }
}

main().catch((err) => {
  console.error("ingest-reviews failed:", err?.message || err);
  process.exitCode = 1;
});
