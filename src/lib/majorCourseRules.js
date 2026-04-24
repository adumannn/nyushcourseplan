import { getMajorRequirement } from "../data/courses";

const BUSINESS_TRACK_MAJORS = new Set(["business", "business-marketing"]);

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

function buildMajorRequirementCourseSet(majorId) {
  const requirement = getMajorRequirement(majorId);
  if (!requirement?.isConfigured) return null;

  const ids = new Set();

  (requirement.requiredCourses || []).forEach((item) => {
    if (item?.courseId) ids.add(item.courseId);
  });

  (requirement.selectOneCourses || []).forEach((group) => {
    (group?.courseIds || []).forEach((courseId) => {
      if (courseId) ids.add(courseId);
    });
  });

  if (requirement.capstone?.courseId) {
    ids.add(requirement.capstone.courseId);
  }

  (requirement.concentrations || []).forEach((concentration) => {
    (concentration?.courses || []).forEach((item) => {
      if (item?.courseId) ids.add(item.courseId);
    });
  });

  return ids;
}

export function isCourseRelevantToMajor(course, majorId) {
  if (!hasMajorCategory(course)) return false;
  if (!majorId || majorId === "custom") return true;

  const requiredCourseIds = buildMajorRequirementCourseSet(majorId);
  if (requiredCourseIds && requiredCourseIds.has(course?.id)) {
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

  if (requiredCourseIds) {
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
