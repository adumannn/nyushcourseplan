import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const SCRAPED_DATA_DIR = path.join(PROJECT_ROOT, "scraped-data");
const REPORTS_DIR = path.join(SCRAPED_DATA_DIR, "reports");

const COURSE_ID_REGEX = /[A-Z]{2,6}-[A-Z]{1,5}\s+\d+[A-Z]?/g;
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF]/g;
const BOILERPLATE_ATTRIBUTE_PATTERNS = [
  /^new york university$/i,
  /^unless otherwise noted, all content copyright new york university\. all rights reserved\.$/i,
  /^download page \(pdf\)the pdf will include all information unique to this page\.$/i,
];

const OFFERING_RULES = [
  { test: /\bflsu\b/i, terms: ["fall", "summer"] },
  { test: /\bspsu\b/i, terms: ["spring", "summer"] },
  { test: /\bfall\b/i, terms: ["fall"] },
  { test: /\bspring\b/i, terms: ["spring"] },
  { test: /\bsummer\b/i, terms: ["summer"] },
  { test: /\bjanuary\b|\bj-term\b|\bj term\b|\bjterm\b/i, terms: ["jterm"] },
];

function ensureString(value) {
  return typeof value === "string" ? value : "";
}

function cleanString(value) {
  return ensureString(value)
    .replace(ZERO_WIDTH_REGEX, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSchoolName(slug) {
  return cleanString(
    slug
      .split("-")
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
      .join(" "),
  );
}

function parseCredits(rawCredits) {
  if (typeof rawCredits === "number" && Number.isFinite(rawCredits)) {
    return {
      creditsMin: rawCredits,
      creditsMax: rawCredits,
      isVariableCredit: false,
      rawValue: rawCredits,
      valid: true,
      issue: null,
    };
  }

  const cleaned = cleanString(String(rawCredits));

  if (!cleaned) {
    return {
      creditsMin: null,
      creditsMax: null,
      isVariableCredit: false,
      rawValue: rawCredits,
      valid: false,
      issue: "missing-credits",
    };
  }

  const rangeMatch = cleaned.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const creditsMin = Number.parseInt(rangeMatch[1], 10);
    const creditsMax = Number.parseInt(rangeMatch[2], 10);
    return {
      creditsMin,
      creditsMax,
      isVariableCredit: creditsMin !== creditsMax,
      rawValue: rawCredits,
      valid: Number.isFinite(creditsMin) && Number.isFinite(creditsMax),
      issue:
        Number.isFinite(creditsMin) && Number.isFinite(creditsMax)
          ? null
          : "invalid-credit-range",
    };
  }

  const singleMatch = cleaned.match(/^(\d+)$/);
  if (singleMatch) {
    const credits = Number.parseInt(singleMatch[1], 10);
    return {
      creditsMin: credits,
      creditsMax: credits,
      isVariableCredit: false,
      rawValue: rawCredits,
      valid: Number.isFinite(credits),
      issue: Number.isFinite(credits) ? null : "invalid-credit-value",
    };
  }

  return {
    creditsMin: null,
    creditsMax: null,
    isVariableCredit: false,
    rawValue: rawCredits,
    valid: false,
    issue: "unparseable-credits",
  };
}

function normalizeOfferingTerms(offeringText) {
  const cleaned = cleanString(offeringText).toLowerCase();
  if (!cleaned) return [];

  const terms = new Set();
  for (const rule of OFFERING_RULES) {
    if (rule.test.test(cleaned)) {
      for (const term of rule.terms) terms.add(term);
    }
  }

  return Array.from(terms);
}

function normalizeAttributes(attributes) {
  const input = Array.isArray(attributes) ? attributes : [];
  const cleaned = input
    .map((value) => cleanString(value))
    .filter(Boolean)
    .filter(
      (value) =>
        !BOILERPLATE_ATTRIBUTE_PATTERNS.some((pattern) => pattern.test(value)),
    );

  return Array.from(new Set(cleaned));
}

function extractCourseIds(text) {
  const cleaned = cleanString(text);
  if (!cleaned) return [];
  const matches = cleaned.match(COURSE_ID_REGEX) || [];
  return Array.from(new Set(matches.map((value) => value.replace(/\s+/g, "-"))));
}

function extractLabeledSectionIds(note, labelPattern) {
  const cleaned = cleanString(note);
  if (!cleaned) return [];

  const source = String.raw`(?:^|\b)${labelPattern}[:\s]+([\s\S]+?)(?=(?:\b(?:Pre-?requisites?|Pre-?req|Co-?requisites?|Corequisites?|Anti-?requisites?|Antirequisites?|Equivalency|Fulfillment|Note)\b[:\s])|$)`;
  const regex = new RegExp(source, "i");
  const match = cleaned.match(regex);
  if (!match) return [];

  return extractCourseIds(match[1]);
}

function buildCourseValidationIssues(course, parsedCredits, knownCourseIds) {
  const issues = [];

  if (!cleanString(course?.id)) issues.push("missing-course-id");
  if (!cleanString(course?.code)) issues.push("missing-course-code");
  if (!cleanString(course?.name)) issues.push("missing-course-name");

  if (!parsedCredits.valid && parsedCredits.issue) {
    issues.push(parsedCredits.issue);
  }

  const code = cleanString(course?.code);
  if (/\b-\s*$/.test(code) || /--/.test(code)) {
    issues.push("placeholder-course-code");
  }

  const directPrereqIds = Array.isArray(course?.prerequisiteIds)
    ? course.prerequisiteIds.map((value) => cleanString(value)).filter(Boolean)
    : [];

  for (const prereqId of directPrereqIds) {
    if (!knownCourseIds.has(prereqId)) {
      issues.push(`unresolved-prerequisite:${prereqId}`);
    }
  }

  return Array.from(new Set(issues));
}

function buildRelationshipRows({
  courseId,
  prerequisiteNote,
  directPrerequisiteIds,
  knownCourseIds,
}) {
  const rows = [];
  const seen = new Set();

  const groups = [
    {
      type: "prerequisite",
      ids: Array.isArray(directPrerequisiteIds) ? directPrerequisiteIds : [],
      rawNote: prerequisiteNote,
    },
    {
      type: "corequisite",
      ids: extractLabeledSectionIds(
        prerequisiteNote,
        "Co-?requisites?|Corequisites?",
      ),
      rawNote: prerequisiteNote,
    },
    {
      type: "antirequisite",
      ids: extractLabeledSectionIds(
        prerequisiteNote,
        "Anti-?requisites?|Antirequisites?",
      ),
      rawNote: prerequisiteNote,
    },
  ];

  for (const group of groups) {
    for (const relatedCourseId of group.ids) {
      const cleanedId = cleanString(relatedCourseId);
      if (!cleanedId) continue;

      const dedupeKey = `${courseId}::${cleanedId}::${group.type}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      rows.push({
        course_id: courseId,
        related_course_id: cleanedId,
        relationship_type: group.type,
        raw_note: cleanString(group.rawNote),
        is_resolved: knownCourseIds.has(cleanedId),
      });
    }
  }

  return rows;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function buildSchoolRow(schoolSlug, inputPath) {
  return {
    slug: schoolSlug,
    name: normalizeSchoolName(schoolSlug),
    is_published: false,
    source_file: path.relative(PROJECT_ROOT, inputPath),
  };
}

function buildSubjectRows(schoolSlug, coursesBySubject) {
  return Object.entries(coursesBySubject || {}).map(([subjectSlug, subject]) => ({
    school_slug: schoolSlug,
    slug: cleanString(subjectSlug),
    code: cleanString(subject?.code || subjectSlug.toUpperCase()),
    name: cleanString(subject?.name || subjectSlug),
    is_published: false,
  }));
}

function buildCourseRows(schoolSlug, schoolData, subjectRows) {
  const subjectsBySlug = new Map(subjectRows.map((row) => [row.slug, row]));
  const allRawCourses = [];
  const knownCourseIds = new Set();

  for (const [subjectSlug, subject] of Object.entries(schoolData?.courses || {})) {
    for (const course of subject?.courses || []) {
      allRawCourses.push({ subjectSlug, subject, course });
      const courseId = cleanString(course?.id);
      if (courseId) knownCourseIds.add(courseId);
    }
  }

  const courses = [];
  const attributes = [];
  const relationships = [];
  const unresolvedRelationshipIds = new Set();
  const duplicateCourseIds = new Set();
  const seenCourseIds = new Set();

  for (const entry of allRawCourses) {
    const subject = subjectsBySlug.get(cleanString(entry.subjectSlug));
    if (!subject) continue;

    const course = entry.course || {};
    const courseId = cleanString(course.id);

    if (courseId && seenCourseIds.has(courseId)) {
      duplicateCourseIds.add(courseId);
      continue;
    }
    if (courseId) seenCourseIds.add(courseId);

    const parsedCredits = parseCredits(course.credits);
    const validationIssues = buildCourseValidationIssues(
      course,
      parsedCredits,
      knownCourseIds,
    );

    const normalizedAttributes = normalizeAttributes(course.attributes);
    const relationshipRows = buildRelationshipRows({
      courseId,
      prerequisiteNote: course.prerequisiteNote,
      directPrerequisiteIds: Array.isArray(course.prerequisiteIds)
        ? course.prerequisiteIds.map((value) => cleanString(value)).filter(Boolean)
        : [],
      knownCourseIds,
    });

    for (const relationship of relationshipRows) {
      if (!relationship.is_resolved) {
        unresolvedRelationshipIds.add(relationship.related_course_id);
      }
    }

    const isPlaceholderCode =
      validationIssues.includes("placeholder-course-code");
    const shouldPublish =
      Boolean(courseId) &&
      !validationIssues.includes("missing-course-id") &&
      !validationIssues.includes("missing-course-code") &&
      !validationIssues.includes("missing-course-name") &&
      !isPlaceholderCode;

    courses.push({
      id: courseId,
      subject_slug: subject.slug,
      code: cleanString(course.code),
      name: cleanString(course.name),
      description: cleanString(course.description),
      credits_min: parsedCredits.creditsMin,
      credits_max: parsedCredits.creditsMax,
      is_variable_credit: parsedCredits.isVariableCredit,
      prerequisite_note: cleanString(course.prerequisiteNote),
      fulfillment_text: cleanString(course.fulfillment),
      offering_text: cleanString(course.typicallyOffered),
      offering_terms: normalizeOfferingTerms(course.typicallyOffered),
      validation_issues: validationIssues,
      is_published: shouldPublish,
      source_school_slug: schoolSlug,
    });

    for (const attributeText of normalizedAttributes) {
      attributes.push({
        course_id: courseId,
        attribute_text: attributeText,
      });
    }

    relationships.push(...relationshipRows);
  }

  return {
    courses,
    attributes,
    relationships,
    summary: {
      duplicateCourseIds: Array.from(duplicateCourseIds).sort(),
      unresolvedRelationshipIds: Array.from(unresolvedRelationshipIds).sort(),
    },
  };
}

function buildValidationSummary({
  schoolSlug,
  schoolRow,
  subjectRows,
  courseRows,
  relationshipRows,
  attributeRows,
  duplicateCourseIds,
  unresolvedRelationshipIds,
}) {
  const issueCounts = {};
  let publishedCourses = 0;
  let variableCreditCourses = 0;
  let placeholderCourses = 0;

  for (const course of courseRows) {
    if (course.is_published) publishedCourses += 1;
    if (course.is_variable_credit) variableCreditCourses += 1;
    if (course.validation_issues.includes("placeholder-course-code")) {
      placeholderCourses += 1;
    }

    for (const issue of course.validation_issues) {
      issueCounts[issue] = (issueCounts[issue] || 0) + 1;
    }
  }

  return {
    school: {
      slug: schoolSlug,
      name: schoolRow.name,
      sourceFile: schoolRow.source_file,
    },
    counts: {
      subjects: subjectRows.length,
      courses: courseRows.length,
      publishedCourses,
      variableCreditCourses,
      placeholderCourses,
      relationships: relationshipRows.length,
      unresolvedRelationships: unresolvedRelationshipIds.length,
      attributes: attributeRows.length,
      duplicateCourseIds: duplicateCourseIds.length,
    },
    issueCounts,
    samples: {
      duplicateCourseIds: duplicateCourseIds.slice(0, 25),
      unresolvedRelationshipIds: unresolvedRelationshipIds.slice(0, 25),
      coursesWithIssues: courseRows
        .filter((course) => course.validation_issues.length > 0)
        .slice(0, 25)
        .map((course) => ({
          id: course.id,
          code: course.code,
          name: course.name,
          validationIssues: course.validation_issues,
        })),
    },
  };
}

export function parseArgs(argv = process.argv.slice(2)) {
  const flags = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    index += 1;
  }

  return flags;
}

export function resolveSchoolSlug(flags = {}) {
  return cleanString(flags.school || "shanghai").toLowerCase();
}

export function getDefaultValidationReportPath(schoolSlug) {
  return path.join(REPORTS_DIR, `${schoolSlug}.validation.json`);
}

export function ensureReportsDirectory() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

export function writeJsonFile(outputPath, value) {
  const directory = path.dirname(outputPath);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(value, null, 2) + "\n");
}

export function readSchoolScrape(schoolSlug) {
  const filePath = getScrapedFilePath(schoolSlug);
  return {
    filePath,
    data: readJson(filePath),
  };
}

export function normalizeSchoolDataset(schoolSlug, schoolData, inputPath) {
  const schoolRow = buildSchoolRow(schoolSlug, inputPath);
  const subjectRows = buildSubjectRows(schoolSlug, schoolData?.courses || {});
  const {
    courses,
    attributes,
    relationships,
    summary: { duplicateCourseIds, unresolvedRelationshipIds },
  } = buildCourseRows(schoolSlug, schoolData, subjectRows);

  const validationSummary = buildValidationSummary({
    schoolSlug,
    schoolRow,
    subjectRows,
    courseRows: courses,
    relationshipRows: relationships,
    attributeRows: attributes,
    duplicateCourseIds,
    unresolvedRelationshipIds,
  });

  return {
    school: schoolRow,
    subjects: subjectRows,
    courses,
    attributes,
    relationships,
    validationSummary,
  };
}

export function buildImportSummary(normalized) {
  return {
    school: normalized.school.slug,
    counts: normalized.validationSummary.counts,
    issueCounts: normalized.validationSummary.issueCounts,
    sourceFile: normalized.school.source_file,
  };
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

function loadProjectEnv() {
  loadEnvFile(path.join(PROJECT_ROOT, ".env"));
  loadEnvFile(path.join(PROJECT_ROOT, ".env.local"));
}

function getProjectRoot() {
  return PROJECT_ROOT;
}

function getReportsDir() {
  return REPORTS_DIR;
}

function getScrapedDataDir() {
  return SCRAPED_DATA_DIR;
}
