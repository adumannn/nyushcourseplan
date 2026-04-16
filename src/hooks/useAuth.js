import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Auth is not configured');

    // Detect if we're running inside an iframe (e.g. the v0 preview).
    // Google OAuth refuses to render in iframes, so we need to break out
    // to the top-level window before kicking off the OAuth redirect.
    let inIframe = false;
    try {
      inIframe = window.self !== window.top;
    } catch {
      inIframe = true; // cross-origin access throws -> we're definitely framed
    }

    const redirectTo =
      (inIframe && document.referrer) ? document.referrer : window.location.origin;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: inIframe,
      },
    });
    if (error) throw error;

    if (inIframe && data?.url) {
      // Try to navigate the top window; fall back to a new tab if blocked.
      try {
        window.top.location.href = data.url;
      } catch {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const resetPassword = useCallback(async (email) => {
    if (!supabase) throw new Error('Auth is not configured');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }, []);

  return { user, loading, signInWithGoogle, signOut, resetPassword, enabled: !!supabase };
}
