import { useCallback, useMemo } from 'react';
import { useAuth as useClerkAuth, useClerk, useUser } from '@clerk/react';

/**
 * Bridge hook from Clerk to existing app auth interface.
 * Extracts Clerk user state and makes it compatible with current components.
 */
export default function useAuth() {
  const { userId, getToken, isLoaded, isSignedIn } = useClerkAuth();
  const { signOut: clerkSignOut } = useClerk();
  const { user: clerkUser } = useUser();

  const email = clerkUser?.primaryEmailAddress?.emailAddress || '';
  const fullName =
    clerkUser?.fullName ||
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ');
  const imageUrl = clerkUser?.imageUrl || '';

  // Derive user object compatible with existing code
  const user = useMemo(
    () =>
      isSignedIn && userId
        ? {
            id: userId,
            email,
            user_metadata: {
              full_name: fullName,
              name: fullName,
              avatar_url: imageUrl,
            },
          }
        : null,
    [email, fullName, imageUrl, isSignedIn, userId],
  );

  const signOut = useCallback(async () => {
    await clerkSignOut?.();
  }, [clerkSignOut]);

  return {
    user,
    loading: !isLoaded,
    getToken,
    signOut,
    enabled: true, // Clerk is always enabled
    authError: '', // Clerk handles errors via built-in UI
  };
}
