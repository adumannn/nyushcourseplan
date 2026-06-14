import { useState, useEffect, useCallback } from "react";
import { getMySupporterStatus, setWallProfile } from "../lib/supporters";

/**
 * Tracks the signed-in user's supporter status. `getToken` comes from useAuth().
 * Pass a falsy `getToken` when signed out to stay in the non-supporter state.
 * `enabled` gates the fetch entirely — used to keep the feature hidden (and avoid
 * querying a not-yet-migrated `supporters` table) until it is configured.
 */
export default function useSupporter(getToken, enabled = true) {
  const [status, setStatus] = useState({
    isSupporter: false,
    displayName: null,
    isPublic: false,
    lifetimeAmount: 0,
    firstSupportedAt: null,
  });
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!enabled || typeof getToken !== "function") return;
    setLoading(true);
    try {
      setStatus(await getMySupporterStatus(getToken));
    } finally {
      setLoading(false);
    }
  }, [getToken, enabled]);

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
