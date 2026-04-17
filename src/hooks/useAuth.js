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
    // Google OAuth refuses to render in iframes, so we must do the flow
    // outside the iframe. Supabase's session is stored in localStorage on
    // our origin, which is shared between the iframe and any popup/new tab
    // on the same origin — so onAuthStateChange in the iframe will pick up
    // the session automatically once the outer flow completes.
    let inIframe = false;
    try {
      inIframe = window.self !== window.top;
    } catch {
      inIframe = true;
    }

    const redirectTo = window.location.origin;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: inIframe,
      },
    });
    if (error) throw error;

    if (inIframe && data?.url) {
      // Prefer a popup window so the user stays in v0 and can close it
      // when done. Fall back to a new tab if popups are blocked.
      const popup = window.open(
        data.url,
        'supabase-oauth',
        'popup=yes,width=500,height=650,left=200,top=100,noopener=no'
      );
      if (!popup) {
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
