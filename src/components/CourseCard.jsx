import { GripVertical, X } from 'lucide-react';

export default function CourseCard({ course, semesterKey, onRemove }) {
  return (
    <div className="group relative flex items-center gap-3 px-4 py-3 bg-accent/10 border border-border/30 rounded-md hover:bg-accent/20 hover:border-border/50 transition-all cursor-move">
      <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm">{course.name}</span>
          <span className="text-xs text-muted-foreground/60 font-mono">
            {course.code}
          </span>
        </div>
        {course.category && (
          <div className="text-xs text-muted-foreground/60 mt-0.5">
            {course.category}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm tabular-nums text-muted-foreground">
          {course.credits} cr
        </span>
        <button
          onClick={() => onRemove(semesterKey, course.id)}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      </div>
    </div>
  );
}
