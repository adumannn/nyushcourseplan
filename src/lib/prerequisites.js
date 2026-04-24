const COURSE_REFERENCE_REGEX =
  /[A-Z]{2,6}-[A-Z]{1,5}\s+\d+(?:[A-Z0-9.]*)/gi;
const STRUCTURE_HINT_REGEX = /\b(?:or|and|one of)\b|[/;()]/i;
const UNTRACKABLE_ALTERNATIVE_REGEX =
  /\b(?:equivalent|placement|permission|approval|consent|exam|instructor|standing)\b/i;

function cleanText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function isWordBoundary(char) {
  return !char || /[^a-z]/i.test(char);
}

function matchesStandaloneWord(text, index, word) {
  const slice = text.slice(index, index + word.length).toLowerCase();
  if (slice !== word) return false;
  return (
    isWordBoundary(text[index - 1]) &&
    isWordBoundary(text[index + word.length])
  );
}

function hasWrappingParentheses(text) {
  let depth = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;

    if (depth === 0 && index < text.length - 1) {
      return false;
    }
  }

  return depth === 0;
}

function stripOuterParentheses(text) {
  let next = cleanText(text);

  while (true) {
    const withoutTrailingPunctuation = next.replace(/[.,;:]+$/g, "").trim();

    if (
      !withoutTrailingPunctuation.startsWith("(") ||
      !withoutTrailingPunctuation.endsWith(")") ||
      !hasWrappingParentheses(withoutTrailingPunctuation)
    ) {
      return next;
    }

    next = cleanText(withoutTrailingPunctuation.slice(1, -1));
  }
}

function unique(values = []) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}

export function normalizeCourseId(value) {
  const cleaned = cleanText(value);
  return cleaned ? cleaned.replace(/\s+/g, "-").toUpperCase() : "";
}

export function normalizePrerequisiteGroups(groups = []) {
  const seen = new Set();
  const normalized = [];

  for (const group of groups || []) {
    const normalizedGroup = unique(
      (Array.isArray(group) ? group : [])
        .map((value) => normalizeCourseId(value))
        .filter(Boolean),
    );

    if (!normalizedGroup.length) continue;

    const key = normalizedGroup.join("::");
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(normalizedGroup);
  }

  return normalized;
}

export function serializePrerequisiteGroup(group = []) {
  return normalizePrerequisiteGroups([group])[0]?.join("::") || "";
}

export function flattenPrerequisiteGroups(groups = []) {
  return unique(normalizePrerequisiteGroups(groups).flat());
}

function extractCourseIds(text) {
  return unique(
    (cleanText(text).match(COURSE_REFERENCE_REGEX) || []).map((value) =>
      normalizeCourseId(value),
    ),
  );
}

function expandImplicitCourseAlternatives(text) {
  let expanded = cleanText(text);
  const pattern =
    /([A-Z]{2,6}-[A-Z]{1,5})\s+(\d+(?:[A-Z0-9.]*)?)(\s*(?:\/|\bor\b)\s*)(\d+(?:[A-Z0-9.]*)?)/gi;

  while (true) {
    const next = expanded.replace(
      pattern,
      (_, prefix, first, separator, second) =>
        `${prefix} ${first}${separator}${prefix} ${second}`,
    );

    if (next === expanded) {
      return expanded;
    }

    expanded = next;
  }
}

function stripNonPrerequisiteSections(text) {
  return cleanText(text).replace(
    /\b(?:Co-?requisites?|Corequisites?|Anti-?requisites?|Antirequisites?)\b[:\s]+.*$/i,
    "",
  );
}

function splitTopLevelOnAnd(text) {
  const source = stripOuterParentheses(text);
  const parts = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth !== 0) continue;

    if (char === ";") {
      parts.push(source.slice(start, index));
      start = index + 1;
      continue;
    }

    if (
      matchesStandaloneWord(source, index, "and") &&
      source[index - 1] !== "/" &&
      source[index + 3] !== "/"
    ) {
      parts.push(source.slice(start, index));
      start = index + 3;
      index += 2;
    }
  }

  parts.push(source.slice(start));

  return parts.map((value) => cleanText(value)).filter(Boolean);
}

function containsTopLevelOr(text) {
  const source = stripOuterParentheses(text);
  let depth = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (char === "(") {
      depth += 1;
      continue;
    }

    if (char === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth !== 0) continue;

    if (char === "/") {
      return true;
    }

    if (
      matchesStandaloneWord(source, index, "or") ||
      matchesStandaloneWord(source, index, "and/or")
    ) {
      return true;
    }
  }

  return false;
}

function parsePrerequisiteGroupsFromText(text) {
  const segments = splitTopLevelOnAnd(text);
  const groups = [];

  for (const segment of segments) {
    const normalizedSegment = stripOuterParentheses(segment);
    const ids = extractCourseIds(normalizedSegment);

    if (!ids.length) continue;

    if (
      /\bone of\b/i.test(normalizedSegment) ||
      containsTopLevelOr(normalizedSegment)
    ) {
      groups.push(ids);
      continue;
    }

    ids.forEach((id) => groups.push([id]));
  }

  return normalizePrerequisiteGroups(groups);
}

export function resolvePrerequisiteData({
  prerequisiteNote = "",
  prerequisiteIds = [],
  prerequisiteGroups = [],
} = {}) {
  const existingGroups = normalizePrerequisiteGroups(prerequisiteGroups);
  if (existingGroups.length > 0) {
    return {
      prerequisiteGroups: existingGroups,
      prerequisites: flattenPrerequisiteGroups(existingGroups),
      parseIssues: [],
    };
  }

  const normalizedNote = cleanText(prerequisiteNote);
  const normalizedIds = unique(
    (Array.isArray(prerequisiteIds) ? prerequisiteIds : [])
      .map((value) => normalizeCourseId(value))
      .filter(Boolean),
  );
  const workingNote = expandImplicitCourseAlternatives(
    stripNonPrerequisiteSections(normalizedNote),
  );
  const noteIds = extractCourseIds(workingNote);
  const parseIssues = [];

  let groups = parsePrerequisiteGroupsFromText(workingNote);

  if (!groups.length) {
    if (noteIds.length > 0) {
      groups = noteIds.map((id) => [id]);

      if (noteIds.length > 1 && STRUCTURE_HINT_REGEX.test(workingNote)) {
        parseIssues.push("prerequisite-structure-fallback");
      }
    } else if (normalizedIds.length > 0) {
      groups = normalizedIds.map((id) => [id]);
    }
  }

  if (
    workingNote &&
    /\bor\b/i.test(workingNote) &&
    UNTRACKABLE_ALTERNATIVE_REGEX.test(workingNote)
  ) {
    parseIssues.push("prerequisite-has-untrackable-alternative");
  }

  const normalizedGroups = normalizePrerequisiteGroups(groups);
  const flattenedIds = flattenPrerequisiteGroups(normalizedGroups);

  return {
    prerequisiteGroups: normalizedGroups,
    prerequisites:
      flattenedIds.length > 0
        ? flattenedIds
        : flattenPrerequisiteGroups(normalizedIds.map((id) => [id])),
    parseIssues: unique(parseIssues),
  };
}

export function hydrateCoursePrerequisites(course = {}, options = {}) {
  const prerequisiteNote =
    options.prerequisiteNote ??
    course.prerequisiteNote ??
    course.prerequisite_note ??
    "";
  const sourceGroups =
    options.prerequisiteGroups ?? course.prerequisiteGroups ?? [];
  const sourceIds =
    options.prerequisiteIds ??
    course.prerequisites ??
    course.prerequisiteIds ??
    [];
  const { prerequisiteGroups, prerequisites, parseIssues } =
    resolvePrerequisiteData({
      prerequisiteNote,
      prerequisiteIds: sourceIds,
      prerequisiteGroups: sourceGroups,
    });

  return {
    ...course,
    prerequisiteNote,
    prerequisites,
    prerequisiteGroups,
    prerequisiteParseIssues: parseIssues,
  };
}

export function buildPrerequisiteWarnings(plan = {}, semesterOrder = []) {
  const warnings = {};

  for (const [semesterId, courses] of Object.entries(plan || {})) {
    const semesterIndex = semesterOrder.indexOf(semesterId);
    if (semesterIndex === -1) continue;

    const priorCourseIds = new Set();
    for (let index = 0; index < semesterIndex; index += 1) {
      const priorSemesterId = semesterOrder[index];
      for (const course of plan[priorSemesterId] || []) {
        if (course?.id) {
          priorCourseIds.add(course.id);
        }
      }
    }

    for (const course of courses || []) {
      const { prerequisiteGroups } = resolvePrerequisiteData({
        prerequisiteNote: course?.prerequisiteNote,
        prerequisiteIds: course?.prerequisites,
        prerequisiteGroups: course?.prerequisiteGroups,
      });

      if (!prerequisiteGroups.length) continue;

      const unmetGroups = prerequisiteGroups.filter(
        (group) => !group.some((courseId) => priorCourseIds.has(courseId)),
      );

      if (unmetGroups.length > 0 && course?.id) {
        warnings[course.id] = unmetGroups;
      }
    }
  }

  return warnings;
}
