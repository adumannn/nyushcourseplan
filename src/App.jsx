import { useState } from 'react'
import Header from './components/Header';
import './App.css'

function App() {
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
