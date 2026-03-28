import { supabase } from './supabase';
import { SEMESTERS, COURSE_CATALOG } from '../data/courses';

const STORAGE_KEY = 'nyu-shanghai-course-planner';

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

export const localStoragePlan = {
  async load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
    }
    return null;
  },

  async save({ plan, major, studentName }) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ plan, major, studentName }));
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
  async ensurePlan(userId) {
    // Get existing plan or create one
    const { data: existing } = await supabase
      .from('plans')
      .select('id, major, student_name')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (existing) return existing;

    const { data: created, error } = await supabase
      .from('plans')
      .insert({ user_id: userId })
      .select('id, major, student_name')
      .single();

    if (error) throw error;
    return created;
  },

  async load(userId) {
    try {
      const planRow = await this.ensurePlan(userId);
      const planId = planRow.id;

      const { data: courses, error } = await supabase
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
      };
    } catch (e) {
      console.error('Failed to load from Supabase:', e);
      return null;
    }
  },

  async save(userId, { planId, plan, major, studentName }) {
    try {
      // Update plan metadata
      await supabase
        .from('plans')
        .update({ major, student_name: studentName })
        .eq('id', planId);

      // Replace all courses: delete then insert
      await supabase
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
        const { error } = await supabase
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

    const planRow = await this.ensurePlan(userId);

    // Update plan metadata from local
    await supabase
      .from('plans')
      .update({
        major: localData.major || 'cs',
        student_name: localData.studentName || '',
      })
      .eq('id', planRow.id);

    // Import courses
    await this.save(userId, {
      planId: planRow.id,
      plan: localData.plan,
      major: localData.major || 'cs',
      studentName: localData.studentName || '',
    });

    return true;
  },
};
