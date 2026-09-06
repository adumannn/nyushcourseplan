import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, GRADUATION_CREDITS } from '../../data/courses';
import { createSamplePlan, shouldShowOnboarding } from '../../lib/onboarding';

const steps = [
  { title: 'A semester starts with a few courses', description: 'Here’s an example first fall. Each course has credits and a category. In your planner, use Add Course to build a semester and select a course title for details.' },
  { title: 'See what each course counts toward', description: 'These four courses add 16 credits toward graduation. The requirements panel tracks your core and major requirements as you plan. On mobile, tap Progress to see it.' },
  { title: 'Now make it yours', description: 'Choose your major at the top of the planner, then add courses to any semester. You can rearrange courses and plan study away as your next semesters take shape.' },
];

export default function OnboardingWalkthrough({ userId, plan, plans, studyAway, onUseSample }) {
  const storageKey = `nyush-planner:onboarding:${userId}`;
  const [open, setOpen] = useState(() => {
    let seen = false;
    try { seen = localStorage.getItem(storageKey) === 'done'; } catch { /* Storage may be unavailable. */ }
    return shouldShowOnboarding({ plan, plans, studyAway, seen });
  });
  const [step, setStep] = useState(0);
  const [sample] = useState(createSamplePlan);
  const dialogRef = useRef(null);
  const titleRef = useRef(null);
  const courses = sample['Y1-Fall'];
  const credits = courses.reduce((sum, course) => sum + course.credits, 0);

  useEffect(() => {
    if (!open) {
      try { localStorage.setItem(storageKey, 'done'); } catch { /* Dismissal still works for this visit. */ }
      return;
    }
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open, storageKey]);

  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [step, open]);

  if (!open) return null;

  return (
    <dialog ref={dialogRef} className="onboarding-dialog" aria-labelledby="onboarding-title" aria-describedby="onboarding-description" onCancel={() => setOpen(false)}>
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3 sm:px-7">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Quick start · {step + 1} of {steps.length}</p>
        <button type="button" className="min-h-11 rounded-md px-3 text-sm hover:bg-accent" onClick={() => setOpen(false)}>Skip tour</button>
      </div>
      <div className="p-5 sm:p-7">
        <h1 ref={titleRef} tabIndex={-1} id="onboarding-title" className="text-2xl font-semibold tracking-tight outline-none">{steps[step].title}</h1>
        <p id="onboarding-description" className="mt-3 text-sm leading-relaxed text-muted-foreground">{steps[step].description}</p>
        <section className="mt-6 overflow-hidden rounded-xl border border-border" aria-label="Example first semester">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-purple-100 px-4 py-3 text-purple-950 dark:bg-purple-400/15 dark:text-purple-100">
            <h2 className="text-sm font-semibold">Year 1 · Fall <span className="font-normal opacity-75">/ Example</span></h2>
            <span className="text-sm tabular-nums">{credits} credits</span>
          </div>
          <ul className="divide-y divide-border">
            {courses.map((course) => (
              <li key={course.id} className="flex items-start gap-3 px-4 py-3">
                <span aria-hidden="true" className="mt-1 h-4 w-1 shrink-0 rounded-full" style={{ backgroundColor: CATEGORIES[course.category]?.color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{course.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{course.code} · {CATEGORIES[course.category]?.label}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{course.credits} cr</span>
              </li>
            ))}
          </ul>
          {step > 0 && (
            <div className="border-t border-border bg-accent/30 px-4 py-3">
              <div className="mb-2 flex justify-between gap-3 text-sm"><span>Planned credits</span><span>{credits} / {GRADUATION_CREDITS}</span></div>
              <progress className="onboarding-progress" value={credits} max={GRADUATION_CREDITS} aria-label="Example graduation credit progress" />
            </div>
          )}
        </section>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">An illustration, not a prescribed schedule. Course choices depend on placement, availability, and advising. The example is only saved if you choose “Use sample”.</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4 sm:px-7">
        {step > 0 && <button type="button" className="mr-auto min-h-11 rounded-lg px-3 text-sm hover:bg-accent" onClick={() => setStep(step - 1)}>Back</button>}
        {step === steps.length - 1 ? (
          <>
            <button type="button" className="min-h-11 rounded-lg border border-border px-4 text-sm hover:bg-accent" onClick={() => setOpen(false)}>Start blank</button>
            <button type="button" className="onboarding-primary" onClick={() => { onUseSample({ plan: sample }, 'merge'); setOpen(false); }}>Use sample</button>
          </>
        ) : <button type="button" className="onboarding-primary" onClick={() => setStep(step + 1)}>Next</button>}
      </div>
    </dialog>
  );
}
