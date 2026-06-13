import { supabase, getSupabaseClientWithAuth } from "./supabase.js";

/** Pure: shape a supporters row (or null) into the app's status object. */
export function mapSupporterRow(row) {
  return {
    isSupporter: !!row,
    displayName: row?.display_name ?? null,
    isPublic: row?.is_public ?? false,
    lifetimeAmount: row?.lifetime_amount ?? 0,
    firstSupportedAt: row?.first_supported_at ?? null,
  };
}

/** Read the signed-in user's own supporter status (RLS-scoped). */
export async function getMySupporterStatus(getToken) {
  const db = await getSupabaseClientWithAuth(getToken);
  if (!db) return mapSupporterRow(null);
  const { data, error } = await db
    .from("supporters")
    .select("display_name, is_public, lifetime_amount, first_supported_at")
    .maybeSingle();
  if (error) {
    console.error("[supporters] getMySupporterStatus", error);
    return mapSupporterRow(null);
  }
  return mapSupporterRow(data);
}

/** Read the public Supporters wall (opt-in rows only; anon-readable view). */
export async function getPublicSupporters() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("public_supporters")
    .select("display_name, first_supported_at")
    .order("first_supported_at", { ascending: true });
  if (error) {
    console.error("[supporters] getPublicSupporters", error);
    return [];
  }
  return data ?? [];
}

/** Set the caller's wall display name + opt-in, via the SECURITY DEFINER RPC. */
export async function setWallProfile(getToken, { displayName, isPublic }) {
  const db = await getSupabaseClientWithAuth(getToken);
  if (!db) throw new Error("Not signed in");
  const { error } = await db.rpc("update_supporter_profile", {
    p_display_name: displayName ?? "",
    p_is_public: !!isPublic,
  });
  if (error) throw error;
}
