import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { SEMESTERS, COURSE_CATALOG, CORE_REQUIREMENTS, MAJOR_REQUIREMENTS } from '../data/courses';
import { localStoragePlan, supabasePlan } from '../lib/planStorage';

function createEmptyPlan() {
  const plan = {};
  SEMESTERS.forEach(s => { plan[s.id] = []; });
  return plan;
}

export default function usePlanner(user) {
  const [plan, setPlan] = useState(createEmptyPlan);
  const [major, setMajor] = useState('cs');
  const [studentName, setStudentName] = useState('');
  const [planId, setPlanId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const saveTimeout = useRef(null);

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
          setPlan(data.plan);
          setMajor(data.major);
          setStudentName(data.studentName);
          setPlanId(data.planId);
        }
      } else {
        const data = await localStoragePlan.load();
        if (cancelled) return;
        if (data) {
          setPlan(data.plan || createEmptyPlan());
          setMajor(data.major || 'cs');
          setStudentName(data.studentName || '');
        }
        setPlanId(null);
      }

      setLoaded(true);
    }

    load();
    return () => { cancelled = true; };
  }, [user, isCloud]);

  // Debounced save on changes
  useEffect(() => {
    if (!loaded) return;

    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      if (isCloud && planId) {
        supabasePlan.save(user.id, { planId, plan, major, studentName });
      }
      // Always write to localStorage as cache
      localStoragePlan.save({ plan, major, studentName });
    }, 500);

    return () => clearTimeout(saveTimeout.current);
  }, [plan, major, studentName, isCloud, planId, user, loaded]);

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

  const moveCourse = useCallback((fromSemester, toSemester, courseId) => {
    setPlan(prev => {
      const course = (prev[fromSemester] || []).find(c => c.id === courseId);
      if (!course) return prev;
      if ((prev[toSemester] || []).some(c => c.id === courseId)) return prev;
      return {
        ...prev,
        [fromSemester]: prev[fromSemester].filter(c => c.id !== courseId),
        [toSemester]: [...(prev[toSemester] || []), course],
      };
    });
  }, []);

  const clearSemester = useCallback((semesterId) => {
    setPlan(prev => ({ ...prev, [semesterId]: [] }));
  }, []);

  const clearAll = useCallback(() => {
    setPlan(createEmptyPlan());
  }, []);

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
    const majorCourses = allPlannedCourses.filter(c => c.category === 'major');
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
