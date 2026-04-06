import { CATEGORIES } from '../data/courses';

export default function CategoryBar({ categoryCredits, totalCredits }) {
  if (!totalCredits) return <div className="category-bar category-bar--empty" />;

  const segments = Object.entries(categoryCredits)
    .filter(([, cr]) => cr > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="category-bar" role="img" aria-label="Credit distribution by category">
      {segments.map(([cat, cr]) => (
        <div
          key={cat}
          className="category-bar-segment"
          style={{
            width: `${(cr / totalCredits) * 100}%`,
            backgroundColor: CATEGORIES[cat]?.color || '#888',
          }}
          title={`${CATEGORIES[cat]?.label || cat}: ${cr} cr`}
        />
      ))}
    </div>
  );
}
