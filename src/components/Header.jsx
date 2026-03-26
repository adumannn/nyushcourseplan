import { MAJORS, GRADUATION_CREDITS } from '../data/courses';
import nyuLogo from '../assets/NYU_Short_RGB_Color.png';

export default function Header({ major, setMajor, studentName, setStudentName, totalCredits, onClearAll, theme, toggleTheme }) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="header-brand">
          <img src={nyuLogo} alt="NYU Shanghai" className="header-logo" />
          <div>
            <h1 className="header-title">Course Planner</h1>
            <p className="header-subtitle">NYU Shanghai — 4 Years</p>
          </div>
        </div>
      </div>

      <div className="header-center">
        <div className="credit-overview">
          <div className="credit-ring">
            <span className="credit-ring-number">{totalCredits}</span>
            <span className="credit-ring-label">/ {GRADUATION_CREDITS}</span>
          </div>
          <span className="credit-overview-label">Total Credits</span>
        </div>
      </div>

      <div className="header-right">
        <div className="header-field">
          <label htmlFor="student-name">Name</label>
          <input
            id="student-name"
            type="text"
            placeholder="Your name"
            value={studentName}
            onChange={e => setStudentName(e.target.value)}
          />
        </div>
        <div className="header-field">
          <label htmlFor="major-select">Major</label>
          <select id="major-select" value={major} onChange={e => setMajor(e.target.value)}>
            {MAJORS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <button className="btn-theme" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
          {theme === 'light' ? '☾' : '☀'}
        </button>
        <button className="btn-clear-all" onClick={onClearAll} title="Clear all courses">
          Reset
        </button>
      </div>
    </header>
  );
}
