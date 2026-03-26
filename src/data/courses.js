
// All data sourced from the NYU Shanghai Academic Bulletin.
// ────────────────────────────────────────────────────────────

export const CATEGORIES = {
  core: { label: 'Core', color: '#57068c' },
  writing: { label: 'Writing', color: '#1565C0' },
  language: { label: 'Language', color: '#2196F3' },
  gps: { label: 'GPS', color: '#2E7D32' },
  major: { label: 'Major', color: '#E65100' },
  elective: { label: 'Elective', color: '#546E7A' },
};

export const SEMESTERS = [
  { id: 'Y1-Fall', label: 'Year 1 — Fall', year: 1, location: 'Shanghai' },
  { id: 'Y1-Spring', label: 'Year 1 — Spring', year: 1, location: 'Shanghai' },
  { id: 'Y2-Fall', label: 'Year 2 — Fall', year: 2, location: 'Shanghai' },
  { id: 'Y2-Spring', label: 'Year 2 — Spring', year: 2, location: 'Shanghai' },
  { id: 'Y3-Fall', label: 'Year 3 — Fall', year: 3, studyAwayEligible: true },
  {
    id: 'Y3-Spring',
    label: 'Year 3 — Spring',
    year: 3,
    studyAwayEligible: true,
  },
  { id: 'Y4-Fall', label: 'Year 4 — Fall', year: 4, studyAwayEligible: true },
  { id: 'Y4-Spring', label: 'Year 4 — Spring', year: 4, location: 'Shanghai' },
];

export const STUDY_AWAY = {
  maxSemesters: 2,
  eligibleSemesters: ['Y3-Fall', 'Y3-Spring', 'Y4-Fall'],
  locations: ['Shanghai', 'New York', 'Abu Dhabi', 'Paris', 'Sydney'],
  maxMajorCoursesPerSemester: 3,
  notes: [
    'Before studying abroad, CS students should complete: ICS, Data Structures, Probability & Statistics, Computer Architecture, and ideally Algorithms.',
    'Students can take a maximum of 3 courses within the same major discipline during study away.',
    'Students who plan to study in New York should follow the registration guide from the Global Programs New York Office (gpnyc@nyu.edu).',
    'CS/DS courses in New York are at Courant (CAS) or Tandon. Seats may be limited and prioritized for NYU New York students.',
    'Graduate-level Tandon CS courses are not open to undergraduates.',
    'Two semesters in New York requires an advising appointment and proposal with compelling academic rationale.',
  ],
};

export const MAJORS = [
  { id: 'cs', label: 'Computer Science' },
  // ↓ Uncomment or add new majors here. Then define their requirements
  //   in MAJOR_REQUIREMENTS and tag courses with majorRoles: { id: 'required'|'elective' }
  // { id: 'ds',       label: 'Data Science' },
  // { id: 'econ',     label: 'Economics' },
  // { id: 'business', label: 'Business and Finance' },
  // { id: 'math',     label: 'Honors Mathematics' },
];

export const AVAILABLE_MINORS = [
  { id: 'math', label: 'Mathematics' },
  // ↓ Add new minors here. Then define matching rules in MINOR_REQUIREMENTS.
  // { id: 'cs',   label: 'Computer Science' },
  // { id: 'econ', label: 'Economics' },
];

export const GRADUATION_CREDITS = 128;
export const MAX_CREDITS_PER_SEMESTER = 18;
export const MIN_CREDITS_PER_SEMESTER = 12;

// Core curriculum — every student must fulfill
export const CORE_REQUIREMENTS = [
  {
    id: 'social-and-cultural-foundations',
    label: 'Social and Cultural Foundations',
    category: 'gps',
    coursesNeeded: 3,
    creditsNeeded: 12,
    subcourses: [
      {
        code: 'CCSF-SHU 101L',
        name: 'Global Perspectives on Society (GPS)',
        credits: 4,
      },
      {
        code: 'IPC',
        name: 'Interdisciplinary Perspectives on China — 2 courses',
        credits: 8,
      },
    ],
  },
  {
    id: 'writing',
    label: 'Writing',
    category: 'writing',
    coursesNeeded: 2,
    creditsNeeded: 8,
    subcourses: [
      { code: 'WRIT-SHU 102', name: 'Writing as Inquiry (WAI)', credits: 4 },
      {
        code: 'WRIT-SHU 201',
        name: 'Perspectives on the Humanities (PoH)',
        credits: 4,
      },
    ],
  },
  {
    id: 'language',
    label: 'Language',
    category: 'language',
    coursesNeeded: 2,
    creditsNeeded: 8,
    subcourses: [
      {
        code: 'ENGL-SHU 100/101',
        name: 'For Chinese students: English for Academic Purposes (EAP)',
        credits: 8,
      },
      {
        code: 'CHIN-SHU 101–202',
        name: 'For non-Chinese students: Passing Intermediate Chinese II',
        credits: '8-16',
      },
    ],
  },
  {
    id: 'mathematics',
    label: 'Mathematics',
    category: 'core',
    coursesNeeded: 1,
    creditsNeeded: 4,
    subcourses: [{ code: 'MATH-SHU 131', name: 'Calculus', credits: 4 }],
  },
  {
    id: 'algorithmic-thinking',
    label: 'Algorithmic Thinking',
    category: 'core',
    coursesNeeded: 1,
    creditsNeeded: 4,
    subcourses: [
      {
        code: null,
        name: 'One 4-credit class from Algorithmic Thinking (AT) category',
        credits: 4,
      },
    ],
    majorFulfillment: {
      cs: 'Fulfilled by Major Coursework',
    },
  },
  {
    id: 'science',
    label: 'Science',
    category: 'core',
    coursesNeeded: 2,
    creditsNeeded: 8,
    subcourses: [
      {
        code: null,
        name: 'Experimental Discovery in the Natural World (ED)',
        credits: 4,
      },
      {
        code: null,
        name: 'Science, Technology, and Society (STS)',
        credits: 4,
      },
    ],
  },
];

// ─── Major-specific requirements ───
export const MAJOR_REQUIREMENTS = {
  cs: {
    label: 'Computer Science',
    bulletin: 'AY 2025-26',
    coursesNeeded: 12,
    creditsNeeded: 48,
    requiredCourses: [
      {
        courseId: 'CSCI-SHU-101',
        label: 'Introduction to Computer and Data Science',
      },
      { courseId: 'CSCI-SHU-210', label: 'Data Structures' },
      { courseId: 'CSCI-SHU-215', label: 'Operating Systems' },
      { courseId: 'CSCI-SHU-220', label: 'Algorithms' },
      { courseId: 'CSCI-SHU-2314', label: 'Discrete Mathematics' },
    ],
    selectOneCourses: [
      {
        label: 'Statistics Requirement',
        courseIds: ['MATH-SHU-235', 'MATH-SHU-238', 'BUSF-SHU-101'],
      },
      {
        label: 'Architecture Requirement',
        courseIds: ['CENG-SHU-202', 'CSCI-SHU-350'],
      },
    ],
    capstone: {
      courseId: 'CSCI-SHU-420',
      label: 'Computer Science Senior Project',
      notes: 'Fall Only',
    },
    electivesNeeded: 4,
    electiveCreditsNeeded: 16,
    otherElectiveCredits: '32-40',
    notes:
      'To officially declare CS, students must have a final grade of C, or be currently enrolled in MATH-SHU 131 Calculus (or pass the "Place out of Calculus" exam) and CSCI-SHU 11 Introduction to Computer Programming (or CSCI-SHU 101 or pass the "Place Into Introduction to Computer and Data Science" Exam). Some CS Elective courses are considered "soft" CS courses — students can only take a maximum of one such course to fulfill the CS Elective requirement (e.g. INTM-SHU 231 Developing Web).',
    studyAwayNotes:
      'Before studying abroad, students should complete: ICS, Data Structures, Probability & Statistics, Computer Architecture, and ideally Algorithms.',
  },
};

// ─── Minor-specific requirements ───
// Each minor needs:
//   id, label, coursesNeeded
//   Matching strategy (pick one or both):
//     • coursePrefix:       auto-match courses whose id starts with this prefix
//     • includedCourseIds:  explicit allow-list of course ids
//   Optional:
//     • excludedCourseIds:  courses to skip even if they match the prefix
//     • description, notes: shown in the sidebar
export const MINOR_REQUIREMENTS = {
  math: {
    id: 'math',
    label: 'Mathematics Minor',
    coursesNeeded: 4,
    description:
      'Any four Math major courses can be counted towards the Math minor.',
    coursePrefix: 'MATH-SHU',
    excludedCourseIds: ['MATH-SHU-9', 'MATH-SHU-10', 'MATH-SHU-265'],
    notes:
      'The following courses cannot fulfill the Math minor requirement: MATH-SHU 9 Precalculus; MATH-SHU 10 Quantitative Reasoning; MATH-SHU 265 Linear Algebra and Differential Equation',
  },
  // Example — explicit id list approach (uncomment to use):
  // econ: {
  //   id: 'econ',
  //   label: 'Economics Minor',
  //   coursesNeeded: 5,
  //   description: 'Five Economics courses…',
  //   includedCourseIds: ['ECON-SHU-1', 'ECON-SHU-2', ...],
  //   excludedCourseIds: [],
  // },
};

// ─── Course Catalog ───
export const COURSE_CATALOG = [
  // ═══ GPS ═══
  {
    id: 'CCSF-SHU-101L',
    code: 'CCSF-SHU 101L',
    name: 'Global Perspectives on Society',
    credits: 4,
    category: 'gps',
    department: 'GPS',
    requirementIds: ['social-and-cultural-foundations'],
  },

  // ═══ WRITING ═══
  {
    id: 'WRIT-SHU-102',
    code: 'WRIT-SHU 102',
    name: 'Writing as Inquiry',
    credits: 4,
    category: 'writing',
    department: 'Writing',
    requirementIds: ['writing'],
  },
  {
    id: 'WRIT-SHU-201',
    code: 'WRIT-SHU 201',
    name: 'Perspectives on the Humanities',
    credits: 4,
    category: 'writing',
    department: 'Writing',
    requirementIds: ['writing'],
  },

  // ═══ CHINESE LANGUAGE ═══
  {
    id: 'CHIN-SHU-101',
    code: 'CHIN-SHU 101',
    name: 'Elementary Chinese I',
    credits: 4,
    category: 'language',
    department: 'Chinese',
    requirementIds: ['language'],
  },
  {
    id: 'CHIN-SHU-102',
    code: 'CHIN-SHU 102',
    name: 'Elementary Chinese II',
    credits: 4,
    category: 'language',
    department: 'Chinese',
    requirementIds: ['language'],
  },
  {
    id: 'CHIN-SHU-201',
    code: 'CHIN-SHU 201',
    name: 'Intermediate Chinese I',
    credits: 4,
    category: 'language',
    department: 'Chinese',
    requirementIds: ['language'],
  },
  {
    id: 'CHIN-SHU-202',
    code: 'CHIN-SHU 202',
    name: 'Intermediate Chinese II',
    credits: 4,
    category: 'language',
    department: 'Chinese',
    requirementIds: ['language'],
  },
  {
    id: 'CHIN-SHU-301',
    code: 'CHIN-SHU 301',
    name: 'Advanced Chinese I',
    credits: 4,
    category: 'language',
    department: 'Chinese',
    requirementIds: ['language'],
  },
  {
    id: 'CHIN-SHU-302',
    code: 'CHIN-SHU 302',
    name: 'Advanced Chinese II',
    credits: 4,
    category: 'language',
    department: 'Chinese',
    requirementIds: ['language'],
  },

  // ═══ ENGLISH (EAP) ═══
  {
    id: 'ENGL-SHU-100',
    code: 'ENGL-SHU 100',
    name: 'English for Academic Purposes I',
    credits: 4,
    category: 'language',
    department: 'English',
    requirementIds: ['language'],
  },
  {
    id: 'ENGL-SHU-101',
    code: 'ENGL-SHU 101',
    name: 'English for Academic Purposes II',
    credits: 4,
    category: 'language',
    department: 'English',
    requirementIds: ['language'],
  },

  // ═══ MATHEMATICS — Excluded from Minor ═══
  {
    id: 'MATH-SHU-9',
    code: 'MATH-SHU 9',
    name: 'Precalculus',
    credits: 4,
    category: 'core',
    department: 'Mathematics',
  },
  {
    id: 'MATH-SHU-10',
    code: 'MATH-SHU 10',
    name: 'Quantitative Reasoning: Great Ideas in Mathematics',
    credits: 4,
    category: 'core',
    department: 'Mathematics',
  },
  {
    id: 'MATH-SHU-265',
    code: 'MATH-SHU 265',
    name: 'Linear Algebra and Differential Equation',
    credits: 4,
    category: 'core',
    department: 'Mathematics',
  },

  // ═══ CORE — MATHEMATICS ═══
  {
    id: 'MATH-SHU-131',
    code: 'MATH-SHU 131',
    name: 'Calculus',
    credits: 4,
    category: 'core',
    department: 'Mathematics',
    requirementIds: ['mathematics'],
  },
  {
    id: 'MATH-SHU-140',
    code: 'MATH-SHU 140',
    name: 'Linear Algebra',
    credits: 4,
    category: 'core',
    department: 'Mathematics',
    prerequisiteNote: 'Grade C or better in Calculus',
  },
  {
    id: 'MATH-SHU-151',
    code: 'MATH-SHU 151',
    name: 'Multivariable Calculus',
    credits: 4,
    category: 'core',
    department: 'Mathematics',
  },

  // ═══ CORE — ALGORITHMIC THINKING (CS prerequisite) ═══
  {
    id: 'CSCI-SHU-11',
    code: 'CSCI-SHU 11',
    name: 'Introduction to Computer Programming',
    credits: 4,
    category: 'core',
    department: 'Computer Science',
    requirementIds: ['algorithmic-thinking'],
    prerequisiteNote:
      'C in Precalculus or pass Calculus placement test (Shanghai portal students only)',
  },

  // ═══ CS MAJOR — REQUIRED ═══
  {
    id: 'CSCI-SHU-101',
    code: 'CSCI-SHU 101',
    name: 'Introduction to Computer and Data Science',
    credits: 4,
    category: 'major',
    department: 'Computer Science',
    csRole: 'required',
    requirementIds: ['algorithmic-thinking'],
    // majorRoles: { cs: 'required' },  — same meaning, generic form
    prerequisites: ['CSCI-SHU-11'],
    prerequisiteNote: 'CSCI-SHU 11 or placement exam',
  },
  {
    id: 'CSCI-SHU-210',
    code: 'CSCI-SHU 210',
    name: 'Data Structures',
    credits: 4,
    category: 'major',
    department: 'Computer Science',
    csRole: 'required',
    prerequisites: ['CSCI-SHU-101'],
    prerequisiteNote: 'ICS or A- in ICP',
  },
  {
    id: 'CSCI-SHU-2314',
    code: 'CSCI-SHU 2314',
    name: 'Discrete Mathematics',
    credits: 4,
    category: 'major',
    department: 'Computer Science',
    csRole: 'required',
    prerequisiteNote:
      'Co-requisite or Pre-requisite: MATH-SHU 131 Calculus or MATH-SHU 201 Honors Calculus',
  },
  {
    id: 'CSCI-SHU-220',
    code: 'CSCI-SHU 220',
    name: 'Algorithms',
    credits: 4,
    category: 'major',
    department: 'Computer Science',
    csRole: 'required',
    prerequisites: ['CSCI-SHU-210'],
    prerequisiteNote:
      'Data Structures AND (Discrete Math OR Linear Algebra OR Honors Linear Algebra)',
  },
  {
    id: 'CSCI-SHU-215',
    code: 'CSCI-SHU 215',
    name: 'Operating Systems',
    credits: 4,
    category: 'major',
    department: 'Computer Science',
    csRole: 'required',
    prerequisites: ['CENG-SHU-202'],
    prerequisiteNote:
      'CENG-SHU 202 Computer Architecture or Computer Systems Organization',
  },
  {
    id: 'CSCI-SHU-420',
    code: 'CSCI-SHU 420',
    name: 'Computer Science Senior Project',
    credits: 4,
    category: 'major',
    department: 'Computer Science',
    csRole: 'capstone',
    prerequisiteNote: 'Fall Only',
  },

  // ═══ CS MAJOR — SELECT ONE (Statistics) ═══
  {
    id: 'MATH-SHU-235',
    code: 'MATH-SHU 235',
    name: 'Probability and Statistics',
    credits: 4,
    category: 'major',
    department: 'Mathematics',
    csRole: 'required',
    prerequisites: ['MATH-SHU-131'],
    prerequisiteNote:
      'Grade C or better in MATH-SHU 131 Calculus or MATH-SHU 201 Honors Calculus. Anti-requisite: MATH-SHU 238.',
  },
  {
    id: 'MATH-SHU-238',
    code: 'MATH-SHU 238',
    name: 'Honors Theory of Probability',
    credits: 4,
    category: 'major',
    department: 'Mathematics',
    csRole: 'required',
    prerequisites: ['MATH-SHU-151', 'MATH-SHU-140'],
    prerequisiteNote:
      'Grade C or better in Multivariable Calculus or Honors Analysis II, AND Grade C or better in Linear Algebra or Honors Linear Algebra I.',
  },
  {
    id: 'BUSF-SHU-101',
    code: 'BUSF-SHU 101',
    name: 'Statistics for Business and Economics',
    credits: 4,
    category: 'major',
    department: 'Business and Finance',
    csRole: 'required',
  },

  // ═══ CS MAJOR — SELECT ONE (Architecture) ═══
  {
    id: 'CENG-SHU-202',
    code: 'CENG-SHU 202',
    name: 'Computer Architecture',
    credits: 4,
    category: 'major',
    department: 'Computer Science',
    csRole: 'required',
    prerequisites: ['CSCI-SHU-101'],
    prerequisiteNote: 'CSCI-SHU 101 ICS or CSCI-SHU 11 ICP',
  },
  {
    id: 'CSCI-SHU-350',
    code: 'CSCI-SHU 350',
    name: 'Embedded Computer Systems',
    credits: 4,
    category: 'major',
    department: 'Computer Science',
    csRole: 'required',
  },

  // ═══ CS MAJOR — ELECTIVES (select 4) ═══
  {
    id: 'CSCI-SHU-308',
    code: 'CSCI-SHU 308',
    name: 'Computer Networking',
    credits: 4,
    category: 'major',
    department: 'Computer Science',
    csRole: 'elective',
    prerequisites: ['CSCI-SHU-101'],
    prerequisiteNote: 'CSCI-SHU 101 Intro to Computer Science',
  },
  {
    id: 'CSCI-SHU-213',
    code: 'CSCI-SHU 213',
    name: 'Databases',
    credits: 4,
    category: 'major',
    department: 'Computer Science',
    csRole: 'elective',
    prerequisites: ['CSCI-SHU-210'],
    prerequisiteNote: 'CSCI-SHU 210 Data Structures',
  },
  {
    id: 'CSCI-SHU-254',
    code: 'CSCI-SHU 254',
    name: 'Distributed Systems',
    credits: 4,
    category: 'major',
    department: 'Computer Science',
    csRole: 'elective',
    prerequisites: ['CENG-SHU-202'],
    prerequisiteNote: 'CENG-SHU 202 Computer Architecture',
  },
  {
    id: 'CSCI-SHU-360',
    code: 'CSCI-SHU 360',
    name: 'Machine Learning',
    credits: 4,
    category: 'major',
    department: 'Computer Science',
    csRole: 'elective',
    prerequisiteNote:
      'ICP, Calculus, Probability and Statistics OR Theory of Probability OR Statistics for Business and Economics OR Linear Algebra',
  },
  {
    id: 'CSCI-SHU-376',
    code: 'CSCI-SHU 376',
    name: 'Natural Language Processing',
    credits: 4,
    category: 'major',
    department: 'Computer Science',
    csRole: 'elective',
    prerequisites: ['CSCI-SHU-11'],
    prerequisiteNote:
      'CSCI-SHU 11 ICP and (CSCI-SHU 360 Machine Learning or MATH-SHU 235 Prob & Stats or MATH-SHU 238 Theory of Probability)',
  },
  {
    id: 'CSCI-SHU-205',
    code: 'CSCI-SHU 205',
    name: 'Topics in Computer Science',
    credits: 4,
    category: 'major',
    department: 'Computer Science',
    csRole: 'elective',
    prerequisites: ['CSCI-SHU-101'],
    prerequisiteNote: 'CSCI-SHU 101 Introduction to Computer and Data Science',
  },
  {
    id: 'CSCI-SHU-200',
    code: 'CSCI-SHU 200',
    name: 'Topics in Human-Computer Interaction',
    credits: 4,
    category: 'major',
    department: 'Computer Science',
    csRole: 'elective',
    prerequisites: ['CSCI-SHU-101'],
    prerequisiteNote: 'CSCI-SHU 101 Introduction to Computer Science',
  },
  {
    id: 'DATS-SHU-377',
    code: 'DATS-SHU 377',
    name: 'Computer Vision',
    credits: 4,
    category: 'major',
    department: 'Data Science',
    csRole: 'elective',
    prerequisites: ['CSCI-SHU-11'],
    prerequisiteNote:
      'CSCI-SHU 11 ICP and (CSCI-SHU 360 Machine Learning or MATH-SHU 235 Prob & Stats or MATH-SHU 238 Theory of Probability)',
  },
  {
    id: 'DATS-SHU-235',
    code: 'DATS-SHU 235',
    name: 'Information Visualization',
    credits: 4,
    category: 'major',
    department: 'Data Science',
    csRole: 'elective',
    prerequisites: ['CSCI-SHU-210'],
    prerequisiteNote: 'Prereq or coreq: CSCI-SHU 210 Data Structures',
  },
  {
    id: 'DATS-SHU-369',
    code: 'DATS-SHU 369',
    name: 'Machine Learning with Graphs',
    credits: 4,
    category: 'major',
    department: 'Data Science',
    csRole: 'elective',
    prerequisites: ['CSCI-SHU-360'],
    prerequisiteNote:
      'CSCI-SHU 360 Machine Learning or MATH-SHU 235 Probability and Statistics',
  },
];

// ─── Sample 4-Year Plans ───
export const SAMPLE_PLANS = {
  cs: [
    {
      id: 'cs-away-jr-fall',
      label: 'Study Away Junior Fall',
      semesters: {
        'Y1-Fall': [
          {
            courseId: 'CCSF-SHU-101L',
            label: 'Global Perspectives on Society',
          },
          { courseId: 'MATH-SHU-131', label: 'Calculus' },
          { label: 'Core Class (ICP/ICS)' },
          { label: 'English, Chinese, Core or General Elective' },
        ],
        'Y1-Spring': [
          { courseId: 'WRIT-SHU-102', label: 'Writing as Inquiry' },
          { label: 'Core Class' },
          { label: 'ICS or Data Structures' },
          { label: 'English, Chinese, Core or General Elective' },
        ],
        'Y2-Fall': [
          { courseId: 'WRIT-SHU-201', label: 'Perspectives on the Humanities' },
          { label: 'Data Structures or CS Elective' },
          { courseId: 'CSCI-SHU-2314', label: 'Discrete Mathematics' },
          { label: 'Probability and Statistics or alternate' },
        ],
        'Y2-Spring': [
          { label: 'Core, General Elective, or Chinese' },
          { courseId: 'CSCI-SHU-220', label: 'Algorithms' },
          { courseId: 'CENG-SHU-202', label: 'Computer Architecture' },
          { label: 'Core, General Elective, or Chinese' },
        ],
        'Y3-Fall': [
          { label: 'Core or General Elective' },
          { label: 'CS Elective' },
          { label: 'CS Elective' },
          { label: 'General Elective' },
        ],
        'Y3-Spring': [
          { label: 'Core or General Elective' },
          { label: 'CS Elective' },
          { label: 'CS Elective' },
          { label: 'General Elective' },
        ],
        'Y4-Fall': [
          { courseId: 'CSCI-SHU-215', label: 'Operating Systems' },
          { courseId: 'CSCI-SHU-420', label: 'Senior Project' },
          { label: 'General Elective' },
          { label: 'General Elective' },
        ],
        'Y4-Spring': [
          { label: 'Core or General Elective' },
          { label: 'Core or General Elective' },
          { label: 'General Elective' },
          { label: 'General Elective' },
        ],
      },
    },
    {
      id: 'cs-away-jr-spring',
      label: 'Study Away Junior Spring',
      semesters: {
        'Y1-Fall': [
          {
            courseId: 'CCSF-SHU-101L',
            label: 'Global Perspectives on Society',
          },
          { courseId: 'MATH-SHU-131', label: 'Calculus' },
          { label: 'Core Class' },
          { label: 'English, Chinese, Core or General Elective' },
        ],
        'Y1-Spring': [
          { courseId: 'WRIT-SHU-102', label: 'Writing as Inquiry' },
          { label: 'Core Class (ICP)' },
          { label: 'Core or General Elective' },
          { label: 'English, Chinese, Core or General Elective' },
        ],
        'Y2-Fall': [
          { courseId: 'WRIT-SHU-201', label: 'Perspectives on the Humanities' },
          {
            courseId: 'CSCI-SHU-101',
            label: 'Intro to Computer and Data Science',
          },
          { courseId: 'CSCI-SHU-2314', label: 'Discrete Mathematics' },
          { label: 'Core, General Elective, or Chinese' },
        ],
        'Y2-Spring': [
          { label: 'CS Elective' },
          { courseId: 'CSCI-SHU-210', label: 'Data Structures' },
          { courseId: 'CENG-SHU-202', label: 'Computer Architecture' },
          { label: 'Core, General Elective, or Chinese' },
        ],
        'Y3-Fall': [
          { label: 'Core or General Elective' },
          { label: 'CS Elective' },
          { label: 'Probability & Statistics or alternate' },
          { label: 'General Elective' },
        ],
        'Y3-Spring': [
          { courseId: 'CSCI-SHU-220', label: 'Algorithms' },
          { label: 'CS Elective' },
          { label: 'Core or General Elective' },
          { label: 'CS Elective' },
        ],
        'Y4-Fall': [
          { courseId: 'CSCI-SHU-215', label: 'Operating Systems' },
          { label: 'CS Elective' },
          { courseId: 'CSCI-SHU-420', label: 'Senior Project' },
          { label: 'General Elective' },
        ],
        'Y4-Spring': [
          { label: 'Core or General Elective' },
          { label: 'Core or General Elective' },
          { label: 'General Elective' },
          { label: 'General Elective' },
        ],
      },
    },
  ],
};

// Derived data
export const DEPARTMENTS = [
  ...new Set(COURSE_CATALOG.map((c) => c.department)),
].sort();