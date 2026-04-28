import { useEffect, useMemo, useState } from 'react';
import { SignIn, SignUp, useAuth } from '@clerk/react';

const SIGN_UP_PATH = '/sign-up';

function getAuthMode() {
  return window.location.pathname === SIGN_UP_PATH ? 'sign-up' : 'sign-in';
}

function getAuthCopy(mode) {
  if (mode === 'sign-up') {
    return {
      ariaLabel: 'Sign up for Course Planner',
      title: 'Create your account.',
      subtitle: 'Use your NYU account to save your course plan.',
    };
  }

  return {
    ariaLabel: 'Sign in to Course Planner',
    title: 'Welcome back.',
    subtitle: 'Sign in with your NYU account to plan your four years.',
  };
}

/**
 * Auth gate component using Clerk.
 * Displays Clerk's built-in sign-in UI when user is not authenticated.
 */
export default function AuthGate() {
  const { isLoaded } = useAuth();
  const [authMode, setAuthMode] = useState(getAuthMode);
  const copy = getAuthCopy(authMode);
  const clerkAppearance = useMemo(
    () => ({
      layout: {
        socialButtonsPlacement: 'top',
      },
      elements: {
        rootBox: 'auth-clerk-root',
        cardBox: 'auth-clerk-card-box',
        card: 'auth-clerk-card',
        main: 'auth-clerk-main',
        form: 'auth-clerk-form',
        footer: 'auth-clerk-footer',
        footerAction: 'auth-clerk-footer-action',
        socialButtonsBlockButton: 'auth-google-btn w-full',
        formButtonPrimary: 'auth-google-btn w-full',
        dividerLine: 'bg-border',
        dividerText: 'text-muted-foreground text-sm',
        headerTitle: 'hidden',
        headerSubtitle: 'hidden',
        footerActionLink: 'text-primary hover:text-primary/80',
        formFieldLabel: 'text-sm font-medium',
        formFieldInput: 'rounded-md border border-input bg-background px-3 py-2 text-sm',
        formFieldErrorText: 'text-destructive text-sm mt-1',
      },
    }),
    [],
  );

  useEffect(() => {
    const handleLocationChange = () => setAuthMode(getAuthMode());

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  if (!isLoaded) {
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

          <section className="auth-card" aria-label={copy.ariaLabel}>
            <p className="auth-eyebrow">
              <span className="auth-eyebrow-dot" aria-hidden="true" />
              NYU Shanghai
            </p>

            <h1 className="auth-title text-balance">{copy.title}</h1>
            <p className="auth-subtitle">{copy.subtitle}</p>

            <div className="clerk-signin-container">
              {authMode === 'sign-up' ? (
                <SignUp
                  appearance={clerkAppearance}
                  signInUrl="/"
                  forceRedirectUrl="/"
                  fallbackRedirectUrl="/"
                />
              ) : (
                <SignIn
                  appearance={clerkAppearance}
                  signUpUrl={SIGN_UP_PATH}
                  forceRedirectUrl="/"
                  fallbackRedirectUrl="/"
                />
              )}
            </div>
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
