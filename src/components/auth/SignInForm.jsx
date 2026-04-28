import { useState } from 'react';
import { useSignIn } from '@clerk/react';

const SIGN_UP_PATH = '/sign-up';
const SSO_CALLBACK_PATH = '/sso-callback';

function navigateInApp(path) {
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function clerkErrorMessage(err) {
  return (
    err?.errors?.[0]?.longMessage ||
    err?.errors?.[0]?.message ||
    err?.message ||
    'Something went wrong. Please try again.'
  );
}

/**
 * Custom sign-in form built on Clerk's useSignIn() hook.
 * Replaces the prebuilt <SignIn /> component.
 */
export default function SignInForm() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleGoogle = async () => {
    if (!isLoaded || oauthLoading) return;
    setError('');
    setOauthLoading(true);
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: SSO_CALLBACK_PATH,
        redirectUrlComplete: '/',
      });
    } catch (err) {
      setError(clerkErrorMessage(err));
      setOauthLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isLoaded || submitting) return;

    setError('');
    setSubmitting(true);
    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        window.location.assign('/');
      } else {
        // Clerk may require additional steps (e.g. MFA). Surface the next step.
        setError('Additional verification required. Please use Google sign-in.');
      }
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUpClick = (event) => {
    event.preventDefault();
    navigateInApp(SIGN_UP_PATH);
  };

  return (
    <div className="auth-form">
      <button
        type="button"
        className="auth-google-btn"
        onClick={handleGoogle}
        disabled={!isLoaded || oauthLoading}
        aria-label="Continue with Google"
      >
        <GoogleMark />
        <span>{oauthLoading ? 'Redirecting…' : 'Continue with Google'}</span>
      </button>

      <div className="auth-divider" role="separator" aria-hidden="true">
        <span>or</span>
      </div>

      <form className="auth-form-fields" onSubmit={handleSubmit} noValidate>
        <label className="auth-field">
          <span className="auth-field-label">Email</span>
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-field-input"
            placeholder="you@nyu.edu"
          />
        </label>

        <label className="auth-field">
          <span className="auth-field-label">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-field-input"
            placeholder="••••••••"
          />
        </label>

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="auth-primary-btn"
          disabled={!isLoaded || submitting}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="auth-switch">
        No account?{' '}
        <a href={SIGN_UP_PATH} onClick={handleSignUpClick} className="auth-switch-link">
          Sign up
        </a>
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.92v2.32A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.92A9 9 0 0 0 0 9c0 1.45.35 2.83.92 4.04l3.05-2.32z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .92 4.96l3.05 2.32C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
