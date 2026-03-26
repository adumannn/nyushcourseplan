import { useState } from 'react';
import useTheme from './hooks/useTheme';
import usePlanner from './hooks/usePlanner';
import Header from './components/Header';
import SemesterGrid from './components/SemesterGrid';
import RequirementsSidebar from './components/RequirementsSidebar';
import CoursePicker from './components/CoursePicker';
import './App.css';

function App() {
  const { theme, toggleTheme } = useTheme();
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
  } = usePlanner();

  const [pickerSemester, setPickerSemester] = useState(null);

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
      />
      <div className="app-body">
        <main className="app-main">
          <SemesterGrid
            plan={plan}
            semesterCredits={semesterCredits}
            onRemoveCourse={removeCourse}
            onAddClick={(semId) => setPickerSemester(semId)}
          />
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
