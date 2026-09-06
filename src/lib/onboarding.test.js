import test from 'node:test';
import assert from 'node:assert/strict';
import { createSamplePlan, shouldShowOnboarding } from './onboarding.js';

test('sample is an independent 16-credit first semester with real catalog courses', () => {
  const plan = createSamplePlan();
  assert.equal(Object.keys(plan).length, 8);
  assert.equal(plan['Y1-Fall'].length, 4);
  assert.equal(plan['Y1-Fall'].reduce((sum, course) => sum + course.credits, 0), 16);
  assert.equal(Object.values(plan).flat().length, 4);
  assert.ok(plan['Y1-Fall'].every((course) => course.id && course.name && course.requirementIds.length));
  plan['Y1-Fall'][0].name = 'Changed';
  assert.equal(createSamplePlan()['Y1-Fall'][0].name, 'Global Perspectives on Society');
});

test('walkthrough only starts for an unseen empty single plan without study away', () => {
  const input = { plan: { 'Y1-Fall': [] }, plans: [{ id: 'one' }], studyAway: { selectedSemesters: [] }, seen: false };
  assert.equal(shouldShowOnboarding(input), true);
  assert.equal(shouldShowOnboarding({ ...input, seen: true }), false);
  assert.equal(shouldShowOnboarding({ ...input, plan: createSamplePlan() }), false);
  assert.equal(shouldShowOnboarding({ ...input, plans: [] }), false);
  assert.equal(shouldShowOnboarding({ ...input, plans: [{ id: 'one' }, { id: 'two' }] }), false);
  assert.equal(shouldShowOnboarding({ ...input, studyAway: { selectedSemesters: ['Y3-Fall'] } }), false);
});
