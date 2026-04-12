import nyuShortLogo from '../assets/NYU_Short_RGB_Color.png';

export default function AuthGate({ onSignInWithGoogle, loading }) {
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" role="status" aria-label="Loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Hero */}
      <div className="hidden lg:flex lg:flex-1 bg-linear-to-br from-[#57068c] to-[#8900e1] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <img
                src={nyuShortLogo}
                alt="NYU Shanghai logo"
                className="h-11 w-auto rounded-md bg-white/95 p-1.5 shadow-sm"
              />
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-white/80">NYU Shanghai</div>
                <div className="text-2xl tracking-tight">Course Planner</div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h1 className="text-5xl tracking-tight leading-tight">
              Plan your
              <br />
              academic journey
            </h1>
            <p className="text-lg text-white/80 max-w-md leading-relaxed">
              Visualize your path to graduation with a course planning tool. Track credits, requirements, and progress all in one place.
            </p>
          </div>

          <div className="text-sm text-white/60">
            &copy; {new Date().getFullYear()} Course Planner
          </div>
        </div>
      </div>

      {/* Right side - Login */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 text-foreground mb-8">
            <img
              src={nyuShortLogo}
              alt="NYU Shanghai logo"
              className="h-10 w-auto rounded-md border border-border/60 bg-white p-1 shadow-sm"
            />
            <div className="text-xl">Course Planner</div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to access your course planner
            </p>
          </div>

          {/* Google Sign-In */}
          <button
            type="button"
            onClick={onSignInWithGoogle}
            className="w-full h-12 rounded-lg border border-border hover:bg-accent font-medium text-sm flex items-center justify-center gap-3 transition-colors cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>

          {/* Info */}
          <div className="pt-4">
            <div className="bg-accent/20 border border-border/40 rounded-lg p-4">
              <div className="flex gap-3">
                <div className="shrink-0 mt-0.5">
                  <svg
                    className="w-5 h-5 text-chart-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="text-sm space-y-1">
                  <div className="font-medium">Your data is saved securely</div>
                  <div className="text-muted-foreground text-xs leading-relaxed">
                    Sign in with your Google account to save your course plan across devices and keep your progress synced.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
