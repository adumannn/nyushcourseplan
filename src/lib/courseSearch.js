const COURSE_ALIASES = {
  "CCSF-SHU-101L": ["gps"],
  "WRIT-SHU-201": ["poh"],
};

export function getCourseSearchRank(course, search) {
  const query = search.trim().toLowerCase();
  if (!query) return 0;

  const values = [
    course.name,
    course.code,
    ...(COURSE_ALIASES[course.id] || []),
  ]
    .filter(Boolean)
    .map((value) => value.toLowerCase());

  if (values.includes(query)) return 0;
  if (values.some((value) => value.startsWith(query))) return 1;
  if (values.some((value) => value.includes(query))) return 2;
  return null;
}
