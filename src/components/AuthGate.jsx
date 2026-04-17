import { useEffect, useState } from 'react';
import nyuShortLogo from '../assets/NYU_Short_RGB_Color.png';
import authHero from '../assets/auth-hero.jpg';

export default function AuthGate({ onSignInWithGoogle, loading, authError = '' }) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (authError) {
      setErrorMessage(authError);
    }
  }, [authError]);

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
        <p className="auth-loading-label">Preparing secure sign-in&hellip;</p>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <main className="auth-layout">
        {/* ─── Left: form pane ─── */}
        <section className="auth-pane" aria-label="Sign in to Course Planner">
          <header className="auth-brand">
            <img
              src={nyuShortLogo}
              alt="NYU"
              className="auth-logo"
            />
            <span className="auth-brand-name">Course Planner</span>
          </header>

          <div className="auth-card">
            <span className="auth-eyebrow">NYU Shanghai</span>
            <h1 className="auth-title text-balance">
              Plan your degree, semester by semester.
            </h1>
            <p className="auth-subtitle">
              Sign in with your NYU Google account to track credits,
              requirements, and study-away plans in one place.
            </p>

            <button
              type="button"
              onClick={handleSignIn}
              disabled={isSigningIn}
              aria-busy={isSigningIn}
              className="auth-google-btn"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isSigningIn ? 'Redirecting\u2026' : 'Continue with Google'}</span>
            </button>

            <p className="auth-helper">
              Email sign-in coming soon.
            </p>

            {errorMessage ? (
              <p className="auth-error" role="alert">
                {errorMessage}
              </p>
            ) : null}
          </div>

          <footer className="auth-footer">
            <span>Restricted to nyu.edu accounts.</span>
            <span className="auth-footer-dot" aria-hidden="true">&middot;</span>
            <span>Your data stays in your account.</span>
          </footer>
        </section>

        {/* ─── Right: full-bleed visual ─── */}
        <aside className="auth-visual" aria-hidden="true">
          <img src={authHero} alt="" className="auth-visual-img" />
        </aside>
      </main>
    </div>
  );
}
