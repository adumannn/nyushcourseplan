import { MAJORS, GRADUATION_CREDITS } from '../data/courses';

export default function Header({
  major, setMajor, totalCredits, onClearAll,
  theme, toggleTheme, user, guestMode, onSignOut,
}) {
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || null;
  const avatarUrl = user?.user_metadata?.avatar_url || null;
  const pct = Math.min(100, Math.round((totalCredits / GRADUATION_CREDITS) * 100));
  const remaining = Math.max(0, GRADUATION_CREDITS - totalCredits);

  return (
    <header className="header">
      {/* Left — branding + major selector */}
      <div className="header-left">
        <h1 className="header-title">Course Planner</h1>
        <div className="header-sep" />
        <select
          className="header-select"
          value={major}
          onChange={e => setMajor(e.target.value)}
          aria-label="Select major"
        >
          {MAJORS.map(m => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Center — credit counter */}
      <div className="header-center">
        <span className="credit-count">
          <strong>{totalCredits}</strong>
          <span className="credit-count-sep">/</span>
          <span>{GRADUATION_CREDITS}</span>
        </span>
        <div className="credit-bar">
          <div className="credit-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="credit-remaining">{remaining} remaining</span>
      </div>

      {/* Right — actions + user */}
      <div className="header-right">
        <button className="header-icon-btn" onClick={toggleTheme} title={theme === 'light' ? 'Dark mode' : 'Light mode'} aria-label="Toggle theme">
          {theme === 'light' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          )}
        </button>

        <button className="header-text-btn header-text-btn--danger" onClick={onClearAll}>
          Reset
        </button>

        {user && !guestMode ? (
          <div className="header-auth">
            {avatarUrl && (
              <img src={avatarUrl} alt="" className="header-avatar" referrerPolicy="no-referrer" />
            )}
            <span className="header-user-name" title={user.email}>{displayName || user.email}</span>
            <button className="header-text-btn" onClick={onSignOut}>Sign out</button>
          </div>
        ) : guestMode ? (
          <span className="header-guest-badge">Guest</span>
        ) : null}
      </div>
    </header>
  );
}
