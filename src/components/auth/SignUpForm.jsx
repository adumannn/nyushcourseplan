import { useState } from 'react';
import { useSignUp } from '@clerk/react';

const SIGN_IN_PATH = '/';
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
 * Custom sign-up form built on Clerk's useSignUp() hook.
 * Two-stage flow:
 *   1. Collect email + password, request email verification code.
 *   2. Submit verification code, activate session, redirect home.
 *
 * Replaces the prebuilt <SignUp /> component.
 */
export default function SignUpForm() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const [stage, setStage] = useState('details'); // 'details' | 'verify'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleGoogle = async () => {
    if (!isLoaded || oauthLoading) return;
    setError('');
    setOauthLoading(true);
    try {
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: SSO_CALLBACK_PATH,
        redirectUrlComplete: '/',
      });
    } catch (err) {
      setError(clerkErrorMessage(err));
      setOauthLoading(false);
    }
  };

  const handleDetailsSubmit = async (event) => {
    event.preventDefault();
    if (!isLoaded || submitting) return;

    setError('');
    setSubmitting(true);
    try {
      await signUp.create({
        emailAddress: email.trim(),
        password,
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setStage('verify');
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifySubmit = async (event) => {
    event.preventDefault();
    if (!isLoaded || submitting) return;

    setError('');
    setSubmitting(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        window.location.assign('/');
      } else {
        setError('Verification did not complete. Please try again.');
      }
    } catch (err) {
      setError(clerkErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!isLoaded || submitting) return;
    setError('');
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    } catch (err) {
      setError(clerkErrorMessage(err));
    }
  };

  const handleSignInClick = (event) => {
    event.preventDefault();
    navigateInApp(SIGN_IN_PATH);
  };

  if (stage === 'verify') {
    return (
      <div className="auth-form">
        <p className="auth-verify-hint">
          We sent a 6-digit code to <strong>{email}</strong>. Enter it below to
          finish creating your account.
        </p>

        <form className="auth-form-fields" onSubmit={handleVerifySubmit} noValidate>
          <label className="auth-field">
            <span className="auth-field-label">Verification code</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="auth-field-input auth-field-code"
              placeholder="123456"
              autoFocus
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
            disabled={!isLoaded || submitting || code.length < 6}
          >
            {submitting ? 'Verifying…' : 'Verify email'}
          </button>
        </form>

        <p className="auth-switch">
          Didn’t get a code?{' '}
          <button
            type="button"
            onClick={handleResend}
            className="auth-switch-link auth-switch-link--button"
          >
            Resend
          </button>
        </p>
      </div>
    );
  }

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

      <form className="auth-form-fields" onSubmit={handleDetailsSubmit} noValidate>
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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-field-input"
            placeholder="At least 8 characters"
          />
        </label>

        {/*
          Clerk's CAPTCHA needs a mount target on every sign-up form to avoid
          a bot-protection error during signUp.create(). It stays invisible.
        */}
        <div id="clerk-captcha" />

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
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account?{' '}
        <a href={SIGN_IN_PATH} onClick={handleSignInClick} className="auth-switch-link">
          Sign in
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
