import { SEMESTERS } from '../data/courses.js';
import { LOCAL_CATALOG_BY_ID } from './localCatalog.js';

export function createSamplePlan() {
  const plan = Object.fromEntries(SEMESTERS.map(({ id }) => [id, []]));
  plan['Y1-Fall'] = ['CCSF-SHU-101L', 'WRIT-SHU-102', 'CHIN-SHU-101', 'MATH-SHU-131']
    .map((id) => structuredClone(LOCAL_CATALOG_BY_ID.get(id)));
  return plan;
}

export function shouldShowOnboarding({ plan, plans, studyAway, seen }) {
  return !seen && plans.length === 1 &&
    Object.values(plan).every((courses) => courses.length === 0) &&
    studyAway.selectedSemesters.length === 0;
}
