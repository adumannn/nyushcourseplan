import { RedirectToSignIn, useAuth } from '@clerk/react';

/**
 * Auth gate component using Clerk's Account Portal.
 *
 * Unauthenticated users are redirected to Clerk's hosted sign-in/sign-up UI,
 * which is served from the configured custom domain (e.g. accounts.nyushplanner.app).
 * After authentication completes Clerk returns the user to the originating URL.
 *
 * The Account Portal handles both sign-in and sign-up — its built-in
 * "Don't have an account? Sign up" link drives users to the sign-up flow.
 */
export default function AuthGate() {
  const { isLoaded } = useAuth();

  return (
    <div
      className="auth-loading-shell min-h-screen flex items-center justify-center bg-background"
      role="status"
      aria-live="polite"
      aria-label="Redirecting to sign-in"
    >
      <div className="spinner" />
      <p className="auth-loading-label">
        {isLoaded ? 'Redirecting to sign-in…' : 'Preparing secure sign-in…'}
      </p>
      {isLoaded ? <RedirectToSignIn /> : null}
    </div>
  );
}
