import { useState } from 'react';
import nyuShortLogo from '../assets/NYU_Short_RGB_Color.png';

const SHOWCASE_SCHOOLS = [
  'Arts & Science',
  'Engineering',
  'Business',
  'Public Health',
];

export default function AuthGate({ onSignInWithGoogle, loading }) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSignIn = async () => {
    if (isSigningIn) return;

    setErrorMessage('');
    setIsSigningIn(true);

    try {
      await onSignInWithGoogle();
    } catch {
      setIsSigningIn(false);
      setErrorMessage('Could not start Google sign-in. Please try again.');
    }
  };

  if (loading) {
    return (
      <div
        className="auth-loading-shell min-h-screen flex items-center justify-center bg-background"
        role="status"
        aria-live="polite"
        aria-label="Loading"
      >
        <div className="spinner" />
        <p className="auth-loading-label">Preparing secure sign-in...</p>
      </div>
    );
  }

  return (
    <div className="auth-shell min-h-screen">
      <main className="auth-layout min-h-screen">
        <section className="auth-pane" aria-label="Sign in to Course Planner">
          <header className="auth-brand">
            <img
              src={nyuShortLogo}
              alt="NYU Shanghai logo"
              className="auth-logo"
            />
            <span className="auth-brand-name">Course Planner</span>
          </header>

          <div className="auth-card">
            <div>
              <h1 className="auth-title">Welcome to NYU Course Planner</h1>
              <p className="auth-subtitle">
                Sign in with your NYU Google account to continue.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSignIn}
              disabled={isSigningIn}
              aria-busy={isSigningIn}
              className="auth-google-btn"
            >
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <span>{isSigningIn ? 'Redirecting...' : 'Sign in with Google'}</span>
            </button>

            <div className="auth-divider" aria-hidden="true">
              <span>or</span>
            </div>

            <input
              type="text"
              value="Email sign-in coming soon"
              readOnly
              tabIndex={-1}
              className="auth-email-input"
              aria-label="Email sign in coming soon"
            />

            <button type="button" className="auth-email-btn" disabled>
              Sign in with Email
            </button>

            {errorMessage ? (
              <p className="auth-error" role="alert">
                {errorMessage}
              </p>
            ) : null}
          </div>
        </section>

        <aside className="auth-showcase" aria-hidden="true">
          <div className="auth-showcase-orb auth-showcase-orb--one" />
          <div className="auth-showcase-orb auth-showcase-orb--two" />

          <div className="auth-showcase-content">
            <h2 className="auth-showcase-title">
              Plan smarter and graduate on track.
            </h2>
            <p className="auth-showcase-copy">
              Build your 4-year path with real credit progress, requirement checks,
              and study-away planning in one place.
            </p>
{/* 
            <div className="auth-showcase-schools">
              {SHOWCASE_SCHOOLS.map((school) => (
                <span key={school} className="auth-showcase-school">
                  {school}
                </span>
              ))}
            </div>*/}
          </div>
        </aside>
      </main>
    </div>
  );
}
