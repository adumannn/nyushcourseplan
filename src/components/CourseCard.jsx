import { CATEGORIES } from '../data/courses';

export default function CourseCard({ course, onRemove, semesterId, compact }) {
  const cat = CATEGORIES[course.category] || CATEGORIES.elective;

  return (
    <div
      className={`course-card ${compact ? 'course-card--compact' : ''}`}
      style={{ '--cat-color': cat.color }}
    >
      <div className="course-card-color" style={{ backgroundColor: cat.color }} />
      <div className="course-card-content">
        <div className="course-card-header">
          <span className="course-card-code">{course.code}</span>
          <span className="course-card-credits">{course.credits} cr</span>
        </div>
        <div className="course-card-name">{course.name}</div>
        <span className="course-card-badge" style={{ backgroundColor: cat.color }}>
          {cat.label}
        </span>
      </div>
      {onRemove && (
        <button
          className="course-card-remove"
          onClick={() => onRemove(semesterId, course.id)}
          title="Remove course"
          aria-label={`Remove ${course.name}`}
        >
          ×
        </button>
      )}
    </div>
  );
}