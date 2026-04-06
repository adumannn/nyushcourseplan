import { useState } from 'react';
import { SEMESTERS } from '../data/courses';
import YearCard from './YearCard';

export default function SemesterGrid({ plan, semesterCredits, onRemoveCourse, onAddClick }) {
  const [expandedYear, setExpandedYear] = useState(null);
  const years = [1, 2, 3, 4];

  return (
    <div className="year-grid">
      {years.map(year => {
        const semesters = SEMESTERS.filter(s => s.year === year);
        return (
          <YearCard
            key={year}
            year={year}
            semesters={semesters}
            plan={plan}
            semesterCredits={semesterCredits}
            isExpanded={expandedYear === year}
            onToggle={() => setExpandedYear(prev => prev === year ? null : year)}
            onRemoveCourse={onRemoveCourse}
            onAddClick={onAddClick}
          />
        );
      })}
    </div>
  );
}
