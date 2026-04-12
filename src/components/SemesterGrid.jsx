import { useCallback, useEffect, useMemo, useState } from 'react';
import { SEMESTERS } from '../data/courses';
import SemesterCard from './SemesterCard';

const years = [
  { id: 'y1', label: 'Y1', name: 'Freshman', semesters: ['Fall', 'Spring'] },
  { id: 'y2', label: 'Y2', name: 'Sophomore', semesters: ['Fall', 'Spring'] },
  { id: 'y3', label: 'Y3', name: 'Junior', semesters: ['Fall', 'Spring'] },
  { id: 'y4', label: 'Y4', name: 'Senior', semesters: ['Fall', 'Spring'] },
];

function createEmptyDragState() {
  return {
    courseId: null,
    fromSemester: null,
    overSemester: null,
    overIndex: null,
  };
}

function readDragPayload(event) {
  const transfer = event.dataTransfer;
  if (!transfer) return null;

  const raw = transfer.getData('application/x-nyu-course') || transfer.getData('text/plain');
  if (!raw) return null;

  try {
    const data = JSON.parse(raw);
    if (typeof data?.courseId === 'string' && typeof data?.fromSemester === 'string') {
      return { courseId: data.courseId, fromSemester: data.fromSemester };
    }
    return null;
  } catch {
    return null;
  }
}

export default function SemesterGrid({
  plan,
  semesterCredits,
  onRemoveCourse,
  onAddClick,
  onMoveCourse,
}) {
  const [dragState, setDragState] = useState(createEmptyDragState);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const updateTouchMode = () => {
      setIsTouchDevice(mediaQuery.matches || window.navigator.maxTouchPoints > 0);
    };

    updateTouchMode();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateTouchMode);
      return () => mediaQuery.removeEventListener('change', updateTouchMode);
    }

    mediaQuery.addListener(updateTouchMode);
    return () => mediaQuery.removeListener(updateTouchMode);
  }, []);

  const resetDragState = useCallback(() => {
    setDragState(createEmptyDragState());
  }, []);

  const selectedCourseName = useMemo(() => {
    if (!dragState.courseId) return null;

    const selectedCourse = Object.values(plan)
      .flat()
      .find((course) => course.id === dragState.courseId);

    return selectedCourse?.name || 'Selected course';
  }, [dragState.courseId, plan]);

  const handleCourseDragStart = useCallback((event, fromSemester, courseId) => {
    const payload = JSON.stringify({ courseId, fromSemester });
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-nyu-course', payload);
      event.dataTransfer.setData('text/plain', payload);
    }

    setDragState({
      courseId,
      fromSemester,
      overSemester: fromSemester,
      overIndex: null,
    });
  }, []);

  const handleDragOverIndex = useCallback((event, semesterId, index) => {
    if (!dragState.courseId) return;

    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';

    setDragState(prev => {
      if (!prev.courseId) return prev;
      if (prev.overSemester === semesterId && prev.overIndex === index) return prev;
      return { ...prev, overSemester: semesterId, overIndex: index };
    });
  }, [dragState.courseId]);

  const handleDropAtIndex = useCallback((event, semesterId, index) => {
    event.preventDefault();

    const payload = readDragPayload(event)
      || (dragState.courseId && dragState.fromSemester
        ? { courseId: dragState.courseId, fromSemester: dragState.fromSemester }
        : null);

    if (payload?.courseId && payload?.fromSemester) {
      onMoveCourse(payload.fromSemester, semesterId, payload.courseId, index);
    }

    resetDragState();
  }, [dragState.courseId, dragState.fromSemester, onMoveCourse, resetDragState]);

  const handleCourseDragEnd = useCallback(() => {
    resetDragState();
  }, [resetDragState]);

  const activateMobileMove = useCallback((fromSemester, courseId) => {
    setDragState({
      courseId,
      fromSemester,
      overSemester: fromSemester,
      overIndex: null,
    });
  }, []);

  const commitMobileMove = useCallback((toSemester, index) => {
    if (!dragState.courseId || !dragState.fromSemester) return false;

    onMoveCourse(dragState.fromSemester, toSemester, dragState.courseId, index);
    resetDragState();
    return true;
  }, [dragState.courseId, dragState.fromSemester, onMoveCourse, resetDragState]);

  const handleCourseTap = useCallback((semesterId, courseId, index) => {
    if (!isTouchDevice) return;

    if (!dragState.courseId || !dragState.fromSemester) {
      activateMobileMove(semesterId, courseId);
      return;
    }

    if (dragState.courseId === courseId && dragState.fromSemester === semesterId) {
      resetDragState();
      return;
    }

    commitMobileMove(semesterId, index);
  }, [activateMobileMove, commitMobileMove, dragState.courseId, dragState.fromSemester, isTouchDevice, resetDragState]);

  const handleTapAtIndex = useCallback((semesterId, index) => {
    if (!isTouchDevice || !dragState.courseId || !dragState.fromSemester) {
      return false;
    }

    return commitMobileMove(semesterId, index);
  }, [commitMobileMove, dragState.courseId, dragState.fromSemester, isTouchDevice]);

  return (
    <div className="planner-grid">
      {isTouchDevice && dragState.courseId && (
        <div className="mx-4 sm:mx-6 my-3 flex items-center justify-between gap-3 rounded-md border border-[#57068c]/35 bg-[#57068c]/12 px-3 py-2">
          <span className="text-xs text-muted-foreground truncate">
            Moving {selectedCourseName}. Tap a course or add area to place it.
          </span>
          <button
            type="button"
            onClick={resetDragState}
            className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent/30"
          >
            Cancel
          </button>
        </div>
      )}
      {years.map(year => (
        <div key={year.id} className="planner-year-block border-b border-border/40 last:border-b-0">
          <div className="planner-year-heading px-4 sm:px-6 py-2.5 sm:py-3 bg-accent/5 border-b border-border/30">
            <div className="flex items-center gap-3">
              <span className="text-xs tracking-wider uppercase text-muted-foreground font-medium">
                {year.label}
              </span>
              <span className="text-sm text-muted-foreground/80">
                {year.name}
              </span>
            </div>
          </div>
          {year.semesters.map(semester => {
            const semesterKey = `Y${year.id.slice(1)}-${semester}`;
            const semObj = SEMESTERS.find(s => s.id === semesterKey);
            if (!semObj) return null;
            return (
              <SemesterCard
                key={semesterKey}
                semesterKey={semesterKey}
                year={`${semester} ${year.label.toUpperCase()}`}
                semester={semester}
                courses={plan[semesterKey] || []}
                credits={semesterCredits[semesterKey] || 0}
                onRemoveCourse={onRemoveCourse}
                onAddClick={onAddClick}
                onCourseDragStart={handleCourseDragStart}
                onCourseDragEnd={handleCourseDragEnd}
                onDragOverIndex={handleDragOverIndex}
                onDropAtIndex={handleDropAtIndex}
                dragState={dragState}
                isTouchDevice={isTouchDevice}
                onCourseTap={handleCourseTap}
                onTapAtIndex={handleTapAtIndex}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
