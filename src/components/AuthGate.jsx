export default function AuthGate({ onSignInWithGoogle, onGuest, loading }) {
  if (loading) {
    return (
      <div className="auth-gate">
        <div className="auth-loading">
          <div className="auth-loader">
            <div className="auth-loader-ring" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-gate">
      <div className="auth-card">
        {/* Left panel - branding */}
        <div className="auth-card-left">
          <div className="auth-card-left-content">
            <span className="auth-badge">NYU Shanghai</span>
            <h1 className="auth-title">
              Course<br />Planner
            </h1>
            <p className="auth-tagline">
              Plan your 4-year academic journey — track credits, requirements, and progress all in one place.
            </p>

            <div className="auth-features">
              <div className="auth-feature">
                <svg className="auth-feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                <span className="auth-feature-label">Drag & drop semester planning</span>
              </div>
              <div className="auth-feature">
                <svg className="auth-feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span className="auth-feature-label">Track 128 credit requirements</span>
              </div>
              <div className="auth-feature">
                <svg className="auth-feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9" />
                </svg>
                <span className="auth-feature-label">Sync across all your devices</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel - sign in */}
        <div className="auth-card-right">
          <div className="auth-card-right-content">
            <div className="auth-welcome">
              <h2 className="auth-welcome-title">Welcome back</h2>
              <p className="auth-welcome-sub">Sign in to access your course plan</p>
            </div>

            <div className="auth-actions">
              <button className="auth-btn auth-btn--google" onClick={onSignInWithGoogle}>
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
              </button>

              <div className="auth-divider">
                <span>or</span>
              </div>

              <button className="auth-btn auth-btn--guest" onClick={onGuest}>
                Continue as Guest
              </button>
            </div>

            <p className="auth-note">
              Guest data is saved locally on this device.
              <br />Sign in to sync across devices.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
