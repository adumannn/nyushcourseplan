import { AuthenticateWithRedirectCallback } from '@clerk/react';

/**
 * Finalizes the OAuth round-trip back from Google.
 * Clerk reads the URL params, completes the sign-in/sign-up, and redirects.
 */
export default function SSOCallback() {
  return (
    <div
      className="auth-loading-shell min-h-screen flex items-center justify-center bg-background"
      role="status"
      aria-live="polite"
      aria-label="Finishing sign-in"
    >
      <div className="spinner" />
      <p className="auth-loading-label">Finishing sign-in&hellip;</p>
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/"
        signUpFallbackRedirectUrl="/"
      />
    </div>
  );
}
