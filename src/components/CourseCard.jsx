import { useRef } from 'react';
import { GripVertical, X, Info, AlertTriangle } from 'lucide-react';
import { CATEGORIES } from '../data/courses';

function withAlpha(color, alpha) {
  if (typeof color !== 'string' || !color.startsWith('#')) {
    return `rgba(84, 110, 122, ${alpha})`;
  }

  const raw = color.slice(1);
  const hex = raw.length === 3
    ? raw.split('').map((char) => `${char}${char}`).join('')
    : raw;

  if (hex.length !== 6) {
    return `rgba(84, 110, 122, ${alpha})`;
  }

  const value = Number.parseInt(hex, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function CourseCard({
  course,
  semesterKey,
  onRemove,
  onDragStart,
  onDragEnd,
  onTap,
  onClick,
  touchMode = false,
  isDragging = false,
  hasPrereqWarning = false,
}) {
  const didDragRef = useRef(false);

  const categoryKey = typeof course.category === 'string'
    ? course.category.toLowerCase()
    : 'elective';
  const categoryColor = CATEGORIES[categoryKey]?.color || CATEGORIES.elective.color;
  const cardStyle = {
    borderLeftWidth: '3px',
    borderLeftColor: categoryColor,
    backgroundImage: `linear-gradient(90deg, ${withAlpha(categoryColor, 0.18)} 0%, ${withAlpha(categoryColor, 0.06)} 42%, transparent 100%)`,
  };
  const categoryBadgeStyle = {
    backgroundColor: withAlpha(categoryColor, 0.14),
    borderColor: withAlpha(categoryColor, 0.36),
    color: categoryColor,
  };

  return (
    <div
      draggable={!touchMode}
      onDragStart={(event) => {
        didDragRef.current = true;
        onDragStart?.(event, course.id);
      }}
      onDragEnd={(event) => {
        onDragEnd?.(event);
        setTimeout(() => { didDragRef.current = false; }, 0);
      }}
      onClick={touchMode ? () => onTap?.() : (event) => {
        if (!event.defaultPrevented && !didDragRef.current) onClick?.();
      }}
      aria-grabbed={isDragging}
      style={cardStyle}
      className={`planner-course-card group relative flex items-center gap-3 px-4 py-3 bg-accent/10 border rounded-md transition-all ${
        touchMode ? 'cursor-pointer' : 'cursor-pointer'
      } ${
        isDragging
          ? 'opacity-45 border-[#57068c]/50 ring-1 ring-[#57068c]/30'
          : hasPrereqWarning
            ? 'border-amber-500/50 hover:bg-accent/20 hover:border-amber-500/70'
            : 'border-border/30 hover:bg-accent/20 hover:border-border/50'
      }`}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 cursor-grab active:cursor-grabbing" />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm">{course.name}</span>
          <span className="text-xs text-muted-foreground/60 font-mono">
            {course.code}
          </span>
        </div>
        {course.category && (
          <div className="mt-1.5">
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium uppercase tracking-wide"
              style={categoryBadgeStyle}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: categoryColor }}
              />
              {course.category}
            </span>
          </div>
        )}
        {course.prerequisiteNote && (
          <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-muted-foreground/70">
            <Info className="h-3 w-3 shrink-0 mt-0.5" />
            <span>Prereq: {course.prerequisiteNote}</span>
          </div>
        )}
        {hasPrereqWarning && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-500">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>Prerequisites not met in earlier semesters</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm tabular-nums text-muted-foreground">
          {course.credits} cr
        </span>
        {touchMode && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onClick?.();
            }}
            className="p-2 hover:bg-accent/20 rounded transition-all"
            aria-label="Course details"
          >
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
        <button
          onClick={(event) => {
            event.stopPropagation();
            onRemove(semesterKey, course.id);
          }}
          className={`${touchMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} p-2 hover:bg-destructive/10 rounded transition-all`}
        >
          <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      </div>
    </div>
  );
}
