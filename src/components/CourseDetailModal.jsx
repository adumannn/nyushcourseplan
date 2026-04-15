import { X, AlertTriangle, BookOpen, Layers, GraduationCap } from 'lucide-react';
import { CATEGORIES, COURSE_CATALOG } from '../data/courses';

export default function CourseDetailModal({ course, prereqWarnings = {}, onClose }) {
  if (!course) return null;

  const categoryKey = typeof course.category === 'string'
    ? course.category.toLowerCase()
    : 'elective';
  const category = CATEGORIES[categoryKey] || CATEGORIES.elective;
  const unmetPrereqs = prereqWarnings[course.id] || [];

  // Look up prerequisite course names from catalog
  const prereqCourses = (course.prerequisites || []).map(preId => {
    const cat = COURSE_CATALOG.find(c => c.id === preId);
    return { id: preId, name: cat?.name || preId, code: cat?.code || preId, met: !unmetPrereqs.includes(preId) };
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: '460px' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{course.code}</h2>
          <button className="modal-close" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {/* Course name */}
          <h3 className="text-lg font-medium leading-snug">{course.name}</h3>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <GraduationCap className="h-4 w-4 text-muted-foreground/60" />
              <span className="text-muted-foreground">{course.credits} credits</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Layers className="h-4 w-4 text-muted-foreground/60" />
              <span className="text-muted-foreground">{course.department || 'N/A'}</span>
            </div>
          </div>

          {/* Category badge */}
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <span className="text-sm text-muted-foreground">{category.label}</span>
          </div>

          {/* Prerequisites */}
          {(prereqCourses.length > 0 || course.prerequisiteNote) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground/60" />
                <span className="text-xs tracking-wider uppercase text-muted-foreground font-medium">
                  Prerequisites
                </span>
              </div>

              {prereqCourses.length > 0 && (
                <div className="space-y-1.5 ml-6">
                  {prereqCourses.map(pre => (
                    <div key={pre.id} className="flex items-center gap-2 text-sm">
                      {pre.met ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-chart-2" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      )}
                      <span className={pre.met ? 'text-muted-foreground' : ''}>
                        {pre.code} — {pre.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {course.prerequisiteNote && (
                <p className="text-sm text-muted-foreground/80 ml-6">
                  {course.prerequisiteNote}
                </p>
              )}

              {unmetPrereqs.length > 0 && (
                <div className="flex items-start gap-2 ml-6 mt-1 text-sm text-amber-500">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    {unmetPrereqs.length === 1
                      ? '1 prerequisite not placed in an earlier semester'
                      : `${unmetPrereqs.length} prerequisites not placed in earlier semesters`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Majors */}
          {course.majors && course.majors.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Relevant to: {course.majors.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
