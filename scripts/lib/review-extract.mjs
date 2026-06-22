import { createHash } from "node:crypto";

export const EVIDENCE_SEP = "\n";

export function sha256Hex(input) {
  return createHash("sha256").update(String(input), "utf8").digest("hex");
}

export function isStub(s) {
  if (!s) return true;
  const t = String(s).trim().toLowerCase();
  return (
    t === "" || t === "unstated" || t === "n/a" || t === "none" ||
    t === "not stated" || t === "unknown"
  );
}

export function cleanText(s) {
  return isStub(s) ? "" : String(s).trim();
}

export function asString(v) {
  return typeof v === "string" ? v : "";
}

export function asStringArray(v) {
  return Array.isArray(v) ? v.map((x) => asString(x).trim()).filter(Boolean) : [];
}

// Round-robin: catalog[i] -> slice[i % k]. Spreads high-traffic departments
// across slices so no single slice's model output is disproportionately large.
// Slicing only bounds OUTPUT — every course is in exactly one slice and the
// full doc is always sent, so no review context is lost.
export function buildCatalogSlices(catalog, k) {
  const n = Math.max(1, Number(k) || 1);
  const slices = Array.from({ length: n }, () => []);
  catalog.forEach((c, i) => slices[i % n].push(c));
  return slices.filter((s) => s.length > 0);
}

export const COMBINED_SCHEMA = {
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
          evidence: { type: "array", items: { type: "string" } },
          professors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                summary_en: { type: "string" },
                teaching_style_en: { type: "string" },
                pros_en: { type: "array", items: { type: "string" } },
                cons_en: { type: "array", items: { type: "string" } },
                evidence: { type: "array", items: { type: "string" } },
              },
              required: [
                "name", "summary_en", "teaching_style_en",
                "pros_en", "cons_en", "evidence",
              ],
            },
          },
        },
        required: [
          "course_id", "summary_en", "difficulty_en", "workload_en",
          "key_points_en", "evidence", "professors",
        ],
      },
    },
  },
  required: ["courses"],
};

export function buildPrompt(catalogSlice, docText) {
  const catalogText = catalogSlice
    .map((c) => `${c.id}\t${c.code}\t${c.name}`)
    .join("\n");
  return [
    `You are extracting structured course and professor reviews from a freeform, bilingual (Chinese + English) student community Google Doc for NYU Shanghai.`,
    `The doc has NO fixed structure: section headings, course names, professor names, questions, replies, and free comments are interleaved, with Chinese and English mixed together.`,
    ``,
    `CRITICAL RULES:`,
    `- Every course_id you return MUST come EXACTLY from the catalog below. Never invent IDs. If you cannot confidently identify the course, DROP the entry.`,
    `- A professor may be referred to in Chinese, English, or both (e.g. "Marsh" and "马什老师" are the SAME person). Merge them into ONE entry with a single canonical name, preferring the Latin-script spelling when known.`,
    `- Strip honorifics from names: "Prof.", "Professor", "教授", "老师", "先生", "女士".`,
    `- "evidence" MUST be 1-2 SHORT verbatim excerpts copied exactly from the doc in their ORIGINAL language (do NOT translate them). They justify your summary. Keep total evidence under ~280 characters.`,
    `- Translate summaries/pros/cons into natural English. Do NOT invent anything not present in the doc.`,
    ``,
    `Match doc references to a course_id by, in priority order:`,
    `  (a) explicit course code like "SOCS-SHU 145" (rare — students seldom write codes),`,
    `  (b) course name match (English or Chinese),`,
    `  (c) a section heading naming a course, scoping the reviews that follow it,`,
    `  (d) common student abbreviations/nicknames (e.g. GPS, WAI, DBC, STS, PFA) — often the only signal.`,
    ``,
    `Brevity caps (truncate/omit beyond these):`,
    `  - course summary_en, professor summary_en: <= 200 chars`,
    `  - difficulty_en, workload_en, teaching_style_en: <= 80 chars`,
    `  - key_points_en, pros_en, cons_en: <= 4 items, each <= 80 chars`,
    ``,
    `Output: one entry in "courses" per course discussed in this slice, each with its professors nested under it.`,
    `- difficulty_en / workload_en: short phrase ("Moderate", "10-15 hrs/week"); empty string if unstated.`,
    `- SKIP entries that are only unanswered questions or have no real review content.`,
    `- An empty "courses" array is acceptable if nothing in this slice was reviewed.`,
    ``,
    `Catalog (TSV: course_id<TAB>code<TAB>name):`,
    catalogText,
    ``,
    `Doc content:`,
    `"""`,
    docText,
    `"""`,
  ].join("\n");
}
