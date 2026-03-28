import { MAJORS, GRADUATION_CREDITS } from '../data/courses';
import nyuLogo from '../assets/NYU_Short_RGB_Color.png';

export default function Header({
  major, setMajor, totalCredits, onClearAll,
  theme, toggleTheme, user, guestMode, onSignOut,
}) {
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || null;
  const avatarUrl = user?.user_metadata?.avatar_url || null;

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

        {user && !guestMode ? (
          <div className="header-auth">
            {avatarUrl && (
              <img src={avatarUrl} alt="" className="header-avatar" referrerPolicy="no-referrer" />
            )}
            <div className="header-user-info">
              {displayName && <span className="header-user-name">{displayName}</span>}
              <span className="header-user-email" title={user.email}>{user.email}</span>
            </div>
            <button className="btn-sign-out" onClick={onSignOut}>Sign Out</button>
          </div>
        ) : guestMode ? (
          <span className="header-guest-badge">Guest</span>
        ) : null}
      </div>
    </header>
  );
}
