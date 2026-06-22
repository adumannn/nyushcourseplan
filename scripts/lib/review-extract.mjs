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

export function normalizeCourses(parsed) {
  const courses = Array.isArray(parsed?.courses) ? parsed.courses : [];
  return courses.map((c) => ({
    course_id: asString(c?.course_id).trim(),
    summary_en: asString(c?.summary_en),
    difficulty_en: asString(c?.difficulty_en),
    workload_en: asString(c?.workload_en),
    key_points_en: asStringArray(c?.key_points_en),
    evidence: asStringArray(c?.evidence),
    professors: (Array.isArray(c?.professors) ? c.professors : []).map((p) => ({
      name: asString(p?.name),
      summary_en: asString(p?.summary_en),
      teaching_style_en: asString(p?.teaching_style_en),
      pros_en: asStringArray(p?.pros_en),
      cons_en: asStringArray(p?.cons_en),
      evidence: asStringArray(p?.evidence),
    })),
  }));
}

function unionInto(target, items) {
  const seen = new Set(target);
  for (const x of items) {
    if (!seen.has(x)) {
      seen.add(x);
      target.push(x);
    }
  }
}

function cloneProf(p) {
  return {
    ...p,
    pros_en: [...p.pros_en],
    cons_en: [...p.cons_en],
    evidence: [...p.evidence],
  };
}

// Defensive cross-slice merge. A course normally lives in exactly one slice,
// so this mostly guards against the model echoing the same id/professor twice.
export function mergeCourses(courseArrays) {
  const byId = new Map();
  for (const list of courseArrays) {
    for (const c of list) {
      if (!c?.course_id) continue;
      const existing = byId.get(c.course_id);
      if (!existing) {
        byId.set(c.course_id, {
          ...c,
          key_points_en: [...c.key_points_en],
          evidence: [...c.evidence],
          professors: c.professors.map(cloneProf),
        });
        continue;
      }
      if (c.summary_en.length > existing.summary_en.length) existing.summary_en = c.summary_en;
      if (!existing.difficulty_en) existing.difficulty_en = c.difficulty_en;
      if (!existing.workload_en) existing.workload_en = c.workload_en;
      unionInto(existing.key_points_en, c.key_points_en);
      unionInto(existing.evidence, c.evidence);
      const byName = new Map(existing.professors.map((p) => [p.name.trim().toLowerCase(), p]));
      for (const p of c.professors) {
        const k = p.name.trim().toLowerCase();
        if (!k) continue;
        const e = byName.get(k);
        if (!e) {
          const copy = cloneProf(p);
          existing.professors.push(copy);
          byName.set(k, copy);
        } else {
          if (p.summary_en.length > e.summary_en.length) e.summary_en = p.summary_en;
          if (!e.teaching_style_en) e.teaching_style_en = p.teaching_style_en;
          unionInto(e.pros_en, p.pros_en);
          unionInto(e.cons_en, p.cons_en);
          unionInto(e.evidence, p.evidence);
        }
      }
    }
  }
  return [...byId.values()];
}

// Maps any plausible spelling of an id/code back to the canonical catalog id.
// Kept as a safety net even though the model is given exact ids.
export function buildIdResolver(catalog) {
  const map = new Map();
  for (const c of catalog) {
    const id = c.id;
    map.set(id.toLowerCase(), id);
    map.set(id.replace(/-/g, " ").toLowerCase(), id);
    map.set(id.replace(/-/g, "").toLowerCase(), id);
    if (c.code) {
      map.set(c.code.toLowerCase(), id);
      map.set(c.code.replace(/\s+/g, "").toLowerCase(), id);
      map.set(c.code.replace(/\s+/g, "-").toLowerCase(), id);
    }
  }
  return (raw) => {
    if (!raw) return null;
    const direct = map.get(String(raw).toLowerCase());
    if (direct) return direct;
    return map.get(String(raw).replace(/\s+/g, "").toLowerCase()) ?? null;
  };
}

export function buildRows(courses, resolveId, nowIso) {
  const courseRows = [];
  const profRows = [];
  const droppedIds = [];
  const courseSeen = new Set();
  const profSeen = new Set();

  for (const c of courses) {
    const id = resolveId(c.course_id);
    if (!id) {
      if (c.course_id) droppedIds.push(c.course_id);
      continue;
    }

    if (!courseSeen.has(id)) {
      const summary = cleanText(c.summary_en);
      const difficulty = cleanText(c.difficulty_en);
      const workload = cleanText(c.workload_en);
      const keyPoints = asStringArray(c.key_points_en).filter((k) => !isStub(k));
      const evidence = asStringArray(c.evidence).filter((e) => !isStub(e));
      if (summary || difficulty || workload || keyPoints.length) {
        courseSeen.add(id);
        courseRows.push({
          course_id: id,
          summary_en: summary,
          difficulty_en: difficulty,
          workload_en: workload,
          key_points_en: keyPoints,
          content_hash: sha256Hex(JSON.stringify({ s: summary, d: difficulty, w: workload, k: keyPoints })),
          raw_zh: evidence.join(EVIDENCE_SEP),
          updated_at: nowIso,
        });
      }
    }

    for (const p of c.professors) {
      const name = asString(p.name).trim();
      if (!name) continue;
      const key = `${id}::${name.toLowerCase()}`;
      if (profSeen.has(key)) continue;
      const summary = cleanText(p.summary_en);
      const teaching = cleanText(p.teaching_style_en);
      const pros = asStringArray(p.pros_en).filter((x) => !isStub(x));
      const cons = asStringArray(p.cons_en).filter((x) => !isStub(x));
      const evidence = asStringArray(p.evidence).filter((e) => !isStub(e));
      if (!summary && !teaching && !pros.length && !cons.length) continue;
      profSeen.add(key);
      profRows.push({
        course_id: id,
        professor_name: name,
        summary_en: summary,
        teaching_style_en: teaching,
        pros_en: pros,
        cons_en: cons,
        content_hash: sha256Hex(JSON.stringify({ s: summary, t: teaching, p: pros, c: cons })),
        raw_zh: evidence.join(EVIDENCE_SEP),
        updated_at: nowIso,
      });
    }
  }
  return { courseRows, profRows, droppedIds };
}
