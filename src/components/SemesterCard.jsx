import { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import CourseCard from './CourseCard';

export default function SemesterCard({
  semesterKey,
  year,
  semester,
  courses,
  credits,
  onRemoveCourse,
  onAddClick,
  onCourseDragStart,
  onCourseDragEnd,
  onDragOverIndex,
  onDropAtIndex,
  dragState,
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isDragActive = Boolean(dragState?.courseId);

  const renderDropZone = (index) => {
    if (!isDragActive) return null;

    const isTarget = dragState.overSemester === semesterKey && dragState.overIndex === index;
    return (
      <div
        onDragOver={(event) => onDragOverIndex(event, semesterKey, index)}
        onDrop={(event) => onDropAtIndex(event, semesterKey, index)}
        className="h-3 -my-0.5 flex items-center"
      >
        <div
          className={`w-full rounded-full transition-all ${
            isTarget ? 'h-0.5 bg-[#57068c]/70' : 'h-px bg-transparent'
          }`}
        />
      </div>
    );
  };

  return (
    <div className="planner-semester-row border-b border-border/40 last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        onDragOver={(event) => onDragOverIndex(event, semesterKey, courses.length)}
        onDrop={(event) => onDropAtIndex(event, semesterKey, courses.length)}
        className="planner-semester-toggle w-full flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 hover:bg-accent/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs tracking-wider uppercase text-muted-foreground whitespace-nowrap">
            {year}
          </span>
          <span className="text-sm text-muted-foreground/60">{semester}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm tabular-nums">{credits}</span>
            <span className="text-xs text-muted-foreground">credits</span>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {isExpanded && (
        <div className="planner-semester-body px-4 sm:px-6 pb-3 sm:pb-4 min-h-24">
          {courses.length === 0 ? (
            <button
              onClick={() => onAddClick(semesterKey)}
              onDragOver={(event) => onDragOverIndex(event, semesterKey, 0)}
              onDrop={(event) => onDropAtIndex(event, semesterKey, 0)}
              className={`planner-semester-empty w-full py-6 sm:py-8 border border-dashed rounded-lg transition-colors flex items-center justify-center gap-2 text-sm ${
                isDragActive && dragState.overSemester === semesterKey && dragState.overIndex === 0
                  ? 'border-[#57068c]/70 bg-[#57068c]/8 text-foreground'
                  : 'border-border/40 hover:border-border/60 hover:bg-accent/5 text-muted-foreground'
              }`}
            >
              <Plus className="h-4 w-4" />
              Click to add courses
            </button>
          ) : (
            <div className="space-y-2">
              {courses.map((course, index) => (
                <div key={course.id}>
                  {renderDropZone(index)}
                  <CourseCard
                    course={course}
                    semesterKey={semesterKey}
                    onRemove={onRemoveCourse}
                    onDragStart={(event, courseId) => onCourseDragStart(event, semesterKey, courseId)}
                    onDragEnd={onCourseDragEnd}
                    isDragging={
                      dragState.fromSemester === semesterKey
                      && dragState.courseId === course.id
                    }
                  />
                </div>
              ))}
              {renderDropZone(courses.length)}
              <button
                onClick={() => onAddClick(semesterKey)}
                className="planner-semester-add w-full py-2.5 sm:py-3 border border-dashed border-border/30 rounded-md hover:border-border/60 hover:bg-accent/5 transition-colors flex items-center justify-center gap-2 text-sm text-muted-foreground"
              >
                <Plus className="h-4 w-4" />
                Add course
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
