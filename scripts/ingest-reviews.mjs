// Standalone review ingestion (replaces the ingest-reviews edge function).
// Fetches the community Google Doc, gates on a SHA-256 hash, and asks Gemini
// to extract course + professor reviews against the full catalog. The FULL doc
// is sent on every call.
//
// Usage:
//   node scripts/ingest-reviews.mjs            # gated run
//   node scripts/ingest-reviews.mjs --force    # ignore the hash gate
//   node scripts/ingest-reviews.mjs --dry-run  # print rows, write nothing
//
// Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY,
//      REVIEW_DOC_ID, [REVIEW_MODEL=gemini-2.5-flash], [REVIEW_COURSES_PER_CALL]

import { createClient } from "@supabase/supabase-js";
import {
  sha256Hex, COMBINED_SCHEMA, buildPrompt,
  normalizeCourses, mergeCourses, buildIdResolver, buildRows, removeExtracted,
} from "./lib/review-extract.mjs";
import { extract } from "./lib/review-providers.mjs";

const MODEL = process.env.REVIEW_MODEL || "gemini-2.5-flash";
// This key's free tier allows only 20 requests/DAY per model
// (GenerateRequestsPerDayPerProjectPerModel-FreeTier) and the doc is
// review-dense (100+ reviewed courses), so extraction runs as continuation
// ROUNDS: each call returns at most COURSES_PER_CALL courses — small enough to
// never truncate — then the extracted ids are removed from the catalog and the
// next round re-sends the full doc with the remaining catalog, until a round
// comes back empty. Every request yields data; none are wasted on truncation.
const COURSES_PER_CALL = Number(
  process.env.REVIEW_COURSES_PER_CALL ||
    (MODEL.includes("2.5") ? "30" : "10"), // non-2.5 models cap output at 8192
);
const MAX_ROUNDS = 12;
const MIN_CALL_INTERVAL_MS = 4000;   // also stay far under any per-minute cap

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Global throttle: enforces a minimum gap between ANY two Gemini calls so
// back-to-back rounds can't trip a per-minute request quota.
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

// One continuation round: full doc + the not-yet-extracted catalog, asking for
// at most COURSES_PER_CALL courses (in catalog order) so output never hits the
// token cap.
async function extractRound(remaining, docText, apiKey) {
  const prompt = buildPrompt(remaining, docText, { maxCourses: COURSES_PER_CALL });
  await throttle();
  const { data, finishReason } = await extract({ model: MODEL, prompt, schema: COMBINED_SCHEMA, apiKey });
  return { courses: normalizeCourses(data), finishReason };
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

    const resolveId = buildIdResolver(catalog);
    console.log(`Catalog ${catalog.length} courses; model=${MODEL}; ≤${COURSES_PER_CALL} courses/round`);

    const perRound = [];
    let remaining = catalog;
    for (let round = 1; round <= MAX_ROUNDS && remaining.length > 0; round++) {
      console.log(`Round ${round}: ${remaining.length} catalog courses remaining…`);
      const { courses, finishReason } = await extractRound(remaining, docText, apiKey);
      console.log(`  → ${finishReason ?? "?"}, extracted ${courses.length}`);
      if (courses.length === 0) {
        // Clean STOP with nothing left = done. A truncated empty round means
        // the cap was ignored; keep what we have rather than loop forever.
        if (finishReason === "MAX_TOKENS") console.warn("  round truncated with no data; stopping early");
        break;
      }
      perRound.push(courses);
      const next = removeExtracted(remaining, courses, resolveId);
      if (next.length === remaining.length) {
        console.warn("  round yielded no known catalog ids; stopping to avoid a loop");
        break;
      }
      remaining = next;
    }

    const merged = mergeCourses(perRound);
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
