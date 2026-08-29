import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  SEMESTERS,
  CORE_REQUIREMENTS,
  getMajorRequirement,
  normalizeSecondMajor,
  STUDY_AWAY,
} from "../data/courses";
import { mergeCourseWithLocalCatalog } from "../lib/localCatalog";
import {
  getEffectiveCategory,
  getEffectiveCategoryForMajors,
} from "../lib/majorCourseRules";
import { localStoragePlan, supabasePlan } from "../lib/planStorage";
import { formatPlanSyncError } from "../lib/planSyncError";
import { buildPrerequisiteWarnings } from "../lib/prerequisites";

const EAP_COURSE_IDS = new Set(["ENGL-SHU-100", "ENGL-SHU-101"]);

function createEmptyPlan() {
  const plan = {};
  SEMESTERS.forEach((s) => {
    plan[s.id] = [];
  });
  return plan;
}

function deduplicatePlan(plan) {
  const result = {};
  for (const [semId, courses] of Object.entries(plan)) {
    const seen = new Set();
    result[semId] = (courses || [])
      .filter((c) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      })
      .map((c) =>
        mergeCourseWithLocalCatalog(c, {
          courseId: c.id,
          selectedCredits: c.credits,
        }),
      );
  }
  return result;
}

function createDefaultStudyAway() {
  return {
    selectedSemesters: [],
    locations: {},
  };
}

function normalizeStudyAway(studyAway) {
  const defaults = createDefaultStudyAway();
  const semesterSet = new Set(STUDY_AWAY.eligibleSemesters || []);
  const locationSet = new Set(STUDY_AWAY.locations || []);
  const semesterOrder = STUDY_AWAY.eligibleSemesters || [];

  if (!studyAway || typeof studyAway !== "object") {
    return defaults;
  }

  const selectedSemesters = Array.from(
    new Set(
      (studyAway.selectedSemesters || []).filter((semesterId) =>
        semesterSet.has(semesterId),
      ),
    ),
  )
    .sort((a, b) => semesterOrder.indexOf(a) - semesterOrder.indexOf(b))
    .slice(0, STUDY_AWAY.maxSemesters);

  const locations = {};
  selectedSemesters.forEach((semesterId) => {
    const value = studyAway.locations?.[semesterId];
    locations[semesterId] = locationSet.has(value) ? value : "";
  });

  return {
    selectedSemesters,
    locations,
  };
}

function getUserProfileName(user) {
  const rawName =
    user?.user_metadata?.full_name || user?.user_metadata?.name || "";
  return typeof rawName === "string" ? rawName.trim() : "";
}

function courseFulfillsRequirement(course, requirement, majorIds) {
  const requirementIds = Array.isArray(course?.requirementIds)
    ? course.requirementIds
    : [];
  if (requirementIds.includes(requirement.id)) {
    return true;
  }

  const category = getEffectiveCategoryForMajors(course, majorIds);
  if (requirement.category === "core") {
    return false;
  }

  return category === requirement.category;
}

function isEffectiveMajorCourse(course, majorId) {
  const category = getEffectiveCategory(course, majorId);
  return category === "major-required" || category === "major-elective";
}

function isEffectiveMajorCourseForMajors(course, majorIds) {
  const category = getEffectiveCategoryForMajors(course, majorIds);
  return category === "major-required" || category === "major-elective";
}

export default function usePlanner(user, getToken) {
  const [plan, setPlan] = useState(createEmptyPlan);
  const [major, setMajorState] = useState("cs");
  const [secondMajor, setSecondMajorState] = useState(null);
  const [studentName, setStudentName] = useState("");
  const [studyAway, setStudyAway] = useState(createDefaultStudyAway);
  const [planId, setPlanId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ state: "synced", detail: "" });
  const saveTimeout = useRef(null);
  const pendingSave = useRef(null);
  const saveInProgress = useRef(false);
  const failedSave = useRef(null);
  const skipNextSave = useRef(false);

  const isCloud = !!user;

  // Selecting the current second major as primary drops the second major
  // rather than leaving the same major declared twice.
  const setMajor = useCallback((value) => {
    setMajorState(value);
    setSecondMajorState((prev) => (prev === value ? null : prev));
  }, []);

  const setSecondMajor = useCallback(
    (value) => {
      setSecondMajorState(normalizeSecondMajor(value, major));
    },
    [major],
  );

  const activeMajors = useMemo(
    () => (secondMajor ? [major, secondMajor] : [major]),
    [major, secondMajor],
  );

  const flushCloudSave = useCallback(async () => {
    if (saveInProgress.current) return;

    saveInProgress.current = true;
    try {
      while (pendingSave.current) {
        const snapshot = pendingSave.current;
        pendingSave.current = null;

        if (snapshot.isCloud && snapshot.planId && snapshot.userId) {
          setSyncStatus({ state: "saving", detail: "" });
          try {
            await supabasePlan.save(
              snapshot.userId,
              {
                planId: snapshot.planId,
                plan: snapshot.plan,
                major: snapshot.major,
                secondMajor: snapshot.secondMajor,
                studentName: snapshot.studentName,
                studyAway: snapshot.studyAway,
              },
              snapshot.getToken,
            );
            failedSave.current = null;
            setSyncStatus({ state: "synced", detail: "" });
          } catch (error) {
            failedSave.current = snapshot;
            setSyncStatus({
              state: "error",
              detail: formatPlanSyncError(error),
            });
            console.error(
              "Cloud plan save failed; latest plan remains cached locally.",
              error,
            );
          }
        }
      }
    } finally {
      saveInProgress.current = false;
      if (pendingSave.current) {
        void flushCloudSave();
      }
    }
  }, []);

  const retryCloudSave = useCallback(() => {
    if (!failedSave.current) return;
    pendingSave.current = failedSave.current;
    void flushCloudSave();
  }, [flushCloudSave]);

  // Load plan on mount or auth change
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoaded(false);
      clearTimeout(saveTimeout.current);
      pendingSave.current = null;
      failedSave.current = null;
      setSyncStatus({ state: "synced", detail: "" });
      let shouldSkipInitialSave = true;

      if (isCloud) {
        const profileStudentName = getUserProfileName(user);
        const data = await supabasePlan.load(user.id, profileStudentName, getToken);
        if (cancelled) return;
        if (data) {
          const storedStudentName =
            typeof data.studentName === "string" ? data.studentName.trim() : "";
          const resolvedStudentName = storedStudentName || profileStudentName;
          const didAutoFillName = !storedStudentName && !!profileStudentName;

          setPlan(deduplicatePlan(data.plan));
          setMajorState(data.major);
          setSecondMajorState(normalizeSecondMajor(data.secondMajor, data.major));
          setStudentName(resolvedStudentName);
          setStudyAway(normalizeStudyAway(data.studyAway));
          setPlanId(data.planId);

          // Allow one save so the first cloud sign-in persists profile name into plans.student_name.
          shouldSkipInitialSave = !didAutoFillName;
        } else {
          // Cloud load failed — fall back to localStorage cache so the user
          // sees their most recent plan instead of an empty grid.
          const cached = await localStoragePlan.load();
          if (!cancelled && cached) {
            setPlan(deduplicatePlan(cached.plan || createEmptyPlan()));
            setMajorState(cached.major || "cs");
            setSecondMajorState(
              normalizeSecondMajor(cached.secondMajor, cached.major || "cs"),
            );
            setStudentName(cached.studentName || "");
            setStudyAway(normalizeStudyAway(cached.studyAway));
          }
        }
      } else {
        const data = await localStoragePlan.load();
        if (cancelled) return;
        if (data) {
          setPlan(deduplicatePlan(data.plan || createEmptyPlan()));
          setMajorState(data.major || "cs");
          setSecondMajorState(
            normalizeSecondMajor(data.secondMajor, data.major || "cs"),
          );
          setStudentName(data.studentName || "");
          setStudyAway(normalizeStudyAway(data.studyAway));
        }
        setPlanId(null);
      }

      // Don't save the data we just loaded back to the database
      skipNextSave.current = shouldSkipInitialSave;
      setLoaded(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user, isCloud, getToken]);

  // Save to localStorage immediately (synchronous, no debounce) so data
  // survives a page refresh even if the Supabase call hasn't finished.
  // Only the Supabase network call is debounced.
  useEffect(() => {
    if (!loaded) return;

    // Skip the save triggered by the load itself
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    // Synchronous localStorage write — always happens immediately
    localStoragePlan.save({ plan, major, secondMajor, studentName, studyAway });

    // Debounce the Supabase save
    const snapshot = {
      plan,
      major,
      secondMajor,
      studentName,
      studyAway,
      isCloud,
      planId,
      userId: user?.id || null,
      getToken,
    };

    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      pendingSave.current = snapshot;
      void flushCloudSave();
    }, 500);

    return () => clearTimeout(saveTimeout.current);
  }, [
    plan,
    major,
    secondMajor,
    studentName,
    studyAway,
    isCloud,
    planId,
    user,
    getToken,
    loaded,
    flushCloudSave,
  ]);

  // Flush any pending Supabase save before the page unloads so data isn't
  // lost when the user refreshes mid-debounce.
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingSave.current) {
        void flushCloudSave();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [flushCloudSave]);

  const addCourse = useCallback((semesterId, course) => {
    setPlan((prev) => {
      const semCourses = prev[semesterId] || [];
      if (semCourses.some((c) => c.id === course.id)) return prev;
      return {
        ...prev,
        [semesterId]: [...semCourses, course],
      };
    });
  }, []);

  const removeCourse = useCallback((semesterId, courseId) => {
    setPlan((prev) => ({
      ...prev,
      [semesterId]: (prev[semesterId] || []).filter((c) => c.id !== courseId),
    }));
  }, []);

  const moveCourse = useCallback(
    (fromSemester, toSemester, courseId, targetIndex = null) => {
      setPlan((prev) => {
        const fromCourses = [...(prev[fromSemester] || [])];
        const sourceIndex = fromCourses.findIndex((c) => c.id === courseId);
        if (sourceIndex === -1) return prev;

        const [course] = fromCourses.splice(sourceIndex, 1);

        if (fromSemester === toSemester) {
          let insertionIndex =
            targetIndex == null
              ? fromCourses.length
              : Math.max(0, Math.min(targetIndex, prev[fromSemester].length));

          // Adjust insertion index because we already removed the dragged item.
          if (sourceIndex < insertionIndex) {
            insertionIndex -= 1;
          }

          if (insertionIndex === sourceIndex) return prev;

          fromCourses.splice(insertionIndex, 0, course);
          return {
            ...prev,
            [fromSemester]: fromCourses,
          };
        }

        const toCourses = [...(prev[toSemester] || [])];
        if (toCourses.some((c) => c.id === courseId)) return prev;

        const insertionIndex =
          targetIndex == null
            ? toCourses.length
            : Math.max(0, Math.min(targetIndex, toCourses.length));
        toCourses.splice(insertionIndex, 0, course);

        return {
          ...prev,
          [fromSemester]: fromCourses,
          [toSemester]: toCourses,
        };
      });
    },
    [],
  );

  const clearSemester = useCallback((semesterId) => {
    setPlan((prev) => ({ ...prev, [semesterId]: [] }));
  }, []);

  const clearAll = useCallback(() => {
    setPlan(createEmptyPlan());
  }, []);

  const replacePlan = useCallback(
    (incoming) => {
      if (!incoming || typeof incoming !== "object") return;
      if (incoming.plan && typeof incoming.plan === "object") {
        const merged = { ...createEmptyPlan(), ...incoming.plan };
        setPlan(deduplicatePlan(merged));
      }
      const nextMajor =
        typeof incoming.major === "string" && incoming.major
          ? incoming.major
          : major;
      if (nextMajor !== major) {
        setMajorState(nextMajor);
      }
      if (incoming.secondMajor !== undefined) {
        setSecondMajorState(normalizeSecondMajor(incoming.secondMajor, nextMajor));
      } else {
        // Imports without the field keep the current second major, unless the
        // incoming primary collides with it.
        setSecondMajorState((prev) => normalizeSecondMajor(prev, nextMajor));
      }
      if (typeof incoming.studentName === "string") {
        setStudentName(incoming.studentName);
      }
      if (incoming.studyAway !== undefined) {
        setStudyAway(normalizeStudyAway(incoming.studyAway));
      }
    },
    [major],
  );

  const mergePlan = useCallback((incoming) => {
    if (!incoming || typeof incoming !== "object") return;
    if (!incoming.plan || typeof incoming.plan !== "object") return;

    setPlan((prev) => {
      const nextPlan = createEmptyPlan();
      const seenAcrossPlan = new Set();

      for (const semester of SEMESTERS) {
        const semesterId = semester.id;
        const existingCourses = Array.isArray(prev[semesterId])
          ? prev[semesterId]
          : [];

        const keptCourses = [];
        existingCourses.forEach((course) => {
          const courseId = course?.id;
          if (!courseId || seenAcrossPlan.has(courseId)) return;
          seenAcrossPlan.add(courseId);
          keptCourses.push(course);
        });

        nextPlan[semesterId] = keptCourses;
      }

      for (const semester of SEMESTERS) {
        const semesterId = semester.id;
        const importedCourses = Array.isArray(incoming.plan[semesterId])
          ? incoming.plan[semesterId]
          : [];

        importedCourses.forEach((course) => {
          const courseId = course?.id;
          if (!courseId || seenAcrossPlan.has(courseId)) return;
          nextPlan[semesterId].push(course);
          seenAcrossPlan.add(courseId);
        });
      }

      return deduplicatePlan(nextPlan);
    });
  }, []);

  const importPlan = useCallback(
    (incoming, mode = "replace") => {
      if (mode === "merge") {
        mergePlan(incoming);
        return;
      }

      replacePlan(incoming);
    },
    [mergePlan, replacePlan],
  );

  const toggleStudyAwaySemester = useCallback((semesterId) => {
    if (!STUDY_AWAY.eligibleSemesters.includes(semesterId)) {
      return;
    }

    setStudyAway((prev) => {
      const selected = prev.selectedSemesters.includes(semesterId);

      if (selected) {
        const nextLocations = { ...prev.locations };
        delete nextLocations[semesterId];
        return {
          selectedSemesters: prev.selectedSemesters.filter(
            (id) => id !== semesterId,
          ),
          locations: nextLocations,
        };
      }

      if (prev.selectedSemesters.length >= STUDY_AWAY.maxSemesters) {
        return prev;
      }

      const selectedSemesters = [...prev.selectedSemesters, semesterId].sort(
        (a, b) =>
          STUDY_AWAY.eligibleSemesters.indexOf(a) -
          STUDY_AWAY.eligibleSemesters.indexOf(b),
      );

      return {
        selectedSemesters,
        locations: {
          ...prev.locations,
          [semesterId]: prev.locations[semesterId] || "",
        },
      };
    });
  }, []);

  const setStudyAwayLocation = useCallback((semesterId, location) => {
    if (!STUDY_AWAY.eligibleSemesters.includes(semesterId)) {
      return;
    }
    if (location !== "" && !STUDY_AWAY.locations.includes(location)) {
      return;
    }

    setStudyAway((prev) => {
      const alreadySelected = prev.selectedSemesters.includes(semesterId);

      if (location === "") {
        if (!alreadySelected) {
          return prev;
        }

        return {
          selectedSemesters: prev.selectedSemesters,
          locations: {
            ...prev.locations,
            [semesterId]: "",
          },
        };
      }

      if (
        !alreadySelected &&
        prev.selectedSemesters.length >= STUDY_AWAY.maxSemesters
      ) {
        return prev;
      }

      const selectedSemesters = alreadySelected
        ? prev.selectedSemesters
        : [...prev.selectedSemesters, semesterId].sort(
            (a, b) =>
              STUDY_AWAY.eligibleSemesters.indexOf(a) -
              STUDY_AWAY.eligibleSemesters.indexOf(b),
          );

      return {
        selectedSemesters,
        locations: {
          ...prev.locations,
          [semesterId]: location,
        },
      };
    });
  }, []);

  const studyAwayWarnings = useMemo(() => {
    const warnings = [];
    const isCsDsMajor = activeMajors.some(
      (majorId) => majorId === "cs" || majorId === "data-science",
    );

    if (studyAway.selectedSemesters.length > STUDY_AWAY.maxSemesters) {
      warnings.push({
        id: "too-many-study-away-semesters",
        message: `You selected ${studyAway.selectedSemesters.length} study-away semesters. The recommended maximum is ${STUDY_AWAY.maxSemesters}.`,
      });
    }

    studyAway.selectedSemesters.forEach((semesterId) => {
      const semesterLabel =
        SEMESTERS.find((semester) => semester.id === semesterId)?.label ||
        semesterId;
      const selectedLocation = studyAway.locations[semesterId] || "";

      if (!selectedLocation) {
        warnings.push({
          id: `missing-location-${semesterId}`,
          semesterId,
          message: `${semesterLabel}: choose a study-away site for this semester.`,
        });
      }

      if (
        semesterId === "Y2-Spring" &&
        (selectedLocation === "New York" || selectedLocation === "Abu Dhabi")
      ) {
        warnings.push({
          id: `site-restriction-${semesterId}`,
          semesterId,
          message: `${semesterLabel}: New York and Abu Dhabi are not available during sophomore spring.`,
        });
      }

      if (!isCsDsMajor) return;

      const majorCourseCount = (plan[semesterId] || []).filter((course) =>
        isEffectiveMajorCourseForMajors(course, activeMajors),
      ).length;

      if (majorCourseCount > STUDY_AWAY.maxMajorCoursesPerSemester) {
        warnings.push({
          id: `major-overload-${semesterId}`,
          semesterId,
          message: `${semesterLabel}: ${majorCourseCount} major courses planned. Recommended maximum during study away is ${STUDY_AWAY.maxMajorCoursesPerSemester} for CS/DS.`,
        });
      }
    });

    return warnings;
  }, [activeMajors, plan, studyAway]);

  const allPlannedCourses = useMemo(() => {
    return Object.values(plan).flat();
  }, [plan]);

  const totalCredits = useMemo(() => {
    return allPlannedCourses.reduce((sum, c) => sum + c.credits, 0);
  }, [allPlannedCourses]);

  const semesterCredits = useMemo(() => {
    const credits = {};
    SEMESTERS.forEach((s) => {
      credits[s.id] = (plan[s.id] || []).reduce((sum, c) => sum + c.credits, 0);
    });
    return credits;
  }, [plan]);

  const requirementProgress = useMemo(() => {
    const progress = {};

    CORE_REQUIREMENTS.forEach((req) => {
      const courses = allPlannedCourses.filter((course) =>
        courseFulfillsRequirement(course, req, activeMajors),
      );
      const creditsTaken = courses.reduce((sum, c) => sum + c.credits, 0);
      progress[req.id] = {
        ...req,
        coursesTaken: courses.length,
        creditsTaken,
        fulfilled:
          courses.length >= req.coursesNeeded &&
          (req.subcourses || []).every(
            (subcourse) =>
              !subcourse.requirementId ||
              courses.some((course) =>
                course.requirementIds?.includes(subcourse.requirementId),
              ),
          ),
      };
    });

    const languageProgress = progress.language;
    if (languageProgress) {
      const languageCourses = allPlannedCourses.filter(
        (course) =>
          courseFulfillsRequirement(course, languageProgress, activeMajors),
      );
      const isEapCourse = (course) => EAP_COURSE_IDS.has(course.id);

      const eapCredits = languageCourses
        .filter(isEapCourse)
        .reduce((sum, course) => sum + course.credits, 0);

      const nonEapCredits = languageCourses
        .filter((course) => !isEapCourse(course))
        .reduce((sum, course) => sum + course.credits, 0);

      const chineseCreditsNeeded =
        typeof languageProgress.chineseCreditsNeeded === "number"
          ? languageProgress.chineseCreditsNeeded
          : 8;
      const internationalCreditsMin =
        typeof languageProgress.internationalCreditsMin === "number"
          ? languageProgress.internationalCreditsMin
          : 0;
      const internationalCreditsMax =
        typeof languageProgress.internationalCreditsMax === "number"
          ? languageProgress.internationalCreditsMax
          : 16;

      const track = eapCredits > 0 ? "chinese" : "international";
      const creditsTaken =
        track === "chinese"
          ? Math.min(eapCredits, chineseCreditsNeeded)
          : Math.min(nonEapCredits, internationalCreditsMax);

      progress.language = {
        ...languageProgress,
        coursesTaken:
          track === "chinese"
            ? languageCourses.filter(isEapCourse).length
            : languageCourses.filter((course) => !isEapCourse(course)).length,
        creditsTaken,
        creditsNeeded:
          track === "chinese" ? chineseCreditsNeeded : internationalCreditsMin,
        maxCreditsNeeded:
          track === "chinese" ? chineseCreditsNeeded : internationalCreditsMax,
        creditsNeededLabel:
          track === "chinese"
            ? `${chineseCreditsNeeded}`
            : `${internationalCreditsMin}-${internationalCreditsMax}`,
        track,
        fulfilled:
          track === "chinese"
            ? creditsTaken >= chineseCreditsNeeded
            : creditsTaken >= internationalCreditsMin,
      };
    }

    const majorReq = getMajorRequirement(major);
    const majorCourses = allPlannedCourses.filter((course) =>
      isEffectiveMajorCourse(course, major),
    );
    progress["major"] = {
      id: "major",
      label: majorReq.label,
      coursesNeeded: majorReq.coursesNeeded,
      creditsNeeded: majorReq.creditsNeeded,
      coursesTaken: majorCourses.length,
      creditsTaken: majorCourses.reduce((sum, c) => sum + c.credits, 0),
      fulfilled: majorReq.isConfigured
        ? majorCourses.length >= majorReq.coursesNeeded
        : false,
    };

    if (secondMajor) {
      const secondMajorReq = getMajorRequirement(secondMajor);
      const secondMajorCourses = allPlannedCourses.filter((course) =>
        isEffectiveMajorCourse(course, secondMajor),
      );
      progress["second-major"] = {
        id: "second-major",
        label: secondMajorReq.label,
        coursesNeeded: secondMajorReq.coursesNeeded,
        creditsNeeded: secondMajorReq.creditsNeeded,
        coursesTaken: secondMajorCourses.length,
        creditsTaken: secondMajorCourses.reduce((sum, c) => sum + c.credits, 0),
        fulfilled: secondMajorReq.isConfigured
          ? secondMajorCourses.length >= secondMajorReq.coursesNeeded
          : false,
        doubleCountedCourses: secondMajorCourses
          .filter((course) => isEffectiveMajorCourse(course, major))
          .map((course) => ({
            id: course.id,
            name: course.name,
            credits: course.credits,
          })),
      };
    }

    const electiveCourses = allPlannedCourses.filter(
      (course) =>
        getEffectiveCategoryForMajors(course, activeMajors) === "elective",
    );
    progress["electives"] = {
      id: "electives",
      label: "Free Electives",
      coursesTaken: electiveCourses.length,
      creditsTaken: electiveCourses.reduce((sum, c) => sum + c.credits, 0),
    };

    return progress;
  }, [allPlannedCourses, major, secondMajor, activeMajors]);

  const isCourseInPlan = useCallback(
    (courseId) => {
      return allPlannedCourses.some((c) => c.id === courseId);
    },
    [allPlannedCourses],
  );

  const getCourseSemester = useCallback(
    (courseId) => {
      for (const semester of SEMESTERS) {
        const semesterId = semester.id;
        if ((plan[semesterId] || []).some((course) => course.id === courseId)) {
          return semesterId;
        }
      }
      return null;
    },
    [plan],
  );

  // Build a map of courseId → list of unmet prerequisite groups.
  // A prerequisite group is "met" if any course in the group appears before it.
  const prereqWarnings = useMemo(() => {
    return buildPrerequisiteWarnings(
      plan,
      SEMESTERS.map((semester) => semester.id),
    );
  }, [plan]);

  return {
    plan,
    major,
    setMajor,
    secondMajor,
    setSecondMajor,
    studentName,
    setStudentName,
    studyAway,
    toggleStudyAwaySemester,
    setStudyAwayLocation,
    studyAwayWarnings,
    addCourse,
    removeCourse,
    moveCourse,
    clearSemester,
    clearAll,
    replacePlan,
    mergePlan,
    importPlan,
    totalCredits,
    semesterCredits,
    requirementProgress,
    isCourseInPlan,
    getCourseSemester,
    allPlannedCourses,
    prereqWarnings,
    loaded,
    syncStatus,
    retryCloudSave,
  };
}
