import { createClient } from '@supabase/supabase-js';

// `import.meta.env` is a Vite-injected object in the browser/build, but is
// `undefined` under plain Node (e.g. the test runner importing a module that
// transitively imports this file). Guard so module load never throws there;
// the `supabaseUrl && supabaseAnonKey` check below then yields a null client.
const env = import.meta.env ?? {};
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
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
        const token = await getToken();
        if (!token) {
          console.warn('[Supabase Auth] getToken() returned null — Clerk session may not be active');
        } else {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            console.debug('[Supabase Auth] JWT sub:', payload.sub, '| exp:', new Date((payload.exp || 0) * 1000).toISOString());
          } catch { /* ignore decode errors */ }
        }
        return token;
      } catch (error) {
        console.error('[Supabase Auth] getToken() threw:', error);
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
