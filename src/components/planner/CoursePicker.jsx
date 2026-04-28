import { useState, useMemo } from "react";
import { MinusCircle } from "lucide-react";
import { CATEGORIES, DEPARTMENTS, SEMESTERS } from "../../data/courses";
import useCatalog from "../../hooks/useCatalog";
import {
  getEffectiveCategory,
  isCourseRelevantToMajor,
} from "../../lib/majorCourseRules";
import { LOCAL_CATALOG_COURSES } from "../../lib/localCatalog";

export default function CoursePicker({
  semesterId,
  onAdd,
  onRemove,
  onClose,
  isCourseInPlan,
  getCourseSemester,
  major,
}) {
  const [tab, setTab] = useState("catalog");
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterCat, setFilterCat] = useState("");

  // Custom course form
  const [customName, setCustomName] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [customCredits, setCustomCredits] = useState(4);
  const [customCategory, setCustomCategory] = useState("elective");

  const { courses: catalogCourses, departments } = useCatalog();
  const availableCourses =
    catalogCourses.length > 0 ? catalogCourses : LOCAL_CATALOG_COURSES;
  const courseSortCollator = useMemo(
    () => new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }),
    [],
  );
  const semesterLabels = useMemo(
    () => new Map(SEMESTERS.map((semester) => [semester.id, semester.label])),
    [],
  );

  const filtered = useMemo(() => {
    let list = availableCourses;

    if (filterDept) {
      list = list.filter((c) => c.department === filterDept);
    }
    if (filterCat) {
      list = list.filter(
        (c) => getEffectiveCategory(c, major) === filterCat,
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
      );
    }

    list = [...list].sort((a, b) => {
      const aRel = isCourseRelevantToMajor(a, major) ? 0 : 1;
      const bRel = isCourseRelevantToMajor(b, major) ? 0 : 1;
      if (aRel !== bRel) return aRel - bRel;

      const aEffective = getEffectiveCategory(a, major);
      const bEffective = getEffectiveCategory(b, major);
      const aCategoryLabel =
        CATEGORIES[aEffective]?.label || aEffective || "";
      const bCategoryLabel =
        CATEGORIES[bEffective]?.label || bEffective || "";
      const categoryCompare = courseSortCollator.compare(
        aCategoryLabel,
        bCategoryLabel,
      );
      if (categoryCompare !== 0) return categoryCompare;

      const nameCompare = courseSortCollator.compare(a.name || "", b.name || "");
      if (nameCompare !== 0) return nameCompare;

      return courseSortCollator.compare(a.code || "", b.code || "");
    });

    return list;
  }, [availableCourses, search, filterDept, filterCat, major, courseSortCollator]);

  const handleAddCatalog = (course) => {
    if (isCourseInPlan(course.id)) return;
    onAdd(semesterId, course);
  };

  const handleRemoveCatalog = (event, courseId, placedSemesterId) => {
    event.stopPropagation();
    if (!placedSemesterId || !onRemove) return;
    onRemove(placedSemesterId, courseId);
  };

  const handleAddCustom = () => {
    if (!customName.trim()) return;
    const course = {
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      code: customCode.trim() || "CUSTOM",
      name: customName.trim(),
      credits: Number(customCredits) || 4,
      category: customCategory,
      department: "Custom",
    };
    onAdd(semesterId, course);
    setCustomName("");
    setCustomCode("");
    setCustomCredits(4);
    setCustomCategory("elective");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Course</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${tab === "catalog" ? "modal-tab--active" : ""}`}
            onClick={() => setTab("catalog")}
          >
            Course Catalog
          </button>
          <button
            className={`modal-tab ${tab === "custom" ? "modal-tab--active" : ""}`}
            onClick={() => setTab("custom")}
          >
            Custom Course
          </button>
        </div>

        {tab === "catalog" ? (
          <>
            <div className="modal-filters">
              <input
                className="modal-search"
                type="text"
                placeholder="Search by name or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              <div className="modal-filter-row">
                <select
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                >
                  <option value="">All Departments</option>
                  {departments.length > 0
                    ? departments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))
                    : DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                </select>
                <select
                  value={filterCat}
                  onChange={(e) => setFilterCat(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {Object.entries(CATEGORIES).map(([key, cat]) => (
                    <option key={key} value={key}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-course-list scrollbar-hidden">
              {filtered.length === 0 ? (
                <div className="modal-empty">
                  No courses match your filters.
                </div>
              ) : (
                filtered.map((course) => {
                  const placedSemesterId =
                    getCourseSemester?.(course.id) ||
                    (isCourseInPlan(course.id) ? semesterId : null);
                  const inPlan = Boolean(placedSemesterId);
                  const effectiveCategory = getEffectiveCategory(course, major);
                  const cat =
                    CATEGORIES[effectiveCategory] || CATEGORIES.elective;
                  const placedSemesterLabel =
                    semesterLabels.get(placedSemesterId) || "your plan";
                  return (
                    <div
                      key={course.id}
                      className={`modal-course-item ${inPlan ? "modal-course-item--added" : ""}`}
                      onClick={() => handleAddCatalog(course)}
                    >
                      <div
                        className="modal-course-color"
                        style={{ backgroundColor: cat.color }}
                      />
                      <div className="modal-course-info">
                        <span className="modal-course-code">{course.code}</span>
                        <span className="modal-course-name">{course.name}</span>
                      </div>
                      <span className="modal-course-credits">
                        {course.credits} cr
                      </span>
                      {inPlan ? (
                        <div className="modal-course-added-actions">
                          <span className="modal-course-added">
                            {placedSemesterId === semesterId
                              ? "Added"
                              : "In plan"}
                          </span>
                          <button
                            type="button"
                            className="modal-course-remove"
                            onClick={(event) =>
                              handleRemoveCatalog(
                                event,
                                course.id,
                                placedSemesterId,
                              )
                            }
                            title={`Remove from ${placedSemesterLabel}`}
                            aria-label={`Remove ${course.name} from ${placedSemesterLabel}`}
                          >
                            <MinusCircle className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <span className="modal-course-add-icon">+</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="modal-custom">
            <div className="custom-field">
              <label htmlFor="custom-name">Course Name</label>
              <input
                id="custom-name"
                type="text"
                placeholder="e.g. Special Topics in AI"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="custom-field-row">
              <div className="custom-field">
                <label htmlFor="custom-code">Course Code</label>
                <input
                  id="custom-code"
                  type="text"
                  placeholder="e.g. CSCI-SHU 500"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                />
              </div>
              <div className="custom-field">
                <label htmlFor="custom-credits">Credits</label>
                <input
                  id="custom-credits"
                  type="number"
                  min="1"
                  max="8"
                  value={customCredits}
                  onChange={(e) => setCustomCredits(e.target.value)}
                />
              </div>
            </div>
            <div className="custom-field">
              <label htmlFor="custom-category">Category</label>
              <select
                id="custom-category"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
              >
                {Object.entries(CATEGORIES).map(([key, cat]) => (
                  <option key={key} value={key}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="btn-primary"
              onClick={handleAddCustom}
              disabled={!customName.trim()}
            >
              Add Custom Course
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
