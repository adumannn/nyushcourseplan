import { getMajorRequirement } from "../data/courses.js";

const BUSINESS_TRACK_MAJORS = new Set(["business", "business-marketing"]);

// Department prefixes used to recognize "major-elective" candidates for
// majors that have an open elective bucket (electivesNeeded > 0). When a
// course matches one of these prefixes for the active major and isn't
// already in the major's required map, it's treated as a major elective.
const MAJOR_DEPT_PREFIXES = {
  cs: ["CSCI", "CENG", "DATS"],
  "data-science": ["DATS", "CSCI", "MATH"],
  "computer-systems-engineering": ["CENG", "CSCI", "EENG"],
  "electrical-systems-engineering": ["EENG", "CENG"],
  business: ["BUSF", "MGMT", "MKTG", "ACCT"],
  "business-marketing": ["MKTG", "BUSF", "MGMT"],
  economics: ["ECON"],
  mathematics: ["MATH"],
  "honors-mathematics": ["MATH"],
  physics: ["PHYS"],
  chemistry: ["CHEM"],
  biology: ["BIOL"],
  "neural-science": ["NEUR", "BIOL"],
  "interactive-media-arts": ["INTM", "IMBX"],
  "interactive-media-business": ["INTM", "IMBX", "BUSF", "MGMT", "MKTG"],
  humanities: ["ART", "GCHN", "HIST", "HUMN", "LITR", "PHIL"],
  "global-china-studies": ["GCHN", "HIST", "SOCS"],
  "social-science": ["SOCS", "GCHN", "PSYC", "ECON"],
  "self-designed-honors": [],
};

function getAcceptedMajorIds(majorId) {
  if (BUSINESS_TRACK_MAJORS.has(majorId)) {
    return new Set(["business", "business-marketing"]);
  }

  return new Set([majorId]);
}

function hasMajorCategory(course) {
  return (
    course?.category === "major-required" ||
    course?.category === "major-elective"
  );
}

// Cache: majorId -> Map<courseId, "major-required" | "major-elective">
const majorCategoryMapCache = new Map();

function buildMajorCategoryMap(majorId) {
  if (!majorId) return null;
  if (majorCategoryMapCache.has(majorId)) {
    return majorCategoryMapCache.get(majorId);
  }

  const requirement = getMajorRequirement(majorId);
  if (!requirement?.isConfigured) {
    majorCategoryMapCache.set(majorId, null);
    return null;
  }

  const map = new Map();

  (requirement.requiredCourses || []).forEach((item) => {
    if (item?.courseId) map.set(item.courseId, "major-required");
  });

  (requirement.selectOneCourses || []).forEach((group) => {
    (group?.courseIds || []).forEach((courseId) => {
      if (courseId && !map.has(courseId)) {
        map.set(courseId, "major-required");
      }
    });
  });

  if (requirement.capstone?.courseId) {
    map.set(requirement.capstone.courseId, "major-required");
  }

  (requirement.concentrations || []).forEach((concentration) => {
    (concentration?.courses || []).forEach((item) => {
      if (item?.courseId && !map.has(item.courseId)) {
        map.set(item.courseId, "major-elective");
      }
    });
  });

  majorCategoryMapCache.set(majorId, map);
  return map;
}

function getCoursePrefix(course) {
  const source = String(course?.id || course?.code || "").toUpperCase();
  if (!source) return "";

  const dashIndex = source.indexOf("-");
  if (dashIndex > 0) return source.slice(0, dashIndex);

  const spaceIndex = source.indexOf(" ");
  if (spaceIndex > 0) return source.slice(0, spaceIndex);

  return source;
}

function matchesMajorElectivePattern(course, majorId) {
  const prefixes = MAJOR_DEPT_PREFIXES[majorId];
  if (!Array.isArray(prefixes) || prefixes.length === 0) return false;

  const coursePrefix = getCoursePrefix(course);
  if (!coursePrefix) return false;

  return prefixes.includes(coursePrefix);
}

/**
 * Resolves the effective category of a course relative to the selected
 * major. The static `course.category` field reflects the catalog's view
 * (largely CS-centric); this function recasts it based on the major's
 * actual MAJOR_REQUIREMENTS entry so that, e.g., Physics required courses
 * appear as "Major Required" when Physics is the active major.
 */
export function getEffectiveCategory(course, majorId) {
  const fallback =
    typeof course?.category === "string" ? course.category : "elective";

  if (!majorId || majorId === "custom") return fallback;

  const requirement = getMajorRequirement(majorId);
  if (!requirement?.isConfigured) return fallback;

  const categoryMap = buildMajorCategoryMap(majorId);
  if (categoryMap && course?.id && categoryMap.has(course.id)) {
    return categoryMap.get(course.id);
  }

  // Open electives: if the major has an elective bucket and this course's
  // department prefix matches the major's catalog space, count it as a
  // major elective.
  const hasOpenElectives =
    Number(requirement.electivesNeeded || 0) > 0 ||
    Number(requirement.electiveCreditsNeeded || 0) > 0;

  if (hasOpenElectives && matchesMajorElectivePattern(course, majorId)) {
    return "major-elective";
  }

  // Course was tagged as a major-* category in the static catalog but it
  // isn't part of THIS major's requirements — downgrade to a generic elective
  // so it doesn't visually masquerade as a major course.
  if (hasMajorCategory(course)) {
    return "elective";
  }

  return fallback;
}

export function isCourseRelevantToMajor(course, majorId) {
  if (!hasMajorCategory(course)) return false;
  if (!majorId || majorId === "custom") return true;

  const categoryMap = buildMajorCategoryMap(majorId);
  if (categoryMap && course?.id && categoryMap.has(course.id)) {
    return true;
  }

  if (majorId === "cs" && typeof course.csRole === "string") return true;
  if (majorId === "data-science" && typeof course.dsRole === "string") {
    return true;
  }

  const courseMajors = Array.isArray(course.majors) ? course.majors : [];
  if (courseMajors.length > 0) {
    const acceptedMajorIds = getAcceptedMajorIds(majorId);
    return courseMajors.some((courseMajorId) =>
      acceptedMajorIds.has(courseMajorId),
    );
  }

  if (categoryMap) {
    // The major has a configured map but the course isn't in it; fall back
    // to the department-prefix elective rule so e.g. CSCI electives still
    // surface for CS even when the catalog entry lacks an explicit role.
    const requirement = getMajorRequirement(majorId);
    const hasOpenElectives =
      Number(requirement?.electivesNeeded || 0) > 0 ||
      Number(requirement?.electiveCreditsNeeded || 0) > 0;
    if (hasOpenElectives && matchesMajorElectivePattern(course, majorId)) {
      return true;
    }
    return false;
  }

  if (majorId === "cs") {
    const id = String(course.id || "").toUpperCase();
    const department = String(course.department || "").toLowerCase();

    return (
      id.startsWith("CSCI-") ||
      id.startsWith("DATS-") ||
      id.startsWith("CENG-") ||
      department === "computer science" ||
      department === "data science"
    );
  }

  return false;
}
