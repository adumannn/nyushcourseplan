import { useState, useEffect } from 'react';
import nyuShortLogo from '../assets/NYU_Short_RGB_Color.png';

function detectIframe() {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export default function AuthGate({ onSignInWithGoogle, loading }) {
  const [inIframe, setInIframe] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    setInIframe(detectIframe());
  }, []);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await onSignInWithGoogle();
    } catch {
      setSigningIn(false);
    }
  };

  const openInNewTab = () => {
    window.open(window.location.href, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        role="status"
        aria-label="Loading"
      >
        <div className="spinner" />
      </div>
    );
  }

  const year = new Date().getFullYear();

  return (
    <div className="auth-shell min-h-dvh flex flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="w-full">
        <div className="mx-auto max-w-6xl px-6 sm:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={nyuShortLogo}
              alt="NYU Shanghai logo"
              className="h-8 w-auto"
            />
            <span className="text-sm tracking-tight text-foreground/80">
              Course Planner
            </span>
          </div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground hidden sm:block">
            NYU Shanghai
          </div>
        </div>
      </header>

      {/* Center content */}
      <main className="flex-1 flex items-center justify-center px-6 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="auth-card flex flex-col items-center text-center">
            {/* Accent mark */}
            <div
              className="mb-8 h-10 w-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(87, 6, 140, 0.08)' }}
              aria-hidden="true"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: '#57068c' }}
              />
            </div>

            <h1 className="text-3xl tracking-tight text-balance">
              Welcome back
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-balance">
              Sign in to plan your semesters, track requirements,
              <br className="hidden sm:inline" /> and pick up where you left off.
            </p>

            {/* Google Sign-In */}
            <button
              type="button"
              onClick={handleSignIn}
              disabled={signingIn}
              className="auth-google-btn mt-10 w-full h-11 rounded-full border border-border bg-card hover:bg-accent text-sm flex items-center justify-center gap-3 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {signingIn ? (
                <>
                  <span
                    className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin"
                    aria-hidden="true"
                  />
                  <span>Waiting for Google…</span>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {/* Iframe notice (v0 preview, embedded demos, etc.) */}
            {inIframe && (
              <div className="mt-6 w-full rounded-lg border border-border bg-muted/40 px-4 py-3 text-left">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {signingIn
                    ? 'Finish signing in in the popup window, then close it. You\'ll be signed in here automatically.'
                    : 'Google blocks sign-in inside embedded previews, so clicking above opens a secure popup. If it\'s blocked, open the app in its own tab.'}
                </p>
                <button
                  type="button"
                  onClick={openInNewTab}
                  className="mt-2 text-xs font-medium text-foreground underline underline-offset-4 hover:no-underline cursor-pointer"
                >
                  Open app in a new tab
                </button>
              </div>
            )}

            {/* Fine print */}
            {!inIframe && (
              <p className="mt-6 text-xs text-muted-foreground leading-relaxed text-balance">
                Your plan is securely synced to your Google account across devices.
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full">
        <div className="mx-auto max-w-6xl px-6 sm:px-8 py-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>&copy; {year} Course Planner</span>
          <span className="hidden sm:inline">Unofficial student tool</span>
        </div>
      </footer>
    </div>
  );
}
