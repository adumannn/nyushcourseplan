import { useMemo, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import useTheme from "./hooks/useTheme";
import useAuth from "./hooks/useAuth";
import usePlanner from "./hooks/usePlanner";
import Header from "./components/Header";
import SemesterGrid from "./components/SemesterGrid";
import RequirementsSidebar from "./components/RequirementsSidebar";
import CoursePicker from "./components/CoursePicker";
import StudyAwayPicker from "./components/StudyAwayPicker";
import CourseDetailModal from "./components/CourseDetailModal";
import AuthGate from "./components/AuthGate";
import "./App.css";

function App() {
  const { theme, toggleTheme } = useTheme();
  const {
    user,
    loading: authLoading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    signOut,
    authError,
    enabled: authEnabled,
  } = useAuth();

  const {
    plan,
    major,
    setMajor,
    studentName,
    addCourse,
    removeCourse,
    moveCourse,
    replacePlan,
    studyAway,
    toggleStudyAwaySemester,
    setStudyAwayLocation,
    studyAwayWarnings,
    totalCredits,
    semesterCredits,
    requirementProgress,
    allPlannedCourses,
    isCourseInPlan,
    prereqWarnings,
    loaded,
  } = usePlanner(user);

  const [pickerSemester, setPickerSemester] = useState(null);
  const [studyAwayPickerOpen, setStudyAwayPickerOpen] = useState(false);
  const [studyAwayFocusSemester, setStudyAwayFocusSemester] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [detailCourse, setDetailCourse] = useState(null);

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

  // Auth gate — must sign in with Google
  if (authEnabled && !authLoading && !user) {
    return (
      <AuthGate
        onSignInWithGoogle={signInWithGoogle}
        onSignInWithEmail={signInWithEmail}
        onSignUpWithEmail={signUpWithEmail}
        onResetPassword={resetPassword}
        loading={authLoading}
        authError={authError}
      />
    );
  }

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
        user={user}
        onSignOut={signOut}
        plan={plan}
        studentName={studentName}
        studyAway={studyAway}
        semesterCredits={semesterCredits}
        onImportPlan={replacePlan}
      />

      <div className="planner-main relative z-0 flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="planner-board scrollbar-hidden flex-1 min-h-[45vh] lg:min-h-0 overflow-y-auto">
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
              onOpenStudyAway={(semesterId) => {
                setStudyAwayFocusSemester(semesterId);
                setStudyAwayPickerOpen(true);
              }}
            />
          )}
        </div>

        <div
          className={`planner-sidebar overflow-hidden transition-all duration-200 w-full lg:shrink-0 ${
            isSidebarCollapsed
              ? "max-h-24 lg:max-h-none lg:w-14"
              : "max-h-[44vh] lg:max-h-none lg:w-80"
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

      {pickerSemester && (
        <CoursePicker
          semesterId={pickerSemester}
          onAdd={addCourse}
          onClose={() => setPickerSemester(null)}
          isCourseInPlan={isCourseInPlan}
          major={major}
        />
      )}

      {detailCourse && (
        <CourseDetailModal
          course={detailCourse}
          prereqWarnings={prereqWarnings}
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
      <Analytics />
    </div>
  );
}

export default App;
