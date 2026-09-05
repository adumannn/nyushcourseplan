import { useState } from "react";
import {
  Moon,
  Sun,
  PlaneTakeoff,
  AlertTriangle,
  Heart,
  Inbox,
  MessageSquare,
  Plus,
  X,
} from "lucide-react";
import { UserButton } from "@clerk/react";
import { MAJORS } from "../../data/courses";
import PlanMenu from "./PlanMenu";
import PlanSwitcher from "./PlanSwitcher";
import SupporterBadge from "../supporters/SupporterBadge";

const clerkAppearance = {
  elements: {
    avatarBox: "w-7 h-7",
    userButtonTrigger:
      "rounded-md hover:bg-accent transition-colors cursor-pointer p-0.5",
    userButtonPopoverCard:
      "bg-card border border-border shadow-lg rounded-lg",
  },
};

const clerkProfileProps = {
  appearance: {
    variables: {
      colorPrimary: "#7f28b8",
      colorBackground: "var(--sidebar)",
      colorForeground: "var(--card-foreground)",
      colorMutedForeground: "var(--muted-foreground)",
      colorRing: "var(--ring)",
      fontFamily: "'Geist Variable', sans-serif",
      borderRadius: "0.625rem",
    },
    elements: {
      cardBox: "shadow-2xl",
      card: "border border-border",
      navbar: "bg-background/50 border-r border-border",
      navbarButton: "rounded-md hover:bg-accent",
      headerTitle: "text-foreground",
      profileSectionTitle: "text-foreground",
    },
  },
};

export default function Header({
  plans,
  planId,
  planName,
  onSwitchPlan,
  onCreatePlan,
  onRenamePlan,
  onDeletePlan,
  major,
  setMajor,
  secondMajor = null,
  setSecondMajor,
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
  onOpenSuggestion,
  onOpenSupporters,
  isSupporter = false,
  supportersEnabled = false,
  canViewSuggestionInbox = false,
  onOpenSuggestionInbox,
}) {
  // Transient "choose your 2nd major" state before one is picked.
  const [addingSecondMajor, setAddingSecondMajor] = useState(false);

  const showSecondMajorSelect = !!secondMajor || addingSecondMajor;
  const secondMajorOptions = MAJORS.filter((m) => m.id !== major);
  const primaryMajorOptions = MAJORS.filter((m) => m.id !== secondMajor);

  const handleSecondMajorChange = (value) => {
    if (typeof setSecondMajor === "function") setSecondMajor(value);
    // Once picked, the select stays visible because secondMajor is set.
    setAddingSecondMajor(false);
  };

  const removeSecondMajor = () => {
    setAddingSecondMajor(false);
    if (typeof setSecondMajor === "function") setSecondMajor(null);
  };

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
      <div className="flex flex-col gap-2 lg:hidden">
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
            {primaryMajorOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          {!showSecondMajorSelect && (
            <button
              type="button"
              onClick={() => setAddingSecondMajor(true)}
              className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center border border-border/50 shrink-0"
              title="Add second major"
              aria-label="Add second major"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}

          <div className="flex items-baseline gap-1 shrink-0">
            <span className="text-lg tabular-nums leading-none">
              {totalCredits}
            </span>
            <span className="text-[11px] text-muted-foreground">cr</span>
          </div>
        </div>

        {showSecondMajorSelect && (
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">
              2nd major
            </span>
            <select
              className="flex-1 min-w-0 text-sm text-foreground bg-transparent border border-border/50 rounded-md pl-3 pr-8 py-2 outline-none cursor-pointer appearance-none truncate"
              value={secondMajor || ""}
              onChange={(e) => handleSecondMajorChange(e.target.value)}
              aria-label="Select second major"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
              }}
            >
              {!secondMajor && (
                <option value="" disabled>
                  Choose 2nd major…
                </option>
              )}
              {secondMajorOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={removeSecondMajor}
              className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center border border-border/50 shrink-0"
              title="Remove second major"
              aria-label="Remove second major"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <PlanSwitcher
            plans={plans}
            planId={planId}
            planName={planName}
            onSwitch={onSwitchPlan}
            onCreate={onCreatePlan}
            onRename={onRenamePlan}
            onDelete={onDeletePlan}
            compact
          />

          <button
            onClick={onOpenStudyAway}
            className={`flex-1 whitespace-nowrap inline-flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs transition-colors cursor-pointer min-h-[36px] ${
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
            secondMajor={secondMajor}
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

          <button
            onClick={onOpenSuggestion}
            className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center border border-border/60"
            title="Send feedback"
            aria-label="Send feedback"
          >
            <MessageSquare className="h-4 w-4" />
          </button>

          {canViewSuggestionInbox && (
            <button
              onClick={onOpenSuggestionInbox}
              className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center border border-border/60"
              title="Feedback inbox"
              aria-label="Feedback inbox"
            >
              <Inbox className="h-4 w-4" />
            </button>
          )}

          {supportersEnabled && isSupporter && <SupporterBadge className="mr-1" />}
          {supportersEnabled ? (
            <UserButton appearance={clerkAppearance} userProfileProps={clerkProfileProps}>
              <UserButton.MenuItems>
                <UserButton.Action
                  label="Support ✦"
                  labelIcon={<Heart size={16} />}
                  onClick={onOpenSupporters}
                />
              </UserButton.MenuItems>
            </UserButton>
          ) : (
            <UserButton appearance={clerkAppearance} userProfileProps={clerkProfileProps} />
          )}
        </div>
      </div>

      {/* Desktop layout — wrap controls when both majors need more space */}
      <div className="hidden lg:flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
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
          <PlanSwitcher
            plans={plans}
            planId={planId}
            planName={planName}
            onSwitch={onSwitchPlan}
            onCreate={onCreatePlan}
            onRename={onRenamePlan}
            onDelete={onDeletePlan}
          />
          <div className="h-4 w-px bg-border/60" />
          <select
            className="min-w-0 max-w-64 text-sm text-muted-foreground bg-transparent border-none outline-none cursor-pointer appearance-none pr-4"
            value={major}
            onChange={(e) => setMajor(e.target.value)}
            aria-label="Select major"
          >
            {primaryMajorOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          {showSecondMajorSelect ? (
            <div className="flex min-w-0 items-center gap-1">
              <span className="text-sm text-muted-foreground/70" aria-hidden="true">
                +
              </span>
              <select
                className="min-w-0 max-w-64 text-sm text-muted-foreground bg-transparent border-none outline-none cursor-pointer appearance-none pr-4"
                value={secondMajor || ""}
                onChange={(e) => handleSecondMajorChange(e.target.value)}
                aria-label="Select second major"
              >
                {!secondMajor && (
                  <option value="" disabled>
                    Choose 2nd major…
                  </option>
                )}
                {secondMajorOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={removeSecondMajor}
                className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground cursor-pointer"
                title="Remove second major"
                aria-label="Remove second major"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingSecondMajor(true)}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-border/60 px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer whitespace-nowrap"
              title="Add second major"
              aria-label="Add second major"
            >
              <Plus className="h-3 w-3" />
              <span>2nd major</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
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
            secondMajor={secondMajor}
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

          <button
            onClick={onOpenSuggestion}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
            title="Send feedback"
            aria-label="Send feedback"
          >
            <MessageSquare className="h-4 w-4" />
            <span>Feedback</span>
          </button>

          {canViewSuggestionInbox && (
            <button
              onClick={onOpenSuggestionInbox}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
              title="Feedback inbox"
              aria-label="Feedback inbox"
            >
              <Inbox className="h-4 w-4" />
              <span>Inbox</span>
            </button>
          )}

          {supportersEnabled && isSupporter && <SupporterBadge className="mr-1" />}
          {supportersEnabled ? (
            <UserButton appearance={clerkAppearance} userProfileProps={clerkProfileProps}>
              <UserButton.MenuItems>
                <UserButton.Action
                  label="Support ✦"
                  labelIcon={<Heart size={16} />}
                  onClick={onOpenSupporters}
                />
              </UserButton.MenuItems>
            </UserButton>
          ) : (
            <UserButton appearance={clerkAppearance} userProfileProps={clerkProfileProps} />
          )}
        </div>
      </div>
    </header>
  );
}
