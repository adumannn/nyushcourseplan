import { useState } from 'react'
import Header from './components/Header';
import usePlanner from './hooks/usePlanner';
import RequirementsSidebar from './components/RequirementsSidebar';
import SemesterGrid from './components/SemesterGrid';
import useTheme from './hooks/useTheme';
import './App.css'

function App() {
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

  const { theme, toggleTheme } = useTheme();

  return (
    <div className="App">
      <Header
        major={major}
        setMajor={setMajor}
        studentName={studentName}
        setStudentName={setStudentName}
        totalCredits={totalCredits}
        onClearAll={handleClearAll}
        theme={theme}
        toggleTheme={toggleTheme}
       />
    </div>

  )
}

export default App
