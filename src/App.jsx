import { useEffect, useMemo, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { AlertTriangle, Heart, ListChecks, RefreshCw, X } from "lucide-react";
import useTheme from "./hooks/useTheme";
import useAuth from "./hooks/useAuth";
import usePlanner from "./hooks/usePlanner";
import useSupporter from "./hooks/useSupporter";
import Header from "./components/layout/Header";
import SemesterGrid from "./components/planner/SemesterGrid";
import RequirementsSidebar from "./components/layout/RequirementsSidebar";
import CoursePicker from "./components/planner/CoursePicker";
import StudyAwayPicker from "./components/planner/StudyAwayPicker";
import CourseDetailModal from "./components/planner/CourseDetailModal";
import SuggestionInbox from "./components/layout/SuggestionInbox";
import SuggestionModal from "./components/layout/SuggestionModal";
import SupportersView from "./components/supporters/SupportersView";
import SupportThanksToast from "./components/supporters/SupportThanksToast";
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
    planId,
    planName,
    plans,
    switchPlan,
    createPlan,
    renamePlan,
    deletePlan,
    major,
    setMajor,
    secondMajor,
    setSecondMajor,
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
    syncStatus,
    retryCloudSave,
  } = usePlanner(user, getToken);

  const [pickerSemester, setPickerSemester] = useState(null);
  const [pickerRequirement, setPickerRequirement] = useState(null);
  const [studyAwayPickerOpen, setStudyAwayPickerOpen] = useState(false);
  const [studyAwayFocusSemester, setStudyAwayFocusSemester] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [detailCourse, setDetailCourse] = useState(null);
  const [requirementsSheetOpen, setRequirementsSheetOpen] = useState(false);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionInboxOpen, setSuggestionInboxOpen] = useState(false);

  // Supporter donations stay hidden until configured: VITE_GUMROAD_PRODUCT_URL is
  // unset until launch, so this flag gates every supporter entry point and the
  // status fetch. Setting that env var at launch reveals the whole feature.
  const supportersEnabled = !!import.meta.env.VITE_GUMROAD_PRODUCT_URL;

  const isPostPurchaseReturn = () =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("supported") === "1";

  const [supportersOpen, setSupportersOpen] = useState(
    () =>
      isPostPurchaseReturn() ||
      (typeof window !== "undefined" && window.location.hash === "#supporters"),
  );
  const [thanksOpen, setThanksOpen] = useState(() => isPostPurchaseReturn());
  const { isSupporter, saveWallProfile, refetch: refetchSupporter } = useSupporter(
    getToken,
    supportersEnabled,
  );

  const openSupporters = () => {
    window.location.hash = "supporters";
  };
  const closeSupporters = () => {
    if (window.location.hash === "#supporters") {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setSupportersOpen(false);
  };

  // Hash is the source of truth for the supporters view.
  useEffect(() => {
    const sync = () => setSupportersOpen(window.location.hash === "#supporters");
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  // Post-purchase return: ?supported=1 -> clean up the URL and poll until the badge lands.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("supported") !== "1") return;
    params.delete("supported");
    const qs = params.toString();
    history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}#supporters`);
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      refetchSupporter();
      if (tries >= 6) clearInterval(id); // ~30s of polling
    }, 5000);
    return () => clearInterval(id);
  }, [refetchSupporter]);

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
  const findCoursesForRequirement = (filter) => {
    setRequirementsSheetOpen(false);
    setPickerSemester(null);
    setPickerRequirement(filter);
  };

  return (
    <div className="planner-shell h-dvh min-h-screen flex flex-col bg-background text-foreground">
      <Header
        plans={plans}
        planId={planId}
        planName={planName}
        onSwitchPlan={switchPlan}
        onCreatePlan={createPlan}
        onRenamePlan={renamePlan}
        onDeletePlan={deletePlan}
        major={major}
        setMajor={setMajor}
        secondMajor={secondMajor}
        setSecondMajor={setSecondMajor}
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
        onOpenSupporters={openSupporters}
        isSupporter={isSupporter}
        supportersEnabled={supportersEnabled}
        canViewSuggestionInbox={canViewSuggestionInbox}
        onOpenSuggestionInbox={() => setSuggestionInboxOpen(true)}
      />

      {syncStatus.state === "error" && (
        <div
          className="mx-3 sm:mx-6 mt-2 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100"
          role="alert"
          aria-live="polite"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Cloud sync failed. Your latest changes are cached only on this device.</p>
            <p className="mt-0.5 break-words text-xs opacity-80">{syncStatus.detail}</p>
          </div>
          <button
            type="button"
            onClick={retryCloudSave}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-500/40 px-2.5 py-1.5 text-xs font-medium hover:bg-amber-500/10"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      <div className="planner-main relative z-0 flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="planner-board min-w-0 flex-1 min-h-0 overflow-y-auto pb-20 lg:pb-0">
          {pickerRequirement && !pickerSemester && (
            <div className="sticky top-0 z-20 mx-3 mt-3 flex items-center gap-3 rounded-lg border border-[#57068c]/25 bg-card px-3 py-2.5 shadow-sm sm:mx-6">
              <ListChecks className="h-4 w-4 shrink-0 text-[#57068c]" />
              <p className="min-w-0 flex-1 text-sm">
                Choose a semester for <span className="font-medium">{pickerRequirement.label}</span>
              </p>
              <button
                type="button"
                onClick={() => setPickerRequirement(null)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                aria-label="Cancel requirement course selection"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
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
              secondMajor={secondMajor}
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
            secondMajor={secondMajor}
            collapsed={isSidebarCollapsed}
            onToggleCollapsed={() => setIsSidebarCollapsed((prev) => !prev)}
            onFindCourses={findCoursesForRequirement}
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
                secondMajor={secondMajor}
                collapsed={false}
                onFindCourses={findCoursesForRequirement}
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
          onClose={() => {
            setPickerSemester(null);
            setPickerRequirement(null);
          }}
          isCourseInPlan={isCourseInPlan}
          getCourseSemester={getCourseSemester}
          major={major}
          secondMajor={secondMajor}
          defaultCampus={getDefaultCampusForSemester(pickerSemester, studyAway)}
          requirementFilter={pickerRequirement}
        />
      )}

      {detailCourse && (
        <CourseDetailModal
          course={detailCourse}
          prereqWarnings={prereqWarnings}
          major={major}
          secondMajor={secondMajor}
          onClose={() => setDetailCourse(null)}
        />
      )}

      {studyAwayPickerOpen && (
        <StudyAwayPicker
          major={major}
          secondMajor={secondMajor}
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
          major={secondMajor ? `${major} + ${secondMajor}` : major}
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

      {supportersEnabled && (
        <>
          <footer className="mt-8 border-t border-border py-4 text-center text-xs text-muted-foreground">
            <button onClick={openSupporters} className="inline-flex items-center gap-1 hover:text-foreground">
              <Heart size={12} /> Support the planner
            </button>
          </footer>
          {supportersOpen && <SupportersView user={user} onClose={closeSupporters} />}
          {thanksOpen && (
            <SupportThanksToast
              isSupporter={isSupporter}
              onSaveWallProfile={saveWallProfile}
              onClose={() => setThanksOpen(false)}
            />
          )}
        </>
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
