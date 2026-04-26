// Edge function: ingest-reviews
//
// Pulls the public community-review Google Doc (Chinese, very freeform) and
// asks Gemini 2.5 Flash to extract structured per-course and per-professor
// reviews against the catalog of NYU Shanghai courses we maintain in
// public.catalog_courses. Results land in course_reviews and
// course_professor_reviews. A doc-level SHA-256 gate avoids re-running Gemini
// when the doc hasn't changed since the last successful run.
//
// Invocation:
//   POST /functions/v1/ingest-reviews                   -- normal run (gated)
//   POST /functions/v1/ingest-reviews { "force": true } -- ignore the gate
//
// Required secrets:
//   GEMINI_API_KEY    -- Google AI Studio key
//   REVIEW_DOC_ID     -- Google Doc ID (not the full URL)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the runtime.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

// Flash Lite has higher free-tier RPM (15 vs 5) and faster generation, which
// matters because we run multiple chunks in parallel and the edge function's
// idle timeout is ~150s.
const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_GEMINI_RETRIES = 3;

type ProfessorReview = {
  name: string;
  summary_en: string;
  teaching_style_en: string;
  pros_en: string[];
  cons_en: string[];
};

type CourseReview = {
  course_id: string;
  summary_en: string;
  difficulty_en: string;
  workload_en: string;
  key_points_en: string[];
  professors: ProfessorReview[];
};

// Two-pass extraction: course-level pass returns just course summaries,
// professor-level pass returns just per-professor summaries. Splitting cuts
// per-call output roughly in half so each chunk stays under MAX_TOKENS.
// raw_zh is dropped entirely — keeping it in the response roughly doubles
// output token count. The DB columns stay (older rows keep their excerpts)
// but new rows store the empty string.
const COURSE_SCHEMA = {
  type: "object",
  properties: {
    courses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          course_id: { type: "string" },
          summary_en: { type: "string" },
          difficulty_en: { type: "string" },
          workload_en: { type: "string" },
          key_points_en: { type: "array", items: { type: "string" } },
        },
        required: [
          "course_id",
          "summary_en",
          "difficulty_en",
          "workload_en",
          "key_points_en",
        ],
      },
    },
  },
  required: ["courses"],
};

const PROFESSOR_SCHEMA = {
  type: "object",
  properties: {
    professors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          course_id: { type: "string" },
          name: { type: "string" },
          summary_en: { type: "string" },
          teaching_style_en: { type: "string" },
          pros_en: { type: "array", items: { type: "string" } },
          cons_en: { type: "array", items: { type: "string" } },
        },
        required: [
          "course_id",
          "name",
          "summary_en",
          "teaching_style_en",
          "pros_en",
          "cons_en",
        ],
      },
    },
  },
  required: ["professors"],
};

type ProfessorRecord = ProfessorReview & { course_id: string };

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchDocPlainText(docId: string): Promise<string> {
  const url = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Doc fetch failed: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseRetryDelayMs(errText: string): number | null {
  try {
    const parsed = JSON.parse(errText);
    const details = parsed?.error?.details ?? [];
    for (const d of details) {
      if (d["@type"]?.includes("RetryInfo") && typeof d.retryDelay === "string") {
        const m = d.retryDelay.match(/^([\d.]+)s$/);
        if (m) return Math.ceil(parseFloat(m[1]) * 1000);
      }
    }
  } catch {
    // not JSON; fall through
  }
  return null;
}

function buildCommonHeader(
  catalog: { id: string; code: string; name: string }[],
  docText: string,
): string[] {
  const catalogText = catalog
    .map((c) => `${c.id}\t${c.code}\t${c.name}`)
    .join("\n");
  return [
    `You are extracting structured reviews from a Chinese-language student community Google Doc for NYU Shanghai. The doc is freeform: a mix of section headings, course names, professor names, questions, replies, and free comments. There is no fixed structure.`,
    ``,
    `Use the following course catalog. course_id values you return MUST come exactly from this list — never invent IDs. Match references in the doc to a course_id by:`,
    `  (a) explicit code mention like "SOCS-SHU 145" or "SOCS-SHU145",`,
    `  (b) course name match like "Foundations of Public Policy",`,
    `  (c) clear context (e.g. a section heading naming the course followed by review content),`,
    `  (d) abbreviations students commonly use (e.g. "DBC" → "Doing Business with China"). Do not guess if you are unsure.`,
    ``,
    `Catalog (TSV: course_id<TAB>code<TAB>name):`,
    catalogText,
    ``,
    `Doc content:`,
    `"""`,
    docText,
    `"""`,
    ``,
  ];
}

function buildCoursePrompt(
  catalog: { id: string; code: string; name: string }[],
  docText: string,
): string {
  return [
    ...buildCommonHeader(catalog, docText),
    `Task: extract per-COURSE summaries only. Do NOT mention specific professors here — that is a separate pass.`,
    ``,
    `Output rules:`,
    `- Return one entry in "courses" per course discussed in the doc.`,
    `- BREVITY IS CRITICAL. Hard caps:`,
    `    * "summary_en": at most 200 characters.`,
    `    * "difficulty_en", "workload_en": at most 80 characters each.`,
    `    * "key_points_en": at most 4 items, each at most 80 characters.`,
    `  Truncate or omit anything past these limits — output budget is finite.`,
    `- "summary_en": 1 neutral English sentence capturing overall student opinion of the course (course-wide, not professor-specific).`,
    `- "difficulty_en": short phrase like "Moderate", "Heavy reading", "Easy". Empty string if unstated.`,
    `- "workload_en": short phrase like "10-15 hrs/week", "Light", "Heavy weekly readings". Empty string if unstated.`,
    `- "key_points_en": brief English bullets a future student would care about (grading scheme, exam style, project size, curve, attendance). Skip filler.`,
    `- SKIP entries that have only unanswered questions or no actual review content.`,
    `- SKIP if you cannot confidently identify the course_id — better to drop than mis-attribute.`,
    `- Do NOT invent information not in the source.`,
    `- Empty array is fine if no entry meets the bar.`,
  ].join("\n");
}

function buildProfessorPrompt(
  catalog: { id: string; code: string; name: string }[],
  docText: string,
): string {
  return [
    ...buildCommonHeader(catalog, docText),
    `Task: extract per-PROFESSOR commentary only. Each professor entry must include the course_id of the course they teach (from the catalog).`,
    ``,
    `Output rules:`,
    `- Return one entry in "professors" per (course, professor) pair discussed.`,
    `- Strip honorifics: "Prof.", "Professor", "教授", "老师", "先生", "女士". Keep the name in its original script (Chinese or Latin).`,
    `- BREVITY IS CRITICAL. Hard caps:`,
    `    * "summary_en": at most 200 characters.`,
    `    * "teaching_style_en": at most 80 characters.`,
    `    * "pros_en", "cons_en": at most 4 items each, each at most 80 characters.`,
    `  Truncate or omit anything past these limits.`,
    `- SKIP if the doc only asks about a professor without an answer.`,
    `- SKIP if you cannot confidently identify the course_id — better to drop than mis-attribute.`,
    `- Do NOT invent information not in the source.`,
    `- Empty array is fine if no entry meets the bar.`,
  ].join("\n");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The Gemini call's wall time is bounded by the Supabase edge function's
// wall-time limit (~150s). To stay under it we prune both the catalog and
// the doc text aggressively before sending. Catalog → only courses whose
// code or name is mentioned. Doc → only paragraphs near a mention, plus a
// small context window. This typically takes the prompt from ~530KB to
// ~50-80KB and keeps Gemini's response time well under the cap.
function pruneCatalogToMentioned(
  catalog: { id: string; code: string; name: string }[],
  docText: string,
): { id: string; code: string; name: string }[] {
  const haystack = docText.toLowerCase();
  return catalog.filter((c) => {
    const code = c.code.toLowerCase();
    const codeNoSpace = code.replace(/\s+/g, "");
    const codeDash = code.replace(/\s+/g, "-");
    if (
      haystack.includes(code) ||
      haystack.includes(codeNoSpace) ||
      haystack.includes(codeDash)
    ) {
      return true;
    }
    const name = c.name.trim().toLowerCase();
    if (name.length >= 8) {
      const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");
      if (re.test(haystack)) return true;
    }
    return false;
  });
}

const TRIM_LINES_BEFORE = 3;
const TRIM_LINES_AFTER = 5;

function trimDocToRelevant(
  docText: string,
  catalog: { id: string; code: string; name: string }[],
): string {
  if (catalog.length === 0) return docText;

  const lines = docText.split(/\r?\n/);
  const patterns: RegExp[] = [];
  for (const c of catalog) {
    const code = c.code;
    patterns.push(new RegExp(escapeRegExp(code), "i"));
    const codeNoSpace = code.replace(/\s+/g, "");
    if (codeNoSpace !== code) {
      patterns.push(new RegExp(escapeRegExp(codeNoSpace), "i"));
    }
    const name = c.name.trim();
    if (name.length >= 8) {
      patterns.push(new RegExp(`\\b${escapeRegExp(name)}\\b`, "i"));
    }
  }

  const relevant = new Array(lines.length).fill(false);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    for (const p of patterns) {
      if (p.test(line)) {
        relevant[i] = true;
        break;
      }
    }
  }

  const keep = new Array(lines.length).fill(false);
  for (let i = 0; i < lines.length; i++) {
    if (!relevant[i]) continue;
    const start = Math.max(0, i - TRIM_LINES_BEFORE);
    const end = Math.min(lines.length, i + TRIM_LINES_AFTER + 1);
    for (let j = start; j < end; j++) keep[j] = true;
  }

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (keep[i]) out.push(lines[i]);
  }
  return out.join("\n");
}

async function callGeminiRaw(
  apiKey: string,
  prompt: string,
  schema: unknown,
): Promise<unknown> {
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: schema,
      maxOutputTokens: 8192,
    },
  };

  for (let attempt = 0; attempt <= MAX_GEMINI_RETRIES; attempt++) {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const json = await res.json();
      const finishReason: string | undefined = json?.candidates?.[0]?.finishReason;
      const text: string | undefined =
        json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error(`Gemini returned no text: ${JSON.stringify(json).slice(0, 800)}`);
      }
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(
          `Gemini returned non-JSON text (finishReason=${finishReason}; first 400 chars): ${text.slice(0, 400)}`,
        );
      }
    }

    const errText = await res.text();
    const retriable = res.status === 429 || (res.status >= 500 && res.status < 600);
    if (!retriable || attempt === MAX_GEMINI_RETRIES) {
      throw new Error(`Gemini call failed: ${res.status} ${errText}`);
    }
    const hint = parseRetryDelayMs(errText);
    const backoff = hint ?? Math.min(30_000, 1_000 * 2 ** attempt);
    await sleep(backoff + 500);
  }
  throw new Error("Gemini retry loop exhausted");
}

async function callGeminiCourses(
  apiKey: string,
  catalog: { id: string; code: string; name: string }[],
  docText: string,
): Promise<CourseReview[]> {
  const parsed = (await callGeminiRaw(
    apiKey,
    buildCoursePrompt(catalog, docText),
    COURSE_SCHEMA,
  )) as { courses?: CourseReview[] };
  return (parsed.courses ?? []).map((c) => ({
    course_id: c.course_id,
    summary_en: c.summary_en ?? "",
    difficulty_en: c.difficulty_en ?? "",
    workload_en: c.workload_en ?? "",
    key_points_en: Array.isArray(c.key_points_en) ? c.key_points_en : [],
    professors: [],
  }));
}

async function callGeminiProfessors(
  apiKey: string,
  catalog: { id: string; code: string; name: string }[],
  docText: string,
): Promise<ProfessorRecord[]> {
  const parsed = (await callGeminiRaw(
    apiKey,
    buildProfessorPrompt(catalog, docText),
    PROFESSOR_SCHEMA,
  )) as { professors?: ProfessorRecord[] };
  return (parsed.professors ?? []).map((p) => ({
    course_id: p.course_id,
    name: p.name,
    summary_en: p.summary_en ?? "",
    teaching_style_en: p.teaching_style_en ?? "",
    pros_en: Array.isArray(p.pros_en) ? p.pros_en : [],
    cons_en: Array.isArray(p.cons_en) ? p.cons_en : [],
  }));
}

function splitIntoChunks(text: string, chunks: number): string[] {
  if (chunks <= 1) return [text];
  const lines = text.split(/\r?\n/);
  const perChunk = Math.ceil(lines.length / chunks);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += perChunk) {
    out.push(lines.slice(i, i + perChunk).join("\n"));
  }
  return out;
}

function mergeCourseReviews(parts: CourseReview[][]): CourseReview[] {
  const byId = new Map<string, CourseReview>();
  for (const part of parts) {
    for (const c of part) {
      if (!c?.course_id) continue;
      const existing = byId.get(c.course_id);
      if (!existing) {
        byId.set(c.course_id, {
          ...c,
          professors: Array.isArray(c.professors) ? [...c.professors] : [],
          key_points_en: Array.isArray(c.key_points_en) ? [...c.key_points_en] : [],
        });
        continue;
      }
      if (!existing.summary_en && c.summary_en) existing.summary_en = c.summary_en;
      else if (c.summary_en && c.summary_en.length > existing.summary_en.length) {
        existing.summary_en = c.summary_en;
      }
      if (!existing.difficulty_en && c.difficulty_en) existing.difficulty_en = c.difficulty_en;
      if (!existing.workload_en && c.workload_en) existing.workload_en = c.workload_en;
      if (Array.isArray(c.key_points_en)) {
        const seen = new Set(existing.key_points_en);
        for (const p of c.key_points_en) {
          if (!seen.has(p)) {
            seen.add(p);
            existing.key_points_en.push(p);
          }
        }
      }
      if (Array.isArray(c.professors)) {
        const profByName = new Map(
          existing.professors.map((p) => [p.name.trim().toLowerCase(), p] as const),
        );
        for (const p of c.professors) {
          if (!p?.name) continue;
          const key = p.name.trim().toLowerCase();
          const e = profByName.get(key);
          if (!e) {
            existing.professors.push({
              name: p.name,
              summary_en: p.summary_en ?? "",
              teaching_style_en: p.teaching_style_en ?? "",
              pros_en: Array.isArray(p.pros_en) ? [...p.pros_en] : [],
              cons_en: Array.isArray(p.cons_en) ? [...p.cons_en] : [],
            });
            profByName.set(key, existing.professors[existing.professors.length - 1]);
          } else {
            if (p.summary_en && p.summary_en.length > e.summary_en.length) {
              e.summary_en = p.summary_en;
            }
            if (!e.teaching_style_en && p.teaching_style_en) {
              e.teaching_style_en = p.teaching_style_en;
            }
            const prosSeen = new Set(e.pros_en);
            for (const x of p.pros_en ?? []) {
              if (!prosSeen.has(x)) { prosSeen.add(x); e.pros_en.push(x); }
            }
            const consSeen = new Set(e.cons_en);
            for (const x of p.cons_en ?? []) {
              if (!consSeen.has(x)) { consSeen.add(x); e.cons_en.push(x); }
            }
          }
        }
      }
    }
  }
  return Array.from(byId.values());
}

function mergeProfessorRecords(parts: ProfessorRecord[][]): ProfessorRecord[] {
  const byKey = new Map<string, ProfessorRecord>();
  for (const part of parts) {
    for (const p of part) {
      if (!p?.course_id || !p?.name) continue;
      const key = `${p.course_id}::${p.name.trim().toLowerCase()}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          course_id: p.course_id,
          name: p.name.trim(),
          summary_en: p.summary_en ?? "",
          teaching_style_en: p.teaching_style_en ?? "",
          pros_en: Array.isArray(p.pros_en) ? [...p.pros_en] : [],
          cons_en: Array.isArray(p.cons_en) ? [...p.cons_en] : [],
        });
        continue;
      }
      if (p.summary_en && p.summary_en.length > existing.summary_en.length) {
        existing.summary_en = p.summary_en;
      }
      if (!existing.teaching_style_en && p.teaching_style_en) {
        existing.teaching_style_en = p.teaching_style_en;
      }
      const prosSeen = new Set(existing.pros_en);
      for (const x of p.pros_en ?? []) {
        if (!prosSeen.has(x)) { prosSeen.add(x); existing.pros_en.push(x); }
      }
      const consSeen = new Set(existing.cons_en);
      for (const x of p.cons_en ?? []) {
        if (!consSeen.has(x)) { consSeen.add(x); existing.cons_en.push(x); }
      }
    }
  }
  return Array.from(byKey.values());
}

// Two-pass extraction across N parallel doc chunks. Pass A asks Gemini for
// per-course summaries only; pass B asks for per-professor commentary only.
// Splitting the schema in half keeps each chunk's output well under the
// MAX_TOKENS cap. All 2N calls run in parallel — well under Gemini Flash's
// per-minute rate limit on a typical free key.
async function callGemini(
  apiKey: string,
  catalog: { id: string; code: string; name: string }[],
  docText: string,
): Promise<{
  courses: CourseReview[];
  professors: ProfessorRecord[];
  chunkErrors: string[];
}> {
  const CHUNKS = 8;
  const chunks = splitIntoChunks(docText, CHUNKS);

  // Run both passes' chunks in parallel — total wall time is the slowest
  // single Gemini call, not the sum across passes.
  const [courseSettled, profSettled] = await Promise.all([
    Promise.allSettled(chunks.map((c) => callGeminiCourses(apiKey, catalog, c))),
    Promise.allSettled(chunks.map((c) => callGeminiProfessors(apiKey, catalog, c))),
  ]);

  const courseOk: CourseReview[][] = [];
  const profOk: ProfessorRecord[][] = [];
  const errs: string[] = [];
  courseSettled.forEach((s, i) => {
    if (s.status === "fulfilled") courseOk.push(s.value);
    else errs.push(`courses[${i}]: ${s.reason instanceof Error ? s.reason.message : String(s.reason)}`);
  });
  profSettled.forEach((s, i) => {
    if (s.status === "fulfilled") profOk.push(s.value);
    else errs.push(`profs[${i}]: ${s.reason instanceof Error ? s.reason.message : String(s.reason)}`);
  });

  return {
    courses: mergeCourseReviews(courseOk),
    professors: mergeProfessorRecords(profOk),
    chunkErrors: errs,
  };
}

async function runIngest(opts: {
  supabase: ReturnType<typeof createClient>;
  runStartedAt: string;
  docHash: string;
  docText: string;
  geminiKey: string;
}): Promise<void> {
  const { supabase, runStartedAt, docHash, docText, geminiKey } = opts;
  try {
    const { data: catalogRows, error: catErr } = await supabase
      .from("catalog_courses")
      .select("id, code, name");
    if (catErr) throw catErr;
    const fullCatalog = (catalogRows ?? []).filter(
      (r): r is { id: string; code: string; name: string } =>
        typeof r?.id === "string" && typeof r?.code === "string" && typeof r?.name === "string",
    );
    if (fullCatalog.length === 0) {
      throw new Error("Catalog empty: catalog_courses has no rows");
    }
    const prunedCatalog = pruneCatalogToMentioned(fullCatalog, docText);
    const catalog = prunedCatalog.length > 0 ? prunedCatalog : fullCatalog;
    const validIds = new Set(catalog.map((c) => c.id));
    // Some Gemini responses come back with spaces or other separators in
    // course IDs (e.g., "CSCI-SHU 220" instead of "CSCI-SHU-220"). Build a
    // lookup that maps any plausible spelling back to the canonical id.
    const idAliases = new Map<string, string>();
    for (const c of catalog) {
      const id = c.id;
      idAliases.set(id.toLowerCase(), id);
      idAliases.set(id.replace(/-/g, " ").toLowerCase(), id);
      idAliases.set(id.replace(/-/g, "").toLowerCase(), id);
      idAliases.set(c.code.toLowerCase(), id);
      idAliases.set(c.code.replace(/\s+/g, "").toLowerCase(), id);
      idAliases.set(c.code.replace(/\s+/g, "-").toLowerCase(), id);
    }
    const resolveCourseId = (raw: string): string | null => {
      if (!raw) return null;
      const direct = idAliases.get(raw.toLowerCase());
      if (direct) return direct;
      const collapsed = raw.replace(/\s+/g, "").toLowerCase();
      return idAliases.get(collapsed) ?? null;
    };
    const trimmedDoc = trimDocToRelevant(docText, catalog);

    const { courses, professors, chunkErrors } = await callGemini(
      geminiKey,
      catalog,
      trimmedDoc,
    );

    const nowIso = new Date().toISOString();
    const courseRows: Record<string, unknown>[] = [];
    const profRows: Record<string, unknown>[] = [];
    const profSeen = new Set<string>();
    const droppedCourseIds: string[] = [];

    // Lite sometimes ignores the "use empty string when unstated" instruction
    // and emits placeholder phrases instead. Treat those as empty.
    const isStub = (s: string | undefined): boolean => {
      if (!s) return true;
      const t = s.trim().toLowerCase();
      return (
        t === "" ||
        t === "unstated" ||
        t === "n/a" ||
        t === "none" ||
        t === "not stated" ||
        t === "unknown"
      );
    };
    const cleanText = (s: string | undefined): string =>
      isStub(s) ? "" : (s as string).trim();

    const courseSeen = new Set<string>();
    for (const c of courses) {
      const resolvedId = resolveCourseId(c?.course_id ?? "");
      if (!resolvedId) {
        if (c?.course_id) droppedCourseIds.push(c.course_id);
        continue;
      }
      if (courseSeen.has(resolvedId)) continue;

      const summary = cleanText(c.summary_en);
      const difficulty = cleanText(c.difficulty_en);
      const workload = cleanText(c.workload_en);
      const keyPoints = (Array.isArray(c.key_points_en) ? c.key_points_en : [])
        .map((k) => (typeof k === "string" ? k.trim() : ""))
        .filter((k) => k && !isStub(k));

      // Skip course rows that are pure questions / no real content. The UI
      // wouldn't render anything useful for them anyway.
      if (!summary && !difficulty && !workload && keyPoints.length === 0) {
        continue;
      }
      courseSeen.add(resolvedId);

      const courseDigestSrc = JSON.stringify({
        s: summary,
        d: difficulty,
        w: workload,
        k: keyPoints,
      });
      const courseHash = await sha256Hex(courseDigestSrc);
      courseRows.push({
        course_id: resolvedId,
        summary_en: summary,
        difficulty_en: difficulty,
        workload_en: workload,
        key_points_en: keyPoints,
        content_hash: courseHash,
        raw_zh: "",
        updated_at: nowIso,
      });
    }

    for (const p of professors) {
      const resolvedId = resolveCourseId(p?.course_id ?? "");
      if (!resolvedId) {
        if (p?.course_id) droppedCourseIds.push(p.course_id);
        continue;
      }
      const name = (p.name ?? "").trim();
      if (!name) continue;
      const dedupeKey = `${resolvedId}::${name.toLowerCase()}`;
      if (profSeen.has(dedupeKey)) continue;

      const summary = cleanText(p.summary_en);
      const teachingStyle = cleanText(p.teaching_style_en);
      const pros = (Array.isArray(p.pros_en) ? p.pros_en : [])
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter((x) => x && !isStub(x));
      const cons = (Array.isArray(p.cons_en) ? p.cons_en : [])
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter((x) => x && !isStub(x));

      if (!summary && !teachingStyle && pros.length === 0 && cons.length === 0) {
        continue;
      }
      profSeen.add(dedupeKey);

      const profDigestSrc = JSON.stringify({
        s: summary,
        t: teachingStyle,
        p: pros,
        c: cons,
      });
      const profHash = await sha256Hex(profDigestSrc);
      profRows.push({
        course_id: resolvedId,
        professor_name: name,
        summary_en: summary,
        teaching_style_en: teachingStyle,
        pros_en: pros,
        cons_en: cons,
        content_hash: profHash,
        raw_zh: "",
        updated_at: nowIso,
      });
    }

    if (courseRows.length > 0) {
      const { error } = await supabase
        .from("course_reviews")
        .upsert(courseRows, { onConflict: "course_id" });
      if (error) throw error;
    }
    if (profRows.length > 0) {
      const { error } = await supabase
        .from("course_professor_reviews")
        .upsert(profRows, { onConflict: "course_id,professor_name" });
      if (error) throw error;
    }

    const allChunksFailed =
      chunkErrors.length > 0 && courses.length === 0 && professors.length === 0;
    if (allChunksFailed) {
      // Throw to the outer catch so the failure is logged exactly once.
      throw new Error(
        `All Gemini chunks failed: ${chunkErrors.join(" || ").slice(0, 800)}`,
      );
    }
    await supabase.from("review_ingest_runs").insert({
      started_at: runStartedAt,
      finished_at: new Date().toISOString(),
      sections_total: courses.length,
      sections_resummarized: courseRows.length + profRows.length,
      // Partial failures (some chunks truncated) are logged here as warnings
      // rather than into "error", so the doc-hash gate still considers the
      // run successful and we don't burn quota retrying with the same input.
      unknown_course_codes:
        chunkErrors.length > 0
          ? [
              ...droppedCourseIds,
              `__chunk_errors__: ${chunkErrors.join(" || ").slice(0, 1000)}`,
            ]
          : droppedCourseIds,
      doc_hash: docHash,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("review_ingest_runs")
      .insert({
        started_at: runStartedAt,
        finished_at: new Date().toISOString(),
        sections_total: 0,
        sections_resummarized: 0,
        unknown_course_codes: [],
        doc_hash: docHash || null,
        error: message,
      })
      .then(() => {});
  }
}

// EdgeRuntime is provided by Supabase's Deno runtime.
// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(async (req) => {
  const runStartedAt = new Date().toISOString();
  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  let force = false;
  let waitForResult = false;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      force = Boolean(body?.force);
      waitForResult = Boolean(body?.wait);
    } catch {
      // empty/invalid body is fine; non-forced async run
    }
  }

  try {
    const docId = requireEnv("REVIEW_DOC_ID");
    const geminiKey = requireEnv("GEMINI_API_KEY");

    const docText = await fetchDocPlainText(docId);
    const docHash = await sha256Hex(docText);

    if (!force) {
      const { data: lastRun } = await supabase
        .from("review_ingest_runs")
        .select("doc_hash, error")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastRun?.doc_hash === docHash && !lastRun?.error) {
        await supabase.from("review_ingest_runs").insert({
          started_at: runStartedAt,
          finished_at: new Date().toISOString(),
          sections_total: 0,
          sections_resummarized: 0,
          unknown_course_codes: [],
          doc_hash: docHash,
        });
        return new Response(
          JSON.stringify({ ok: true, skipped: true, doc_hash: docHash }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
    }

    // The Gemini call against the full doc + catalog can take longer than the
    // 150s edge function idle timeout. Hand the work off as a background task
    // (or run inline if the caller passed { "wait": true }) and return now.
    const work = runIngest({
      supabase,
      runStartedAt,
      docHash,
      docText,
      geminiKey,
    });

    if (waitForResult) {
      await work;
      const { data: latest } = await supabase
        .from("review_ingest_runs")
        .select(
          "doc_hash, sections_total, sections_resummarized, unknown_course_codes, error",
        )
        .eq("started_at", runStartedAt)
        .maybeSingle();
      return new Response(
        JSON.stringify({ ok: true, mode: "sync", doc_hash: docHash, run: latest }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(work);
    } else {
      // Local dev fallback: just run it inline. Local has no idle timeout.
      await work;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        mode: "background",
        doc_hash: docHash,
        message: "Ingest started; poll review_ingest_runs for the result.",
      }),
      { status: 202, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("review_ingest_runs")
      .insert({
        started_at: runStartedAt,
        finished_at: new Date().toISOString(),
        sections_total: 0,
        sections_resummarized: 0,
        unknown_course_codes: [],
        doc_hash: null,
        error: message,
      })
      .then(() => {});
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
