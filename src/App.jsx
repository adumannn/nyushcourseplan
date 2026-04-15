import { useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import useTheme from './hooks/useTheme';
import useAuth from './hooks/useAuth';
import usePlanner from './hooks/usePlanner';
import Header from './components/Header';
import SemesterGrid from './components/SemesterGrid';
import RequirementsSidebar from './components/RequirementsSidebar';
import CoursePicker from './components/CoursePicker';
import StudyAwayPicker from './components/StudyAwayPicker';
import AuthGate from './components/AuthGate';
import './App.css';

function App() {
  const { theme, toggleTheme } = useTheme();
  const { user, loading: authLoading, signInWithGoogle, signOut, enabled: authEnabled } = useAuth();

  const {
    plan,
    major,
    setMajor,
    addCourse,
    removeCourse,
    moveCourse,
    studyAway,
    toggleStudyAwaySemester,
    setStudyAwayLocation,
    studyAwayWarnings,
    totalCredits,
    semesterCredits,
    requirementProgress,
    allPlannedCourses,
    isCourseInPlan,
    loaded,
  } = usePlanner(user);

  const [pickerSemester, setPickerSemester] = useState(null);
  const [studyAwayPickerOpen, setStudyAwayPickerOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Auth gate — must sign in with Google
  if (authEnabled && !authLoading && !user) {
    return (
      <AuthGate
        onSignInWithGoogle={signInWithGoogle}
        loading={authLoading}
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
        onOpenStudyAway={() => setStudyAwayPickerOpen(true)}
        studyAwayCount={studyAway.selectedSemesters.length}
        user={user}
        onSignOut={signOut}
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
            />
          )}
        </div>

        <div
          className={`planner-sidebar overflow-hidden transition-all duration-200 w-full lg:shrink-0 ${
            isSidebarCollapsed
              ? 'max-h-24 lg:max-h-none lg:w-14'
              : 'max-h-[44vh] lg:max-h-none lg:w-80'
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

      {studyAwayPickerOpen && (
        <StudyAwayPicker
          major={major}
          studyAway={studyAway}
          warnings={studyAwayWarnings}
          onClose={() => setStudyAwayPickerOpen(false)}
          onToggleSemester={toggleStudyAwaySemester}
          onSetLocation={setStudyAwayLocation}
        />
      )}
      <Analytics />
    </div>
  );
}

export default App;
