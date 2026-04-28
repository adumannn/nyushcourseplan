import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import SignInForm from './SignInForm';
import SignUpForm from './SignUpForm';
import SSOCallback from './SSOCallback';

const SIGN_UP_PATH = '/sign-up';
const SSO_CALLBACK_PATH = '/sso-callback';

function getAuthRoute() {
  const path = window.location.pathname;
  if (path.startsWith(SSO_CALLBACK_PATH)) return 'sso-callback';
  if (path === SIGN_UP_PATH) return 'sign-up';
  return 'sign-in';
}

function getAuthCopy(route) {
  if (route === 'sign-up') {
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
 * Renders custom sign-in / sign-up forms (built on useSignIn / useSignUp)
 * or the OAuth callback handler, depending on the current path.
 */
export default function AuthGate() {
  const { isLoaded } = useAuth();
  const [route, setRoute] = useState(getAuthRoute);

  useEffect(() => {
    const handleLocationChange = () => setRoute(getAuthRoute());

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  if (route === 'sso-callback') {
    return <SSOCallback />;
  }

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

  const copy = getAuthCopy(route);

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

            <div className="auth-form-container">
              {route === 'sign-up' ? <SignUpForm /> : <SignInForm />}
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
