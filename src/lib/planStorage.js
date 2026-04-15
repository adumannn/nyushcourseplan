import { supabase } from './supabase';
import { SEMESTERS, COURSE_CATALOG } from '../data/courses';

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}

const STORAGE_KEY = 'nyu-shanghai-course-planner';

function normalizeStudentName(studentName) {
  return typeof studentName === 'string' ? studentName.trim() : '';
}

function buildPlanName(studentName) {
  const cleanedName = normalizeStudentName(studentName);
  return cleanedName ? `${cleanedName}'s Plan` : 'My Plan';
}

function createEmptyPlan() {
  const plan = {};
  SEMESTERS.forEach(s => { plan[s.id] = []; });
  return plan;
}

// Look up full course object from catalog by ID
function resolveCourse(row) {
  const catalogCourse = COURSE_CATALOG.find(c => c.id === row.course_id);
  if (catalogCourse) return catalogCourse;
  // Custom course — reconstruct from stored fields
  return {
    id: row.course_id,
    code: row.course_id,
    name: row.custom_name || 'Custom Course',
    credits: row.custom_credits || 4,
    category: row.custom_category || 'elective',
    department: 'Custom',
  };
}

// ─── localStorage implementation ───

function normalizeStudyAwayPayload(studyAway) {
  if (!studyAway || typeof studyAway !== 'object') {
    return {
      selectedSemesters: [],
      locations: {},
    };
  }

  return {
    selectedSemesters: Array.isArray(studyAway.selectedSemesters)
      ? studyAway.selectedSemesters
      : [],
    locations: studyAway.locations && typeof studyAway.locations === 'object'
      ? studyAway.locations
      : {},
  };
}

export const localStoragePlan = {
  async load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          ...parsed,
          studyAway: normalizeStudyAwayPayload(parsed.studyAway),
        };
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
    }
    return null;
  },

  async save({ plan, major, studentName, studyAway }) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        plan,
        major,
        studentName,
        studyAway: normalizeStudyAwayPayload(studyAway),
      }));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  },

  async clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
};

// ─── Supabase implementation ───

export const supabasePlan = {
  async ensurePlan(userId, profileStudentName = '') {
    // Get existing plan or create one
    const db = requireSupabase();
    const normalizedProfileName = normalizeStudentName(profileStudentName);
    const { data: existing } = await db
      .from('plans')
      .select('id, name, major, student_name, study_away_semesters, study_away_locations')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (existing) {
      // Backfill legacy default plan name once; preserve any custom plan names.
      if (
        normalizedProfileName
        && (!existing.name || existing.name === 'My Plan')
      ) {
        const updatePayload = {
          name: buildPlanName(normalizedProfileName),
        };

        if (!normalizeStudentName(existing.student_name)) {
          updatePayload.student_name = normalizedProfileName;
        }

        const { error: updateError } = await db
          .from('plans')
          .update(updatePayload)
          .eq('id', existing.id);

        if (updateError) throw updateError;

        return {
          ...existing,
          ...updatePayload,
        };
      }

      return existing;
    }

    const { data: created, error } = await db
      .from('plans')
      .insert({
        user_id: userId,
        name: buildPlanName(normalizedProfileName),
        student_name: normalizedProfileName || '',
      })
      .select('id, name, major, student_name, study_away_semesters, study_away_locations')
      .single();

    if (error) throw error;
    return created;
  },

  async load(userId, profileStudentName = '') {
    try {
      const planRow = await this.ensurePlan(userId, profileStudentName);
      const planId = planRow.id;

      const db = requireSupabase();
      const { data: courses, error } = await db
        .from('plan_courses')
        .select('*')
        .eq('plan_id', planId)
        .order('position', { ascending: true });

      if (error) throw error;

      const plan = createEmptyPlan();
      (courses || []).forEach(row => {
        if (plan[row.semester_id]) {
          plan[row.semester_id].push(resolveCourse(row));
        }
      });

      return {
        planId,
        plan,
        major: planRow.major || 'cs',
        studentName: planRow.student_name || '',
        studyAway: normalizeStudyAwayPayload({
          selectedSemesters: planRow.study_away_semesters || [],
          locations: planRow.study_away_locations || {},
        }),
      };
    } catch (e) {
      console.error('Failed to load from Supabase:', e);
      return null;
    }
  },

  async save(userId, { planId, plan, major, studentName, studyAway }) {
    try {
      const db = requireSupabase();
      const normalizedStudyAway = normalizeStudyAwayPayload(studyAway);
      // Update plan metadata
      await db
        .from('plans')
        .update({
          major,
          student_name: studentName,
          study_away_semesters: normalizedStudyAway.selectedSemesters,
          study_away_locations: normalizedStudyAway.locations,
        })
        .eq('id', planId);

      // Replace all courses: delete then insert
      await db
        .from('plan_courses')
        .delete()
        .eq('plan_id', planId);

      const rows = [];
      for (const [semesterId, courses] of Object.entries(plan)) {
        courses.forEach((course, i) => {
          const isCustom = course.id.startsWith('custom-');
          rows.push({
            plan_id: planId,
            semester_id: semesterId,
            course_id: course.id,
            position: i,
            custom_name: isCustom ? course.name : null,
            custom_credits: isCustom ? course.credits : null,
            custom_category: isCustom ? course.category : null,
          });
        });
      }

      if (rows.length > 0) {
        const { error } = await db
          .from('plan_courses')
          .insert(rows);
        if (error) throw error;
      }
    } catch (e) {
      console.error('Failed to save to Supabase:', e);
    }
  },

  async importFromLocal(userId) {
    const localData = await localStoragePlan.load();
    if (!localData || !localData.plan) return false;

    // Check if there are any courses in the local plan
    const hasCourses = Object.values(localData.plan).some(s => s.length > 0);
    if (!hasCourses) return false;

    const localStudentName = normalizeStudentName(localData.studentName);
    const planRow = await this.ensurePlan(userId, localStudentName);

    // Update plan metadata from local
    const db = requireSupabase();
    await db
      .from('plans')
      .update({
        name: buildPlanName(localStudentName),
        major: localData.major || 'cs',
        student_name: localData.studentName || '',
        study_away_semesters: localData.studyAway?.selectedSemesters || [],
        study_away_locations: localData.studyAway?.locations || {},
      })
      .eq('id', planRow.id);

    // Import courses
    await this.save(userId, {
      planId: planRow.id,
      plan: localData.plan,
      major: localData.major || 'cs',
      studentName: localData.studentName || '',
      studyAway: normalizeStudyAwayPayload(localData.studyAway),
    });

    return true;
  },
};
