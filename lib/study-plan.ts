// ============================================================
// lib/study-plan.ts — 90-day AP DSC SGT study plan, per medium
// ============================================================
// Built unit by unit on the official "DSC-2026 SGT Syllabus" (SCERT, see
// lib/exam-roadmap.ts), with study days given by the exam's marks:
//
//   Part                         Marks   Phase 1 study days
//   Content, 5 school subjects     40     27  (Science 7, Social 7, Maths 6,
//                                               Telugu 4, English 3: the bigger
//                                               syllabi get more of the days)
//   Methodology, 5 subjects        20     14
//   Educational Psychology          8      6
//   GK & Current Affairs            8      4, plus a current-affairs topic in
//                                            every weekly test and daily reading
//   Perspectives in Education       4      3
//
//   Phase 1  Days 1–63   learn every unit once: 9 weeks of six study days and
//                        a weekly test. Subjects are interleaved; content
//                        first, methodology from week 6.
//   Phase 2  Days 64–77  a revision day and section test for every part, the
//                        methodology core, and two full mocks.
//   Phase 3  Days 78–90  five more full mocks, each followed by a review day,
//                        short revision, and rest before the exam.
//
// One schedule, two mediums. Everything is in English except what is studied:
// in the Telugu-medium plan, each study day's topic heading and its topics are
// in Telugu. The Telugu paper's topics are Telugu and the English paper's
// English in both plans, because both mediums write both language papers.
// ============================================================

export type PlanMedium = 'english' | 'telugu'

export type PlanSubject =
  | 'psychology' | 'perspectives' | 'mathematics' | 'telugu' | 'science'
  | 'english' | 'social' | 'gk' | 'test' | 'mock' | 'revision' | 'rest'

export type PlanAction = 'practice' | 'mock' | 'performance' | 'none'

/** What a day asks of the candidate; it picks the day's AI study prompt (lib/study-prompt.ts). */
export type DayKind = 'study' | 'methodology' | 'section' | 'weekly' | 'mock' | 'review' | 'weak' | 'mistakes' | 'rest'

/** The exam part a Phase 1 study day counts towards. */
export type PlanPart = 'content' | 'methodology' | 'psychology' | 'gk' | 'perspectives'

export interface StudyDay {
  day: number
  week: number
  phase: 1 | 2 | 3
  subject: PlanSubject
  title: string
  topics: string[]
  task: string
  action: PlanAction
  kind: DayKind
  /** Set on Phase 1 study days. */
  part?: PlanPart
}

export const SUBJECT_LABEL: Record<PlanSubject, string> = {
  psychology: 'Educational Psychology', perspectives: 'Perspectives in Education', mathematics: 'Mathematics',
  telugu: 'Telugu', science: 'Science', english: 'English', social: 'Social Studies', gk: 'GK & Current Affairs',
  test: 'Weekly test', mock: 'Full mock', revision: 'Revision', rest: 'Rest',
}

export const PLAN_PHASES = [
  { phase: 1 as const, days: 'Days 1–63', title: 'Learn' },
  { phase: 2 as const, days: 'Days 64–77', title: 'Revise' },
  { phase: 3 as const, days: 'Days 78–90', title: 'Mocks' },
]

export const DAILY_HABITS = ['Current affairs, 20 min', 'Revise yesterday, 15 min', 'Note every mistake']

const TASK = {
  practice: 'Study the topics, then practise them.',
  method: 'Study the methodology, then practise it.',
  section: 'Revise, then a 24-question section test.',
  weekly: '50-question test on this week, then the GK topic.',
  mock: '160 questions, 150 minutes, one sitting.',
  review: 'Re-study and practise the mock’s wrong answers.',
  weak: 'Practise your 3 weakest topics.',
}

/** The everyday study tasks: not shown, since the day's Practice button says it. */
export const ROUTINE_TASKS: ReadonlySet<string> = new Set([TASK.practice, TASK.method])

/** Study content in both mediums. */
type L<T = string> = { en: T; te: T }
const same = <T,>(v: T): L<T> => ({ en: v, te: v })

type Entry = { subject: PlanSubject; title: L; topics: L<string[]>; methodology?: boolean }

// ---- Phase 1 units, in syllabus order -------------------------------------

const PSY: Entry[] = [
  {
    subject: 'psychology',
    title: { en: 'Development of the child I', te: 'శిశు వికాసం I' },
    topics: {
      en: ['Development, growth and maturation: concept and nature', 'Principles of development and their educational implications', 'Factors: biological, psychological, sociological, emotional'],
      te: ['వికాసం, వృద్ధి, పరిపక్వత: భావన, స్వభావం', 'వికాస సూత్రాలు, వాటి విద్యాపరమైన అనువర్తనాలు', 'వికాసాన్ని ప్రభావితం చేసే కారకాలు: జీవ, మానసిక, సామాజిక, ఉద్వేగ'],
    },
  },
  {
    subject: 'psychology',
    title: { en: 'Development of the child II', te: 'శిశు వికాసం II' },
    topics: {
      en: ['Dimensions: physical and motor, cognitive, emotional, social, moral, language', 'Infancy, early childhood, late childhood, adolescence', 'Piaget, Kohlberg, Chomsky, Carl Rogers, Erikson'],
      te: ['వికాస రంగాలు: శారీరక–చలన, జ్ఞానాత్మక, ఉద్వేగ, సాంఘిక, నైతిక, భాషా వికాసం', 'శైశవం, పూర్వ బాల్యం, ఉత్తర బాల్యం, కౌమారం', 'పియాజే, కోల్‌బర్గ్, చోమ్‌స్కీ, కార్ల్ రోజర్స్, ఎరిక్సన్'],
    },
  },
  {
    subject: 'psychology',
    title: { en: 'Individual differences', te: 'వైయక్తిక భేదాలు' },
    topics: {
      en: ['Inter- and intra-individual differences', 'Intelligence: theories, multiple intelligence, IQ and its assessment', 'EQ, creativity; attitude, aptitude, interest, habit in the classroom'],
      te: ['అంతర, అంతః వైయక్తిక భేదాలు', 'ప్రజ్ఞ: సిద్ధాంతాలు, బహుళ ప్రజ్ఞలు, ప్రజ్ఞాలబ్ధి (IQ), ప్రజ్ఞా మాపనం', 'ఉద్వేగ ప్రజ్ఞ, సృజనాత్మకత; వైఖరి, సహజ సామర్థ్యం, అభిరుచి, అలవాటు — తరగతి గదిలో'],
    },
  },
  {
    subject: 'psychology',
    title: { en: 'Learning I', te: 'అభ్యసనం I' },
    topics: {
      en: ['Theories and approaches of learning', 'Learning curves; factors, phases, dimensions and types of learning', 'Transfer of learning'],
      te: ['అభ్యసన సిద్ధాంతాలు, ఉపగమాలు', 'అభ్యసన వక్రాలు; అభ్యసన కారకాలు, దశలు, పరిమాణాలు, రకాలు', 'అభ్యసన బదలాయింపు'],
    },
  },
  {
    subject: 'psychology',
    title: { en: 'Learning II', te: 'అభ్యసనం II' },
    topics: {
      en: ['Memory and forgetting', 'Learning and assessment in the classroom', 'Children with special needs, inclusive education'],
      te: ['స్మృతి, విస్మృతి', 'అభ్యసనం, మూల్యాంకనం — తరగతి గదిలో', 'ప్రత్యేక అవసరాలు గల పిల్లలు, సమ్మిళిత విద్య'],
    },
  },
  {
    subject: 'psychology',
    title: { en: 'Personality', te: 'మూర్తిమత్వం' },
    topics: {
      en: ['Nature, characteristics, factors and theories of personality', 'Assessment of personality', 'Mental health, adjustment, stress; emotional intelligence, managing emotions'],
      te: ['మూర్తిమత్వ స్వభావం, లక్షణాలు, కారకాలు, సిద్ధాంతాలు', 'మూర్తిమత్వ మాపనం', 'మానసిక ఆరోగ్యం, సర్దుబాటు, ఒత్తిడి; ఉద్వేగ ప్రజ్ఞ, ఉద్వేగాల నిర్వహణ'],
    },
  },
]

const PERSP: Entry[] = [
  {
    subject: 'perspectives',
    title: { en: 'History of Education', te: 'విద్యా చరిత్ర' },
    topics: {
      en: ['Ancient India: pre-Vedic and post-Vedic; medieval education', 'Before Independence: Wood’s Despatch 1854, Hunter 1882, Hartog 1929, Sargent 1944', 'After Independence: Mudaliar 1952–53, Kothari 1964–66, Ishwarbhai Patel 1977, NPE 1986, POA 1992'],
      te: ['ప్రాచీన భారతదేశం: వేద పూర్వ, వేదానంతర విద్య; మధ్యయుగ విద్య', 'స్వాతంత్ర్యానికి ముందు: వుడ్స్ డిస్పాచ్ 1854, హంటర్ కమిషన్ 1882, హార్టాగ్ కమిటీ 1929, సార్జంట్ కమిటీ 1944', 'స్వాతంత్ర్యానంతరం: ముదలియార్ కమిషన్ 1952–53, కొఠారి కమిషన్ 1964–66, ఈశ్వరభాయ్ పటేల్ కమిటీ 1977, జాతీయ విద్యా విధానం 1986, POA 1992'],
    },
  },
  {
    subject: 'perspectives',
    title: { en: 'Teachers and educational concerns', te: 'ఉపాధ్యాయ సాధికారత, సమకాలీన విద్యా అంశాలు' },
    topics: {
      en: ['Teacher empowerment: code of conduct, motivation, professional development, teacher organisations, school records', 'Democracy, equality, equity, quality; economics of education, human capital, Saakshar Bharat', 'Population, gender, urbanisation, life skills; adolescence, value, health and inclusive education; LPG'],
      te: ['ఉపాధ్యాయ సాధికారత: వృత్తి నియమావళి, ప్రేరణ, వృత్తిపర అభివృద్ధి, ఉపాధ్యాయ సంఘాలు, పాఠశాల రికార్డులు', 'ప్రజాస్వామ్యం, సమానత్వం, సమన్యాయం, నాణ్యత; విద్యా అర్థశాస్త్రం, మానవ మూలధనం, సాక్షర భారత్', 'జనాభా విద్య, లింగ సమానత్వం, పట్టణీకరణ, జీవన నైపుణ్యాలు; కౌమార, విలువల, ఆరోగ్య, సమ్మిళిత విద్య; సరళీకరణ, ప్రైవేటీకరణ, ప్రపంచీకరణ'],
    },
  },
  {
    subject: 'perspectives',
    title: { en: 'Programmes, acts and policies', te: 'విద్యా కార్యక్రమాలు, చట్టాలు, విధానాలు' },
    topics: {
      en: ['APPEP, DPEP, SSA, NPEGEL, RMSA, RAA, KGBVs, Model Schools; mid-day meals, scholarships, incentives', 'RTE Act 2009, RTI Act 2005, child rights, human rights', 'NCF 2005, NEP 2020, current trends in education'],
      te: ['APPEP, DPEP, సర్వశిక్షా అభియాన్, NPEGEL, RMSA, RAA, KGBVలు, మోడల్ స్కూళ్లు; మధ్యాహ్న భోజనం, ఉపకార వేతనాలు, ప్రోత్సాహకాలు', 'విద్యా హక్కు చట్టం 2009, సమాచార హక్కు చట్టం 2005, బాలల హక్కులు, మానవ హక్కులు', 'జాతీయ పాఠ్యప్రణాళికా చట్రం 2005, జాతీయ విద్యా విధానం 2020, విద్యలో నూతన ధోరణులు'],
    },
  },
]

const GK: Entry[] = [
  {
    subject: 'gk',
    title: { en: 'Andhra Pradesh GK', te: 'ఆంధ్రప్రదేశ్ సాధారణ జ్ఞానం' },
    topics: {
      en: ['Districts, rivers, projects, geography', 'History, culture, festivals, personalities', 'State schemes and recent developments'],
      te: ['జిల్లాలు, నదులు, ప్రాజెక్టులు, భౌగోళిక అంశాలు', 'చరిత్ర, సంస్కృతి, పండుగలు, ప్రముఖులు', 'రాష్ట్ర పథకాలు, తాజా పరిణామాలు'],
    },
  },
  {
    subject: 'gk',
    title: { en: 'Indian polity and economy', te: 'భారత రాజకీయ, ఆర్థిక వ్యవస్థ' },
    topics: {
      en: ['Constitution, President, Parliament, key bodies', 'Budget, banking, central schemes', 'Important committees and appointments'],
      te: ['రాజ్యాంగం, రాష్ట్రపతి, పార్లమెంట్, ముఖ్య సంస్థలు', 'బడ్జెట్, బ్యాంకింగ్, కేంద్ర పథకాలు', 'ముఖ్య కమిటీలు, నియామకాలు'],
    },
  },
  {
    subject: 'gk',
    title: { en: 'India and the world', te: 'భారతదేశం, ప్రపంచం' },
    topics: {
      en: ['Indian and world geography', 'Indian history and the freedom movement: key facts', 'International organisations and summits'],
      te: ['భారత, ప్రపంచ భౌగోళికం', 'భారత చరిత్ర, స్వాతంత్ర్యోద్యమం: ముఖ్య విషయాలు', 'అంతర్జాతీయ సంస్థలు, సదస్సులు'],
    },
  },
  {
    subject: 'gk',
    title: { en: 'Science, sports and awards', te: 'విజ్ఞానం, క్రీడలు, అవార్డులు' },
    topics: {
      en: ['Science and technology: space, defence, health', 'Sports, awards and honours', 'Books and authors, important days'],
      te: ['విజ్ఞానం, సాంకేతికత: అంతరిక్షం, రక్షణ, ఆరోగ్యం', 'క్రీడలు, అవార్డులు, పురస్కారాలు', 'పుస్తకాలు–రచయితలు, ముఖ్య దినోత్సవాలు'],
    },
  },
]

/** The current-affairs topic studied after each weekly test. */
const WEEKLY_CURRENT_AFFAIRS: L[] = [
  { en: 'Current affairs: Andhra Pradesh', te: 'వర్తమానాంశాలు: ఆంధ్రప్రదేశ్' },
  { en: 'Current affairs: national', te: 'వర్తమానాంశాలు: జాతీయం' },
  { en: 'Current affairs: international', te: 'వర్తమానాంశాలు: అంతర్జాతీయం' },
  { en: 'Current affairs: economy and schemes', te: 'వర్తమానాంశాలు: ఆర్థికం, పథకాలు' },
  { en: 'Current affairs: science and technology', te: 'వర్తమానాంశాలు: విజ్ఞానం, సాంకేతికత' },
  { en: 'Current affairs: sports', te: 'వర్తమానాంశాలు: క్రీడలు' },
  { en: 'Current affairs: awards and appointments', te: 'వర్తమానాంశాలు: అవార్డులు, నియామకాలు' },
  { en: 'Current affairs: important days and reports', te: 'వర్తమానాంశాలు: ముఖ్య దినోత్సవాలు, నివేదికలు' },
  { en: 'Current affairs: the year in review', te: 'వర్తమానాంశాలు: సంవత్సర పునశ్చరణ' },
]

const MATHS: Entry[] = [
  {
    subject: 'mathematics',
    title: { en: 'Numbers I', te: 'సంఖ్యలు I' },
    topics: {
      en: ['Four operations; Indian and international numeration; place and face value', 'Comparing and ordering; whole numbers; even, odd, prime and composite numbers', 'Factors and multiples, divisibility tests, prime factorisation, HCF and LCM'],
      te: ['చతుర్విధ ప్రక్రియలు; భారతీయ, అంతర్జాతీయ సంఖ్యామానం; స్థాన విలువ, ముఖ విలువ', 'సంఖ్యల పోలిక, క్రమం; పూర్ణ సంఖ్యలు; సరి, బేసి, ప్రధాన, సంయుక్త సంఖ్యలు', 'కారణాంకాలు, గుణిజాలు, భాజనీయతా సూత్రాలు, ప్రధాన కారణాంక విభజన, గ.సా.భా, క.సా.గు'],
    },
  },
  {
    subject: 'mathematics',
    title: { en: 'Numbers II', te: 'సంఖ్యలు II' },
    topics: {
      en: ['Integers: properties and operations', 'Fractions and decimals; rational numbers and their properties', 'Squares, square roots, cubes, cube roots; playing with numbers'],
      te: ['పూర్ణాంకాలు: ధర్మాలు, ప్రక్రియలు', 'భిన్నాలు, దశాంశాలు; అకరణీయ సంఖ్యలు, వాటి ధర్మాలు', 'వర్గాలు, వర్గమూలాలు, ఘనాలు, ఘనమూలాలు; సంఖ్యలతో ఆటలు'],
    },
  },
  {
    subject: 'mathematics',
    title: { en: 'Arithmetic', te: 'అంకగణితం' },
    topics: {
      en: ['BODMAS; ratio and proportion, direct and inverse', 'Percentages and their applications; profit and loss, discount', 'Sales tax, VAT, GST; simple and compound interest'],
      te: ['BODMAS; నిష్పత్తి, అనుపాతం — అనులోమ, విలోమ', 'శాతాలు, అనువర్తనాలు; లాభ నష్టాలు, రాయితీ', 'అమ్మకపు పన్ను, VAT, GST; బారువడ్డీ, చక్రవడ్డీ'],
    },
  },
  {
    subject: 'mathematics',
    title: { en: 'Geometry', te: 'జ్యామితి' },
    topics: {
      en: ['Point, line, ray, curves; angles: types and measuring', 'Triangles: types and properties; polygons, angle sum property', 'Quadrilaterals and their construction; 3D shapes, Euler’s rule, nets'],
      te: ['బిందువు, రేఖ, కిరణం, వక్రాలు; కోణాలు: రకాలు, కొలవడం', 'త్రిభుజాలు: రకాలు, ధర్మాలు; బహుభుజులు, కోణాల మొత్తం ధర్మం', 'చతుర్భుజాలు, వాటి నిర్మాణం; త్రిమితీయ ఆకారాలు, ఆయిలర్ సూత్రం, వలలు'],
    },
  },
  {
    subject: 'mathematics',
    title: { en: 'Algebra', te: 'బీజగణితం' },
    topics: {
      en: ['Patterns, variables; algebraic expressions: terms, factors, coefficients', 'Linear equations in one variable and their applications', 'Operations on expressions, standard identities, factorisation, exponents, linear graphs'],
      te: ['అమరికలు, చరరాశులు; బీజీయ సమాసాలు: పదాలు, కారణాంకాలు, గుణకాలు', 'ఏకచరరాశిలో రేఖీయ సమీకరణాలు, అనువర్తనాలు', 'సమాసాలపై ప్రక్రియలు, సర్వసమీకరణాలు, కారణాంక విభజన, ఘాతాంకాలు, రేఖీయ గ్రాఫులు'],
    },
  },
  {
    subject: 'mathematics',
    title: { en: 'Mensuration and data handling', te: 'క్షేత్రమితి, దత్తాంశ నిర్వహణ' },
    topics: {
      en: ['Measuring length, weight, capacity, time, calendar, money; symmetry', 'Perimeter and area of plane figures; surface area and volume of cube, cuboid, cylinder', 'Pictographs, bar graphs, pie charts; mean, median, mode; probability'],
      te: ['పొడవు, బరువు, సామర్థ్యం, కాలం, క్యాలెండర్, డబ్బు కొలతలు; సౌష్ఠవం', 'సమతల పటాల చుట్టుకొలత, వైశాల్యం; ఘనం, దీర్ఘఘనం, స్థూపం ఉపరితల వైశాల్యం, ఘనపరిమాణం', 'చిత్ర, కమ్మీ, వృత్త రేఖాచిత్రాలు; సగటు, మధ్యగతం, బాహుళకం; సంభావ్యత'],
    },
  },
]

const MATHS_METHOD: Entry[] = [
  {
    subject: 'mathematics', methodology: true,
    title: { en: 'Maths methodology I', te: 'గణిత బోధనా పద్ధతులు I' },
    topics: {
      en: ['Nature and definitions of mathematics', 'Aims, values and instructional objectives', 'Methods of teaching; remedial measures'],
      te: ['గణిత స్వభావం, నిర్వచనాలు', 'గణిత బోధనా లక్ష్యాలు, విలువలు, బోధనా ఉద్దేశాలు', 'బోధనా పద్ధతులు; నివారణ బోధన'],
    },
  },
  {
    subject: 'mathematics', methodology: true,
    title: { en: 'Maths methodology II', te: 'గణిత బోధనా పద్ధతులు II' },
    topics: {
      en: ['Instructional material, TLM, resource use', 'Curriculum, textbooks, instructional planning', 'Evaluation and CCE'],
      te: ['బోధనోపకరణాలు, బోధనాభ్యసన సామగ్రి, వనరుల వినియోగం', 'పాఠ్యప్రణాళిక, పాఠ్యపుస్తకాలు, బోధనా ప్రణాళిక', 'మూల్యాంకనం, నిరంతర సమగ్ర మూల్యాంకనం (CCE)'],
    },
  },
]

const SCIENCE: Entry[] = [
  {
    subject: 'science',
    title: { en: 'Living world I', te: 'జీవ ప్రపంచం I' },
    topics: {
      en: ['Living and non-living; plants: types, habitats, parts and functions', 'Animals: oviparous and viviparous, food habits, shelters, movement, sounds', 'Habitats and adaptation; birds and nests; domestic and wild animals'],
      te: ['సజీవులు, నిర్జీవులు; మొక్కలు: రకాలు, ఆవాసాలు, భాగాలు, విధులు', 'జంతువులు: అండజాలు, శిశూత్పాదకాలు, ఆహారపు అలవాట్లు, నివాసాలు, చలనం, శబ్దాలు', 'ఆవాసాలు, అనుకూలనాలు; పక్షులు, గూళ్లు; పెంపుడు, అడవి జంతువులు'],
    },
  },
  {
    subject: 'science',
    title: { en: 'Living world II', te: 'జీవ ప్రపంచం II' },
    topics: {
      en: ['Human body: parts, sense organs, bones, joints, muscles; good and bad touch', 'Safety at home, school and on roads; first aid', 'Food: sources, components, balanced diet, deficiency diseases, preservation; agriculture'],
      te: ['మానవ శరీరం: భాగాలు, జ్ఞానేంద్రియాలు, ఎముకలు, కీళ్లు, కండరాలు; మంచి స్పర్శ, చెడు స్పర్శ', 'ఇల్లు, పాఠశాల, రహదారి భద్రత; ప్రథమ చికిత్స', 'ఆహారం: వనరులు, ఆహార అంశాలు, సమతుల ఆహారం, లోప వ్యాధులు, నిల్వ; వ్యవసాయం'],
    },
  },
  {
    subject: 'science',
    title: { en: 'Living world III, nutrition', te: 'జీవ ప్రపంచం III, పోషణ' },
    topics: {
      en: ['Family: roles, family tree, budget, houses, migration', 'The cell; useful and harmful microorganisms; games and recreation', 'Nutrition in plants and animals; digestion in humans, grass-eaters and amoeba'],
      te: ['కుటుంబం: పాత్రలు, వంశవృక్షం, కుటుంబ బడ్జెట్, ఇళ్లు, వలసలు', 'కణం; ఉపయోగకర, హానికర సూక్ష్మజీవులు; ఆటలు, వినోదం', 'మొక్కలు, జంతువుల్లో పోషణ; మానవులు, నెమరువేసే జంతువులు, అమీబాలో జీర్ణక్రియ'],
    },
  },
  {
    subject: 'science',
    title: { en: 'Life processes', te: 'జీవక్రియలు' },
    topics: {
      en: ['Respiration in plants and animals; circulation; transport in plants', 'Excretion; the nervous system and coordination', 'Reproduction in plants and animals; adolescence, hormones, reproductive health'],
      te: ['మొక్కలు, జంతువుల్లో శ్వాసక్రియ; రక్తప్రసరణ; మొక్కల్లో రవాణా', 'విసర్జన; నాడీ వ్యవస్థ, సమన్వయం', 'మొక్కలు, జంతువుల్లో ప్రత్యుత్పత్తి; కౌమారం, హార్మోన్లు, ప్రత్యుత్పత్తి ఆరోగ్యం'],
    },
  },
  {
    subject: 'science',
    title: { en: 'Materials, motion, force, heat', te: 'పదార్థాలు, చలనం, బలం, ఉష్ణం' },
    topics: {
      en: ['Materials; metals and non-metals; separation; acids, bases and salts', 'Physical and chemical changes, rusting, crystallisation', 'Measurement, motion and speed; force, pressure, friction; heat and temperature'],
      te: ['పదార్థాలు; లోహాలు, అలోహాలు; వేరుచేసే పద్ధతులు; ఆమ్లాలు, క్షారాలు, లవణాలు', 'భౌతిక, రసాయన మార్పులు, తుప్పు పట్టడం, స్ఫటికీకరణం', 'కొలతలు, చలనం, వడి; బలం, పీడనం, ఘర్షణ; ఉష్ణం, ఉష్ణోగ్రత'],
    },
  },
  {
    subject: 'science',
    title: { en: 'Light, electricity, magnetism, sound', te: 'కాంతి, విద్యుత్, అయస్కాంతత్వం, ధ్వని' },
    topics: {
      en: ['Light: shadows, mirrors, lenses, dispersion, the human eye, Braille', 'Electricity: circuits; heating, magnetic and chemical effects; magnets', 'Sound: production, propagation, waves, pitch and loudness, noise pollution'],
      te: ['కాంతి: నీడలు, దర్పణాలు, కటకాలు, విక్షేపణం, మానవ నేత్రం, బ్రెయిలీ లిపి', 'విద్యుత్: వలయాలు; ఉష్ణ, అయస్కాంత, రసాయన ఫలితాలు; అయస్కాంతాలు', 'ధ్వని: ఉత్పత్తి, ప్రసారం, తరంగాలు, కీచుదనం, తీవ్రత, ధ్వని కాలుష్యం'],
    },
  },
  {
    subject: 'science',
    title: { en: 'Fuels, nature, environment', te: 'ఇంధనాలు, ప్రకృతి, పర్యావరణం' },
    topics: {
      en: ['Coal, petroleum, combustion, flame; fibres and plastics', 'Lightning, earthquakes, tsunami; moon, stars, solar system, satellites', 'Transport, communication, professions, services; climate, air, water, biodiversity'],
      te: ['బొగ్గు, పెట్రోలియం, దహనం, జ్వాల; దారాలు, ప్లాస్టిక్‌లు', 'మెరుపులు, భూకంపాలు, సునామీ; చంద్రుడు, నక్షత్రాలు, సౌర కుటుంబం, కృత్రిమ ఉపగ్రహాలు', 'రవాణా, సమాచారం, వృత్తులు, సేవలు; వాతావరణం, గాలి, నీరు, జీవవైవిధ్యం'],
    },
  },
]

/** Science and Social methodology share the syllabus's ten-unit outline. */
function tenUnitMethod(subject: 'science' | 'social', en: string, te: string): Entry[] {
  return [
    {
      subject, methodology: true,
      title: { en: `${en} methodology I`, te: `${te} బోధనా పద్ధతులు I` },
      topics: {
        en: [`Nature, scope, history and development of ${en.toLowerCase()}`, 'Aims, values, objectives, academic standards', 'Methods, approaches and techniques'],
        te: [`${te} స్వభావం, పరిధి, చరిత్ర, అభివృద్ధి`, 'బోధనా లక్ష్యాలు, విలువలు, ఉద్దేశాలు, విద్యా ప్రమాణాలు', 'బోధనా పద్ధతులు, ఉపగమాలు, మెళకువలు'],
      },
    },
    {
      subject, methodology: true,
      title: { en: `${en} methodology II`, te: `${te} బోధనా పద్ధతులు II` },
      topics: {
        en: ['Teaching-learning material, improvised aids', `${en} curriculum and textbook`, 'Assessment and evaluation'],
        te: ['బోధనాభ్యసన సామగ్రి, స్వయం తయారీ బోధనోపకరణాలు', `${te} పాఠ్యప్రణాళిక, పాఠ్యపుస్తకం`, 'మదింపు, మూల్యాంకనం'],
      },
    },
    {
      subject, methodology: true,
      title: { en: `${en} methodology III`, te: `${te} బోధనా పద్ధతులు III` },
      topics: {
        en: [`${en} laboratories`, 'Year plan and lesson plan', 'Role of the teacher; fairs, clubs, field trips, museums'],
        te: [`${te} ప్రయోగశాలలు`, 'వార్షిక ప్రణాళిక, పాఠ్య ప్రణాళిక', 'ఉపాధ్యాయుని పాత్ర; ప్రదర్శనలు, క్లబ్బులు, క్షేత్ర పర్యటనలు, మ్యూజియంలు'],
      },
    },
  ]
}
const SCIENCE_METHOD = tenUnitMethod('science', 'Science', 'విజ్ఞాన శాస్త్ర')
const SOCIAL_METHOD = tenUnitMethod('social', 'Social studies', 'సాంఘిక శాస్త్ర')

const SOCIAL: Entry[] = [
  {
    subject: 'social',
    title: { en: 'Our universe and maps', te: 'విశ్వం, పటాలు' },
    topics: {
      en: ['Shape of the Earth, the universe, the solar system, constellations', 'Latitudes and longitudes, movements of the Earth, the globe, eclipses', 'Maps: directions, scale, symbols, types; village to country maps'],
      te: ['భూమి ఆకారం, విశ్వం, సౌర కుటుంబం, నక్షత్ర రాశులు', 'అక్షాంశాలు, రేఖాంశాలు, భూ చలనాలు, గ్లోబు, గ్రహణాలు', 'పటాలు: దిక్కులు, స్కేలు, చిహ్నాలు, రకాలు; గ్రామం నుండి దేశ పటాల వరకు'],
    },
  },
  {
    subject: 'social',
    title: { en: 'The Earth and its resources', te: 'భూమి, వనరులు' },
    topics: {
      en: ['Interior, atmosphere, biosphere, pollution, disasters', 'Landforms of AP, podu cultivation; forests and climatic regions', 'Land, soil, water, natural vegetation and wildlife'],
      te: ['భూ అంతర్భాగం, వాతావరణం, జీవావరణం, కాలుష్యం, విపత్తులు', 'ఆంధ్రప్రదేశ్ భూస్వరూపాలు, పోడు వ్యవసాయం; అడవులు, శీతోష్ణస్థితి మండలాలు', 'భూమి, నేలలు, నీరు, సహజ వృక్షసంపద, వన్యప్రాణులు'],
    },
  },
  {
    subject: 'social',
    title: { en: 'Production, exchange, livelihoods', te: 'ఉత్పత్తి, వినిమయం, జీవనోపాధులు' },
    topics: {
      en: ['Migration, professions; mineral and power resources; population', 'Agriculture and industries; weavers, iron smelters, Wootz steel', 'Markets, consumer protection; transport, exports and imports, road safety'],
      te: ['వలసలు, వృత్తులు; ఖనిజ, శక్తి వనరులు; జనాభా', 'వ్యవసాయం, పరిశ్రమలు; నేత కార్మికులు, ఇనుము కరిగించేవారు, ఊట్జ్ ఉక్కు', 'మార్కెట్లు, వినియోగదారుల రక్షణ; రవాణా, ఎగుమతులు, దిగుమతులు, రహదారి భద్రత'],
    },
  },
  {
    subject: 'social',
    title: { en: 'Early and medieval history', te: 'ప్రాచీన, మధ్యయుగ చరిత్ర' },
    topics: {
      en: ['Early people, Belum caves, rock paintings, settled life', 'Mahajanapadas, Magadha; Mauryas, Guptas, Satavahanas, Pallavas, Chalukyas', 'Delhi Sultanate, Kakatiyas, Vijayanagara, Mughals'],
      te: ['ఆదిమానవులు, బెలూం గుహలు, శిలా చిత్రాలు, స్థిర జీవనం', 'మహాజనపదాలు, మగధ; మౌర్యులు, గుప్తులు, శాతవాహనులు, పల్లవులు, చాళుక్యులు', 'ఢిల్లీ సుల్తానులు, కాకతీయులు, విజయనగర సామ్రాజ్యం, మొఘలులు'],
    },
  },
  {
    subject: 'social',
    title: { en: 'Government and the Constitution', te: 'ప్రభుత్వం, రాజ్యాంగం' },
    topics: {
      en: ['Types and levels of government, local self-government', 'Parliament, state government, judiciary, criminal justice, law and social justice', 'The Constitution, fundamental rights and duties, secularism'],
      te: ['ప్రభుత్వ రకాలు, స్థాయిలు, స్థానిక స్వపరిపాలన', 'పార్లమెంటు, రాష్ట్ర ప్రభుత్వం, న్యాయవ్యవస్థ, నేర న్యాయ వ్యవస్థ, చట్టం–సామాజిక న్యాయం', 'భారత రాజ్యాంగం, ప్రాథమిక హక్కులు, విధులు, లౌకికవాదం'],
    },
  },
  {
    subject: 'social',
    title: { en: 'Colonial rule, freedom struggle', te: 'వలస పాలన, స్వాతంత్ర్యోద్యమం' },
    topics: {
      en: ['East India Company, Plassey, Tipu Sultan, Doctrine of Lapse; Diwani and Munro systems', 'Indigo, tribal life, forest laws, Birsa Munda; British education', '1857, the national movement 1870s–1947, India after Independence'],
      te: ['ఈస్ట్ ఇండియా కంపెనీ, ప్లాసీ యుద్ధం, టిప్పు సుల్తాన్, రాజ్యసంక్రమణ సిద్ధాంతం; దివానీ, మన్రో పద్ధతులు', 'నీలిమందు, గిరిజన జీవనం, అటవీ చట్టాలు, బిర్సా ముండా; బ్రిటిష్ విద్యా విధానం', '1857 తిరుగుబాటు, జాతీయోద్యమం 1870–1947, స్వాతంత్ర్యానంతర భారతదేశం'],
    },
  },
  {
    subject: 'social',
    title: { en: 'Society, religion, culture', te: 'సమాజం, మతం, సంస్కృతి' },
    topics: {
      en: ['Inequality and equality; women’s movements, caste and social reform; marginalisation', 'Religions; Bhakti and Sufi movements', 'Communication and media; historical places of AP; Indus Valley, Vedic period, Indian culture'],
      te: ['అసమానతలు, సమానత్వం; మహిళా ఉద్యమాలు, కుల, సాంఘిక సంస్కరణలు; అణచివేతకు గురైన వర్గాలు', 'మతాలు; భక్తి, సూఫీ ఉద్యమాలు', 'సమాచారం, ప్రసార మాధ్యమాలు; ఆంధ్రప్రదేశ్ చారిత్రక ప్రదేశాలు; సింధు నాగరికత, వేద కాలం, భారతీయ సంస్కృతి'],
    },
  },
]

// The Telugu paper, in Telugu for both mediums: the syllabus's three content
// units (textbook lessons, vocabulary, grammar) and ten methodology units.
const TELUGU: Entry[] = [
  { subject: 'telugu', title: { en: 'Telugu: textbook lessons', te: 'తెలుగు వాచకాలు: పాఠ్యభాగ విషయాలు' }, topics: same(['కవి పరిచయాలు', 'పాత్రలు, ఇతివృత్తాలు', 'సందర్భాలు, నేపథ్యాలు', 'విద్యా ప్రమాణాలు']) },
  { subject: 'telugu', title: { en: 'Telugu: vocabulary', te: 'పదజాలం' }, topics: same(['అర్థాలు, పర్యాయపదాలు, నానార్థాలు', 'వ్యుత్పత్త్యర్థాలు', 'జాతీయాలు, సామెతలు — వివరణ, గుర్తించడం', 'పొడుపు కథలు']) },
  {
    subject: 'telugu',
    title: { en: 'Telugu grammar I', te: 'భాషాంశాలు I' },
    topics: same([
      'విభక్తి ప్రత్యయాలు, ఔపవిభక్తికాలు',
      'పారిభాషిక పదాలు: ద్రుత ప్రకృతికాలు, కళలు, ఆమ్రేడితం, ఆగమం, ఆదేశం, లింగాలు, వచనాలు, కాలాలు',
      'తెలుగు సంధులు: అత్వ, ఇత్వ, ఉత్వ, యడాగమ, సరళాదేశ, ఆమ్రేడిత, ద్విరుక్తటకార, గసడదవాదేశ',
      'సంస్కృత సంధులు: సవర్ణదీర్ఘ, గుణ, యణాదేశ, వృద్ధి',
    ]),
  },
  {
    subject: 'telugu',
    title: { en: 'Telugu grammar II', te: 'భాషాంశాలు II' },
    topics: same([
      'సమాసాలు: ద్వంద్వ, ద్విగు, తత్పురుష',
      'ఛందస్సు: గణ విభజన, గణాల గుర్తింపు',
      'అలంకారాలు: వృత్త్యనుప్రాస, ఛేకానుప్రాస, అంత్యానుప్రాస; ఉపమ, ఉత్ప్రేక్ష, అతిశయోక్తి',
      'వాక్యాలు: శత్రర్థక, విధ్యర్థక, నిషేధార్థక, అనుమత్యర్థక, సామర్థ్యార్థక, సందేహార్థక, ఆశీరర్థక, ప్రార్థనార్థక, ప్రశ్నార్థక, హేత్వర్థక; కర్తరి, కర్మణి',
    ]),
  },
]

const TELUGU_METHOD: Entry[] = [
  { subject: 'telugu', methodology: true, title: { en: 'Telugu methodology I', te: 'తెలుగు బోధనా పద్ధతులు I' }, topics: same(['ప్రాథమిక స్థాయిలో భాషాభివృద్ధి, అవగాహన', 'తెలుగు భాషా బోధన: ఉద్దేశాలు, విలువలు, లక్ష్యాలు, స్పష్టీకరణలు', 'భాష – సమాజం – సాహిత్య ప్రక్రియలు']) },
  { subject: 'telugu', methodology: true, title: { en: 'Telugu methodology II', te: 'తెలుగు బోధనా పద్ధతులు II' }, topics: same(['మాతృభాష స్వభావం, స్థానం, ప్రాధాన్యత', 'భాషోత్పత్తి వాదాలు, ధ్వని, అర్థ విపరిణామాలు', 'పాఠ్యపుస్తకాలు – బోధనా శాస్త్రంపై అవగాహన', 'భాషా సామర్థ్యాలు, విద్యా ప్రమాణాలు']) },
  { subject: 'telugu', methodology: true, title: { en: 'Telugu methodology III', te: 'తెలుగు బోధనా పద్ధతులు III' }, topics: same(['బోధనా పద్ధతులు, బోధనాభ్యసన ప్రక్రియల నిర్వహణ', 'ప్రణాళికా రచన, బోధనాభ్యసన సామగ్రి', 'ఆంధ్రప్రదేశ్‌లో భాషాభివృద్ధి కార్యక్రమాలు', 'భాష – మూల్యాంకనం']) },
]

// The English paper, in English for both mediums: the syllabus's seven
// content units and nine methodology units.
const ENGLISH: Entry[] = [
  { subject: 'english', title: same('Parts of speech, articles, prepositions'), topics: same(['Parts of speech', 'Articles', 'Prepositions']) },
  { subject: 'english', title: same('Tenses and types of sentences'), topics: same(['Tenses: forms and usage', 'Types of sentences']) },
  { subject: 'english', title: same('Pronunciation, writing, literature'), topics: same(['Pronunciation, sounds, use of the dictionary', 'Writing of discourse: story, essay, letter, editorial, précis, note-making, autobiography, biography', 'Poets, essayists, novelists, dramatists and their works']) },
]

const ENGLISH_METHOD: Entry[] = [
  { subject: 'english', methodology: true, title: same('English methodology I'), topics: same(['Aspects of English: history, nature, importance; principles of English as a second language', 'Problems of teaching and learning English', 'Objectives of teaching English']) },
  { subject: 'english', methodology: true, title: same('English methodology II'), topics: same(['Language skills: listening, speaking, reading, writing; communicative skills', 'Approaches, methods and techniques; remedial teaching', 'Teaching structures and vocabulary']) },
  { subject: 'english', methodology: true, title: same('English methodology III'), topics: same(['Teaching-learning materials', 'Lesson planning', 'Curriculum and textbooks', 'Evaluation in English']) },
]

/**
 * Phase 1, week by week: six study days, then the weekly test. Subjects are
 * interleaved so each comes back within the week; content first, then
 * methodology from week 6 once that subject's content is done.
 */
const WEEKS: Entry[][] = [
  [PSY[0], MATHS[0], TELUGU[0], SCIENCE[0], ENGLISH[0], SOCIAL[0]],
  [PSY[1], MATHS[1], TELUGU[1], SCIENCE[1], ENGLISH[1], SOCIAL[1]],
  [PERSP[0], MATHS[2], TELUGU[2], SCIENCE[2], ENGLISH[2], SOCIAL[2]],
  [PSY[2], MATHS[3], TELUGU[3], SCIENCE[3], GK[0], SOCIAL[3]],
  [PSY[3], MATHS[4], SCIENCE[4], SOCIAL[4], PERSP[1], GK[1]],
  [PSY[4], MATHS[5], SCIENCE[5], SOCIAL[5], TELUGU_METHOD[0], ENGLISH_METHOD[0]],
  [PSY[5], SCIENCE[6], SOCIAL[6], MATHS_METHOD[0], SCIENCE_METHOD[0], SOCIAL_METHOD[0]],
  [PERSP[2], TELUGU_METHOD[1], ENGLISH_METHOD[1], MATHS_METHOD[1], SCIENCE_METHOD[1], GK[2]],
  [SOCIAL_METHOD[1], TELUGU_METHOD[2], ENGLISH_METHOD[2], SCIENCE_METHOD[2], SOCIAL_METHOD[2], GK[3]],
]

// ---- Phases 2 and 3: English titles; topics are study content per medium,
// while activity bullets ("Mock 3 mistakes") stay English ------------------

type Fixed = { subject: PlanSubject; title: string; topics: L<string[]>; task?: string; action?: PlanAction; kind?: DayKind }
const ALL_PARTS = same(['All parts'])
const mock = (n: number): Fixed => ({ subject: 'mock', title: `Full mock ${n}`, topics: ALL_PARTS, task: TASK.mock, action: 'mock' })
/** A review day: the mock's mistakes, then the study topics. */
const review = (n: number, study: L<string[]>): L<string[]> => ({ en: [`Mock ${n} mistakes`, ...study.en], te: [`Mock ${n} mistakes`, ...study.te] })
const WEAK_TOPICS = same(['Your weakest topics in Performance'])

const PHASE_TWO: Fixed[] = [
  { subject: 'psychology', title: 'Psychology & Perspectives: revise + section test', topics: { en: ['Development, individual differences, learning, personality', 'History of education, programmes, acts, NCF 2005, NEP 2020'], te: ['వికాసం, వైయక్తిక భేదాలు, అభ్యసనం, మూర్తిమత్వం', 'విద్యా చరిత్ర, కార్యక్రమాలు, చట్టాలు, NCF 2005, జాతీయ విద్యా విధానం 2020'] }, task: TASK.section },
  { subject: 'mathematics', title: 'Maths: revise + section test', topics: { en: ['Numbers, arithmetic, geometry, algebra, mensuration, data handling', 'Maths methodology'], te: ['సంఖ్యలు, అంకగణితం, జ్యామితి, బీజగణితం, క్షేత్రమితి, దత్తాంశ నిర్వహణ', 'గణిత బోధనా పద్ధతులు'] }, task: TASK.section },
  { subject: 'telugu', title: 'Telugu: revise + section test', topics: same(['పాఠ్యభాగ విషయాలు, పదజాలం, భాషాంశాలు', 'తెలుగు బోధనా పద్ధతులు']), task: TASK.section },
  { subject: 'science', title: 'Science: revise + section test', topics: { en: ['Living world, life processes, natural phenomena, environment', 'Science methodology'], te: ['జీవ ప్రపంచం, జీవక్రియలు, ప్రకృతి దృగ్విషయాలు, పర్యావరణం', 'విజ్ఞాన శాస్త్ర బోధనా పద్ధతులు'] }, task: TASK.section },
  { subject: 'english', title: 'English: revise + section test', topics: same(['Grammar, writing, literature', 'English methodology']), task: TASK.section },
  { subject: 'social', title: 'Social Studies: revise + section test', topics: { en: ['All six themes', 'Social studies methodology'], te: ['ఆరు థీమ్‌లు', 'సాంఘిక శాస్త్ర బోధనా పద్ధతులు'] }, task: TASK.section },
  mock(1),
  { subject: 'revision', title: 'Review mock 1', topics: review(1, { en: ['The topics behind your wrong answers'], te: ['తప్పిన ప్రశ్నల వెనుక ఉన్న అంశాలు'] }), task: TASK.review },
  { subject: 'revision', title: 'Methodology: the common core', topics: { en: ['Aims, objectives, academic standards', 'Year plans and lesson plans', 'TLM, CCE and evaluation'], te: ['బోధనా లక్ష్యాలు, ఉద్దేశాలు, విద్యా ప్రమాణాలు', 'వార్షిక, పాఠ్య ప్రణాళికలు', 'బోధనాభ్యసన సామగ్రి, CCE, మూల్యాంకనం'] }, task: TASK.method },
  { subject: 'gk', title: 'GK: revise + section test', topics: { en: ['Andhra Pradesh, polity, economy, geography, science', 'Current affairs of the last 12 months'], te: ['ఆంధ్రప్రదేశ్, రాజకీయ వ్యవస్థ, ఆర్థికం, భౌగోళికం, విజ్ఞానం', 'గత 12 నెలల వర్తమానాంశాలు'] }, task: TASK.section },
  { subject: 'revision', title: 'Methodology: subject by subject', topics: { en: ['Telugu, English, Maths, Science, Social studies methodology'], te: ['తెలుగు, English, గణితం, విజ్ఞాన శాస్త్ర, సాంఘిక శాస్త్ర బోధనా పద్ధతులు'] }, task: TASK.method },
  { subject: 'revision', title: 'Weak topics day', topics: WEAK_TOPICS, task: TASK.weak, action: 'performance' },
  mock(2),
  { subject: 'revision', title: 'Review mock 2', topics: review(2, { en: ['The topics behind your wrong answers'], te: ['తప్పిన ప్రశ్నల వెనుక ఉన్న అంశాలు'] }), task: TASK.review },
]

// Every mock is followed by a review day, which also revises one area.
const PHASE_THREE: Fixed[] = [
  { subject: 'revision', title: 'Psychologists and Perspectives facts', topics: { en: ['Theorists and their theories', 'Commissions, acts and years'], te: ['మనోవిజ్ఞాన శాస్త్రవేత్తలు, వారి సిద్ధాంతాలు', 'కమిషన్లు, చట్టాలు, సంవత్సరాలు'] } },
  mock(3),
  { subject: 'revision', title: 'Review mock 3 + language grammar', topics: review(3, { en: ['Telugu grammar: sandhis, samasas, alankaras', 'English grammar: tenses, sentences, articles'], te: ['తెలుగు భాషాంశాలు: సంధులు, సమాసాలు, అలంకారాలు', 'English grammar: tenses, sentences, articles'] }), task: TASK.review },
  mock(4),
  { subject: 'revision', title: 'Review mock 4 + Maths and Science', topics: review(4, { en: ['Maths formulas and shortcuts', 'Science key facts'], te: ['గణిత సూత్రాలు, షార్ట్‌కట్‌లు', 'విజ్ఞాన శాస్త్ర ముఖ్య విషయాలు'] }), task: TASK.review },
  mock(5),
  { subject: 'revision', title: 'Review mock 5 + Social Studies and GK', topics: review(5, { en: ['History and the Constitution', 'Andhra Pradesh facts, current affairs'], te: ['చరిత్ర, రాజ్యాంగం', 'ఆంధ్రప్రదేశ్ ముఖ్య విషయాలు, వర్తమానాంశాలు'] }), task: TASK.review },
  { subject: 'revision', title: 'Your wrong-answer list', topics: same(['Every question you got wrong so far']), task: 'Retry every wrong answer until it is right.', kind: 'mistakes' },
  mock(6),
  { subject: 'revision', title: 'Review mock 6 + methodology', topics: review(6, { en: ['Methodology of all five subjects'], te: ['ఐదు సబ్జెక్టుల బోధనా పద్ధతులు'] }), task: TASK.review },
  { subject: 'mock', title: 'Final mock at exam time', topics: ALL_PARTS, task: 'Take it at the real exam’s time of day.', action: 'mock' },
  { subject: 'revision', title: 'Review the final mock + short notes', topics: review(7, { en: ['One page of notes per subject'], te: ['ప్రతి సబ్జెక్టుకు ఒక పేజీ నోట్స్'] }), task: 'Review the mock, then short notes only.', kind: 'review' },
  { subject: 'rest', title: 'Rest and get ready', topics: same(['Hall ticket, ID proof, exam centre route', 'Sleep early']), task: 'No studying. Check documents and travel.', action: 'none' },
]

function kindOf(subject: PlanSubject, task: string): DayKind {
  if (subject === 'mock') return 'mock'
  if (subject === 'rest') return 'rest'
  if (subject === 'test') return 'weekly'
  if (task === TASK.method) return 'methodology'
  if (task === TASK.section) return 'section'
  if (task === TASK.review) return 'review'
  if (task === TASK.weak) return 'weak'
  return 'study'
}

function partOf(e: Entry): PlanPart {
  if (e.subject === 'psychology' || e.subject === 'perspectives' || e.subject === 'gk') return e.subject
  return e.methodology ? 'methodology' : 'content'
}

function buildPlan(medium: PlanMedium): StudyDay[] {
  const k = medium === 'telugu' ? 'te' : 'en'
  const days: StudyDay[] = []
  const push = (phase: 1 | 2 | 3, subject: PlanSubject, title: string, topics: string[], task: string, action: PlanAction, kind?: DayKind, part?: PlanPart) => {
    const day = days.length + 1
    days.push({ day, week: Math.ceil(day / 7), phase, subject, title, topics, task, action, kind: kind ?? kindOf(subject, task), ...(part && { part }) })
  }
  WEEKS.forEach((week, w) => {
    for (const e of week) push(1, e.subject, e.title[k], e.topics[k], e.methodology ? TASK.method : TASK.practice, 'practice', undefined, partOf(e))
    push(1, 'test', `Weekly test ${w + 1} + GK`, ['This week’s topics', `GK: ${WEEKLY_CURRENT_AFFAIRS[w][k]}`], TASK.weekly, 'practice')
  })
  for (const f of PHASE_TWO) push(2, f.subject, f.title, f.topics[k], f.task ?? TASK.practice, f.action ?? 'practice', f.kind)
  for (const f of PHASE_THREE) push(3, f.subject, f.title, f.topics[k], f.task ?? TASK.practice, f.action ?? 'practice', f.kind)
  return days
}

const PLANS: Record<PlanMedium, StudyDay[]> = { english: buildPlan('english'), telugu: buildPlan('telugu') }

export const getStudyPlan = (medium: PlanMedium): StudyDay[] => PLANS[medium]
