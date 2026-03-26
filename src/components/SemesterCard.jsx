import CourseCard from './CourseCard';
import { MAX_CREDITS_PER_SEMESTER } from '../data/courses';

export default function SemesterCard({ semester, courses, credits, onRemoveCourse, onAddClick }) {
  const overloaded = credits > MAX_CREDITS_PER_SEMESTER;

  return (
    <div className={`semester-card ${overloaded ? 'semester-card--overloaded' : ''}`}>
      <div className="semester-card-header">
        <h3 className="semester-card-title">{semester.label}</h3>
        <span className={`semester-card-credits ${overloaded ? 'credits--warning' : ''}`}>
          {credits} credits
          {overloaded && <span className="credits-warning-icon" title={`Exceeds ${MAX_CREDITS_PER_SEMESTER} credit limit`}> ⚠</span>}
        </span>
      </div>

      <div className="semester-card-courses">
        {courses.length === 0 ? (
          <div className="semester-card-empty">
            <span>No courses added yet</span>
          </div>
        ) : (
          courses.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              semesterId={semester.id}
              onRemove={onRemoveCourse}
              compact
            />
          ))
        )}
      </div>

      <button className="semester-add-btn" onClick={() => onAddClick(semester.id)}>
        + Add Course
      </button>
    </div>
  );
}