import { useState } from 'react';
import nyuShortLogo from '../assets/NYU_Short_RGB_Color.png';

export default function AuthGate({ onSignInWithGoogle, loading }) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSignIn = async () => {
    if (isSigningIn) return;

    setErrorMessage('');
    setIsSigningIn(true);

    try {
      await onSignInWithGoogle();
    } catch {
      setIsSigningIn(false);
      setErrorMessage('Could not start Google sign-in. Please try again.');
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
      <main className="auth-layout">
        {/* ─── Left: form pane ─── */}
        <section className="auth-pane" aria-label="Sign in to Course Planner">
          <header className="auth-brand">
            <img
              src={nyuShortLogo}
              alt="NYU"
              className="auth-logo"
            />
            <span className="auth-brand-name">Course Planner</span>
          </header>

          <div className="auth-card">
            <span className="auth-eyebrow">NYU Shanghai</span>
            <h1 className="auth-title text-balance">
              Plan your degree, semester by semester.
            </h1>
            <p className="auth-subtitle">
              Sign in with your NYU Google account to track credits,
              requirements, and study-away plans in one place.
            </p>

            <button
              type="button"
              onClick={handleSignIn}
              disabled={isSigningIn}
              aria-busy={isSigningIn}
              className="auth-google-btn"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isSigningIn ? 'Redirecting\u2026' : 'Continue with Google'}</span>
            </button>

            <p className="auth-helper">
              Email sign-in coming soon.
            </p>

            {errorMessage ? (
              <p className="auth-error" role="alert">
                {errorMessage}
              </p>
            ) : null}
          </div>

          <footer className="auth-footer">
            <span>Restricted to nyu.edu accounts.</span>
            <span className="auth-footer-dot" aria-hidden="true">&middot;</span>
            <span>Your data stays in your account.</span>
          </footer>
        </section>

        {/* ─── Right: product preview ─── */}
        <aside className="auth-preview" aria-hidden="true">
          <div className="auth-preview-stage">
            <PlannerPreviewMock />
          </div>

          <div className="auth-preview-caption">
            <span className="auth-preview-caption-dot" />
            A live view of your degree progress &mdash; updated as you plan.
          </div>
        </aside>
      </main>
    </div>
  );
}

/* ─── Static, styled preview of the planner board ─── */

function PlannerPreviewMock() {
  return (
    <div className="preview-window" role="presentation">
      {/* Window chrome */}
      <div className="preview-chrome">
        <div className="preview-dots">
          <span />
          <span />
          <span />
        </div>
        <div className="preview-chrome-title">course-planner.nyu.edu</div>
        <div className="preview-chrome-spacer" />
      </div>

      {/* App header */}
      <div className="preview-header">
        <div className="preview-header-left">
          <div className="preview-logo-mark" />
          <div>
            <div className="preview-header-title">My 4-Year Plan</div>
            <div className="preview-header-sub">Computer Science, B.S.</div>
          </div>
        </div>
        <div className="preview-header-right">
          <div className="preview-chip preview-chip--ok">
            <span className="preview-chip-dot" /> On track
          </div>
          <div className="preview-chip">128 / 128 cr</div>
        </div>
      </div>

      {/* Year heading */}
      <div className="preview-year">
        <span className="preview-year-label">Year 2</span>
        <span className="preview-year-meta">32 credits &middot; 8 courses</span>
      </div>

      {/* Fall semester */}
      <div className="preview-semester">
        <div className="preview-semester-head">
          <span className="preview-semester-name">Fall 2026</span>
          <span className="preview-semester-credits">16 cr</span>
        </div>
        <div className="preview-courses">
          <CourseCard code="CSCI-SHU 210" title="Data Structures" credits="4" tag="Core" />
          <CourseCard code="MATH-SHU 140" title="Linear Algebra" credits="4" tag="Math" tagTone="violet" />
          <CourseCard code="WRIT-SHU 101" title="Writing as Inquiry" credits="4" tag="Core" />
          <CourseCard code="EAP-SHU 201" title="Intermediate Mandarin" credits="4" tag="Lang" tagTone="muted" />
        </div>
      </div>

      {/* Spring semester */}
      <div className="preview-semester">
        <div className="preview-semester-head">
          <span className="preview-semester-name">Spring 2027</span>
          <span className="preview-semester-credits">16 cr</span>
        </div>
        <div className="preview-courses">
          <CourseCard code="CSCI-SHU 220" title="Algorithms" credits="4" tag="Core" />
          <CourseCard code="CSCI-SHU 360" title="Machine Learning" credits="4" tag="Elective" tagTone="violet" />
          <CourseCard
            code="BUSF-SHU 250"
            title="Statistics for Business"
            credits="4"
            tag="Quant"
            tagTone="muted"
          />
          <CourseCard
            code="—"
            title="Study Away: NYU Prague"
            credits="4"
            tag="Away"
            tagTone="violet"
            muted
          />
        </div>
      </div>
    </div>
  );
}

function CourseCard({ code, title, credits, tag, tagTone = 'neutral', muted = false }) {
  return (
    <div className={`preview-course${muted ? ' preview-course--muted' : ''}`}>
      <div className="preview-course-top">
        <span className="preview-course-code">{code}</span>
        <span className={`preview-course-tag preview-course-tag--${tagTone}`}>{tag}</span>
      </div>
      <div className="preview-course-title">{title}</div>
      <div className="preview-course-bottom">
        <span className="preview-course-credits">{credits} credits</span>
      </div>
    </div>
  );
}
