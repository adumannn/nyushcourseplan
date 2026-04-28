import {
  X,
  AlertTriangle,
  BookOpen,
  Layers,
  GraduationCap,
  CheckSquare,
} from "lucide-react";
import { CATEGORIES, CORE_REQUIREMENTS } from "../data/courses";
import useCatalog from "../hooks/useCatalog";
import { LOCAL_CATALOG_BY_ID } from "../lib/localCatalog";
import { getEffectiveCategory } from "../lib/majorCourseRules";
import { serializePrerequisiteGroup } from "../lib/prerequisites";
import ReviewSummary from "./ReviewSummary";

export default function CourseDetailModal({
  course: passedCourse,
  prereqWarnings = {},
  major,
  onClose,
}) {
  const { coursesById } = useCatalog();

  if (!passedCourse) return null;

  // Resolve from the active catalog first so remote-only courses can still
  // pick up the latest merged metadata when available.
  const course =
    coursesById.get(passedCourse.id) ||
    LOCAL_CATALOG_BY_ID.get(passedCourse.id) ||
    passedCourse;

  const resolvedCategory = getEffectiveCategory(course, major);
  const categoryKey =
    typeof resolvedCategory === "string"
      ? resolvedCategory.toLowerCase()
      : "elective";
  const category = CATEGORIES[categoryKey] || CATEGORIES.elective;
  const unmetPrereqs = prereqWarnings[course.id] || [];
  const unmetGroupKeys = new Set(
    unmetPrereqs.map((group) => serializePrerequisiteGroup(group)),
  );

  const prerequisiteGroups = (
    Array.isArray(course.prerequisiteGroups) && course.prerequisiteGroups.length
      ? course.prerequisiteGroups
      : (course.prerequisites || []).map((preId) => [preId])
  ).map((group) => {
    const options = group.map((preId) => {
      const catalogCourse =
        coursesById.get(preId) || LOCAL_CATALOG_BY_ID.get(preId);
      return {
        id: preId,
        name: catalogCourse?.name || preId,
        code: catalogCourse?.code || preId,
      };
    });

    return {
      key: serializePrerequisiteGroup(group),
      met: !unmetGroupKeys.has(serializePrerequisiteGroup(group)),
      options,
    };
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: "460px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{course.code}</h2>
          <button className="modal-close" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="p-5 space-y-4 overflow-y-auto"
          style={{ maxHeight: "60vh" }}
        >
          {/* Course name */}
          <h3 className="text-lg font-medium leading-snug">{course.name}</h3>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <GraduationCap className="h-4 w-4 text-muted-foreground/60" />
              <span className="text-muted-foreground">
                {course.credits} credits
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Layers className="h-4 w-4 text-muted-foreground/60" />
              <span className="text-muted-foreground">
                {course.department || "N/A"}
              </span>
            </div>
          </div>

          {/* Category badge */}
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <span className="text-sm text-muted-foreground">
              {category.label}
            </span>
          </div>

          {/* Requirements fulfilled */}
          {course.requirementIds && course.requirementIds.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-muted-foreground/60" />
                <span className="text-xs tracking-wider uppercase text-muted-foreground font-medium">
                  Fulfills Requirements
                </span>
              </div>
              <div className="space-y-1.5 ml-6">
                {course.requirementIds.map((reqId) => {
                  const req = CORE_REQUIREMENTS.find((r) => r.id === reqId);
                  return (
                    <div
                      key={reqId}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-chart-2" />
                      <span>{req ? req.label : reqId}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Prerequisites */}
          {(prerequisiteGroups.length > 0 || course.prerequisiteNote) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground/60" />
                <span className="text-xs tracking-wider uppercase text-muted-foreground font-medium">
                  Prerequisites
                </span>
              </div>

              {prerequisiteGroups.length > 0 && (
                <div className="space-y-1.5 ml-6">
                  {prerequisiteGroups.map((group) => (
                    <div
                      key={group.key}
                      className="flex items-center gap-2 text-sm"
                    >
                      {group.met ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-chart-2" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      )}
                      <span
                        className={group.met ? "text-muted-foreground" : ""}
                      >
                        {group.options.length === 1
                          ? `${group.options[0].code} — ${group.options[0].name}`
                          : `One of: ${group.options
                              .map((option) => `${option.code} — ${option.name}`)
                              .join(", ")}`}
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
                      ? "1 prerequisite not placed in an earlier semester"
                      : `${unmetPrereqs.length} prerequisites not placed in earlier semesters`}
                  </span>
                </div>
              )}
            </div>
          )}

          <ReviewSummary courseId={course.id} />

          {/* Majors */}
          {course.majors && course.majors.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Relevant to:{" "}
              {course.majors
                .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
                .join(", ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
