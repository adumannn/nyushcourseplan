/**
 * Program requirement normalizer.
 *
 * Transforms the structured `curriculum` data scraped from NYU Bulletin
 * program pages into the `MAJOR_REQUIREMENTS` format used by the frontend
 * planner (src/data/courses.js).
 */

// ─── Major ID <-> Program slug mapping ───

const MAJOR_TO_PROGRAM_SLUG = {
  cs: "computer-science-bs",
  business: "business-finance-bs",
  "business-marketing": "business-marketing-bs",
  biology: "biology-bs",
  chemistry: "chemistry-bs",
  "computer-systems-engineering": "computer-systems-engineering-bs",
  "data-science": "data-science-bs",
  economics: "economics-ba",
  "electrical-systems-engineering": "electrical-systems-engineering-bs",
  "global-china-studies": "global-china-studies-ba",
  "honors-mathematics": "honors-mathematics-bs",
  humanities: "humanities-ba",
  "interactive-media-arts": "interactive-media-arts-bs",
  "interactive-media-business": "interactive-media-business-bs",
  mathematics: "mathematics-bs",
  "neural-science": "neural-science-bs",
  physics: "physics-bs",
  "self-designed-honors": "self-designed-honors-ba",
  "social-science": "social-science-ba",
};

const PROGRAM_SLUG_TO_MAJOR = Object.fromEntries(
  Object.entries(MAJOR_TO_PROGRAM_SLUG).map(([k, v]) => [v, k]),
);

function getProgramSlugForMajor(majorId) {
  return MAJOR_TO_PROGRAM_SLUG[majorId] || null;
}

function getMajorIdForProgramSlug(slug) {
  return PROGRAM_SLUG_TO_MAJOR[slug] || null;
}

// ─── Section classification ───

const SECTION_ROLES = [
  { pattern: /^core\s+courses$/i, role: "core" },
  {
    pattern:
      /capstone|senior\s+project|senior\s+seminar|senior\s+thesis/i,
    role: "capstone",
  },
  {
    pattern:
      /foundational|required.*course|required.*major|major\s+requirement/i,
    role: "required",
  },
  { pattern: /elective/i, role: "elective" },
  { pattern: /concentration/i, role: "concentration" },
  { pattern: /focus|track/i, role: "focus" },
  { pattern: /method/i, role: "methods" },
];

function classifySection(name) {
  for (const { pattern, role } of SECTION_ROLES) {
    if (pattern.test(name)) return role;
  }
  return "other";
}

// ─── Word-to-number mapping ───

const WORD_TO_NUM = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function parseSelectCount(text) {
  if (!text) return 1;
  const wordMatch = text.match(
    /select\s+(one|two|three|four|five|six|seven|eight|nine|ten)\b/i,
  );
  if (wordMatch) return WORD_TO_NUM[wordMatch[1].toLowerCase()] || 1;
  const numMatch = text.match(/select\s+(\d+)/i);
  if (numMatch) return parseInt(numMatch[1], 10);
  // "At least X credits" patterns
  const atLeastMatch = text.match(/at\s+least\s+(\d+)\s+credits?/i);
  if (atLeastMatch) return Math.ceil(parseInt(atLeastMatch[1], 10) / 4);
  return 1;
}

function parseCreditsFromText(text) {
  if (!text) return null;
  const m = text.match(/(\d+(?:\s*-\s*\d+)?)\s*credits?/i);
  return m ? m[1].replace(/\s/g, "") : null;
}

// ─── Entry processors ───

/**
 * Walk entries within a section/subsection and extract:
 * - required courses (flat course entries without select context)
 * - select-one groups (comment with "select" + pool/subsequent courses)
 * - capstone courses
 * - elective pools
 */
function processEntries(entries, sectionRole, subsectionName) {
  const required = [];
  const selectGroups = [];
  const electives = [];
  let capstone = null;
  const notes = [];

  let i = 0;
  while (i < entries.length) {
    const entry = entries[i];

    // Handle "select X" comments followed by pool courses
    if (
      entry.type === "comment" &&
      /select|choose|pick|complete/i.test(entry.text)
    ) {
      const count = parseSelectCount(entry.text);
      const pool = [];
      let j = i + 1;
      while (j < entries.length && entries[j].type === "pool-course") {
        pool.push(entries[j]);
        j++;
      }
      if (pool.length > 0) {
        // Derive a descriptive label from the pool's first course department
        // or use the subsection name if unique, or the comment text itself
        const firstDept = pool[0]?.courseId?.split("-").slice(0, 2).join("-") || "";
        const genericSelect = /^select\s+(one|two|\d+)\s+of\s+the\s+following/i;
        let label;
        if (!genericSelect.test(entry.text)) {
          // Comment has a descriptive label
          label = entry.text.replace(/[:\s]+$/, "");
        } else if (subsectionName && !/required|major/i.test(subsectionName)) {
          // Subsection name is descriptive
          label = subsectionName;
        } else {
          // Generate label from course pool
          label = `${firstDept} Requirement`;
        }
        selectGroups.push({
          label,
          courseIds: pool.map((p) => p.courseId),
          count,
          credits: entry.credits,
        });
        i = j;
        continue;
      }
    }

    // Handle elective count/credit comments
    if (
      entry.type === "comment" &&
      sectionRole === "elective" &&
      /elective|list below/i.test(entry.text)
    ) {
      const count = parseSelectCount(entry.text);
      const pool = [];
      let j = i + 1;
      while (j < entries.length && entries[j].type === "pool-course") {
        pool.push(entries[j]);
        j++;
      }
      if (pool.length > 0) {
        electives.push({
          label: subsectionName || entry.text.replace(/[:\s]+$/, ""),
          courseIds: pool.map((p) => p.courseId),
          count,
          credits: entry.credits,
        });
        i = j;
        continue;
      } else {
        // Comment-only elective indicator
        electives.push({
          label: entry.text,
          courseIds: [],
          count,
          credits: entry.credits,
        });
      }
      i++;
      continue;
    }

    // Regular course entries
    if (entry.type === "course") {
      // Check if it's a capstone
      if (
        /capstone|senior\s+project|senior\s+seminar/i.test(entry.name) ||
        sectionRole === "capstone"
      ) {
        capstone = {
          courseId: entry.courseId,
          label: entry.name,
        };
        i++;
        continue;
      }

      // Course with or-alternatives becomes a select-one group
      if (entry.alternatives && entry.alternatives.length > 0) {
        selectGroups.push({
          label: subsectionName || entry.name,
          courseIds: [
            entry.courseId,
            ...entry.alternatives.map((a) => a.courseId),
          ],
          count: 1,
        });
      } else if (sectionRole === "elective") {
        // Regular course in an elective section is part of the pool
        electives.push({
          label: subsectionName || "Elective",
          courseIds: [entry.courseId],
          count: 1,
          credits: entry.credits,
        });
      } else {
        required.push({
          courseId: entry.courseId,
          label: entry.name,
        });
      }
    }

    // Pool courses without a preceding select comment
    if (entry.type === "pool-course") {
      electives.push({
        label: subsectionName || "Elective",
        courseIds: [entry.courseId],
        count: 1,
      });
    }

    // Standalone comment notes
    if (
      entry.type === "comment" &&
      !/select|choose|pick|complete|list below/i.test(entry.text) &&
      entry.text.length > 10
    ) {
      notes.push(entry.text);
    }

    i++;
  }

  return { required, selectGroups, electives, capstone, notes };
}

// ─── Main normalizer ───

function normalizeProgramRequirements(
  majorId,
  majorLabel,
  curriculum,
) {
  if (!curriculum || !curriculum.sections) {
    return {
      label: majorLabel,
      bulletin: "AY 2025-26",
      coursesNeeded: 0,
      creditsNeeded: 0,
      requiredCourses: [],
      selectOneCourses: [],
      capstone: null,
      electivesNeeded: 0,
      electiveCreditsNeeded: 0,
      otherElectiveCredits: "",
      notes:
        "Detailed major requirement mapping could not be extracted from the bulletin.",
    };
  }

  const allRequired = [];
  const allSelectGroups = [];
  const allElectivePools = [];
  let capstone = null;
  let otherElectiveCredits = "";
  const allNotes = [];

  for (const section of curriculum.sections) {
    const sectionRole = classifySection(section.name);

    // Skip core courses (handled by CORE_REQUIREMENTS in frontend)
    if (sectionRole === "core") continue;

    // "Other Elective Credits" or bare "Electives" with only a credit number
    if (
      (sectionRole === "elective" || /other\s+elective/i.test(section.name)) &&
      section.entries.length === 0 &&
      section.subsections.length === 0 &&
      section.credits
    ) {
      otherElectiveCredits = section.credits;
      continue;
    }

    // Process direct section entries
    const sectionResult = processEntries(
      section.entries,
      sectionRole,
      section.name,
    );
    allRequired.push(...sectionResult.required);
    allSelectGroups.push(...sectionResult.selectGroups);
    allElectivePools.push(...sectionResult.electives);
    if (sectionResult.capstone) capstone = sectionResult.capstone;
    allNotes.push(...sectionResult.notes);

    // Process subsections
    for (const sub of section.subsections || []) {
      const subRole = classifySection(sub.name) || sectionRole;
      const effectiveRole =
        subRole === "other" ? sectionRole : subRole;
      const subResult = processEntries(
        sub.entries,
        effectiveRole,
        sub.name,
      );
      allRequired.push(...subResult.required);
      allSelectGroups.push(...subResult.selectGroups);
      allElectivePools.push(...subResult.electives);
      if (subResult.capstone) capstone = subResult.capstone;
      allNotes.push(...subResult.notes);
    }
  }

  // Merge elective pools into a coherent count
  // Collect all unique course IDs from elective pools
  const electiveCourseIds = new Set();
  let electiveCount = 0;
  let electiveCredits = 0;
  const electiveLabels = new Set();

  for (const pool of allElectivePools) {
    for (const id of pool.courseIds) electiveCourseIds.add(id);
    if (pool.count) electiveCount = Math.max(electiveCount, pool.count);
    if (pool.credits) {
      const parsed = parseInt(pool.credits, 10);
      if (Number.isFinite(parsed)) electiveCredits = Math.max(electiveCredits, parsed);
    }
    if (pool.label) electiveLabels.add(pool.label);
  }

  // If we have grouped elective pools with explicit counts, use those
  // Otherwise infer from credits (assuming 4cr/course)
  if (electiveCount === 0 && electiveCredits > 0) {
    electiveCount = Math.ceil(electiveCredits / 4);
  }
  if (electiveCredits === 0 && electiveCount > 0) {
    electiveCredits = electiveCount * 4;
  }

  // Deduplicate select groups: only merge if labels match AND course sets overlap
  const mergedSelectGroups = [];
  const seenSelectLabels = new Map();
  for (const group of allSelectGroups) {
    const key = group.label;
    if (seenSelectLabels.has(key)) {
      const existing = seenSelectLabels.get(key);
      // Only merge if there's overlap in course IDs (indicates same logical group)
      const hasOverlap = group.courseIds.some((id) =>
        existing.courseIds.includes(id),
      );
      if (hasOverlap) {
        const newIds = group.courseIds.filter(
          (id) => !existing.courseIds.includes(id),
        );
        existing.courseIds.push(...newIds);
        if (group.count > existing.count) existing.count = group.count;
        continue;
      }
    }
    // No overlap or new label — create a new group
    const entry = { ...group };
    mergedSelectGroups.push(entry);
    seenSelectLabels.set(key, entry);
  }

  // Clean select groups: remove count property if it's 1 (default)
  const selectOneCourses = mergedSelectGroups.map((g) => {
    const entry = {
      label: g.label,
      courseIds: g.courseIds,
    };
    if (g.count && g.count > 1) entry.count = g.count;
    return entry;
  });

  // Calculate totals
  const coursesNeeded =
    allRequired.length +
    mergedSelectGroups.reduce((sum, g) => sum + (g.count || 1), 0) +
    (capstone ? 1 : 0) +
    electiveCount;

  const creditsFromRequired = allRequired.length * 4;
  const creditsFromSelect = mergedSelectGroups.reduce(
    (sum, g) => sum + (g.count || 1) * 4,
    0,
  );
  const creditsFromCapstone = capstone ? 4 : 0;
  const creditsNeeded =
    creditsFromRequired +
    creditsFromSelect +
    creditsFromCapstone +
    electiveCredits;

  const notes = allNotes.filter((n) => n.length > 0).join(" ");

  // Build concentrations array if present
  let concentrations = undefined;
  if (curriculum.concentrations && curriculum.concentrations.length > 0) {
    concentrations = curriculum.concentrations.map((c) => ({
      name: c.name,
      courses: c.courses.map((course) => ({
        courseId: course.courseId,
        label: course.name,
      })),
      totalCredits: c.totalCredits,
    }));
  }

  const result = {
    label: majorLabel,
    bulletin: "AY 2025-26",
    coursesNeeded,
    creditsNeeded,
    requiredCourses: allRequired,
    selectOneCourses,
    capstone,
    electivesNeeded: electiveCount,
    electiveCreditsNeeded: electiveCredits,
    otherElectiveCredits,
    notes,
  };

  if (concentrations) {
    result.concentrations = concentrations;
  }

  return result;
}

// ─── Batch processing ───

function normalizeAllMajors(shanghaiData) {
  const programs = shanghaiData.programs || {};
  const results = {};
  const warnings = [];

  for (const [majorId, programSlug] of Object.entries(
    MAJOR_TO_PROGRAM_SLUG,
  )) {
    const program = programs[programSlug];
    if (!program) {
      warnings.push(`Program "${programSlug}" not found for major "${majorId}"`);
      continue;
    }

    if (!program.curriculum) {
      warnings.push(
        `Program "${programSlug}" has no structured curriculum data`,
      );
      continue;
    }

    const label =
      program.name?.replace(/\s*\((?:BS|BA|Minor)\)\s*$/i, "").trim() || majorId;
    results[majorId] = normalizeProgramRequirements(
      majorId,
      label,
      program.curriculum,
    );
  }

  return { results, warnings };
}

// ─── Source code generation ───

function indent(str, level) {
  return "  ".repeat(level) + str;
}

function stringLiteral(value) {
  if (value === null || value === undefined) return "null";
  const escaped = String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n");
  return `'${escaped}'`;
}

function formatCourseEntry(entry, indentLevel) {
  const parts = [
    `courseId: ${stringLiteral(entry.courseId)}`,
    `label: ${stringLiteral(entry.label)}`,
  ];
  if (entry.notes) {
    parts.push(`notes: ${stringLiteral(entry.notes)}`);
  }
  return indent(`{ ${parts.join(", ")} }`, indentLevel);
}

function formatSelectGroup(group, indentLevel) {
  const lines = [];
  lines.push(indent("{", indentLevel));
  lines.push(indent(`  label: ${stringLiteral(group.label)},`, indentLevel));
  const ids = group.courseIds.map((id) => stringLiteral(id)).join(", ");
  lines.push(indent(`  courseIds: [${ids}],`, indentLevel));
  if (group.count && group.count > 1) {
    lines.push(indent(`  count: ${group.count},`, indentLevel));
  }
  lines.push(indent("}", indentLevel));
  return lines.join("\n");
}

function formatMajorEntry(majorId, req) {
  const lines = [];
  const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(majorId) ? majorId : `'${majorId}'`;
  lines.push(indent(`${key}: {`, 1));
  lines.push(indent(`label: ${stringLiteral(req.label)},`, 2));
  lines.push(indent(`bulletin: ${stringLiteral(req.bulletin)},`, 2));
  lines.push(indent(`coursesNeeded: ${req.coursesNeeded},`, 2));
  lines.push(indent(`creditsNeeded: ${req.creditsNeeded},`, 2));

  // requiredCourses
  if (req.requiredCourses.length === 0) {
    lines.push(indent("requiredCourses: [],", 2));
  } else {
    lines.push(indent("requiredCourses: [", 2));
    for (const c of req.requiredCourses) {
      lines.push(formatCourseEntry(c, 3) + ",");
    }
    lines.push(indent("],", 2));
  }

  // selectOneCourses
  if (req.selectOneCourses.length === 0) {
    lines.push(indent("selectOneCourses: [],", 2));
  } else {
    lines.push(indent("selectOneCourses: [", 2));
    for (const g of req.selectOneCourses) {
      lines.push(formatSelectGroup(g, 3) + ",");
    }
    lines.push(indent("],", 2));
  }

  // capstone
  if (req.capstone) {
    lines.push(
      indent(`capstone: ${formatCourseEntry(req.capstone, 0).trim()},`, 2),
    );
  } else {
    lines.push(indent("capstone: null,", 2));
  }

  lines.push(indent(`electivesNeeded: ${req.electivesNeeded},`, 2));
  lines.push(
    indent(`electiveCreditsNeeded: ${req.electiveCreditsNeeded},`, 2),
  );
  lines.push(
    indent(
      `otherElectiveCredits: ${stringLiteral(req.otherElectiveCredits)},`,
      2,
    ),
  );

  // concentrations (optional)
  if (req.concentrations && req.concentrations.length > 0) {
    lines.push(indent("concentrations: [", 2));
    for (const conc of req.concentrations) {
      lines.push(indent("{", 3));
      lines.push(indent(`  name: ${stringLiteral(conc.name)},`, 3));
      if (conc.totalCredits != null) {
        lines.push(indent(`  totalCredits: ${conc.totalCredits},`, 3));
      }
      lines.push(indent("  courses: [", 3));
      for (const c of conc.courses) {
        lines.push(formatCourseEntry(c, 5) + ",");
      }
      lines.push(indent("  ],", 3));
      lines.push(indent("},", 3));
    }
    lines.push(indent("],", 2));
  }

  lines.push(
    indent(`notes: ${stringLiteral(req.notes || "")},`, 2),
  );

  lines.push(indent("},", 1));
  return lines.join("\n");
}

function generateMajorRequirementsSource(normalizedMajors) {
  const lines = [];
  lines.push("export const MAJOR_REQUIREMENTS = {");
  for (const [majorId, req] of Object.entries(normalizedMajors)) {
    lines.push(formatMajorEntry(majorId, req));
  }
  lines.push("};");
  return lines.join("\n");
}
