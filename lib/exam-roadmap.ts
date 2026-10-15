// ============================================================
// lib/exam-roadmap.ts — Content of the Exam roadmap page
// ============================================================
// Marks, content/methodology split and units come from the official
// "DSC-2026 SGT – Secondary Grade Teacher Syllabus" (Government of AP,
// Department of School Education, SCERT). The question count, duration and
// marking come from AP_DSC_SGT_OFFICIAL_BLUEPRINT, which the mock tests use.
//
// Edit EXAM_DATES when the schedule is announced.
// ============================================================

export interface ExamPart {
  id: string
  name: string
  marks: number
  /** Content and methodology marks, for the five school subjects. */
  split?: { content: number; methodology: number }
  /** Units as the official syllabus lists them; empty where it lists none. */
  units: string[]
  methodologyUnits?: string[]
  note?: string
}

export const SYLLABUS_SOURCE = 'DSC-2026 SGT Syllabus — Government of Andhra Pradesh, SCERT'

/** School subjects: Class III to VIII content, difficulty up to Class X. */
const SUBJECT_LEVEL = 'Content from Class III to VIII; difficulty up to Class X.'

export const EXAM_PARTS: ExamPart[] = [
  {
    id: 'gk',
    name: 'General Knowledge & Current Affairs',
    marks: 8,
    units: [],
    note: 'The syllabus lists no units for this part: it covers general knowledge and current affairs.',
  },
  {
    id: 'perspectives',
    name: 'Perspectives in Education',
    marks: 4,
    units: [
      'History of Education — ancient and medieval India; Wood’s Despatch, Hunter, Hartog and Sargent; Mudaliar, Kothari, Ishwarbhai Patel, NPE-1986, POA-1992',
      'Teacher empowerment — professional code of conduct, motivation, professional development, teacher organisations, school records and registers',
      'Educational concerns in contemporary India — democracy, equality, equity and quality; economics of education, human capital, Saakshar Bharat; population, gender, urbanisation, life skills; adolescence, value, health and inclusive education; LPG; programmes (APPEP, DPEP, SSA, NPEGEL, RMSA, RAA, KGBVs, Model Schools), incentives, current trends',
      'Acts and rights — RTE Act 2009, RTI Act 2005, child rights, human rights',
      'National Curriculum Framework 2005',
      'National Education Policy 2020',
    ],
  },
  {
    id: 'psychology',
    name: 'Educational Psychology',
    marks: 8,
    units: [
      'Development of the child — growth and maturation, principles and factors, dimensions; Piaget, Kohlberg, Chomsky, Carl Rogers, Erikson',
      'Individual differences — intelligence and its theories, multiple intelligence, IQ, EQ, creativity, attitude, aptitude, interest, habit',
      'Learning — theories and approaches, learning curves, transfer, memory and forgetting, children with special needs, inclusive education',
      'Personality — theories and assessment, mental health, adjustment, stress, emotional intelligence',
    ],
  },
  {
    id: 'telugu',
    name: 'Telugu (Language I)',
    marks: 12,
    split: { content: 8, methodology: 4 },
    // In Telugu, as the syllabus gives them.
    units: [
      'తెలుగు వాచకాల్లోని పాఠ్యభాగ విషయాలు — కవి పరిచయాలు, పాత్రలు, ఇతివృత్తాలు, సందర్భాలు, నేపథ్యాలు, విద్యా ప్రమాణాలు',
      'పదజాలం — అర్థాలు, పర్యాయపదాలు, నానార్థాలు, వ్యుత్పత్త్యర్థాలు, జాతీయాలు, సామెతలు, పొడుపు కథలు',
      'భాషాంశాలు — విభక్తి ప్రత్యయాలు, ఔపవిభక్తికాలు, పారిభాషిక పదాలు, తెలుగు, సంస్కృత సంధులు, సమాసాలు, ఛందస్సు, అలంకారాలు, వాక్యాలు',
    ],
    methodologyUnits: [
      'తెలుగు భాషా బోధన — ఉద్దేశాలు, విలువలు, లక్ష్యాలు, స్పష్టీకరణలు', 'భాష – సమాజం – సాహిత్య ప్రక్రియలు',
      'మాతృభాష స్వభావం, స్థానం, ప్రాధాన్యత, భాషోత్పత్తి వాదాలు, ధ్వని, అర్థ విపరిణామాలు', 'పాఠ్యపుస్తకాలు – బోధనా శాస్త్రంపై అవగాహన',
      'భాషా సామర్థ్యాలు, విద్యా ప్రమాణాలు', 'బోధనా పద్ధతులు – బోధనాభ్యసన ప్రక్రియల నిర్వహణ', 'ప్రణాళికా రచన',
      'బోధనాభ్యసన సామగ్రి', 'ఆంధ్రప్రదేశ్‌లో భాషాభివృద్ధి కార్యక్రమాలు', 'భాష – మూల్యాంకనం',
    ],
    note: SUBJECT_LEVEL,
  },
  {
    id: 'english',
    name: 'English (Language II)',
    marks: 12,
    split: { content: 8, methodology: 4 },
    units: [
      'Poets, essayists, novelists, dramatists and their works',
      'Writing of discourse — story, essay, letter, editorial, précis and more',
      'Pronunciation, sounds and use of the dictionary',
      'Parts of speech',
      'Tenses',
      'Types of sentences',
      'Articles and prepositions',
    ],
    methodologyUnits: [
      'Aspects of English and problems of teaching it', 'Objectives of teaching English', 'Language skills (LSRW)',
      'Approaches, methods and techniques', 'Teaching structures and vocabulary', 'Teaching-learning materials',
      'Lesson planning', 'Curriculum and textbooks', 'Evaluation',
    ],
    note: SUBJECT_LEVEL,
  },
  {
    id: 'mathematics',
    name: 'Mathematics',
    marks: 12,
    split: { content: 8, methodology: 4 },
    units: ['Numbers', 'Arithmetic', 'Geometry', 'Data handling', 'Algebra', 'Mensuration'],
    methodologyUnits: [
      'Nature and definitions of mathematics', 'Aims, values and instructional objectives',
      'Methods of teaching and remedial measures', 'TLM and resource utilisation',
      'Curriculum, textbooks and instructional planning', 'Evaluation and CCE',
    ],
    note: SUBJECT_LEVEL,
  },
  {
    id: 'science',
    name: 'Science',
    marks: 12,
    split: { content: 8, methodology: 4 },
    units: ['Living world', 'Life processes', 'Natural phenomena', 'Transportation and communication', 'Professions and services', 'Our environment'],
    methodologyUnits: [
      'Nature, scope and history of science', 'Aims, values, objectives and academic standards',
      'Methods, approaches and techniques', 'Teaching-learning material and improvised aids', 'Curriculum and textbook',
      'Assessment and evaluation', 'Science laboratories', 'Year plan and lesson plan', 'Role of the science teacher',
      'Science fairs, clubs, field trips and museums',
    ],
    note: SUBJECT_LEVEL,
  },
  {
    id: 'social',
    name: 'Social Studies',
    marks: 12,
    split: { content: 8, methodology: 4 },
    units: [
      'Our universe', 'Production, exchange and livelihoods', 'Political systems and governance',
      'Social organisation and inequities', 'Religion and society', 'Culture and communication',
    ],
    methodologyUnits: [
      'Nature, scope and history of social studies', 'Aims, values, objectives and academic standards',
      'Methods, approaches and techniques', 'Teaching-learning material and improvised aids', 'Curriculum and textbook',
      'Assessment and evaluation', 'Social studies laboratories', 'Year plan and lesson plan',
      'Roles and responsibilities of the teacher', 'Fairs, clubs, field trips and museums',
    ],
    note: SUBJECT_LEVEL,
  },
]

export interface ExamDate {
  label: string
  /** ISO date (YYYY-MM-DD), or null while not announced. */
  date: string | null
  /** Optional text shown beside the date, e.g. "Expected in March". */
  note?: string
}

/** Update as the notification and schedule are published. */
export const EXAM_DATES: ExamDate[] = [
  { label: 'Notification', date: null },
  { label: 'Online applications', date: null },
  { label: 'Hall tickets', date: null },
  { label: 'Exam', date: null },
  { label: 'Answer key', date: null },
  { label: 'Results', date: null },
]

/** When EXAM_DATES was last checked, shown so candidates know how fresh it is. */
export const EXAM_DATES_UPDATED = '2026-10-14'
