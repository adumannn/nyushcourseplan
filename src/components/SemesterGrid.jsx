import { useCallback, useState } from 'react';
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

  const resetDragState = useCallback(() => {
    setDragState(createEmptyDragState());
  }, []);

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

  return (
    <div className="planner-grid">
      {years.map(year => (
        <div key={year.id} className="planner-year-block border-b border-border/40 last:border-b-0">
          <div className="planner-year-heading px-6 py-3 bg-accent/5 border-b border-border/30">
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
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
