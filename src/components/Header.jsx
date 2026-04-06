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
      <div className="header-inner">
        {/* Left — branding + major */}
        <div className="header-left">
          <div className="header-brand">
            <svg className="header-logo" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            <div className="header-brand-text">
              <span className="header-title">Course Planner</span>
              <span className="header-subtitle">NYU Shanghai</span>
            </div>
          </div>

          <div className="header-sep" />

          <div className="header-major-wrapper">
            <label className="header-field-label" htmlFor="major-select">Major</label>
            <select
              id="major-select"
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
        </div>

        {/* Center — credit progress */}
        <div className="header-center">
          <div className="credit-progress">
            <div className="credit-progress-top">
              <span className="credit-label">Credits</span>
              <span className="credit-numbers">
                <strong>{totalCredits}</strong>
                <span className="credit-of"> / {GRADUATION_CREDITS}</span>
              </span>
            </div>
            <div className="credit-bar">
              <div
                className="credit-bar-fill"
                style={{ width: `${pct}%` }}
                role="progressbar"
                aria-valuenow={totalCredits}
                aria-valuemin={0}
                aria-valuemax={GRADUATION_CREDITS}
                aria-label={`${totalCredits} of ${GRADUATION_CREDITS} credits completed`}
              />
            </div>
            <span className="credit-remaining">{remaining} to go</span>
          </div>
        </div>

        {/* Right — actions + user */}
        <div className="header-right">
          <button
            className="header-icon-btn"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            )}
          </button>

          <button className="header-text-btn header-text-btn--danger" onClick={onClearAll} aria-label="Reset all courses">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
            Reset
          </button>

          <div className="header-sep" />

          {user && !guestMode ? (
            <div className="header-auth">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="header-avatar" referrerPolicy="no-referrer" />
              ) : (
                <div className="header-avatar-placeholder">
                  {(displayName || user.email || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="header-user-info">
                <span className="header-user-name" title={user.email}>{displayName || user.email}</span>
              </div>
              <button className="header-text-btn" onClick={onSignOut}>Sign out</button>
            </div>
          ) : guestMode ? (
            <span className="header-guest-badge">Guest</span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
