import { useEffect, useState } from 'react';
import nyuShortLogo from '../assets/NYU_Short_RGB_Color.png';

const DEFAULT_SIGNIN_ERROR = 'Could not sign you in. Please try again.';
const DEFAULT_SIGNUP_ERROR = 'Could not create your account. Please try again.';
const DEFAULT_RESET_ERROR = 'Could not send the reset email. Please try again.';
const DEFAULT_GOOGLE_ERROR = 'Could not start Google sign-in. Please try again.';

export default function AuthGate({
  onSignInWithGoogle,
  onSignInWithEmail,
  onSignUpWithEmail,
  onResetPassword,
  loading,
  authError = '',
}) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  useEffect(() => {
    if (authError) {
      setErrorMessage(authError);
    }
  }, [authError]);

  // Clear transient messages when switching tabs
  const switchMode = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setErrorMessage('');
    setInfoMessage('');
  };

  const handleGoogle = async () => {
    if (isGoogleLoading || isSubmitting) return;
    setErrorMessage('');
    setInfoMessage('');
    setIsGoogleLoading(true);
    try {
      await onSignInWithGoogle();
    } catch {
      setIsGoogleLoading(false);
      setErrorMessage(DEFAULT_GOOGLE_ERROR);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting || isGoogleLoading) return;

    setErrorMessage('');
    setInfoMessage('');
    setIsSubmitting(true);

    try {
      if (mode === 'signup') {
        const result = await onSignUpWithEmail(email, password);
        if (result?.needsConfirmation) {
          setInfoMessage(
            `We sent a confirmation link to ${email.trim()}. Click it to finish creating your account.`,
          );
          setPassword('');
        }
      } else {
        await onSignInWithEmail(email, password);
      }
    } catch (err) {
      const fallback = mode === 'signup' ? DEFAULT_SIGNUP_ERROR : DEFAULT_SIGNIN_ERROR;
      setErrorMessage(err?.message || fallback);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (isSubmitting || isGoogleLoading) return;
    setErrorMessage('');
    setInfoMessage('');

    if (!email.trim()) {
      setErrorMessage('Enter your NYU email first, then click "Forgot password?"');
      return;
    }

    setIsSubmitting(true);
    try {
      await onResetPassword(email);
      setInfoMessage(`Password reset link sent to ${email.trim()}.`);
    } catch (err) {
      setErrorMessage(err?.message || DEFAULT_RESET_ERROR);
    } finally {
      setIsSubmitting(false);
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

  const isSignUp = mode === 'signup';
  const submitLabel = isSubmitting
    ? (isSignUp ? 'Creating account\u2026' : 'Signing in\u2026')
    : (isSignUp ? 'Create account' : 'Sign in');

  return (
    <div className="auth-shell">
      <div className="auth-mesh" aria-hidden="true" />
      <nav className="auth-topbar">
        <header className="auth-brand">
          <img src={nyuShortLogo} alt="NYU" className="auth-logo" />
          <span className="auth-brand-name">Course Planner</span>
        </header>
        <span className="auth-topbar-meta">Restricted to NYU accounts</span>
      </nav>

      <main className="auth-main">
        <section className="auth-card" aria-label="Sign in to Course Planner">
            <span className="auth-eyebrow">NYU Shanghai</span>
            <h1 className="auth-title text-balance">
              {isSignUp
                ? 'Create your Course Planner account.'
                : 'Welcome back.'}
            </h1>
            <p className="auth-subtitle">
              {isSignUp
                ? 'Sign up with your NYU email to start planning your degree.'
                : 'Sign in to continue planning your semesters.'}
            </p>

            {/* Tabs */}
            <div className="auth-tabs" role="tablist" aria-label="Sign in or sign up">
              <button
                type="button"
                role="tab"
                aria-selected={!isSignUp}
                className={`auth-tab ${!isSignUp ? 'auth-tab--active' : ''}`}
                onClick={() => switchMode('signin')}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isSignUp}
                className={`auth-tab ${isSignUp ? 'auth-tab--active' : ''}`}
                onClick={() => switchMode('signup')}
              >
                Sign up
              </button>
            </div>

            {/* Email form */}
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <label className="auth-field">
                <span className="auth-field-label">NYU email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="netid@nyu.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                  disabled={isSubmitting || isGoogleLoading}
                />
              </label>

              <label className="auth-field">
                <span className="auth-field-label-row">
                  <span className="auth-field-label">Password</span>
                  {!isSignUp ? (
                    <button
                      type="button"
                      className="auth-inline-link"
                      onClick={handleForgotPassword}
                      disabled={isSubmitting || isGoogleLoading}
                    >
                      Forgot password?
                    </button>
                  ) : null}
                </span>
                <input
                  type="password"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  required
                  minLength={isSignUp ? 8 : undefined}
                  placeholder={isSignUp ? 'At least 8 characters' : 'Your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input"
                  disabled={isSubmitting || isGoogleLoading}
                />
              </label>

              <button
                type="submit"
                className="auth-submit-btn"
                disabled={isSubmitting || isGoogleLoading}
                aria-busy={isSubmitting}
              >
                {submitLabel}
              </button>
            </form>

            {/* Divider */}
            <div className="auth-divider" role="separator">
              <span>or</span>
            </div>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={isGoogleLoading || isSubmitting}
              aria-busy={isGoogleLoading}
              className="auth-google-btn auth-google-btn--secondary"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isGoogleLoading ? 'Redirecting\u2026' : 'Continue with Google'}</span>
            </button>

            {/* Messages */}
            {infoMessage ? (
              <p className="auth-info" role="status">
                {infoMessage}
              </p>
            ) : null}
            {errorMessage ? (
              <p className="auth-error" role="alert">
                {errorMessage}
              </p>
            ) : null}
        </section>

        <footer className="auth-footer">
          <span>Restricted to nyu.edu &amp; nyu.edu.cn accounts.</span>
          <span className="auth-footer-dot" aria-hidden="true">&middot;</span>
          <span>Your data stays in your account.</span>
        </footer>
      </main>
    </div>
  );
}
