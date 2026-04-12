import { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import CourseCard from './CourseCard';

export default function SemesterCard({ semesterKey, year, semester, courses, credits, onRemoveCourse, onAddClick }) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-accent/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs tracking-wider uppercase text-muted-foreground">
            {year}
          </span>
          <span className="text-sm text-muted-foreground/60">{semester}</span>
        </div>
        <div className="flex items-center gap-4">
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
        <div className="px-6 pb-4 min-h-24">
          {courses.length === 0 ? (
            <button
              onClick={() => onAddClick(semesterKey)}
              className="w-full py-8 border border-dashed border-border/40 rounded-lg hover:border-border/60 hover:bg-accent/5 transition-colors flex items-center justify-center gap-2 text-sm text-muted-foreground"
            >
              <Plus className="h-4 w-4" />
              Click to add courses
            </button>
          ) : (
            <div className="space-y-2">
              {courses.map(course => (
                <CourseCard
                  key={course.id}
                  course={course}
                  semesterKey={semesterKey}
                  onRemove={onRemoveCourse}
                />
              ))}
              <button
                onClick={() => onAddClick(semesterKey)}
                className="w-full py-3 border border-dashed border-border/30 rounded-md hover:border-border/60 hover:bg-accent/5 transition-colors flex items-center justify-center gap-2 text-sm text-muted-foreground"
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
