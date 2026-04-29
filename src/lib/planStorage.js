import { supabase, getSupabaseClientWithAuth } from "./supabase";
import { SEMESTERS } from "../data/courses";
import { LOCAL_CATALOG_BY_ID, mergeCourseWithLocalCatalog } from "./localCatalog";

function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

async function getSupabaseDb(getToken) {
  const db = await getSupabaseClientWithAuth(getToken);
  return db || requireSupabase();
}

const STORAGE_KEY = "nyu-shanghai-course-planner";

function normalizeStudentName(studentName) {
  return typeof studentName === "string" ? studentName.trim() : "";
}

function buildPlanName(studentName) {
  const cleanedName = normalizeStudentName(studentName);
  return cleanedName ? `${cleanedName}'s Plan` : "My Plan";
}

function createEmptyPlan() {
  const plan = {};
  SEMESTERS.forEach((s) => {
    plan[s.id] = [];
  });
  return plan;
}

// Look up full course object from catalog by ID.
// Fall back to a stored snapshot so plans remain usable while the runtime
// catalog source transitions away from the local hardcoded dataset.
function resolveCourse(row) {
  const snapshot =
    row.course_snapshot && typeof row.course_snapshot === "object"
      ? row.course_snapshot
      : null;
  const catalogCourse = LOCAL_CATALOG_BY_ID.get(row.course_id);
  const selectedCredits = Number.isFinite(row.selected_credits)
    ? row.selected_credits
    : snapshot?.credits;

  if (catalogCourse || snapshot) {
    return mergeCourseWithLocalCatalog(snapshot || catalogCourse, {
      courseId: row.course_id,
      selectedCredits,
    });
  }

  // Custom course — reconstruct from stored fields
  return {
    id: row.course_id,
    code: row.course_id,
    name: row.custom_name || "Custom Course",
    credits: row.custom_credits || 4,
    category: row.custom_category || "elective",
    department: "Custom",
  };
}

function buildCourseSnapshot(course) {
  if (!course || typeof course !== "object") return null;

  return {
    id: course.id,
    code: course.code,
    name: course.name,
    credits: course.credits,
    category: course.category,
    department: course.department,
    requirementIds: Array.isArray(course.requirementIds)
      ? course.requirementIds
      : [],
    prerequisites: Array.isArray(course.prerequisites)
      ? course.prerequisites
      : [],
    prerequisiteGroups: Array.isArray(course.prerequisiteGroups)
      ? course.prerequisiteGroups
      : [],
    prerequisiteNote: course.prerequisiteNote || "",
    majors: Array.isArray(course.majors) ? course.majors : [],
  };
}

function buildCourseRows(plan) {
  const rows = [];

  for (const [semesterId, courses] of Object.entries(plan || {})) {
    (courses || []).forEach((course, i) => {
      const courseId = course?.id;
      if (!courseId) return;

      const isCustom = courseId.startsWith("custom-");
      const hasLocalCatalogRecord = LOCAL_CATALOG_BY_ID.has(courseId);
      rows.push({
        semester_id: semesterId,
        course_id: courseId,
        position: i,
        selected_credits: Number.isFinite(course.credits)
          ? course.credits
          : null,
        course_snapshot:
          isCustom || hasLocalCatalogRecord ? null : buildCourseSnapshot(course),
        custom_name: isCustom ? course.name : null,
        custom_credits: isCustom ? course.credits : null,
        custom_category: isCustom ? course.category : null,
      });
    });
  }

  return rows;
}

// ─── localStorage implementation ───

function normalizeStudyAwayPayload(studyAway) {
  if (!studyAway || typeof studyAway !== "object") {
    return {
      selectedSemesters: [],
      locations: {},
    };
  }

  return {
    selectedSemesters: Array.isArray(studyAway.selectedSemesters)
      ? studyAway.selectedSemesters
      : [],
    locations:
      studyAway.locations && typeof studyAway.locations === "object"
        ? studyAway.locations
        : {},
  };
}

// Re-resolve stored course objects against the current catalog so that
// newly-added fields (e.g. requirementIds) are picked up even for plans
// saved before those fields existed.
function refreshPlanCourses(plan) {
  if (!plan || typeof plan !== "object") return plan;
  const refreshed = {};
  for (const [semId, courses] of Object.entries(plan)) {
    refreshed[semId] = (courses || []).map((stored) => {
      if (stored.id && !stored.id.startsWith("custom-")) {
        return mergeCourseWithLocalCatalog(stored, {
          courseId: stored.id,
          selectedCredits: stored.credits,
        });
      }
      return stored;
    });
  }
  return refreshed;
}

export const localStoragePlan = {
  async load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          ...parsed,
          plan: refreshPlanCourses(parsed.plan),
          studyAway: normalizeStudyAwayPayload(parsed.studyAway),
        };
      }
    } catch (e) {
      console.error("Failed to load from localStorage:", e);
    }
    return null;
  },

  async save({ plan, major, studentName, studyAway }) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          plan,
          major,
          studentName,
          studyAway: normalizeStudyAwayPayload(studyAway),
        }),
      );
    } catch (e) {
      console.error("Failed to save to localStorage:", e);
    }
  },

  async clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
};

// ─── Supabase implementation ───

export const supabasePlan = {
  async ensurePlan(userId, profileStudentName = "", getToken) {
    // Get existing plan or create one
    console.debug('[ensurePlan] userId:', userId, '| getToken type:', typeof getToken);
    const db = await getSupabaseDb(getToken);
    const normalizedProfileName = normalizeStudentName(profileStudentName);
    const { data: existing, error: existingError } = await db
      .from("plans")
      .select(
        "id, name, major, student_name, study_away_semesters, study_away_locations",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    console.debug('[ensurePlan] SELECT result — data:', existing, '| error:', existingError);
    if (existingError) throw existingError;

    if (existing) {
      // Backfill legacy default plan name once; preserve any custom plan names.
      if (
        normalizedProfileName &&
        (!existing.name || existing.name === "My Plan")
      ) {
        const updatePayload = {
          name: buildPlanName(normalizedProfileName),
        };

        if (!normalizeStudentName(existing.student_name)) {
          updatePayload.student_name = normalizedProfileName;
        }

        const { error: updateError } = await db
          .from("plans")
          .update(updatePayload)
          .eq("id", existing.id);

        if (updateError) throw updateError;

        return {
          ...existing,
          ...updatePayload,
        };
      }

      return existing;
    }

    console.debug('[ensurePlan] No existing plan found, inserting new plan for userId:', userId);
    const { data: created, error } = await db
      .from("plans")
      .insert({
        user_id: userId,
        name: buildPlanName(normalizedProfileName),
        student_name: normalizedProfileName || "",
      })
      .select(
        "id, name, major, student_name, study_away_semesters, study_away_locations",
      )
      .single();

    console.debug('[ensurePlan] INSERT result — data:', created, '| error:', error);
    if (error) throw error;
    return created;
  },

  async load(userId, profileStudentName = "", getToken) {
    try {
      const planRow = await this.ensurePlan(userId, profileStudentName, getToken);
      const planId = planRow.id;

      const db = await getSupabaseDb(getToken);
      const { data: courses, error } = await db
        .from("plan_courses")
        .select("*")
        .eq("plan_id", planId)
        .order("position", { ascending: true });

      if (error) throw error;

      const plan = createEmptyPlan();
      (courses || []).forEach((row) => {
        if (plan[row.semester_id]) {
          plan[row.semester_id].push(resolveCourse(row));
        }
      });

      return {
        planId,
        plan,
        major: planRow.major || "cs",
        studentName: planRow.student_name || "",
        studyAway: normalizeStudyAwayPayload({
          selectedSemesters: planRow.study_away_semesters || [],
          locations: planRow.study_away_locations || {},
        }),
      };
    } catch (e) {
      console.error('[supabasePlan.load] FAILED — userId:', userId, '| error:', e?.message || e, '| code:', e?.code, '| details:', e?.details);
      return null;
    }
  },

  async save(userId, { planId, plan, major, studentName, studyAway }, getToken) {
    try {
      if (!userId) throw new Error("Cannot save a cloud plan without a user");
      const db = await getSupabaseDb(getToken);
      const normalizedStudyAway = normalizeStudyAwayPayload(studyAway);
      const { error } = await db.rpc("save_plan_with_courses", {
        p_plan_id: planId,
        p_major: major,
        p_student_name: studentName || "",
        p_study_away_semesters: normalizedStudyAway.selectedSemesters,
        p_study_away_locations: normalizedStudyAway.locations,
        p_courses: buildCourseRows(plan),
      });

      if (error) throw error;
    } catch (e) {
      console.error("Failed to save to Supabase:", e);
      throw e;
    }
  },

  async importFromLocal(userId, getToken) {
    const localData = await localStoragePlan.load();
    if (!localData || !localData.plan) return false;

    // Check if there are any courses in the local plan
    const hasCourses = Object.values(localData.plan).some((s) => s.length > 0);
    if (!hasCourses) return false;

    const localStudentName = normalizeStudentName(localData.studentName);
    const planRow = await this.ensurePlan(userId, localStudentName, getToken);

    // Update plan metadata from local
    const db = await getSupabaseDb(getToken);
    const { error: updateError } = await db
      .from("plans")
      .update({
        name: buildPlanName(localStudentName),
        major: localData.major || "cs",
        student_name: localData.studentName || "",
        study_away_semesters: localData.studyAway?.selectedSemesters || [],
        study_away_locations: localData.studyAway?.locations || {},
      })
      .eq("id", planRow.id)
      .eq("user_id", userId);

    if (updateError) throw updateError;

    // Import courses
    await this.save(userId, {
      planId: planRow.id,
      plan: localData.plan,
      major: localData.major || "cs",
      studentName: localData.studentName || "",
      studyAway: normalizeStudyAwayPayload(localData.studyAway),
    }, getToken);

    return true;
  },
};
