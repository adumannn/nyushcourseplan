import { useEffect, useState } from 'react';

const DEFAULT_GOOGLE_ERROR = 'Could not start Google sign-in. Please try again.';

export default function AuthGate({
  onSignInWithGoogle,
  loading,
  authError = '',
}) {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (authError) {
      setErrorMessage(authError);
    }
  }, [authError]);

  const handleGoogle = async () => {
    if (isGoogleLoading) return;
    setErrorMessage('');
    setIsGoogleLoading(true);
    try {
      await onSignInWithGoogle();
    } catch {
      setIsGoogleLoading(false);
      setErrorMessage(DEFAULT_GOOGLE_ERROR);
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
      <main className="auth-main">
        <div className="auth-stack">
          <header className="auth-brand-stack" aria-label="Course Planner">
            <span className="planner-logo-mark planner-logo-mark--lg" aria-hidden="true">
              <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                <rect width="64" height="64" rx="14" fill="#0b0e17" />
                <rect x="10" y="44" width="20" height="10" rx="2.5" fill="#57068c" />
                <rect x="18" y="32" width="20" height="10" rx="2.5" fill="#7f28b8" />
                <rect x="26" y="20" width="20" height="10" rx="2.5" fill="#a371ff" />
                <rect x="34" y="8" width="20" height="10" rx="2.5" fill="#c8a2ff" />
              </svg>
            </span>
            <span className="auth-brand-name">Course Planner</span>
          </header>

          <section className="auth-card" aria-label="Sign in to Course Planner">
            <p className="auth-eyebrow">
              <span className="auth-eyebrow-dot" aria-hidden="true" />
              NYU Shanghai
            </p>

            <h1 className="auth-title text-balance">Welcome back.</h1>
            <p className="auth-subtitle">
              Continue with your NYU Google account to plan your four years.
            </p>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={isGoogleLoading}
              aria-busy={isGoogleLoading}
              className="auth-google-btn"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isGoogleLoading ? 'Redirecting…' : 'Continue with Google'}</span>
            </button>

            {errorMessage ? (
              <p className="auth-error" role="alert">
                {errorMessage}
              </p>
            ) : null}
          </section>

          <footer className="auth-footer">
            <span className="auth-footer-status" aria-hidden="true" />
            <span>Restricted to nyu.edu</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
