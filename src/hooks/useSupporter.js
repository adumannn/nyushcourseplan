import { useState, useEffect, useCallback } from "react";
import { getMySupporterStatus, setWallProfile } from "../lib/supporters";

/**
 * Tracks the signed-in user's supporter status. `getToken` comes from useAuth().
 * Pass a falsy `getToken` when signed out to stay in the non-supporter state.
 */
export default function useSupporter(getToken) {
  const [status, setStatus] = useState({
    isSupporter: false,
    displayName: null,
    isPublic: false,
    lifetimeAmount: 0,
    firstSupportedAt: null,
  });
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (typeof getToken !== "function") return;
    setLoading(true);
    try {
      setStatus(await getMySupporterStatus(getToken));
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const saveWallProfile = useCallback(
    async ({ displayName, isPublic }) => {
      await setWallProfile(getToken, { displayName, isPublic });
      await refetch();
    },
    [getToken, refetch],
  );

  return { ...status, loading, refetch, saveWallProfile };
}
