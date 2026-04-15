import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { COURSE_CATALOG } from "../data/courses";

const LOCAL_COURSES = COURSE_CATALOG.map((course) => ({ ...course }));

const LOCAL_COURSES_BY_ID = new Map(
  LOCAL_COURSES.map((course) => [course.id, course]),
);

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
    existing.push(relatedCourseId);
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

  const prerequisites =
    prerequisiteMap.get(remoteCourse.id) ||
    localCourse?.prerequisites ||
    [];

  return {
    id: remoteCourse.id,
    code: remoteCourse.code || localCourse?.code || remoteCourse.id,
    name: remoteCourse.name || localCourse?.name || remoteCourse.id,
    credits: resolvedCredits,
    creditsMin: creditsMin ?? resolvedCredits,
    creditsMax: creditsMax ?? resolvedCredits,
    isVariableCredit: Boolean(remoteCourse.is_variable_credit),
    category: localCourse?.category || "elective",
    department:
      localCourse?.department || subject?.name || subject?.code || "General",
    description: remoteCourse.description || localCourse?.description || "",
    prerequisites,
    prerequisiteNote:
      remoteCourse.prerequisite_note || localCourse?.prerequisiteNote || "",
    requirementIds: localCourse?.requirementIds || [],
    majors: localCourse?.majors || [],
    offeringText: remoteCourse.offering_text || "",
    offeringTerms: Array.isArray(remoteCourse.offering_terms)
      ? remoteCourse.offering_terms
      : [],
  };
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

  const [courses, setCourses] = useState(localFallback);
  const [source, setSource] = useState("local");
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState(null);

  const loadCatalog = useCallback(async () => {
    if (!supabase) {
      setCourses(localFallback);
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
        setCourses(localFallback);
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

      for (const localCourse of localFallback) {
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
      setCourses(localFallback);
      setSource("local");
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [localFallback, schoolSlug]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!supabase) {
        if (!cancelled) {
          setCourses(localFallback);
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
          setCourses(localFallback);
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

        for (const localCourse of localFallback) {
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
        setCourses(localFallback);
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
  }, [localFallback, schoolSlug]);

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
