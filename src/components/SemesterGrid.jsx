import { SEMESTERS } from '../data/courses';
import SemesterCard from './SemesterCard';

export default function SemesterGrid({ plan, semesterCredits, onRemoveCourse, onAddClick }) {
  const years = [1, 2, 3, 4];

  return (
    <div className="semester-grid">
      {years.map(year => {
        const semesters = SEMESTERS.filter(s => s.year === year);
        return (
          <div key={year} className="year-row">
            <div className="year-label">Year {year}</div>
            <div className="year-semesters">
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
        );
      })}
    </div>
  );
}