import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  SEMESTERS,
  COURSE_CATALOG,
  CORE_REQUIREMENTS,
  MAJOR_REQUIREMENTS,
  STUDY_AWAY,
} from '../data/courses';
import { localStoragePlan, supabasePlan } from '../lib/planStorage';

function createEmptyPlan() {
  const plan = {};
  SEMESTERS.forEach(s => { plan[s.id] = []; });
  return plan;
}

// Safety net: remove duplicate courses within each semester
// Also refreshes course metadata from the catalog (e.g. category renames)
function deduplicatePlan(plan) {
  const catalogById = new Map(COURSE_CATALOG.map(c => [c.id, c]));
  const result = {};
  for (const [semId, courses] of Object.entries(plan)) {
    const seen = new Set();
    result[semId] = (courses || []).filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    }).map(c => {
      const catalogCourse = catalogById.get(c.id);
      if (catalogCourse) return { ...c, category: catalogCourse.category };
      return c;
    });
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

  if (!studyAway || typeof studyAway !== 'object') {
    return defaults;
  }

  const selectedSemesters = Array.from(
    new Set((studyAway.selectedSemesters || []).filter((semesterId) => semesterSet.has(semesterId)))
  );

  const locations = {};
  selectedSemesters.forEach((semesterId) => {
    const value = studyAway.locations?.[semesterId];
    locations[semesterId] = locationSet.has(value) ? value : '';
  });

  return {
    selectedSemesters,
    locations,
  };
}

export default function usePlanner(user) {
  const [plan, setPlan] = useState(createEmptyPlan);
  const [major, setMajor] = useState('cs');
  const [studentName, setStudentName] = useState('');
  const [studyAway, setStudyAway] = useState(createDefaultStudyAway);
  const [planId, setPlanId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const saveTimeout = useRef(null);
  const saveInProgress = useRef(false);
  const skipNextSave = useRef(false);

  const isCloud = !!user;

  // Load plan on mount or auth change
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoaded(false);

      if (isCloud) {
        const data = await supabasePlan.load(user.id);
        if (cancelled) return;
        if (data) {
          setPlan(deduplicatePlan(data.plan));
          setMajor(data.major);
          setStudentName(data.studentName);
          setStudyAway(normalizeStudyAway(data.studyAway));
          setPlanId(data.planId);
        }
      } else {
        const data = await localStoragePlan.load();
        if (cancelled) return;
        if (data) {
          setPlan(deduplicatePlan(data.plan || createEmptyPlan()));
          setMajor(data.major || 'cs');
          setStudentName(data.studentName || '');
          setStudyAway(normalizeStudyAway(data.studyAway));
        }
        setPlanId(null);
      }

      // Don't save the data we just loaded back to the database
      skipNextSave.current = true;
      setLoaded(true);
    }

    load();
    return () => { cancelled = true; };
  }, [user, isCloud]);

  // Debounced save on changes
  useEffect(() => {
    if (!loaded) return;

    // Skip the save triggered by the load itself
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      // Prevent concurrent saves (DELETE+INSERT is not atomic)
      if (saveInProgress.current) return;
      saveInProgress.current = true;

      try {
        if (isCloud && planId) {
          await supabasePlan.save(user.id, {
            planId,
            plan,
            major,
            studentName,
            studyAway,
          });
        }
        // Always write to localStorage as cache
        localStoragePlan.save({ plan, major, studentName, studyAway });
      } finally {
        saveInProgress.current = false;
      }
    }, 500);

    return () => clearTimeout(saveTimeout.current);
  }, [plan, major, studentName, studyAway, isCloud, planId, user, loaded]);

  const addCourse = useCallback((semesterId, course) => {
    setPlan(prev => {
      const semCourses = prev[semesterId] || [];
      if (semCourses.some(c => c.id === course.id)) return prev;
      return { ...prev, [semesterId]: [...semCourses, course] };
    });
  }, []);

  const removeCourse = useCallback((semesterId, courseId) => {
    setPlan(prev => ({
      ...prev,
      [semesterId]: (prev[semesterId] || []).filter(c => c.id !== courseId),
    }));
  }, []);

  const moveCourse = useCallback((fromSemester, toSemester, courseId, targetIndex = null) => {
    setPlan(prev => {
      const fromCourses = [...(prev[fromSemester] || [])];
      const sourceIndex = fromCourses.findIndex(c => c.id === courseId);
      if (sourceIndex === -1) return prev;

      const [course] = fromCourses.splice(sourceIndex, 1);

      if (fromSemester === toSemester) {
        let insertionIndex =
          targetIndex == null ? fromCourses.length : Math.max(0, Math.min(targetIndex, prev[fromSemester].length));

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
      if (toCourses.some(c => c.id === courseId)) return prev;

      const insertionIndex =
        targetIndex == null ? toCourses.length : Math.max(0, Math.min(targetIndex, toCourses.length));
      toCourses.splice(insertionIndex, 0, course);

      return {
        ...prev,
        [fromSemester]: fromCourses,
        [toSemester]: toCourses,
      };
    });
  }, []);

  const clearSemester = useCallback((semesterId) => {
    setPlan(prev => ({ ...prev, [semesterId]: [] }));
  }, []);

  const clearAll = useCallback(() => {
    setPlan(createEmptyPlan());
  }, []);

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
          selectedSemesters: prev.selectedSemesters.filter((id) => id !== semesterId),
          locations: nextLocations,
        };
      }

      return {
        selectedSemesters: [...prev.selectedSemesters, semesterId],
        locations: {
          ...prev.locations,
          [semesterId]: prev.locations[semesterId] || '',
        },
      };
    });
  }, []);

  const setStudyAwayLocation = useCallback((semesterId, location) => {
    if (!STUDY_AWAY.eligibleSemesters.includes(semesterId)) {
      return;
    }
    if (!STUDY_AWAY.locations.includes(location)) {
      return;
    }

    setStudyAway((prev) => {
      const selectedSemesters = prev.selectedSemesters.includes(semesterId)
        ? prev.selectedSemesters
        : [...prev.selectedSemesters, semesterId];

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
    const isCsDsMajor = major === 'cs' || major === 'ds';

    if (studyAway.selectedSemesters.length > STUDY_AWAY.maxSemesters) {
      warnings.push({
        id: 'too-many-study-away-semesters',
        message: `You selected ${studyAway.selectedSemesters.length} study-away semesters. The recommended maximum is ${STUDY_AWAY.maxSemesters}.`,
      });
    }

    studyAway.selectedSemesters.forEach((semesterId) => {
      const semesterLabel = SEMESTERS.find((semester) => semester.id === semesterId)?.label || semesterId;
      const selectedLocation = studyAway.locations[semesterId] || '';

      if (!selectedLocation) {
        warnings.push({
          id: `missing-location-${semesterId}`,
          message: `${semesterLabel}: choose a study-away site for this semester.`,
        });
      }

      if (
        semesterId === 'Y2-Spring'
        && (selectedLocation === 'New York' || selectedLocation === 'Abu Dhabi')
      ) {
        warnings.push({
          id: `site-restriction-${semesterId}`,
          message: `${semesterLabel}: New York and Abu Dhabi are not available during sophomore spring.`,
        });
      }

      if (!isCsDsMajor) return;

      const majorCourseCount = (plan[semesterId] || [])
        .filter((course) => course.category === 'major-required' || course.category === 'major-elective')
        .length;

      if (majorCourseCount > STUDY_AWAY.maxMajorCoursesPerSemester) {
        warnings.push({
          id: `major-overload-${semesterId}`,
          message: `${semesterLabel}: ${majorCourseCount} major courses planned. Recommended maximum during study away is ${STUDY_AWAY.maxMajorCoursesPerSemester} for CS/DS.`,
        });
      }
    });

    return warnings;
  }, [major, plan, studyAway]);

  const allPlannedCourses = useMemo(() => {
    return Object.values(plan).flat();
  }, [plan]);

  const totalCredits = useMemo(() => {
    return allPlannedCourses.reduce((sum, c) => sum + c.credits, 0);
  }, [allPlannedCourses]);

  const semesterCredits = useMemo(() => {
    const credits = {};
    SEMESTERS.forEach(s => {
      credits[s.id] = (plan[s.id] || []).reduce((sum, c) => sum + c.credits, 0);
    });
    return credits;
  }, [plan]);

  const requirementProgress = useMemo(() => {
    const progress = {};

    CORE_REQUIREMENTS.forEach(req => {
      const courses = allPlannedCourses.filter(c => c.category === req.category);
      progress[req.id] = {
        ...req,
        coursesTaken: courses.length,
        creditsTaken: courses.reduce((sum, c) => sum + c.credits, 0),
        fulfilled: courses.length >= req.coursesNeeded,
      };
    });

    const majorReq = MAJOR_REQUIREMENTS[major] || MAJOR_REQUIREMENTS.custom;
    const majorCourses = allPlannedCourses.filter(c => c.category === 'major-required' || c.category === 'major-elective');
    progress['major'] = {
      id: 'major',
      label: majorReq.label,
      coursesNeeded: majorReq.coursesNeeded,
      creditsNeeded: majorReq.creditsNeeded,
      coursesTaken: majorCourses.length,
      creditsTaken: majorCourses.reduce((sum, c) => sum + c.credits, 0),
      fulfilled: majorCourses.length >= majorReq.coursesNeeded,
    };

    const electiveCourses = allPlannedCourses.filter(c => c.category === 'elective');
    progress['electives'] = {
      id: 'electives',
      label: 'Free Electives',
      coursesTaken: electiveCourses.length,
      creditsTaken: electiveCourses.reduce((sum, c) => sum + c.credits, 0),
    };

    return progress;
  }, [allPlannedCourses, major]);

  const isCourseInPlan = useCallback((courseId) => {
    return allPlannedCourses.some(c => c.id === courseId);
  }, [allPlannedCourses]);

  return {
    plan,
    major,
    setMajor,
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
    totalCredits,
    semesterCredits,
    requirementProgress,
    isCourseInPlan,
    allPlannedCourses,
    loaded,
  };
}
