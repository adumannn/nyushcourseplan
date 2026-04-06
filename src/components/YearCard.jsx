import { useMemo } from 'react';
import { MAX_CREDITS_PER_SEMESTER } from '../data/courses';
import SemesterCard from './SemesterCard';
import CategoryBar from './CategoryBar';

const YEAR_LABELS = { 1: 'Freshman', 2: 'Sophomore', 3: 'Junior', 4: 'Senior' };

export default function YearCard({
  year, semesters, plan, semesterCredits,
  isExpanded, onToggle, onRemoveCourse, onAddClick,
}) {
  const stats = useMemo(() => {
    let totalCredits = 0;
    let courseCount = 0;
    const categoryCredits = {};
    const semStats = [];

    for (const sem of semesters) {
      const courses = plan[sem.id] || [];
      const cr = semesterCredits[sem.id] || 0;
      totalCredits += cr;
      courseCount += courses.length;
      semStats.push({
        label: sem.id.includes('Fall') ? 'Fall' : 'Spring',
        credits: cr,
        courses: courses.length,
        overloaded: cr > MAX_CREDITS_PER_SEMESTER,
      });

      for (const course of courses) {
        const cat = course.category || 'elective';
        categoryCredits[cat] = (categoryCredits[cat] || 0) + (course.credits || 0);
      }
    }

    return { totalCredits, courseCount, categoryCredits, semStats };
  }, [year, semesters, plan, semesterCredits]);

  const hasStudyAway = semesters.some(s => s.studyAwayEligible);
  const isEmpty = stats.courseCount === 0;

  return (
    <div className={`year-card ${isExpanded ? 'year-card--expanded' : ''}`}>
      <button
        className="year-card-header"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={`year-${year}-body`}
      >
        <div className="year-card-left">
          <span className="year-card-number">Y{year}</span>
          <div className="year-card-title-group">
            <span className="year-card-label">{YEAR_LABELS[year]}</span>
            {hasStudyAway && (
              <span className="year-card-badge" title="Study away eligible">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                Study Away
              </span>
            )}
          </div>
        </div>

        <div className="year-card-right">
          {!isEmpty && (
            <div className="year-card-stats">
              <div className="year-card-sem-summary">
                {stats.semStats.map((s, i) => (
                  <span key={i} className={s.overloaded ? 'year-card-sem--warn' : ''}>
                    {s.label}: {s.credits} cr
                  </span>
                ))}
              </div>
              <div className="year-card-totals">
                <span className="year-card-credits">{stats.totalCredits} credits</span>
                <span className="year-card-courses">{stats.courseCount} {stats.courseCount === 1 ? 'course' : 'courses'}</span>
              </div>
            </div>
          )}
          {isEmpty && (
            <span className="year-card-empty-hint">Click to add courses</span>
          )}
          <svg
            className="year-card-chevron"
            width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {!isEmpty && !isExpanded && (
        <div className="year-card-bar-wrapper">
          <CategoryBar categoryCredits={stats.categoryCredits} totalCredits={stats.totalCredits} />
        </div>
      )}

      <div className="year-card-body-wrapper" id={`year-${year}-body`}>
        <div className="year-card-body">
          <div className="year-card-semesters">
            {semesters.map(sem => (
              <SemesterCard
                key={sem.id}
                semester={sem}
                courses={plan[sem.id] || []}
                credits={semesterCredits[sem.id] || 0}
                onRemoveCourse={onRemoveCourse}
                onAddClick={onAddClick}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
