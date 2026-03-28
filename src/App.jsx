import { useState, useCallback } from 'react';
import useTheme from './hooks/useTheme';
import useAuth from './hooks/useAuth';
import usePlanner from './hooks/usePlanner';
import { supabasePlan } from './lib/planStorage';
import Header from './components/Header';
import SemesterGrid from './components/SemesterGrid';
import RequirementsSidebar from './components/RequirementsSidebar';
import CoursePicker from './components/CoursePicker';
import AuthGate from './components/AuthGate';
import './App.css';

function App() {
  const { theme, toggleTheme } = useTheme();
  const { user, loading: authLoading, signIn, signUp, signOut } = useAuth();
  const [guestMode, setGuestMode] = useState(false);

  // If signed in, pass user to planner (cloud mode). Otherwise local-only.
  const activeUser = user && !guestMode ? user : null;
  const {
    plan,
    major,
    setMajor,
    studentName,
    setStudentName,
    addCourse,
    removeCourse,
    clearAll,
    totalCredits,
    semesterCredits,
    requirementProgress,
    isCourseInPlan,
    loaded,
  } = usePlanner(activeUser);

  const [pickerSemester, setPickerSemester] = useState(null);

  const handleSignIn = useCallback(async (email, password) => {
    await signIn(email, password);
    setGuestMode(false);
  }, [signIn]);

  const handleSignUp = useCallback(async (email, password) => {
    await signUp(email, password);
  }, [signUp]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setGuestMode(false);
  }, [signOut]);

  const handleGuest = useCallback(() => {
    setGuestMode(true);
  }, []);

  const handleImportLocal = useCallback(async () => {
    if (!user) return;
    const imported = await supabasePlan.importFromLocal(user.id);
    if (imported) {
      setGuestMode(true);
      setTimeout(() => setGuestMode(false), 50);
    }
  }, [user]);

  // Show auth gate if not signed in and not in guest mode
  if (!authLoading && !user && !guestMode) {
    return (
      <div className="app" data-theme={theme}>
        <AuthGate
          onSignIn={handleSignIn}
          onSignUp={handleSignUp}
          onGuest={handleGuest}
          loading={authLoading}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <Header
        major={major}
        setMajor={setMajor}
        studentName={studentName}
        setStudentName={setStudentName}
        totalCredits={totalCredits}
        onClearAll={clearAll}
        theme={theme}
        toggleTheme={toggleTheme}
        user={user}
        guestMode={guestMode}
        onSignOut={handleSignOut}
        onImportLocal={handleImportLocal}
      />
      <div className="app-body">
        <main className="app-main">
          {!loaded ? (
            <div className="plan-loading">Loading your plan...</div>
          ) : (
            <SemesterGrid
              plan={plan}
              semesterCredits={semesterCredits}
              onRemoveCourse={removeCourse}
              onAddClick={(semId) => setPickerSemester(semId)}
            />
          )}
        </main>
        <RequirementsSidebar
          requirementProgress={requirementProgress}
          totalCredits={totalCredits}
        />
      </div>

      {pickerSemester && (
        <CoursePicker
          semesterId={pickerSemester}
          onAdd={(semId, course) => {
            addCourse(semId, course);
          }}
          onClose={() => setPickerSemester(null)}
          isCourseInPlan={isCourseInPlan}
          major={major}
        />
      )}
    </div>
  );
}

export default App;
