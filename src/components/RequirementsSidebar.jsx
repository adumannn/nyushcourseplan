import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, CheckCircle2, Circle, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { CORE_REQUIREMENTS, MAJOR_REQUIREMENTS, GRADUATION_CREDITS, CATEGORIES } from '../data/courses';

function RequirementCategory({ requirement }) {
  const hasItems = Array.isArray(requirement.items) && requirement.items.length > 0;
  const [isExpanded, setIsExpanded] = useState(hasItems);

  useEffect(() => {
    if (!hasItems) {
      setIsExpanded(false);
    }
  }, [hasItems]);

  const percentage = Math.min(
    (requirement.completed / requirement.required) * 100,
    100
  );

  const isComplete = requirement.completed >= requirement.required;

  return (
    <div>
      {hasItems ? (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          className="w-full flex items-start justify-between gap-3 mb-3 group"
        >
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="text-xs tracking-wider uppercase text-muted-foreground">
                {requirement.category}
              </h3>
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground/60 transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm tabular-nums">{requirement.completed}</span>
              <span className="text-xs text-muted-foreground">
                / {requirement.required} credits
              </span>
            </div>
          </div>
        </button>
      ) : (
        <div className="w-full flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="text-xs tracking-wider uppercase text-muted-foreground">
                {requirement.category}
              </h3>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm tabular-nums">{requirement.completed}</span>
              <span className="text-xs text-muted-foreground">
                / {requirement.required} credits
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 h-1 bg-accent/20 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            isComplete ? 'bg-chart-2' : 'bg-chart-1'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {hasItems && isExpanded && (
        <div className="space-y-2 ml-1">
          {requirement.items.map((item, index) => (
            <div
              key={index}
              className="flex items-start gap-2.5 text-sm group/item"
            >
              {item.completed ? (
                <CheckCircle2 className="h-4 w-4 text-chart-2 shrink-0 mt-0.5" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div
                  className={`${
                    item.completed ? 'text-muted-foreground' : ''
                  }`}
                >
                  {item.name}
                </div>
                {item.progress && (
                  <div className={`text-xs mt-0.5 ${item.completed ? 'text-chart-2/70' : 'text-muted-foreground/60'}`}>
                    {item.progress} selected
                  </div>
                )}
                {item.credits !== undefined && (
                  <div className="text-xs text-muted-foreground/60 mt-0.5">
                    {item.credits} credits
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function buildRequirements(requirementProgress, allPlannedCourses, major) {
  const planned = allPlannedCourses || [];
  const requirements = [];

  function isSubcourseCompleted(sub) {
    if (!sub.code) return false;
    const normalizedCode = sub.code.replace(/\s/g, '-');
    return planned.some(
      (c) => c.id === normalizedCode || c.code === sub.code
    );
  }

  // Core Requirements
  const coreIds = [
    'social-and-cultural-foundations',
    'mathematics',
    'algorithmic-thinking',
    'science',
  ];
  let coreCompleted = 0;
  let coreRequired = 0;
  const coreItems = [];

  for (const id of coreIds) {
    const req = CORE_REQUIREMENTS.find((r) => r.id === id);
    const progress = requirementProgress[id];
    if (!req || !progress) continue;
    coreCompleted += progress.creditsTaken;
    coreRequired += progress.creditsNeeded;
    for (const sub of req.subcourses || []) {
      coreItems.push({
        name: sub.name,
        completed: isSubcourseCompleted(sub),
        credits: typeof sub.credits === 'number' ? sub.credits : undefined,
      });
    }
  }

  requirements.push({
    category: 'Core Requirements',
    completed: coreCompleted,
    required: coreRequired,
    items: coreItems,
  });

  // Major
  const majorDef = MAJOR_REQUIREMENTS[major] || MAJOR_REQUIREMENTS[Object.keys(MAJOR_REQUIREMENTS)[0]];
  const majorProgress = requirementProgress['major'];
  if (majorDef && majorProgress) {
    const majorItems = [];
    for (const req of majorDef.requiredCourses || []) {
      majorItems.push({
        name: req.label,
        completed: planned.some((c) => c.id === req.courseId),
      });
    }
    for (const group of majorDef.selectOneCourses || []) {
      const needed = group.count || 1;
      const matchedCount = planned.filter((c) => group.courseIds.includes(c.id)).length;
      majorItems.push({
        name: group.label,
        completed: matchedCount >= needed,
        progress: needed > 1 ? `${matchedCount}/${needed}` : undefined,
      });
    }
    if (majorDef.capstone) {
      majorItems.push({
        name: majorDef.capstone.label,
        completed: planned.some((c) => c.id === majorDef.capstone.courseId),
      });
    }

    requirements.push({
      category: `Major — ${majorDef.label}`,
      completed: majorProgress.creditsTaken,
      required: majorProgress.creditsNeeded,
      items: majorItems,
    });
  }

  // Writing
  const writingReq = CORE_REQUIREMENTS.find((r) => r.id === 'writing');
  const writingProgress = requirementProgress['writing'];
  if (writingReq && writingProgress) {
    requirements.push({
      category: 'Writing',
      completed: writingProgress.creditsTaken,
      required: writingProgress.creditsNeeded,
      items: (writingReq.subcourses || []).map((sub) => ({
        name: sub.name,
        completed: isSubcourseCompleted(sub),
        credits: typeof sub.credits === 'number' ? sub.credits : undefined,
      })),
    });
  }

  // Language
  const langProgress = requirementProgress['language'];
  if (langProgress) {
    requirements.push({
      category: 'Language',
      completed: langProgress.creditsTaken,
      required: langProgress.creditsNeeded,
    });
  }

  // Electives
  const electives = requirementProgress['electives'];
  if (electives) {
    const electiveItems = planned
      .filter((c) => c.category === 'elective')
      .map((c) => ({
        name: c.name,
        completed: true,
        credits: c.credits,
      }));

    requirements.push({
      category: 'Electives',
      completed: electives.creditsTaken,
      required: 20,
      items: electiveItems.length > 0 ? electiveItems : undefined,
    });
  }

  return requirements;
}

export default function RequirementsSidebar({
  requirementProgress,
  totalCredits,
  allPlannedCourses,
  major,
  collapsed = false,
  onToggleCollapsed,
}) {
  const requirements = useMemo(
    () => buildRequirements(requirementProgress, allPlannedCourses, major),
    [requirementProgress, allPlannedCourses, major]
  );

  const completionPercent = Math.min(
    (totalCredits / GRADUATION_CREDITS) * 100,
    100
  );

  return (
    <div className="planner-requirements flex flex-col h-full border-t border-border/40 lg:border-t-0 lg:border-l">
      <div
        className={`planner-requirements-header ${
          collapsed
            ? 'px-1 py-2 border-b-0 flex items-start justify-center'
            : 'px-4 sm:px-6 py-4 sm:py-5 border-b border-border/40'
        }`}
      >
        {collapsed ? (
          typeof onToggleCollapsed === 'function' ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Expand sidebar"
              aria-expanded="false"
              className="planner-sidebar-toggle inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          ) : null
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs tracking-wider uppercase text-muted-foreground">
                Requirements
              </h2>
              {typeof onToggleCollapsed === 'function' ? (
                <button
                  type="button"
                  onClick={onToggleCollapsed}
                  aria-label="Collapse sidebar"
                  aria-expanded="true"
                  className="planner-sidebar-toggle inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent transition-colors cursor-pointer"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl tabular-nums">{totalCredits}</span>
              <span className="text-muted-foreground">
                / {GRADUATION_CREDITS} credits
              </span>
            </div>
            <div className="mt-3 h-1.5 bg-accent/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-chart-1 transition-all duration-500"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </>
        )}
      </div>

      {!collapsed && (
        <div className="planner-requirements-scroll scrollbar-hidden flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">
            {requirements.map((requirement, index) => (
              <RequirementCategory key={index} requirement={requirement} />
            ))}

            <div className="pt-2 border-t border-border/30">
              <h3 className="text-xs tracking-wider uppercase text-muted-foreground mb-3">
                Category Legend
              </h3>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {Object.entries(CATEGORIES).map(([key, cat]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-[11px] text-muted-foreground truncate">
                      {cat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
