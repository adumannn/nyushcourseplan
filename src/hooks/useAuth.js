import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const NYU_EMAIL_DOMAIN_REGEX = /@(nyu\.edu)$/i;

function isAllowedNyuEmail(email) {
  return typeof email === 'string' && NYU_EMAIL_DOMAIN_REGEX.test(email.trim());
}

async function signOutIfUnauthorizedSession(session) {
  const email = session?.user?.email;
  if (!session?.user || isAllowedNyuEmail(email)) {
    return false;
  }

  await supabase.auth.signOut();
  return true;
}

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const blocked = await signOutIfUnauthorizedSession(session);
      if (blocked) {
        setUser(null);
        setAuthError('Sign-in is restricted to NYU email accounts.');
      } else {
        setUser(session?.user ?? null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const blocked = await signOutIfUnauthorizedSession(session);
      if (blocked) {
        setUser(null);
        setAuthError('Sign-in is restricted to NYU email accounts.');
        return;
      }

      if (session?.user) {
        setAuthError('');
      }
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Auth is not configured');
    setAuthError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          hd: 'nyu.edu',
        },
      },
    });
    if (error) throw error;
  }, []);

  const signInWithEmail = useCallback(async (email, password) => {
    if (!supabase) throw new Error('Auth is not configured');

    const trimmed = typeof email === 'string' ? email.trim() : '';
    if (!isAllowedNyuEmail(trimmed)) {
      throw new Error('Please use your NYU email address (@nyu.edu).');
    }
    if (!password) {
      throw new Error('Please enter your password.');
    }

    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });
    if (error) {
      // Normalize Supabase's generic message for better UX
      if (/invalid login credentials/i.test(error.message)) {
        throw new Error('Email or password is incorrect.');
      }
      throw error;
    }
  }, []);

  const signUpWithEmail = useCallback(async (email, password) => {
    if (!supabase) throw new Error('Auth is not configured');

    const trimmed = typeof email === 'string' ? email.trim() : '';
    if (!isAllowedNyuEmail(trimmed)) {
      throw new Error('Sign-up is restricted to NYU email addresses (@nyu.edu).');
    }
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    setAuthError('');
    const { data, error } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;

    // If email confirmation is required, there will be no active session yet.
    const needsConfirmation = !data?.session;
    return { needsConfirmation };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const resetPassword = useCallback(async (email) => {
    if (!supabase) throw new Error('Auth is not configured');

    if (!isAllowedNyuEmail(email)) {
      throw new Error('Please enter an NYU email address.');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }, []);

  return {
    user,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    resetPassword,
    authError,
    enabled: !!supabase,
  };
}
