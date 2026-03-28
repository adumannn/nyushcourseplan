import { useState } from 'react';
import nyuLogo from '../assets/NYU_Short_RGB_Color.png';

export default function AuthGate({ onSignIn, onSignUp, onGuest, loading }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (mode === 'signup') {
        await onSignUp(email, password);
        setConfirmationSent(true);
      } else {
        await onSignIn(email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-gate">
        <div className="auth-loading">Loading...</div>
      </div>
    );
  }

  if (confirmationSent) {
    return (
      <div className="auth-gate">
        <div className="auth-card">
          <div className="auth-brand">
            <img src={nyuLogo} alt="NYU Shanghai" className="auth-logo" />
            <h1 className="auth-title">Check your email</h1>
            <p className="auth-subtitle">
              We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then sign in.
            </p>
          </div>
          <button
            className="auth-btn auth-btn--primary"
            onClick={() => { setConfirmationSent(false); setMode('signin'); }}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-gate">
      <div className="auth-card">
        <div className="auth-brand">
          <img src={nyuLogo} alt="NYU Shanghai" className="auth-logo" />
          <h1 className="auth-title">Course Planner</h1>
          <p className="auth-subtitle">NYU Shanghai — Plan your 4-year journey</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${mode === 'signin' ? 'auth-tab--active' : ''}`}
              onClick={() => { setMode('signin'); setError(''); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === 'signup' ? 'auth-tab--active' : ''}`}
              onClick={() => { setMode('signup'); setError(''); }}
            >
              Sign Up
            </button>
          </div>

          <div className="auth-fields">
            <div className="auth-field">
              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                type="email"
                placeholder="you@nyu.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </div>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button
            type="submit"
            className="auth-btn auth-btn--primary"
            disabled={submitting}
          >
            {submitting ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button className="auth-btn auth-btn--ghost" onClick={onGuest}>
          Continue as Guest
        </button>
        <p className="auth-guest-note">
          Guest plans are saved locally on this device only
        </p>
      </div>
    </div>
  );
}
