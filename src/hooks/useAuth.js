import { useAuth as useClerkAuth, useSession } from '@clerk/react';

/**
 * Bridge hook from Clerk to existing app auth interface.
 * Extracts Clerk user state and makes it compatible with current components.
 */
export default function useAuth() {
  const { userId, isLoaded, isSignedIn } = useClerkAuth();
  const { session } = useSession();

  // Derive user object compatible with existing code
  const user = isSignedIn && userId
    ? {
        id: userId,
        email: session?.user?.emailAddresses?.[0]?.emailAddress,
      }
    : null;

  // Sign out via Clerk
  const signOut = async () => {
    const { signOut: clerkSignOut } = await import('@clerk/react');
    // Use the window.__clerk global that Clerk provides
    if (window.Clerk) {
      await window.Clerk.signOut();
    }
  };

  return {
    user,
    loading: !isLoaded,
    signOut,
    enabled: true, // Clerk is always enabled
    authError: '', // Clerk handles errors via built-in UI
  };
}
