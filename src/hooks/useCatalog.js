import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { LOCAL_CATALOG_COURSES } from "../lib/localCatalog";
import { hydrateCoursePrerequisites } from "../lib/prerequisites";

const LOCAL_COURSES = LOCAL_CATALOG_COURSES.map((course) => ({ ...course }));

const LOCAL_COURSES_BY_ID = new Map(
  LOCAL_COURSES.map((course) => [course.id, course]),
);

function getCoursePrefix(value) {
  if (typeof value !== "string") return "";

  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return "";

  const dashIndex = trimmed.indexOf("-");
  if (dashIndex > 0) return trimmed.slice(0, dashIndex);

  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex > 0) return trimmed.slice(0, spaceIndex);

  return trimmed;
}

const CATEGORY_BY_PREFIX = (() => {
  const categoriesByPrefix = new Map();

  for (const course of LOCAL_COURSES) {
    const prefix = getCoursePrefix(course.id || course.code);
    if (!prefix || !course.category) continue;

    if (!categoriesByPrefix.has(prefix)) {
      categoriesByPrefix.set(prefix, new Set());
    }
    categoriesByPrefix.get(prefix).add(course.category);
  }

  const resolved = new Map();
  for (const [prefix, categories] of categoriesByPrefix.entries()) {
    if (categories.size === 1) {
      resolved.set(prefix, [...categories][0]);
    }
  }

  return resolved;
})();

const LANGUAGE_PREFIX_HINTS = new Set([
  "ARAB",
  "ARBC",
  "CHIN",
  "FREN",
  "GERM",
  "HEBR",
  "HIND",
  "ITAL",
  "JAPN",
  "KORE",
  "PERS",
  "PORT",
  "RUSS",
  "SPAN",
  "SWED",
  "TURK",
]);

const LANGUAGE_NAME_HINTS = [
  "arabic",
  "chinese",
  "english for academic purposes",
  "french",
  "german",
  "hebrew",
  "hindi",
  "italian",
  "japanese",
  "korean",
  "language",
  "persian",
  "portuguese",
  "russian",
  "spanish",
  "swedish",
  "turkish",
];

function hasLanguageKeyword(value) {
  if (!value) return false;
  return LANGUAGE_NAME_HINTS.some((keyword) => value.includes(keyword));
}

function inferCategory(remoteCourse, localCourse, subject) {
  if (localCourse?.category) return localCourse.category;

  const subjectPrefix = getCoursePrefix(subject?.code || remoteCourse?.code);
  if (CATEGORY_BY_PREFIX.has(subjectPrefix)) {
    return CATEGORY_BY_PREFIX.get(subjectPrefix);
  }

  const normalizedName =
    typeof remoteCourse?.name === "string"
      ? remoteCourse.name.trim().toLowerCase()
      : "";
  const normalizedSubjectName =
    typeof subject?.name === "string" ? subject.name.toLowerCase() : "";
  const startsWithLanguageLevel =
    /^(elementary|intermediate|advanced|beginning|intensive)\b/.test(
      normalizedName,
    );
  const languageKeywordInName = hasLanguageKeyword(normalizedName);
  const languageKeywordInSubject = hasLanguageKeyword(normalizedSubjectName);

  if (
    LANGUAGE_PREFIX_HINTS.has(subjectPrefix) ||
    languageKeywordInSubject ||
    (startsWithLanguageLevel && languageKeywordInName) ||
    (subjectPrefix === "ENGL" && normalizedName.includes("academic purposes"))
  ) {
    return "language";
  }

  return "elective";
}

function normalizeSubject(subject) {
  if (!subject) return null;
  if (Array.isArray(subject)) return subject[0] || null;
  return subject;
}

function buildPrerequisiteMap(relationships) {
  const map = new Map();

  for (const relationship of relationships || []) {
    if (!relationship || relationship.relationship_type !== "prerequisite") {
      continue;
    }

    const courseId = relationship.course_id;
    const relatedCourseId = relationship.related_course_id;

    if (!courseId || !relatedCourseId) continue;

    const existing = map.get(courseId) || [];
    if (!existing.includes(relatedCourseId)) {
      existing.push(relatedCourseId);
    }
    map.set(courseId, existing);
  }

  return map;
}

function toRuntimeCourse(remoteCourse, prerequisiteMap) {
  const localCourse = LOCAL_COURSES_BY_ID.get(remoteCourse.id);
  const subject = normalizeSubject(remoteCourse.catalog_subjects);

  const creditsMin =
    typeof remoteCourse.credits_min === "number"
      ? remoteCourse.credits_min
      : null;
  const creditsMax =
    typeof remoteCourse.credits_max === "number"
      ? remoteCourse.credits_max
      : null;
  const resolvedCredits =
    creditsMin ?? creditsMax ?? localCourse?.credits ?? 4;

  return hydrateCoursePrerequisites({
    id: remoteCourse.id,
    code: remoteCourse.code || localCourse?.code || remoteCourse.id,
    name: remoteCourse.name || localCourse?.name || remoteCourse.id,
    credits: resolvedCredits,
    creditsMin: creditsMin ?? resolvedCredits,
    creditsMax: creditsMax ?? resolvedCredits,
    isVariableCredit: Boolean(remoteCourse.is_variable_credit),
    category: inferCategory(remoteCourse, localCourse, subject),
    department:
      localCourse?.department || subject?.name || subject?.code || "General",
    description: remoteCourse.description || localCourse?.description || "",
    prerequisites:
      prerequisiteMap.get(remoteCourse.id) ||
      localCourse?.prerequisites ||
      [],
    prerequisiteNote:
      remoteCourse.prerequisite_note || localCourse?.prerequisiteNote || "",
    requirementIds: localCourse?.requirementIds || [],
    majors: localCourse?.majors || [],
    offeringText: remoteCourse.offering_text || "",
    offeringTerms: Array.isArray(remoteCourse.offering_terms)
      ? remoteCourse.offering_terms
      : [],
  });
}

function buildCatalogIndexes(courses) {
  const coursesById = new Map(courses.map((course) => [course.id, course]));
  const departments = Array.from(
    new Set(courses.map((course) => course.department).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  return { coursesById, departments };
}

async function fetchPublishedCatalog(schoolSlug) {
  if (!supabase) {
    return { courses: [], relationships: [] };
  }

  const { data: remoteCourses, error: courseError } = await supabase
    .from("catalog_courses")
    .select(
      `
        id,
        code,
        name,
        description,
        credits_min,
        credits_max,
        is_variable_credit,
        prerequisite_note,
        offering_text,
        offering_terms,
        catalog_subjects!inner (
          slug,
          code,
          name,
          school_slug
        )
      `,
    )
    .eq("catalog_subjects.school_slug", schoolSlug)
    .order("code", { ascending: true });

  if (courseError) {
    throw courseError;
  }

  if (!remoteCourses || remoteCourses.length === 0) {
    return { courses: [], relationships: [] };
  }

  const courseIds = remoteCourses.map((course) => course.id);

  const { data: relationships, error: relationshipError } = await supabase
    .from("catalog_course_relationships")
    .select("course_id, related_course_id, relationship_type")
    .eq("relationship_type", "prerequisite")
    .in("course_id", courseIds);

  if (relationshipError) {
    throw relationshipError;
  }

  return {
    courses: remoteCourses,
    relationships: relationships || [],
  };
}

export default function useCatalog(options = {}) {
  const schoolSlug = options.schoolSlug || "shanghai";
  const localFallback = options.localFallback || LOCAL_COURSES;
  const resolvedLocalFallback = useMemo(
    () =>
      (localFallback || []).map((course) =>
        hydrateCoursePrerequisites({ ...course }),
      ),
    [localFallback],
  );

  const [courses, setCourses] = useState(resolvedLocalFallback);
  const [source, setSource] = useState("local");
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState(null);

  const loadCatalog = useCallback(async () => {
    if (!supabase) {
      setCourses(resolvedLocalFallback);
      setSource("local");
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { courses: remoteCourses, relationships } =
        await fetchPublishedCatalog(schoolSlug);

      if (!remoteCourses.length) {
        setCourses(resolvedLocalFallback);
        setSource("local");
        setError(null);
        return;
      }

      const prerequisiteMap = buildPrerequisiteMap(relationships);
      const mergedRemoteCourses = remoteCourses.map((course) =>
        toRuntimeCourse(course, prerequisiteMap),
      );

      const mergedById = new Map(
        mergedRemoteCourses.map((course) => [course.id, course]),
      );

      for (const localCourse of resolvedLocalFallback) {
        if (!mergedById.has(localCourse.id)) {
          mergedById.set(localCourse.id, localCourse);
        }
      }

      const nextCourses = Array.from(mergedById.values()).sort((a, b) => {
        const codeComparison = (a.code || "").localeCompare(b.code || "");
        if (codeComparison !== 0) return codeComparison;
        return (a.name || "").localeCompare(b.name || "");
      });

      setCourses(nextCourses);
      setSource("supabase");
      setError(null);
    } catch (err) {
      setCourses(resolvedLocalFallback);
      setSource("local");
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [resolvedLocalFallback, schoolSlug]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!supabase) {
        if (!cancelled) {
          setCourses(resolvedLocalFallback);
          setSource("local");
          setError(null);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setLoading(true);
      }

      try {
        const { courses: remoteCourses, relationships } =
          await fetchPublishedCatalog(schoolSlug);

        if (cancelled) return;

        if (!remoteCourses.length) {
          setCourses(resolvedLocalFallback);
          setSource("local");
          setError(null);
          return;
        }

        const prerequisiteMap = buildPrerequisiteMap(relationships);
        const mergedRemoteCourses = remoteCourses.map((course) =>
          toRuntimeCourse(course, prerequisiteMap),
        );

        const mergedById = new Map(
          mergedRemoteCourses.map((course) => [course.id, course]),
        );

        for (const localCourse of resolvedLocalFallback) {
          if (!mergedById.has(localCourse.id)) {
            mergedById.set(localCourse.id, localCourse);
          }
        }

        const nextCourses = Array.from(mergedById.values()).sort((a, b) => {
          const codeComparison = (a.code || "").localeCompare(b.code || "");
          if (codeComparison !== 0) return codeComparison;
          return (a.name || "").localeCompare(b.name || "");
        });

        setCourses(nextCourses);
        setSource("supabase");
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setCourses(resolvedLocalFallback);
        setSource("local");
        setError(err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [resolvedLocalFallback, schoolSlug]);

  const indexes = useMemo(() => buildCatalogIndexes(courses), [courses]);

  return {
    courses,
    coursesById: indexes.coursesById,
    departments: indexes.departments,
    source,
    loading,
    error,
    refetch: loadCatalog,
  };
}
