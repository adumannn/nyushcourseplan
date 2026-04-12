import { SEMESTERS } from '../data/courses';
import SemesterCard from './SemesterCard';

const years = [
  { id: 'y1', label: 'Y1', name: 'Freshman', semesters: ['Fall', 'Spring'] },
  { id: 'y2', label: 'Y2', name: 'Sophomore', semesters: ['Fall', 'Spring'] },
  { id: 'y3', label: 'Y3', name: 'Junior', semesters: ['Fall', 'Spring'] },
  { id: 'y4', label: 'Y4', name: 'Senior', semesters: ['Fall', 'Spring'] },
];

export default function SemesterGrid({ plan, semesterCredits, onRemoveCourse, onAddClick }) {
  return (
    <div>
      {years.map(year => (
        <div key={year.id} className="border-b border-border/40 last:border-b-0">
          <div className="px-6 py-3 bg-accent/5 border-b border-border/30">
            <div className="flex items-center gap-3">
              <span className="text-xs tracking-wider uppercase text-muted-foreground font-medium">
                {year.label}
              </span>
              <span className="text-sm text-muted-foreground/80">
                {year.name}
              </span>
            </div>
          </div>
          {year.semesters.map(semester => {
            const semesterKey = `Y${year.id.slice(1)}-${semester}`;
            const semObj = SEMESTERS.find(s => s.id === semesterKey);
            if (!semObj) return null;
            return (
              <SemesterCard
                key={semesterKey}
                semesterKey={semesterKey}
                year={`${semester} ${year.label.toUpperCase()}`}
                semester={semester}
                courses={plan[semesterKey] || []}
                credits={semesterCredits[semesterKey] || 0}
                onRemoveCourse={onRemoveCourse}
                onAddClick={onAddClick}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
