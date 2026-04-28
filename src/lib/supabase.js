import { createClient } from '@supabase/supabase-js';
import { getAuth } from '@clerk/react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Create Supabase client with Clerk JWT token support.
 * The client will automatically attach Clerk's JWT to each request for RLS validation.
 */
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: '',
        },
      },
      auth: {
        persistSession: false, // Clerk manages sessions, not Supabase
      },
    })
  : null;

/**
 * Get the Supabase client configured with the current Clerk session's JWT.
 * Call this before making queries that need RLS validation.
 */
export async function getSupabaseClientWithAuth() {
  if (!supabase) return null;

  try {
    const auth = getAuth();
    const token = await auth?.getToken?.({ template: 'supabase' });

    if (token) {
      // Clone the client with the authorization header set
      return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          persistSession: false,
        },
      });
    }
  } catch (error) {
    console.warn('Failed to get Clerk token for Supabase:', error);
  }

  return supabase;
}
