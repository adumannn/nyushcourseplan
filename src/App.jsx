import { useEffect, useMemo, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { ListChecks, X } from "lucide-react";
import useTheme from "./hooks/useTheme";
import useAuth from "./hooks/useAuth";
import usePlanner from "./hooks/usePlanner";
import Header from "./components/layout/Header";
import SemesterGrid from "./components/planner/SemesterGrid";
import RequirementsSidebar from "./components/layout/RequirementsSidebar";
import CoursePicker from "./components/planner/CoursePicker";
import StudyAwayPicker from "./components/planner/StudyAwayPicker";
import CourseDetailModal from "./components/planner/CourseDetailModal";
import SuggestionInbox from "./components/layout/SuggestionInbox";
import SuggestionModal from "./components/layout/SuggestionModal";
import AuthGate from "./components/auth/AuthGate";
import { GRADUATION_CREDITS } from "./data/courses";
import { getDefaultCampusForSemester } from "./lib/campus";
import { isFeedbackAdmin } from "./lib/feedbackAdmin";
import "./App.css";

function AppContent() {
  const { theme, toggleTheme } = useTheme();
  const {
    user,
    loading: authLoading,
    getToken,
  } = useAuth();

  const {
    plan,
    major,
    setMajor,
    studentName,
    addCourse,
    removeCourse,
    moveCourse,
    importPlan,
    studyAway,
    toggleStudyAwaySemester,
    setStudyAwayLocation,
    studyAwayWarnings,
    totalCredits,
    semesterCredits,
    requirementProgress,
    allPlannedCourses,
    isCourseInPlan,
    getCourseSemester,
    prereqWarnings,
    loaded,
  } = usePlanner(user, getToken);

  const [pickerSemester, setPickerSemester] = useState(null);
  const [studyAwayPickerOpen, setStudyAwayPickerOpen] = useState(false);
  const [studyAwayFocusSemester, setStudyAwayFocusSemester] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [detailCourse, setDetailCourse] = useState(null);
  const [requirementsSheetOpen, setRequirementsSheetOpen] = useState(false);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionInboxOpen, setSuggestionInboxOpen] = useState(false);

  const hasIncompleteStudyAway =
    studyAway.selectedSemesters.length === 0 ||
    studyAway.selectedSemesters.some(
      (semesterId) => !studyAway.locations[semesterId],
    );

  const studyAwayWarningsBySemester = useMemo(() => {
    return studyAwayWarnings.reduce((acc, warning) => {
      const semesterId = warning.semesterId;

      if (!semesterId) return acc;
      if (!acc[semesterId]) acc[semesterId] = [];
      acc[semesterId].push(warning);
      return acc;
    }, {});
  }, [studyAwayWarnings]);

  // Lock body scroll while the mobile requirements sheet is open
  useEffect(() => {
    if (!requirementsSheetOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (event) => {
      if (event.key === "Escape") setRequirementsSheetOpen(false);
    };
    document.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [requirementsSheetOpen]);

  // Auth gate — must sign in with Clerk
  if (authLoading) {
    return (
      <div
        className="auth-loading-shell min-h-screen flex items-center justify-center bg-background"
        role="status"
        aria-live="polite"
        aria-label="Loading"
      >
        <div className="spinner" />
        <p className="auth-loading-label">Preparing secure sign-in&hellip;</p>
      </div>
    );
  }

  const completionPercent = Math.min(
    (totalCredits / GRADUATION_CREDITS) * 100,
    100,
  );
  const canViewSuggestionInbox = isFeedbackAdmin(user);

  return (
    <div className="planner-shell h-dvh min-h-screen flex flex-col bg-background text-foreground">
      <Header
        major={major}
        setMajor={setMajor}
        totalCredits={totalCredits}
        theme={theme}
        toggleTheme={toggleTheme}
        onOpenStudyAway={() => {
          setStudyAwayFocusSemester(null);
          setStudyAwayPickerOpen(true);
        }}
        studyAwayCount={studyAway.selectedSemesters.length}
        studyAwayWarningCount={studyAwayWarnings.length}
        hasIncompleteStudyAway={hasIncompleteStudyAway}
        isStudyAwayOpen={studyAwayPickerOpen}
        plan={plan}
        studentName={studentName}
        studyAway={studyAway}
        semesterCredits={semesterCredits}
        onImportPlan={importPlan}
        onOpenSuggestion={() => setSuggestionOpen(true)}
        canViewSuggestionInbox={canViewSuggestionInbox}
        onOpenSuggestionInbox={() => setSuggestionInboxOpen(true)}
      />

      <div className="planner-main relative z-0 flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="planner-board scrollbar-hidden flex-1 min-h-0 overflow-y-auto pb-20 lg:pb-0">
          {!loaded ? (
            <div className="plan-loading">
              <div className="spinner" />
              <span>Loading your plan...</span>
            </div>
          ) : (
            <SemesterGrid
              plan={plan}
              semesterCredits={semesterCredits}
              onRemoveCourse={removeCourse}
              onAddClick={setPickerSemester}
              onMoveCourse={moveCourse}
              studyAway={studyAway}
              studyAwayWarnings={studyAwayWarningsBySemester}
              prereqWarnings={prereqWarnings}
              onCourseClick={setDetailCourse}
              major={major}
              onOpenStudyAway={(semesterId) => {
                setStudyAwayFocusSemester(semesterId);
                setStudyAwayPickerOpen(true);
              }}
            />
          )}
        </div>

        {/* Desktop sidebar — hidden on mobile, shown lg+ */}
        <div
          className={`planner-sidebar hidden lg:block overflow-hidden transition-all duration-200 lg:shrink-0 ${
            isSidebarCollapsed ? "lg:w-14" : "lg:w-80"
          }`}
        >
          <RequirementsSidebar
            requirementProgress={requirementProgress}
            totalCredits={totalCredits}
            allPlannedCourses={allPlannedCourses}
            major={major}
            collapsed={isSidebarCollapsed}
            onToggleCollapsed={() => setIsSidebarCollapsed((prev) => !prev)}
          />
        </div>
      </div>

      {/* Mobile-only floating Progress pill */}
      <button
        type="button"
        onClick={() => setRequirementsSheetOpen(true)}
        className="lg:hidden fixed right-3 bottom-3 z-30 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2.5 text-sm font-medium shadow-lg shadow-black/10 hover:bg-accent active:scale-95 transition-all"
        aria-label={`View progress: ${totalCredits} of ${GRADUATION_CREDITS} credits`}
        aria-haspopup="dialog"
        aria-expanded={requirementsSheetOpen}
      >
        <ListChecks className="h-4 w-4 text-[#57068c]" />
        <span>Progress</span>
        <span className="inline-flex items-baseline gap-1 tabular-nums">
          <span>{totalCredits}</span>
          <span className="text-[11px] text-muted-foreground">
            / {GRADUATION_CREDITS}
          </span>
        </span>
        <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-accent/40">
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-[#57068c]"
            style={{ width: `${completionPercent}%` }}
          />
        </span>
      </button>

      {/* Mobile-only bottom sheet for requirements */}
      {requirementsSheetOpen && (
        <div
          className="requirements-sheet-overlay lg:hidden"
          onClick={() => setRequirementsSheetOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Requirements progress"
        >
          <div
            className="requirements-sheet-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pt-2 pb-1 flex justify-center shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <button
              type="button"
              onClick={() => setRequirementsSheetOpen(false)}
              className="absolute top-2 right-2 p-2 rounded-md text-muted-foreground hover:bg-accent transition-colors"
              aria-label="Close progress sheet"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex-1 min-h-0 overflow-hidden">
              <RequirementsSidebar
                requirementProgress={requirementProgress}
                totalCredits={totalCredits}
                allPlannedCourses={allPlannedCourses}
                major={major}
                collapsed={false}
              />
            </div>
          </div>
        </div>
      )}

      {pickerSemester && (
        <CoursePicker
          semesterId={pickerSemester}
          onAdd={addCourse}
          onRemove={removeCourse}
          onClose={() => setPickerSemester(null)}
          isCourseInPlan={isCourseInPlan}
          getCourseSemester={getCourseSemester}
          major={major}
          defaultCampus={getDefaultCampusForSemester(pickerSemester, studyAway)}
        />
      )}

      {detailCourse && (
        <CourseDetailModal
          course={detailCourse}
          prereqWarnings={prereqWarnings}
          major={major}
          onClose={() => setDetailCourse(null)}
        />
      )}

      {studyAwayPickerOpen && (
        <StudyAwayPicker
          major={major}
          studyAway={studyAway}
          warnings={studyAwayWarnings}
          initialSemester={studyAwayFocusSemester}
          onClose={() => {
            setStudyAwayPickerOpen(false);
            setStudyAwayFocusSemester(null);
          }}
          onToggleSemester={toggleStudyAwaySemester}
          onSetLocation={setStudyAwayLocation}
        />
      )}
      {suggestionOpen && (
        <SuggestionModal
          onClose={() => setSuggestionOpen(false)}
          getToken={getToken}
          user={user}
          plan={plan}
          major={major}
          totalCredits={totalCredits}
        />
      )}
      {suggestionInboxOpen && canViewSuggestionInbox && (
        <SuggestionInbox
          onClose={() => setSuggestionInboxOpen(false)}
          getToken={getToken}
          user={user}
        />
      )}

      <Analytics />
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="auth-loading-shell min-h-screen flex items-center justify-center bg-background"
        role="status"
        aria-live="polite"
        aria-label="Loading"
      >
        <div className="spinner" />
        <p className="auth-loading-label">Preparing secure sign-in&hellip;</p>
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  return (
    <AppContent />
  );
}
