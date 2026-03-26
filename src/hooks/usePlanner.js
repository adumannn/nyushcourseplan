import { useState, useEffect, useCallback, useMemo } from 'react';
import { SEMESTERS, COURSE_CATALOG, CORE_REQUIREMENTS, MAJOR_REQUIREMENTS, GRADUATION_CREDITS } from '../data/courses';

const STORAGE_KEY = 'nyu-shanghai-course-planner';

function loadFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Failed to load planner data:', e);
  }
  return null;
}

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save planner data:', e);
  }
}

function createEmptyPlan() {
  const plan = {};
  SEMESTERS.forEach(s => { plan[s.id] = []; });
  return plan;
}

export default function usePlanner() {
  const stored = loadFromStorage();

  const [plan, setPlan] = useState(() => stored?.plan || createEmptyPlan());
  const [major, setMajor] = useState(() => stored?.major || 'cs');
  const [studentName, setStudentName] = useState(() => stored?.studentName || '');

  // Persist to localStorage on changes
  useEffect(() => {
    saveToStorage({ plan, major, studentName });
  }, [plan, major, studentName]);

  const addCourse = useCallback((semesterId, course) => {
    setPlan(prev => {
      const semCourses = prev[semesterId] || [];
      // Don't add duplicates in same semester
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
      // Don't add duplicates
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

  // All courses across all semesters
  const allPlannedCourses = useMemo(() => {
    return Object.values(plan).flat();
  }, [plan]);

  // Total credits
  const totalCredits = useMemo(() => {
    return allPlannedCourses.reduce((sum, c) => sum + c.credits, 0);
  }, [allPlannedCourses]);

  // Credits per semester
  const semesterCredits = useMemo(() => {
    const credits = {};
    SEMESTERS.forEach(s => {
      credits[s.id] = (plan[s.id] || []).reduce((sum, c) => sum + c.credits, 0);
    });
    return credits;
  }, [plan]);

  // Requirement progress
  const requirementProgress = useMemo(() => {
    const progress = {};

    // Core requirements
    CORE_REQUIREMENTS.forEach(req => {
      const courses = allPlannedCourses.filter(c => c.category === req.category);
      progress[req.id] = {
        ...req,
        coursesTaken: courses.length,
        creditsTaken: courses.reduce((sum, c) => sum + c.credits, 0),
        fulfilled: courses.length >= req.coursesNeeded,
      };
    });

    // Major requirements
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

    // Elective credits (everything that doesn't fit above)
    const electiveCourses = allPlannedCourses.filter(c => c.category === 'elective');
    progress['electives'] = {
      id: 'electives',
      label: 'Free Electives',
      coursesTaken: electiveCourses.length,
      creditsTaken: electiveCourses.reduce((sum, c) => sum + c.credits, 0),
    };

    return progress;
  }, [allPlannedCourses, major]);

  // Check if a course is already planned somewhere
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
  };
}
