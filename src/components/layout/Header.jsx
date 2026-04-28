import {
  Moon,
  Sun,
  PlaneTakeoff,
  AlertTriangle,
} from "lucide-react";
import { UserButton } from "@clerk/react";
import { MAJORS } from "../../data/courses";
import PlanMenu from "./PlanMenu";

const clerkAppearance = {
  elements: {
    avatarBox: "w-7 h-7",
    userButtonTrigger:
      "rounded-md hover:bg-accent transition-colors cursor-pointer p-0.5",
    userButtonPopoverCard:
      "bg-card border border-border shadow-lg rounded-lg",
  },
};

export default function Header({
  major,
  setMajor,
  totalCredits,
  theme,
  toggleTheme,
  onOpenStudyAway,
  studyAwayCount,
  studyAwayWarningCount = 0,
  hasIncompleteStudyAway = false,
  isStudyAwayOpen = false,
  plan,
  studentName,
  studyAway,
  semesterCredits,
  onImportPlan,
}) {
  const hasStudyAwayIssues =
    studyAwayWarningCount > 0 || hasIncompleteStudyAway;
  const studyAwayLabel =
    studyAwayCount === 0
      ? "Required"
      : hasStudyAwayIssues
        ? `${studyAwayCount} selected`
        : `${studyAwayCount} ready`;
  const studyAwayShortLabel =
    studyAwayCount === 0
      ? "!"
      : hasStudyAwayIssues
        ? `${studyAwayCount}!`
        : `${studyAwayCount}`;

  return (
    <header className="planner-header relative z-40 border-b border-border/40 px-3 sm:px-6 py-2.5 sm:py-4">
      {/* Mobile layout: 2 rows for breathing room */}
      <div className="flex flex-col gap-2 md:hidden">
        <div className="flex items-center gap-2">
          <div className="planner-brand shrink-0" aria-label="Course Planner">
            <span className="planner-logo-mark" aria-hidden="true">
              <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect width="64" height="64" rx="12" fill="#0b0e17" />
                <rect x="10" y="44" width="20" height="10" rx="2.5" fill="#57068c" />
                <rect x="18" y="32" width="20" height="10" rx="2.5" fill="#7f28b8" />
                <rect x="26" y="20" width="20" height="10" rx="2.5" fill="#a371ff" />
                <rect x="34" y="8" width="20" height="10" rx="2.5" fill="#c8a2ff" />
              </svg>
            </span>
          </div>

          <select
            className="flex-1 min-w-0 text-sm text-foreground bg-transparent border border-border/50 rounded-md pl-3 pr-8 py-2 outline-none cursor-pointer appearance-none truncate"
            value={major}
            onChange={(e) => setMajor(e.target.value)}
            aria-label="Select major"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 10px center",
            }}
          >
            {MAJORS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          <div className="flex items-baseline gap-1 shrink-0">
            <span className="text-lg tabular-nums leading-none">
              {totalCredits}
            </span>
            <span className="text-[11px] text-muted-foreground">cr</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenStudyAway}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs transition-colors cursor-pointer min-h-[36px] ${
              isStudyAwayOpen
                ? "border-[#57068c]/45 bg-[#57068c]/10 text-foreground"
                : hasStudyAwayIssues
                  ? "border-amber-500/35 bg-amber-500/10 text-foreground"
                  : "border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            title="Study away"
            aria-label={`Study away. ${studyAwayCount} semester${studyAwayCount === 1 ? "" : "s"} selected. ${studyAwayWarningCount} issue${studyAwayWarningCount === 1 ? "" : "s"} flagged.`}
            aria-haspopup="dialog"
            aria-expanded={isStudyAwayOpen}
          >
            {hasStudyAwayIssues ? (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <PlaneTakeoff className="h-3.5 w-3.5" />
            )}
            <span>Study Away</span>
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                hasStudyAwayIssues
                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                  : studyAwayCount > 0
                    ? "bg-[#57068c] text-white"
                    : "bg-accent text-muted-foreground"
              }`}
            >
              {studyAwayShortLabel}
            </span>
          </button>

          <PlanMenu
            plan={plan}
            major={major}
            studentName={studentName}
            studyAway={studyAway}
            totalCredits={totalCredits}
            semesterCredits={semesterCredits}
            onImport={onImportPlan}
            compact
          />

          <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center border border-border/60"
            title={theme === "light" ? "Dark mode" : "Light mode"}
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>

          <UserButton appearance={clerkAppearance} />
        </div>
      </div>

      {/* Desktop layout — unchanged */}
      <div className="hidden md:flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <div className="planner-brand" aria-label="Course Planner">
            <span className="planner-logo-mark" aria-hidden="true">
              <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect width="64" height="64" rx="12" fill="#0b0e17" />
                <rect x="10" y="44" width="20" height="10" rx="2.5" fill="#57068c" />
                <rect x="18" y="32" width="20" height="10" rx="2.5" fill="#7f28b8" />
                <rect x="26" y="20" width="20" height="10" rx="2.5" fill="#a371ff" />
                <rect x="34" y="8" width="20" height="10" rx="2.5" fill="#c8a2ff" />
              </svg>
            </span>
            <h1 className="planner-brand-name text-lg">Course Planner</h1>
          </div>
          <div className="h-4 w-px bg-border/60" />
          <select
            className="min-w-0 max-w-44 lg:max-w-none text-sm text-muted-foreground bg-transparent border-none outline-none cursor-pointer appearance-none pr-4"
            value={major}
            onChange={(e) => setMajor(e.target.value)}
            aria-label="Select major"
          >
            {MAJORS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-end gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl tabular-nums">{totalCredits}</span>
            <span className="text-sm text-muted-foreground">credits</span>
          </div>

          <div className="h-4 w-px bg-border/60" />

          <button
            onClick={onOpenStudyAway}
            className={`relative inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
              isStudyAwayOpen
                ? "border-[#57068c]/45 bg-[#57068c]/10 text-foreground"
                : hasStudyAwayIssues
                  ? "border-amber-500/35 bg-amber-500/8 text-foreground hover:bg-amber-500/12"
                  : "border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            title="Open study away picker"
            aria-label={`Open study away planner. ${studyAwayCount} semester${studyAwayCount === 1 ? "" : "s"} selected. ${studyAwayWarningCount} issue${studyAwayWarningCount === 1 ? "" : "s"} flagged.`}
            aria-haspopup="dialog"
            aria-expanded={isStudyAwayOpen}
          >
            {hasStudyAwayIssues ? (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <PlaneTakeoff className="h-3.5 w-3.5" />
            )}
            <span>Study Away</span>
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                hasStudyAwayIssues
                  ? "bg-amber-500/14 text-amber-700 dark:text-amber-300"
                  : studyAwayCount > 0
                    ? "bg-[#57068c] text-white"
                    : "bg-accent text-muted-foreground"
              }`}
            >
              {studyAwayLabel}
            </span>
          </button>

          <div className="h-4 w-px bg-border/60" />

          <PlanMenu
            plan={plan}
            major={major}
            studentName={studentName}
            studyAway={studyAway}
            totalCredits={totalCredits}
            semesterCredits={semesterCredits}
            onImport={onImportPlan}
          />

          <div className="h-4 w-px bg-border/60" />

          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground cursor-pointer"
            title={theme === "light" ? "Dark mode" : "Light mode"}
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>

          <UserButton appearance={clerkAppearance} />
        </div>
      </div>
    </header>
  );
}
