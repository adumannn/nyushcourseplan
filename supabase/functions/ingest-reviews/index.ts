// Edge function: ingest-reviews
//
// Pulls the public community-review Google Doc (Chinese), splits it into
// sections keyed by course code (and optionally professor name), translates
// and summarizes each *changed* section with Gemini 2.5 Flash, and upserts
// the results into course_reviews / course_professor_reviews.
//
// Invocation:
//   POST /functions/v1/ingest-reviews           -- normal run (hash-gated)
//   POST /functions/v1/ingest-reviews { "force": true }  -- resummarize all
//
// Required secrets:
//   GEMINI_API_KEY    -- Google AI Studio key
//   REVIEW_DOC_ID     -- Google Doc ID (not the full URL)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the Supabase
// runtime automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { DOMParser, type Element } from "https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const COURSE_CODE_RE = /([A-Z]{2,6})-SHU[\s\-]?(\d+[A-Z]*)/i;
const PROF_STRIP_RE = /(prof\.?|professor|教授|老师|先生|女士)/gi;
const CONCURRENCY = 4;

type Section = {
  rawHeading: string;
  rawZh: string;
  courseId: string | null;
  professorName: string | null;
};

type GeminiResult = {
  summary_en: string;
  difficulty_en: string;
  workload_en: string;
  key_points_en: string[];
  teaching_style_en: string;
  pros_en: string[];
  cons_en: string[];
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary_en: { type: "string" },
    difficulty_en: { type: "string" },
    workload_en: { type: "string" },
    key_points_en: { type: "array", items: { type: "string" } },
    teaching_style_en: { type: "string" },
    pros_en: { type: "array", items: { type: "string" } },
    cons_en: { type: "array", items: { type: "string" } },
  },
  required: [
    "summary_en",
    "difficulty_en",
    "workload_en",
    "key_points_en",
    "teaching_style_en",
    "pros_en",
    "cons_en",
  ],
};

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function normalizeCourseCode(raw: string): string | null {
  const match = raw.match(COURSE_CODE_RE);
  if (!match) return null;
  return `${match[1].toUpperCase()}-SHU-${match[2].toUpperCase()}`;
}

function extractProfessorName(heading: string, courseCode: string | null): string | null {
  let rest = heading;
  if (courseCode) {
    rest = rest.replace(COURSE_CODE_RE, " ");
  }
  rest = rest
    .replace(/[-–—|•·]/g, " ")
    .replace(PROF_STRIP_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!rest || rest.length < 2) return null;
  return rest;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchDocHtml(docId: string): Promise<string> {
  const url = `https://docs.google.com/document/d/${docId}/export?format=html`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Doc fetch failed: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

function collectSections(html: string): Section[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) throw new Error("Failed to parse doc HTML");

  const body = doc.querySelector("body");
  if (!body) return [];

  const sections: Section[] = [];
  let currentHeading: string | null = null;
  let currentCourseId: string | null = null;
  let inheritedCourseId: string | null = null;
  let currentProfessor: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (currentHeading === null) return;
    const rawZh = buffer.join("\n").trim();
    sections.push({
      rawHeading: currentHeading,
      rawZh,
      courseId: currentCourseId,
      professorName: currentProfessor,
    });
    buffer = [];
  };

  for (const node of body.children) {
    const el = node as Element;
    const tag = el.tagName?.toLowerCase() ?? "";
    const text = (el.textContent ?? "").replace(/ /g, " ").trim();
    if (!text) continue;

    if (/^h[1-3]$/.test(tag)) {
      flush();
      currentHeading = text;
      const courseId = normalizeCourseCode(text);
      if (courseId) {
        currentCourseId = courseId;
        inheritedCourseId = courseId;
      } else {
        // Heading without a course code — inherit from the last one (handles
        // the "H1 = course, H2 = professor under that course" pattern).
        currentCourseId = inheritedCourseId;
      }
      currentProfessor = extractProfessorName(text, courseId);
      continue;
    }

    if (currentHeading !== null) {
      buffer.push(text);
    }
  }

  flush();

  // Only keep sections whose course code we could resolve and which actually
  // have review content under them.
  return sections.filter((s) => s.courseId && s.rawZh.length > 0);
}

function buildPrompt(section: Section): string {
  const target = section.professorName
    ? `the course ${section.courseId} as taught by Professor ${section.professorName}`
    : `the course ${section.courseId}`;

  return [
    `You are summarizing Chinese-language student reviews of ${target} at NYU Shanghai.`,
    `Translate the key insights into concise, neutral English. Do not invent information that is not in the source.`,
    `If the source says nothing about a field, return an empty string (or empty array).`,
    `Focus on what would help a future student decide whether to take this course/professor: difficulty, workload per week, teaching style, grading, strengths, weaknesses.`,
    ``,
    `Source reviews (Chinese):`,
    `"""`,
    section.rawZh,
    `"""`,
  ].join("\n");
}

async function callGemini(apiKey: string, section: Section): Promise<GeminiResult> {
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: buildPrompt(section) }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini call failed: ${res.status} ${errText}`);
  }
  const json = await res.json();
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`Gemini returned no text: ${JSON.stringify(json)}`);
  }

  const parsed = JSON.parse(text) as GeminiResult;
  return {
    summary_en: parsed.summary_en ?? "",
    difficulty_en: parsed.difficulty_en ?? "",
    workload_en: parsed.workload_en ?? "",
    key_points_en: parsed.key_points_en ?? [],
    teaching_style_en: parsed.teaching_style_en ?? "",
    pros_en: parsed.pros_en ?? [],
    cons_en: parsed.cons_en ?? [],
  };
}

async function processInBatches<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

Deno.serve(async (req) => {
  const runStartedAt = new Date().toISOString();
  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  let force = false;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      force = Boolean(body?.force);
    } catch {
      // empty/invalid body is fine; treat as a non-forced run
    }
  }

  let sectionsTotal = 0;
  let sectionsResummarized = 0;
  const unknownCourseCodes: string[] = [];

  try {
    const docId = requireEnv("REVIEW_DOC_ID");
    const geminiKey = requireEnv("GEMINI_API_KEY");

    const html = await fetchDocHtml(docId);
    const sections = collectSections(html);
    sectionsTotal = sections.length;

    // Track any headings that looked like they should have a course code but
    // didn't resolve, so the doc maintainers can find and fix them.
    const parser = new DOMParser();
    const preParseDoc = parser.parseFromString(html, "text/html");
    if (preParseDoc) {
      const headingEls = preParseDoc.querySelectorAll("h1, h2, h3");
      for (const hn of headingEls) {
        const txt = (hn.textContent ?? "").trim();
        if (!txt) continue;
        if (!normalizeCourseCode(txt) && /shu/i.test(txt)) {
          unknownCourseCodes.push(txt);
        }
      }
    }

    // Fetch existing hashes so we can skip unchanged sections.
    const [{ data: existingCourseRows }, { data: existingProfRows }] = await Promise.all([
      supabase.from("course_reviews").select("course_id, content_hash"),
      supabase.from("course_professor_reviews").select("course_id, professor_name, content_hash"),
    ]);

    const courseHashes = new Map<string, string | null>();
    for (const row of existingCourseRows ?? []) {
      courseHashes.set(row.course_id as string, (row.content_hash as string | null) ?? null);
    }
    const profHashes = new Map<string, string | null>();
    for (const row of existingProfRows ?? []) {
      const key = `${row.course_id}::${row.professor_name}`;
      profHashes.set(key, (row.content_hash as string | null) ?? null);
    }

    // Pre-compute hashes + decide which sections to re-summarize.
    const work = await Promise.all(
      sections.map(async (section) => {
        const hash = await sha256Hex(section.rawZh);
        const key = section.professorName
          ? `${section.courseId}::${section.professorName}`
          : `${section.courseId}`;
        const prev = section.professorName
          ? profHashes.get(key) ?? null
          : courseHashes.get(key) ?? null;
        const changed = force || prev !== hash;
        return { section, hash, changed };
      }),
    );

    const changed = work.filter((w) => w.changed);
    sectionsResummarized = changed.length;

    const summarized = await processInBatches(changed, CONCURRENCY, async (item) => {
      const summary = await callGemini(geminiKey, item.section);
      return { ...item, summary };
    });

    // Upsert results. Per-professor rows and course-level rows go to
    // different tables based on whether a professor name is present.
    const courseRows: Record<string, unknown>[] = [];
    const profRows: Record<string, unknown>[] = [];
    for (const item of summarized) {
      const { section, hash, summary } = item;
      if (section.professorName) {
        profRows.push({
          course_id: section.courseId,
          professor_name: section.professorName,
          summary_en: summary.summary_en,
          teaching_style_en: summary.teaching_style_en,
          pros_en: summary.pros_en,
          cons_en: summary.cons_en,
          content_hash: hash,
          raw_zh: section.rawZh,
          updated_at: new Date().toISOString(),
        });
      } else {
        courseRows.push({
          course_id: section.courseId,
          summary_en: summary.summary_en,
          difficulty_en: summary.difficulty_en,
          workload_en: summary.workload_en,
          key_points_en: summary.key_points_en,
          content_hash: hash,
          raw_zh: section.rawZh,
          updated_at: new Date().toISOString(),
        });
      }
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

    await supabase.from("review_ingest_runs").insert({
      started_at: runStartedAt,
      finished_at: new Date().toISOString(),
      sections_total: sectionsTotal,
      sections_resummarized: sectionsResummarized,
      unknown_course_codes: unknownCourseCodes,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        sections_total: sectionsTotal,
        sections_resummarized: sectionsResummarized,
        unknown_course_codes: unknownCourseCodes,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("review_ingest_runs")
      .insert({
        started_at: runStartedAt,
        finished_at: new Date().toISOString(),
        sections_total: sectionsTotal,
        sections_resummarized: sectionsResummarized,
        unknown_course_codes: unknownCourseCodes,
        error: message,
      })
      .then(() => {});
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
