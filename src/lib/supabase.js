import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const clerkClientCache = new WeakMap();

/**
 * Create Supabase client with Clerk JWT token support.
 * The client will automatically attach Clerk's JWT to each request for RLS validation.
 */
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false, // Clerk manages sessions, not Supabase
      },
    })
  : null;

/**
 * Get the Supabase client configured with a Clerk session's JWT.
 * Call this before making queries that need RLS validation.
 */
export async function getSupabaseClientWithAuth(getToken) {
  if (!supabase) return null;
  if (typeof getToken !== 'function') return supabase;

  const cachedClient = clerkClientCache.get(getToken);
  if (cachedClient) {
    return cachedClient;
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => {
      try {
        return await getToken();
      } catch (error) {
        console.warn('Failed to get Clerk token for Supabase:', error);
        return null;
      }
    },
    auth: {
      persistSession: false,
    },
  });

  clerkClientCache.set(getToken, client);
  return client;
}
