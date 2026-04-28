import { useEffect, useState } from "react";
import useAuth from "./useAuth";
import { supabase, getSupabaseClientWithAuth } from "../lib/supabase";

export default function useCourseReviews(courseId) {
  const { getToken, user } = useAuth();
  const [courseReview, setCourseReview] = useState(null);
  const [professorReviews, setProfessorReviews] = useState([]);
  const [loading, setLoading] = useState(Boolean(supabase && courseId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!supabase || !courseId || !user) {
      setCourseReview(null);
      setProfessorReviews([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const db = await getSupabaseClientWithAuth(getToken);

        if (!db) {
          throw new Error("Supabase is not configured");
        }

        const [courseRes, profRes] = await Promise.all([
          db
            .from("course_reviews")
            .select("*")
            .eq("course_id", courseId)
            .maybeSingle(),
          db
            .from("course_professor_reviews")
            .select("*")
            .eq("course_id", courseId)
            .order("professor_name", { ascending: true }),
        ]);

        if (cancelled) return;

        if (courseRes.error) throw courseRes.error;
        if (profRes.error) throw profRes.error;

        setCourseReview(courseRes.data || null);
        setProfessorReviews(profRes.data || []);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err);
        setCourseReview(null);
        setProfessorReviews([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [courseId, getToken, user]);

  return { courseReview, professorReviews, loading, error };
}
