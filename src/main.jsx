import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import './index.css'
import App from './App.jsx'

const VITE_CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

if (!VITE_CLERK_PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key. Go to the Clerk Dashboard (https://dashboard.clerk.com), create an application, and add a .env.local file with VITE_CLERK_PUBLISHABLE_KEY set to your key");
}

function renderClerkLocalKeyError() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-md space-y-3 rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#57068c]">Clerk local setup</p>
        <h1 className="text-xl font-semibold">Use a Clerk test key for localhost.</h1>
        <p className="text-sm text-muted-foreground">
          Clerk live publishable keys are restricted to their production domain.
          Set `VITE_CLERK_PUBLISHABLE_KEY` to a `pk_test_...` key for local
          development, or run the app from the configured production domain.
        </p>
      </div>
    </div>
  );
}

const isBlockedLocalLiveKey =
  import.meta.env.DEV &&
  VITE_CLERK_PUBLISHABLE_KEY.startsWith('pk_live_') &&
  LOCAL_HOSTNAMES.has(window.location.hostname);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isBlockedLocalLiveKey ? (
      renderClerkLocalKeyError()
    ) : (
      <ClerkProvider publishableKey={VITE_CLERK_PUBLISHABLE_KEY}>
        <App />
      </ClerkProvider>
    )}
  </StrictMode>,
)
