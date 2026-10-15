// ============================================================
// lib/exam-syllabus.ts — The full DSC-2026 SGT syllabus, in both mediums
// ============================================================
// Unit by unit, with every topic, from the official "DSC-2026 SGT – Secondary
// Grade Teacher Syllabus" (Government of AP, School Education, SCERT). Marks
// and part names are in lib/exam-roadmap.ts (EXAM_PARTS); this adds depth.
//
// Each unit and topic has an English and a Telugu version. As on the rest of
// the roadmap, only what is studied is in Telugu in the Telugu-medium view:
// the page around it stays English. The Telugu paper is in Telugu and the
// English paper in English in both mediums, since everyone writes both.
// ============================================================

import { AP_DSC_SGT_OFFICIAL_BLUEPRINT as PATTERN } from './mock-tests/blueprints'
import { EXAM_PARTS } from './exam-roadmap'

export type SyllabusMedium = 'english' | 'telugu'

type L = { en: string; te: string }
type Unit = { title: L; topics: L[] }
const same = (text: string): L => ({ en: text, te: text })
/** A unit: [English title, Telugu title], then [English, Telugu] topics. */
const unit = (en: string, te: string, topics: [string, string][] = []): Unit =>
  ({ title: { en, te }, topics: topics.map(([e, t]) => ({ en: e, te: t })) })
/** A unit of the Telugu or English paper: the same text in both mediums. */
const sameUnit = (title: L, topics: string[] = []): Unit => ({ title, topics: topics.map(same) })

/** What candidates should know about the paper, beyond the marks table. */
export const PATTERN_FACTS: { label: string; value: string }[] = [
  { label: 'Questions', value: `${PATTERN.total_questions} multiple-choice questions, 4 options each` },
  { label: 'Marks', value: `${PATTERN.total_marks} (½ mark per question)` },
  { label: 'Time', value: `${PATTERN.duration_minutes} minutes (2 hours 30 minutes)` },
  { label: 'Negative marking', value: PATTERN.negative_marks ? `−${PATTERN.negative_marks} per wrong answer` : 'None' },
  { label: 'Mode', value: 'Online, computer-based test (as in DSC 2025)' },
  { label: 'School subjects', value: 'Content from Class III–VIII textbooks, difficulty up to Class X; each has content (8 marks) and teaching methodology (4 marks)' },
  { label: 'Language I', value: 'Telugu, or Urdu, Kannada, Oriya or Tamil for those mediums' },
  { label: 'Language II', value: 'English' },
  { label: 'Selection', value: 'Written test 80 marks + APTET score 20% weightage (as in DSC 2025; confirm in the 2026 notification)' },
]

/** Part names in Telugu, shown beside the English name in the Telugu-medium view. */
const TELUGU_NAMES: Record<string, string> = {
  gk: 'సాధారణ జ్ఞానం, వర్తమాన వ్యవహారాలు', perspectives: 'విద్యా దృక్పథాలు', psychology: 'విద్యా మనోవిజ్ఞాన శాస్త్రం',
  telugu: 'తెలుగు (భాష I)', english: 'ఇంగ్లీష్ (భాష II)', mathematics: 'గణితం', science: 'విజ్ఞాన శాస్త్రం', social: 'సాంఘిక శాస్త్రం',
}

const SUBJECT_NOTE ='Content from Class III–VIII textbooks; questions up to Class X difficulty.'

interface SyllabusPart { id: string; note?: string; content: Unit[]; methodology?: Unit[] }

const PARTS: SyllabusPart[] = [
  {
    id: 'gk',
    note: 'The syllabus lists no units for this part. Questions cover general knowledge and current affairs: Andhra Pradesh, India and the world.',
    content: [
      unit('General knowledge', 'సాధారణ జ్ఞానం', [
        ['Andhra Pradesh – geography, history, culture, schemes', 'ఆంధ్రప్రదేశ్ – భౌగోళికం, చరిత్ర, సంస్కృతి, పథకాలు'],
        ['India – polity, economy, geography, history', 'భారతదేశం – రాజకీయ వ్యవస్థ, ఆర్థిక వ్యవస్థ, భౌగోళికం, చరిత్ర'],
        ['General science, technology, sports, awards, books and authors, important days', 'సాధారణ విజ్ఞానం, సాంకేతికత, క్రీడలు, అవార్డులు, పుస్తకాలు–రచయితలు, ముఖ్య దినోత్సవాలు'],
      ]),
      unit('Current affairs', 'వర్తమాన వ్యవహారాలు', [
        ['State, national and international events of the last year', 'గత ఏడాది రాష్ట్ర, జాతీయ, అంతర్జాతీయ సంఘటనలు'],
      ]),
    ],
  },
  {
    id: 'perspectives',
    content: [
      unit('History of Education', 'విద్యా చరిత్ర', [
        ['Education in ancient India – pre-Vedic and post-Vedic period; medieval education', 'ప్రాచీన భారతదేశంలో విద్య – వేద పూర్వ, వేదానంతర కాలం; మధ్యయుగ విద్య'],
        ['Pre-Independence – Wood’s Despatch (1854), Hunter Commission (1882), Hartog Committee (1929), Sargent Committee (1944)', 'స్వాతంత్ర్యానికి ముందు – వుడ్స్ డిస్పాచ్ (1854), హంటర్ కమిషన్ (1882), హార్టాగ్ కమిటీ (1929), సార్జంట్ కమిటీ (1944)'],
        ['Post-Independence – Mudaliar Commission (1952–53), Kothari Commission (1964–66), Ishwarbhai Patel Committee (1977), NPE 1986, POA 1992', 'స్వాతంత్ర్యానంతరం – ముదలియార్ కమిషన్ (1952–53), కొఠారి కమిషన్ (1964–66), ఈశ్వరభాయ్ పటేల్ కమిటీ (1977), జాతీయ విద్యా విధానం 1986, POA 1992'],
      ]),
      unit('Teacher Empowerment', 'ఉపాధ్యాయ సాధికారత', [
        ['Need and interventions for empowerment', 'సాధికారత అవసరం, చర్యలు'],
        ['Professional code of conduct for teachers; teacher motivation', 'ఉపాధ్యాయుల వృత్తి నియమావళి; ఉపాధ్యాయ ప్రేరణ'],
        ['Professional development of teachers; teacher organisations', 'ఉపాధ్యాయుల వృత్తిపర అభివృద్ధి; ఉపాధ్యాయ సంఘాలు'],
        ['National and state level organisations for teacher education', 'ఉపాధ్యాయ విద్యకు జాతీయ, రాష్ట్ర స్థాయి సంస్థలు'],
        ['Maintenance of records and registers in schools', 'పాఠశాలల్లో రికార్డులు, రిజిస్టర్ల నిర్వహణ'],
      ]),
      unit('Educational Concerns in Contemporary India', 'సమకాలీన భారతదేశంలో విద్యా అంశాలు', [
        ['Democracy and education; equality, equity and quality in education; equality of educational opportunities', 'ప్రజాస్వామ్యం, విద్య; విద్యలో సమానత్వం, సమన్యాయం, నాణ్యత; విద్యావకాశాల సమానత్వం'],
        ['Economics of education; education as human capital; education and human resource development; literacy – Saakshar Bharat Mission', 'విద్యా అర్థశాస్త్రం; మానవ మూలధనంగా విద్య; విద్య, మానవ వనరుల అభివృద్ధి; అక్షరాస్యత – సాక్షర భారత్ మిషన్'],
        ['Population education; gender – equality, equity and empowerment of women; urbanisation and migration; life skills', 'జనాభా విద్య; లింగ సమానత్వం, సమన్యాయం, మహిళా సాధికారత; పట్టణీకరణ, వలసలు; జీవన నైపుణ్యాలు'],
        ['Adolescence education; value education – moral values and professional ethics', 'కౌమార విద్య; విలువల విద్య – నైతిక విలువలు, వృత్తిపర నైతికత'],
        ['Health and physical education; inclusive education – classroom management', 'ఆరోగ్య, వ్యాయామ విద్య; సమ్మిళిత విద్య – తరగతి గది నిర్వహణ'],
        ['Role of education in view of liberalisation, privatisation and globalisation', 'సరళీకరణ, ప్రైవేటీకరణ, ప్రపంచీకరణల దృష్ట్యా విద్య పాత్ర'],
        ['Programmes and projects – APPEP, DPEP, Sarva Shiksha Abhiyan, NPEGEL, RMSA, RAA, KGBVs, Model Schools', 'కార్యక్రమాలు, ప్రాజెక్టులు – APPEP, DPEP, సర్వశిక్షా అభియాన్, NPEGEL, RMSA, RAA, KGBVలు, మోడల్ స్కూళ్లు'],
        ['Incentives and special provisions – mid-day meals, free books, scholarships, awards, welfare hostels, transportation', 'ప్రోత్సాహకాలు, ప్రత్యేక ఏర్పాట్లు – మధ్యాహ్న భోజనం, ఉచిత పుస్తకాలు, ఉపకార వేతనాలు, అవార్డులు, సంక్షేమ వసతి గృహాలు, రవాణా'],
        ['Current trends in education', 'విద్యలో నూతన ధోరణులు'],
      ]),
      unit('Acts and Rights', 'చట్టాలు, హక్కులు', [
        ['Right of Children to Free and Compulsory Education Act 2009', 'ఉచిత, నిర్బంధ విద్యకు బాలల హక్కు చట్టం 2009'],
        ['Right to Information Act 2005', 'సమాచార హక్కు చట్టం 2005'],
        ['Child rights; human rights', 'బాలల హక్కులు; మానవ హక్కులు'],
      ]),
      unit('National Curriculum Framework 2005', 'జాతీయ పాఠ్యప్రణాళికా చట్రం 2005', [
        ['Perspectives and guiding principles', 'దృక్పథాలు, మార్గదర్శక సూత్రాలు'],
        ['Learning and knowledge; the teaching–learning process', 'అభ్యసనం, జ్ఞానం; బోధనాభ్యసన ప్రక్రియ'],
        ['Assessments; systemic reforms', 'మూల్యాంకనాలు; వ్యవస్థాగత సంస్కరణలు'],
      ]),
      unit('National Education Policy 2020', 'జాతీయ విద్యా విధానం 2020'),
    ],
  },
  {
    id: 'psychology',
    content: [
      unit('Development of Child', 'శిశు వికాసం', [
        ['Development, growth and maturation – concept and nature', 'వికాసం, పెరుగుదల, పరిపక్వత – భావన, స్వభావం'],
        ['Principles of development and their educational implications', 'వికాస సూత్రాలు, వాటి విద్యాపరమైన అనువర్తనాలు'],
        ['Factors influencing development – biological, psychological, sociological, emotional', 'వికాసాన్ని ప్రభావితం చేసే కారకాలు – జీవ, మానసిక, సామాజిక, ఉద్వేగ'],
        ['Dimensions of development and their interrelationship – physical and motor, cognitive, emotional, social, moral, language – in infancy, early childhood, late childhood and adolescence', 'వికాస రంగాలు, వాటి పరస్పర సంబంధం – శారీరక–చలన, జ్ఞానాత్మక, ఉద్వేగ, సాంఘిక, నైతిక, భాషా వికాసం – శైశవం, పూర్వ బాల్యం, ఉత్తర బాల్యం, కౌమారంలో'],
        ['Understanding development – Piaget, Kohlberg, Chomsky, Carl Rogers, Erikson', 'వికాసాన్ని అర్థం చేసుకోవడం – పియాజే, కోల్‌బర్గ్, చోమ్‌స్కీ, కార్ల్ రోజర్స్, ఎరిక్సన్'],
      ]),
      unit('Individual Differences', 'వైయక్తిక భేదాలు', [
        ['Inter- and intra-individual differences – meaning and nature', 'అంతర, అంతః వైయక్తిక భేదాలు – అర్థం, స్వభావం'],
        ['Theories of intelligence, with special emphasis on multiple intelligence', 'ప్రజ్ఞా సిద్ధాంతాలు – బహుళ ప్రజ్ఞకు ప్రత్యేక ప్రాధాన్యం'],
        ['IQ and assessment of intelligence; EQ; creativity', 'ప్రజ్ఞాలబ్ధి (IQ), ప్రజ్ఞా మాపనం; ఉద్వేగ ప్రజ్ఞ (EQ); సృజనాత్మకత'],
        ['Attitude, aptitude, interest and habit, and their influence on intelligence – classroom implementation', 'వైఖరి, సహజ సామర్థ్యం, అభిరుచి, అలవాటు – ప్రజ్ఞపై వాటి ప్రభావం – తరగతి గది అనువర్తనం'],
      ]),
      unit('Learning', 'అభ్యసనం', [
        ['Theories and approaches of learning', 'అభ్యసన సిద్ధాంతాలు, ఉపగమాలు'],
        ['Learning curves; factors, phases, dimensions and types of learning', 'అభ్యసన వక్రాలు; అభ్యసన కారకాలు, దశలు, పరిమాణాలు, రకాలు'],
        ['Transfer of learning; memory and forgetting', 'అభ్యసన బదలాయింపు; స్మృతి, విస్మృతి'],
        ['Learning and assessment – classroom implementation', 'అభ్యసనం, మూల్యాంకనం – తరగతి గది అనువర్తనం'],
        ['Children with special needs; inclusive education', 'ప్రత్యేక అవసరాలు గల పిల్లలు; సమ్మిళిత విద్య'],
      ]),
      unit('Personality', 'మూర్తిమత్వం', [
        ['Nature, characteristics and theories of personality; factors of personality', 'మూర్తిమత్వ స్వభావం, లక్షణాలు, సిద్ధాంతాలు; మూర్తిమత్వ కారకాలు'],
        ['Assessment of personality', 'మూర్తిమత్వ మాపనం'],
        ['Mental health; adjustment; stress – nature, symptoms and management', 'మానసిక ఆరోగ్యం; సర్దుబాటు; ఒత్తిడి – స్వభావం, లక్షణాలు, నిర్వహణ'],
        ['Emotional intelligence; management of emotions – classroom implementation', 'ఉద్వేగ ప్రజ్ఞ; ఉద్వేగాల నిర్వహణ – తరగతి గది అనువర్తనం'],
      ]),
    ],
  },
  {
    id: 'telugu',
    note: SUBJECT_NOTE,
    content: [
      sameUnit({ en: 'Textbook lessons (Telugu readers, Classes III–VIII)', te: 'తెలుగు వాచకాల్లోని పాఠ్యభాగ విషయాలు' }, ['కవి పరిచయాలు', 'పాత్రలు', 'ఇతివృత్తాలు', 'సందర్భాలు', 'నేపథ్యాలు', 'విద్యా ప్రమాణాలు']),
      sameUnit({ en: 'Vocabulary (పదజాలం)', te: 'పదజాలం' }, ['అర్థాలు', 'పర్యాయపదాలు', 'నానార్థాలు', 'వ్యుత్పత్త్యర్థాలు', 'జాతీయాలు', 'సామెతలు – వివరణ, గుర్తించడం', 'పొడుపు కథలు']),
      sameUnit({ en: 'Grammar (భాషాంశాలు)', te: 'భాషాంశాలు' }, [
        'విభక్తి ప్రత్యయాలు',
        'ఔపవిభక్తికాలు',
        'పారిభాషిక పదాలు – ద్రుత ప్రకృతికాలు, కళలు, ఆమ్రేడితం, సంధి, వచనాలు, కాలాలు, లింగాలు, సమాసం, ఆగమం, ఆదేశం',
        'తెలుగు సంధులు – అత్వ, ఇత్వ, ఉత్వ, యడాగమ, సరళాదేశ, ఆమ్రేడిత, ద్విరుక్తటకార, గసడదవాదేశ సంధులు',
        'సంస్కృత సంధులు – సవర్ణదీర్ఘ, గుణ, యణాదేశ, వృద్ధి సంధులు',
        'సమాసాలు – ద్వంద్వ, ద్విగు, తత్పురుష సమాసాలు',
        'ఛందస్సు – గణ విభజన, గణాల గుర్తింపు',
        'అలంకారాలు – శబ్దాలంకారాలు (వృత్త్యనుప్రాస, ఛేకానుప్రాస, అంత్యానుప్రాస), అర్థాలంకారాలు (ఉపమ, ఉత్ప్రేక్ష, అతిశయోక్తి) – గుర్తించుట, లక్ష్య లక్షణ సమన్వయం',
        'వాక్యాలు – శత్రర్థక, విధ్యర్థక, నిషేధార్థక, అనుమత్యర్థక, సామర్థ్యార్థక, సందేహార్థక, ఆశీరర్థక, ప్రార్థనార్థక, ప్రశ్నార్థక, హేత్వర్థక, కర్తరి, కర్మణి వాక్యాలు',
      ]),
    ],
    methodology: [
      sameUnit({ en: 'Language development at the primary level (ప్రాథమిక స్థాయిలో భాషాభివృద్ధి)', te: 'ప్రాథమిక స్థాయిలో భాషాభివృద్ధి మరియు అవగాహన' }, [
        'తెలుగు భాషా బోధన – ఉద్దేశాలు, విలువలు, లక్ష్యాలు, స్పష్టీకరణలు',
        'భాష – సమాజం – సాహిత్య ప్రక్రియలు',
        'మాతృభాష స్వభావం, స్థానం, ప్రాధాన్యత; భాషోత్పత్తి వాదాలు; ధ్వని, అర్థ విపరిణామాలు',
        'పాఠ్యపుస్తకాలు – బోధనా శాస్త్రంపై అవగాహన',
        'భాషా సామర్థ్యాలు – విద్యా ప్రమాణాలు',
        'బోధనా పద్ధతులు – బోధనాభ్యసన ప్రక్రియల నిర్వహణ',
        'ప్రణాళికా రచన',
        'బోధనాభ్యసన సామగ్రి',
        'ఆంధ్రప్రదేశ్‌లో భాషాభివృద్ధి కార్యక్రమాలు',
        'భాష – మూల్యాంకనం',
      ]),
    ],
  },
  {
    id: 'english',
    note: SUBJECT_NOTE,
    content: [
      sameUnit(same('Poets, essayists, novelists, dramatists and their works')),
      sameUnit(same('Writing of discourse'), ['Story', 'Essay', 'Letter writing', 'Editorial', 'Précis writing', 'Note-making', 'Autobiography and biography']),
      sameUnit(same('Pronunciation'), ['Sounds', 'Use of the dictionary']),
      sameUnit(same('Parts of speech')),
      sameUnit(same('Tenses')),
      sameUnit(same('Types of sentences')),
      sameUnit(same('Articles and prepositions')),
    ],
    methodology: [
      sameUnit(same('Aspects of English'), ['English language – history, nature, importance, principles of English as a second language', 'Problems of teaching and learning English']),
      sameUnit(same('Objectives of teaching English')),
      sameUnit(same('Development of language skills'), ['Listening, speaking, reading and writing (LSRW)', 'Communicative skills']),
      sameUnit(same('Approaches, methods and techniques of teaching English'), ['Introduction, definition and types of approaches, methods and techniques', 'Remedial teaching']),
      sameUnit(same('Teaching of structures and vocabulary items')),
      sameUnit(same('Teaching-learning materials in English')),
      sameUnit(same('Lesson planning')),
      sameUnit(same('Curriculum and textbooks')),
      sameUnit(same('Evaluation in English language')),
    ],
  },
  {
    id: 'mathematics',
    note: SUBJECT_NOTE,
    content: [
      unit('Numbers', 'సంఖ్యలు', [
        ['Four fundamental operations; knowing about numbers', 'చతుర్విధ ప్రక్రియలు (కూడిక, తీసివేత, గుణకారం, భాగహారం); సంఖ్యల గురించి తెలుసుకోవడం'],
        ['Hindu–Arabic (Indian) and international (British) systems of numeration; place value and face value', 'హిందూ–అరబిక్ (భారతీయ), అంతర్జాతీయ (బ్రిటిష్) సంఖ్యామానాలు; స్థాన విలువ, ముఖ విలువ'],
        ['Comparing and ordering numbers; whole numbers', 'సంఖ్యల పోలిక, క్రమం; పూర్ణ సంఖ్యలు'],
        ['Factors and multiples; prime and composite, even and odd numbers; tests of divisibility', 'కారణాంకాలు, గుణిజాలు; ప్రధాన, సంయుక్త, సరి, బేసి సంఖ్యలు; భాజనీయతా సూత్రాలు'],
        ['Common factors and common multiples; prime factorisation; HCF (GCD) and LCM', 'సామాన్య కారణాంకాలు, సామాన్య గుణిజాలు; ప్రధాన కారణాంక విభజన; గ.సా.భా, క.సా.గు'],
        ['Integers – properties and fundamental operations', 'పూర్ణాంకాలు – ధర్మాలు, ప్రాథమిక ప్రక్రియలు'],
        ['Fractions and decimals – types, comparison, daily-life applications, four operations', 'భిన్నాలు, దశాంశాలు – రకాలు, పోలిక, నిత్యజీవిత అనువర్తనాలు, చతుర్విధ ప్రక్రియలు'],
        ['Rational numbers – properties, rational numbers between two rational numbers, four operations, product of reciprocals', 'అకరణీయ సంఖ్యలు – ధర్మాలు, రెండు అకరణీయ సంఖ్యల మధ్య అకరణీయ సంఖ్యలు, చతుర్విధ ప్రక్రియలు, వ్యుత్క్రమాల లబ్ధం'],
        ['Squares and square roots (numbers and decimals), properties of square numbers; cubes and cube roots', 'వర్గాలు, వర్గమూలాలు (సంఖ్యలు, దశాంశాలు), వర్గ సంఖ్యల ధర్మాలు; ఘనాలు, ఘనమూలాలు'],
        ['Playing with numbers; games with numbers; letters for digits', 'సంఖ్యలతో ఆటలు; అంకెలకు అక్షరాలు'],
      ]),
      unit('Arithmetic', 'అంకగణితం', [
        ['BODMAS rule', 'BODMAS నియమం'],
        ['Ratio and proportion (direct, inverse); comparing quantities using ratio, proportion and percentage, and their applications', 'నిష్పత్తి, అనుపాతం (అనులోమ, విలోమ); నిష్పత్తి, అనుపాతం, శాతాలతో రాశుల పోలిక, అనువర్తనాలు'],
        ['Profit and loss; discount', 'లాభ నష్టాలు; రాయితీ'],
        ['Sales tax, VAT, GST', 'అమ్మకపు పన్ను, VAT, GST'],
        ['Simple and compound interest and their applications', 'బారువడ్డీ, చక్రవడ్డీ, వాటి అనువర్తనాలు'],
      ]),
      unit('Geometry', 'జ్యామితి', [
        ['Basic concepts – point, line, line segment, ray, curves, polygons, angles', 'ప్రాథమిక భావనలు – బిందువు, రేఖ, రేఖాఖండం, కిరణం, వక్రాలు, బహుభుజులు, కోణాలు'],
        ['Measuring lines; pairs of lines; elements, measuring and types of angles', 'రేఖల కొలత; రేఖా యుగ్మాలు; కోణ భాగాలు, కోణాల కొలత, రకాలు'],
        ['Naming 2D figures – triangles, square, rectangle', 'ద్విమితీయ పటాల పేర్లు – త్రిభుజం, చతురస్రం, దీర్ఘచతురస్రం'],
        ['The triangle – types and properties; classification of polygons; angle sum property', 'త్రిభుజం – రకాలు, ధర్మాలు; బహుభుజుల వర్గీకరణ; కోణాల మొత్తం ధర్మం'],
        ['Quadrilaterals – trapezium, kite, parallelogram; special parallelograms (rhombus, rectangle, square); constructing quadrilaterals', 'చతుర్భుజాలు – సమలంబ చతుర్భుజం, గాలిపటం, సమాంతర చతుర్భుజం; ప్రత్యేక సమాంతర చతుర్భుజాలు (సమచతుర్భుజం, దీర్ఘచతురస్రం, చతురస్రం); చతుర్భుజాల నిర్మాణం'],
        ['Views of 3D shapes; edges, vertices and faces (Euler’s rule); nets for building 3D shapes', 'త్రిమితీయ ఆకారాల దృశ్యాలు; అంచులు, శీర్షాలు, ముఖాలు (ఆయిలర్ సూత్రం); త్రిమితీయ ఆకారాల నిర్మాణానికి వలలు'],
      ]),
      unit('Data Handling', 'దత్తాంశ నిర్వహణ', [
        ['Reading, interpreting and analysing data – pictographs, tally marks, bar graphs, double bar graphs, pie charts', 'దత్తాంశాన్ని చదవడం, వ్యాఖ్యానించడం, విశ్లేషించడం – చిత్ర రేఖాచిత్రాలు, గణన చిహ్నాలు, కమ్మీ రేఖాచిత్రాలు, ద్వి కమ్మీ రేఖాచిత్రాలు, వృత్త రేఖాచిత్రాలు'],
        ['Arithmetic mean, mode and median of ungrouped data', 'వర్గీకరించని దత్తాంశం అంకగణిత సగటు, బాహుళకం, మధ్యగతం'],
        ['Chance and probability', 'అవకాశం, సంభావ్యత'],
      ]),
      unit('Algebra', 'బీజగణితం', [
        ['Patterns and making rules; the idea of variables', 'అమరికలు, నియమాల రూపకల్పన; చరరాశి భావన'],
        ['Algebraic expressions – formation; terms, factors and coefficients; types; finding the value', 'బీజీయ సమాసాలు – రూపొందించడం; పదాలు, కారణాంకాలు, గుణకాలు; రకాలు; విలువ కనుగొనడం'],
        ['Linear equations in one variable; simple equations in practical situations', 'ఏకచరరాశిలో రేఖీయ సమీకరణాలు; సామాన్య సమీకరణాల ఆచరణాత్మక అనువర్తనాలు'],
        ['Addition, subtraction and multiplication of expressions; monomial × monomial and polynomial; polynomial × polynomial', 'బీజీయ సమాసాల కూడిక, తీసివేత, గుణకారం; ఏకపది × ఏకపది, బహుపది; బహుపది × బహుపది'],
        ['Standard identities and their applications', 'సర్వసమీకరణాలు, వాటి అనువర్తనాలు'],
        ['Exponents and powers – negative exponents, laws of exponents, large numbers in standard form', 'ఘాతాలు, ఘాతాంకాలు – రుణ ఘాతాంకాలు, ఘాతాంక న్యాయాలు, పెద్ద సంఖ్యల ప్రామాణిక రూపం'],
        ['Factorisation; division of algebraic expressions (polynomial ÷ polynomial)', 'కారణాంక విభజన; బీజీయ సమాసాల భాగహారం (బహుపది ÷ బహుపది)'],
        ['Linear graphs', 'రేఖీయ గ్రాఫులు'],
      ]),
      unit('Mensuration', 'క్షేత్రమితి', [
        ['Measuring length, weight, capacity, time – seasons, calendar; money; area', 'పొడవు, బరువు, సామర్థ్యం, కాలం – ఋతువులు, క్యాలెండర్; డబ్బు; వైశాల్యం కొలవడం'],
        ['Symmetry – line and rotational', 'సౌష్ఠవం – రేఖా, భ్రమణ సౌష్ఠవం'],
        ['Perimeter of triangle, square, rectangle, rhombus, trapezium, parallelogram, circle and polygon; area of a quadrilateral', 'త్రిభుజం, చతురస్రం, దీర్ఘచతురస్రం, సమచతుర్భుజం, సమలంబ చతుర్భుజం, సమాంతర చతుర్భుజం, వృత్తం, బహుభుజి చుట్టుకొలత; చతుర్భుజ వైశాల్యం'],
        ['Surface area and volume of cube, cuboid and cylinder; volume and capacity', 'ఘనం, దీర్ఘఘనం, స్థూపం ఉపరితల వైశాల్యం, ఘనపరిమాణం; ఘనపరిమాణం, సామర్థ్యం'],
      ]),
    ],
    methodology: [
      unit('Nature and definitions of mathematics', 'గణిత స్వభావం, నిర్వచనాలు'),
      unit('Aims, values and instructional objectives of teaching mathematics', 'గణిత బోధనా లక్ష్యాలు, విలువలు, బోధనా ఉద్దేశాలు'),
      unit('Methods of teaching and remedial measures in mathematics', 'గణిత బోధనా పద్ధతులు, నివారణ చర్యలు'),
      unit('Instructional material, TLM and resource utilisation in mathematics', 'గణితంలో బోధనోపకరణాలు, బోధనాభ్యసన సామగ్రి, వనరుల వినియోగం'),
      unit('Curriculum, textbooks and instructional planning', 'పాఠ్యప్రణాళిక, పాఠ్యపుస్తకాలు, బోధనా ప్రణాళిక'),
      unit('Evaluation and continuous comprehensive evaluation (CCE)', 'మూల్యాంకనం, నిరంతర సమగ్ర మూల్యాంకనం (CCE)'),
    ],
  },
  {
    id: 'science',
    note: SUBJECT_NOTE,
    content: [
      unit('Living World', 'జీవ ప్రపంచం', [
        ['Living and non-living things; characteristics of living organisms', 'సజీవులు, నిర్జీవులు; జీవుల లక్షణాలు'],
        ['Plants – herbs, shrubs, trees; terrestrial, aquatic and desert plants; plant parts and their functions', 'మొక్కలు – గుల్మాలు, పొదలు, వృక్షాలు; భౌమ, జల, ఎడారి మొక్కలు; మొక్క భాగాలు, వాటి విధులు'],
        ['Animals – oviparous and viviparous; herbivores, carnivores, omnivores; shelters, birds and beaks; domestic and wild animals; sounds and movements; habitats and adaptation; homes of animals, nests of birds', 'జంతువులు – అండజాలు, శిశూత్పాదకాలు; శాకాహారులు, మాంసాహారులు, సర్వాహారులు; నివాసాలు, పక్షులు, ముక్కులు; పెంపుడు, అడవి జంతువులు; శబ్దాలు, చలనం; ఆవాసాలు, అనుకూలనాలు; జంతువుల ఇళ్లు, పక్షుల గూళ్లు'],
        ['Human beings – body parts; healthy body and good habits; sense organs and their care; concern for differently abled persons; good touch and bad touch', 'మానవులు – శరీర భాగాలు; ఆరోగ్యకర శరీరం, మంచి అలవాట్లు; జ్ఞానేంద్రియాలు, సంరక్షణ; దివ్యాంగుల పట్ల శ్రద్ధ; మంచి స్పర్శ, చెడు స్పర్శ'],
        ['Skeleton – bones, joints, cartilage, muscles; safety at home, school and on roads; water hazards; first aid', 'అస్థిపంజరం – ఎముకలు, కీళ్లు, మృదులాస్థి, కండరాలు; ఇల్లు, పాఠశాల, రహదారి భద్రత; నీటి ప్రమాదాలు; ప్రథమ చికిత్స'],
        ['Food – need and sources; types; cooked and raw food; utensils; mid-day meal; preparing, wasting and preserving food; components of food; balanced diet; junk food; deficiency diseases', 'ఆహారం – అవసరం, వనరులు; రకాలు; వండిన, పచ్చి ఆహారం; పాత్రలు; మధ్యాహ్న భోజనం; ఆహారం తయారీ, వృథా, నిల్వ; ఆహార అంశాలు; సమతుల ఆహారం; జంక్ ఫుడ్; లోప వ్యాధులు'],
        ['Agricultural practices and tools; storage of food; food from animals; food for birds and animals', 'వ్యవసాయ పద్ధతులు, పనిముట్లు; ఆహార నిల్వ; జంతువుల నుండి ఆహారం; పక్షులు, జంతువులకు ఆహారం'],
        ['Family – roles, family tree, types, changing structure, family budget; shelter for all; types of houses; home appliances; migration – reasons and effects; slums; homeless people', 'కుటుంబం – పాత్రలు, వంశవృక్షం, రకాలు, మారుతున్న నిర్మాణం, కుటుంబ బడ్జెట్; అందరికీ నివాసం; ఇళ్ల రకాలు; గృహోపకరణాలు; వలసలు – కారణాలు, ప్రభావాలు; మురికివాడలు; నిరాశ్రయులు'],
        ['Cell – the basic unit of life; types, structure and function', 'కణం – జీవ మూల ప్రమాణం; రకాలు, నిర్మాణం, విధులు'],
        ['Microorganisms – types; useful and harmful microorganisms', 'సూక్ష్మజీవులు – రకాలు; ఉపయోగకర, హానికర సూక్ష్మజీవులు'],
        ['Games and recreation – indoor, outdoor and local games; uses, materials and rules', 'ఆటలు, వినోదం – ఇండోర్, అవుట్‌డోర్, స్థానిక ఆటలు; ఉపయోగాలు, సామగ్రి, నియమాలు'],
      ]),
      unit('Life Processes', 'జీవక్రియలు', [
        ['Nutrition in plants – autotrophic, parasitic, saprophytic, insectivorous', 'మొక్కల్లో పోషణ – స్వయంపోషణ, పరాన్నజీవనం, పూతికాహారం, కీటకాహారం'],
        ['Ways of taking food; digestion in humans and grass-eating animals; feeding and digestion in amoeba', 'ఆహార గ్రహణ విధానాలు; మానవులు, నెమరువేసే జంతువుల్లో జీర్ణక్రియ; అమీబాలో ఆహార గ్రహణం, జీర్ణక్రియ'],
        ['Respiration – types; in animals and plants', 'శ్వాసక్రియ – రకాలు; జంతువులు, మొక్కల్లో'],
        ['Circulation – the human circulatory system; transport of substances in plants', 'రక్తప్రసరణ – మానవ రక్తప్రసరణ వ్యవస్థ; మొక్కల్లో పదార్థాల రవాణా'],
        ['Excretion in animals; coordination – the nervous system', 'జంతువుల్లో విసర్జన; సమన్వయం – నాడీ వ్యవస్థ'],
        ['Reproduction – sexual, asexual and vegetative; seed dispersal; reproduction in animals', 'ప్రత్యుత్పత్తి – లైంగిక, అలైంగిక, శాఖీయ; విత్తన వ్యాప్తి; జంతువుల్లో ప్రత్యుత్పత్తి'],
        ['Adolescence and puberty – changes, role of hormones, reproductive phase, sex determination, other hormones; metamorphosis; reproductive health', 'కౌమారం, యుక్తవయస్సు – మార్పులు, హార్మోన్ల పాత్ర, ప్రత్యుత్పత్తి దశ, లింగ నిర్ధారణ, ఇతర హార్మోన్లు; రూపవిక్రియ; ప్రత్యుత్పత్తి ఆరోగ్యం'],
      ]),
      unit('Natural Phenomena', 'ప్రకృతి దృగ్విషయాలు', [
        ['Objects and materials – properties and classification; metals and non-metals, reactivity order; methods of separation; saturated and unsaturated solutions; acids, bases, salts, indicators, neutralisation; physical and chemical changes; rusting, galvanisation, crystallisation', 'వస్తువులు, పదార్థాలు – ధర్మాలు, వర్గీకరణ; లోహాలు, అలోహాలు, చర్యాశీలత క్రమం; వేరుచేసే పద్ధతులు; సంతృప్త, అసంతృప్త ద్రావణాలు; ఆమ్లాలు, క్షారాలు, లవణాలు, సూచికలు, తటస్థీకరణం; భౌతిక, రసాయన మార్పులు; తుప్పు పట్టడం, గాల్వనీకరణం, స్ఫటికీకరణం'],
        ['Measurement of distances and motion – standard and non-standard units; motion and rest; speed and average speed; uniform and non-uniform motion; time period; distance–time graph', 'దూరాల కొలత, చలనం – ప్రామాణిక, అప్రామాణిక ప్రమాణాలు; చలనం, నిశ్చలస్థితి; వడి, సగటు వడి; సమ, అసమ చలనం; ఆవర్తన కాలం; దూరం–కాలం గ్రాఫ్'],
        ['Light – shadows; transparent, opaque, translucent; pinhole camera; mirrors, regular and diffused reflection, multiple images, kaleidoscope, periscope; spherical mirrors and lenses; dispersion; the human eye and its care; Braille; visually impaired persons', 'కాంతి – నీడలు; పారదర్శక, అపారదర్శక, పాక్షిక పారదర్శక వస్తువులు; సూది బెజ్జం కెమెరా; దర్పణాలు, క్రమ, క్రమరహిత పరావర్తనం, బహుళ ప్రతిబింబాలు, కెలిడోస్కోప్, పెరిస్కోప్; గోళాకార దర్పణాలు, కటకాలు; విక్షేపణం; మానవ నేత్రం, సంరక్షణ; బ్రెయిలీ లిపి; దృష్టి లోపం గలవారు'],
        ['Electricity – circuits and symbols; conductors and insulators; heating effect; CFL, LED, fuse, MCB; magnetic effect, electromagnet, electric bell; chemical effect, conducting liquids, electroplating', 'విద్యుత్ – వలయాలు, సంకేతాలు; వాహకాలు, బంధకాలు; ఉష్ణ ఫలితం; CFL, LED, ఫ్యూజ్, MCB; అయస్కాంత ఫలితం, విద్యుదయస్కాంతం, విద్యుత్ గంట; రసాయన ఫలితం, వాహక ద్రవాలు, విద్యుత్ లేపనం'],
        ['Magnetism – discovery; magnetic and non-magnetic substances; types and properties of magnets; magnetic compass; storing magnets', 'అయస్కాంతత్వం – ఆవిష్కరణ; అయస్కాంత, అనయస్కాంత పదార్థాలు; అయస్కాంతాల రకాలు, ధర్మాలు; దిక్సూచి; అయస్కాంతాల నిల్వ'],
        ['Heat – temperature, measurement and units; thermometers; conduction, convection, radiation', 'ఉష్ణం – ఉష్ణోగ్రత, కొలత, ప్రమాణాలు; ఉష్ణమాపకాలు; ఉష్ణ వహనం, సంవహనం, వికిరణం'],
        ['Force, friction and pressure – push and pull, net force, effects; contact and non-contact forces; fluid and atmospheric pressure; friction – factors, types, increasing and reducing it', 'బలం, ఘర్షణ, పీడనం – తోపు, లాగు, ఫలిత బలం, ప్రభావాలు; స్పర్శ, అస్పర్శ బలాలు; ద్రవ, వాతావరణ పీడనం; ఘర్షణ – కారకాలు, రకాలు, పెంచడం, తగ్గించడం'],
        ['Combustion and fuels – exhaustible and inexhaustible resources; coal and petroleum, their products and formation; natural gas; misuse of energy; combustion, ignition temperature, flame zones, fuel efficiency, harmful products, fire control', 'దహనం, ఇంధనాలు – తరిగిపోయే, తరగని వనరులు; బొగ్గు, పెట్రోలియం, ఉత్పన్నాలు, ఏర్పడటం; సహజ వాయువు; శక్తి దుర్వినియోగం; దహనం, జ్వలన ఉష్ణోగ్రత, జ్వాల మండలాలు, ఇంధన సామర్థ్యం, హానికర ఉత్పన్నాలు, అగ్ని నియంత్రణ'],
        ['Fibres and plastics – natural and synthetic fibres; our dress, our culture; types of plastics; plastics and the environment; biodegradable and non-biodegradable materials', 'దారాలు, ప్లాస్టిక్‌లు – సహజ, కృత్రిమ దారాలు; మన దుస్తులు, మన సంస్కృతి; ప్లాస్టిక్ రకాలు; ప్లాస్టిక్‌లు, పర్యావరణం; జీవ విఘటనశీల, విఘటనశీలం కాని పదార్థాలు'],
        ['Sound – production, propagation, the human ear, hearing impairment; noise and music; longitudinal and transverse waves; wavelength, frequency, time period, speed; pitch, loudness, quality; audible and inaudible sounds; noise pollution', 'ధ్వని – ఉత్పత్తి, ప్రసారం, మానవ చెవి, వినికిడి లోపం; శబ్దం, సంగీతం; అనుదైర్ఘ్య, తిర్యక్ తరంగాలు; తరంగదైర్ఘ్యం, పౌనఃపున్యం, ఆవర్తన కాలం, వడి; కీచుదనం, తీవ్రత, నాణ్యత; శ్రవ్య, అశ్రవ్య ధ్వనులు; ధ్వని కాలుష్యం'],
        ['Some natural phenomena – lightning, charging by rubbing, electric charges, lightning conductors and safety; earthquakes and tsunami – causes, effects, protection', 'కొన్ని సహజ దృగ్విషయాలు – మెరుపులు, రాపిడి ద్వారా ఆవేశం, విద్యుదావేశాలు, తటిద్వాహకం, రక్షణ; భూకంపాలు, సునామీ – కారణాలు, ప్రభావాలు, రక్షణ'],
        ['Our universe – the moon and its phases; solar and lunar eclipses; stars, constellations, pole star; the solar system and planets; artificial satellites', 'మన విశ్వం – చంద్రుడు, చంద్ర కళలు; సూర్య, చంద్ర గ్రహణాలు; నక్షత్రాలు, నక్షత్ర రాశులు, ధ్రువ నక్షత్రం; సౌర కుటుంబం, గ్రహాలు; కృత్రిమ ఉపగ్రహాలు'],
      ]),
      unit('Transportation and Communication', 'రవాణా, సమాచారం', [
        ['Story of transport; signs and signboards; modes of travel then and now; transport in hills, forests, deserts, snowy areas, rivers and canals', 'రవాణా చరిత్ర; సంకేతాలు, సూచిక బోర్డులు; నాటి, నేటి ప్రయాణ సాధనాలు; కొండలు, అడవులు, ఎడారులు, మంచు ప్రాంతాలు, నదులు, కాలువల్లో రవాణా'],
        ['International transport; import and export of goods; tourism; seven wonders of the world', 'అంతర్జాతీయ రవాణా; వస్తువుల ఎగుమతి, దిగుమతి; పర్యాటకం; ప్రపంచ ఏడు వింతలు'],
        ['Communication – means; in humans and animals; past and modern forms; mass communication – postcard, cell phone, e-mail, newspaper, radio, TV, social media', 'సమాచారం – సాధనాలు; మానవులు, జంతువుల్లో; పూర్వ, ఆధునిక రూపాలు; ప్రసార మాధ్యమాలు – పోస్ట్‌కార్డ్, సెల్‌ఫోన్, ఈ-మెయిల్, వార్తాపత్రిక, రేడియో, టీవీ, సామాజిక మాధ్యమాలు'],
      ]),
      unit('Professions and Services', 'వృత్తులు, సేవలు', [
        ['Household materials and professions (farmer, cobbler, tailor); professions and their need in society', 'గృహోపకరణాలు, వృత్తులు (రైతు, చెప్పులు కుట్టేవారు, దర్జీ); వృత్తులు, సమాజానికి వాటి అవసరం'],
        ['Helping agents – bank, e-Seva, PHC, panchayat office, post office', 'సహాయ సంస్థలు – బ్యాంకు, ఈ-సేవ, ప్రాథమిక ఆరోగ్య కేంద్రం, పంచాయతీ కార్యాలయం, తపాలా కార్యాలయం'],
        ['Governance and services – local self-government, state and central government, judiciary', 'పాలన, సేవలు – స్థానిక స్వపరిపాలన, రాష్ట్ర, కేంద్ర ప్రభుత్వాలు, న్యాయవ్యవస్థ'],
      ]),
      unit('Our Environment', 'మన పర్యావరణం', [
        ['Climate – climate change, weather, rain, floods, cyclones, disaster management; greenhouse effect, global warming, acid rain; eco-friendly activities; say no to plastic', 'వాతావరణం – శీతోష్ణస్థితి మార్పు, వర్షం, వరదలు, తుఫానులు, విపత్తు నిర్వహణ; హరితగృహ ప్రభావం, భూతాపం, ఆమ్ల వర్షాలు; పర్యావరణహిత కార్యక్రమాలు; ప్లాస్టిక్ వద్దు'],
        ['Air – components and properties; oxygen for animals and plants; nitrogen cycle; air pollution – causes, effects, prevention', 'గాలి – అనుఘటకాలు, ధర్మాలు; జంతువులు, మొక్కలకు ఆక్సిజన్; నైట్రోజన్ వలయం; వాయు కాలుష్యం – కారణాలు, ప్రభావాలు, నివారణ'],
        ['Water – forms, uses, sources, scarcity, water cycle, major rivers of AP, drought and floods; water pollution; sewage and its treatment; sanitation and disease', 'నీరు – రూపాలు, ఉపయోగాలు, వనరులు, కొరత, జల చక్రం, ఆంధ్రప్రదేశ్ ప్రధాన నదులు, కరువు, వరదలు; జల కాలుష్యం; మురుగునీరు, శుద్ధి; పారిశుధ్యం, వ్యాధులు'],
        ['Biodiversity – forests, flora and fauna; deforestation, Chipko movement; conservation of forests and wildlife; endangered and endemic species', 'జీవవైవిధ్యం – అడవులు, వృక్ష, జంతు జాలం; అటవీ నిర్మూలన, చిప్కో ఉద్యమం; అడవులు, వన్యప్రాణుల సంరక్షణ; అంతరించిపోతున్న, స్థానిక జాతులు'],
      ]),
    ],
    methodology: tenUnits('science', 'Science', 'విజ్ఞాన శాస్త్ర'),
  },
  {
    id: 'social',
    note: SUBJECT_NOTE,
    content: [
      unit('Theme I – Our Universe', 'థీమ్ I – మన విశ్వం', [
        ['Shape of the Earth; the universe and its origin; the solar system; celestial bodies, constellations; realms of the Earth', 'భూమి ఆకారం; విశ్వం, ఆవిర్భావం; సౌర కుటుంబం; ఖగోళ వస్తువులు, నక్షత్ర రాశులు; భూ పరిమండలాలు'],
        ['Latitudes and longitudes; movements of the Earth; the globe and the Earth’s axis; equinox; eclipses', 'అక్షాంశాలు, రేఖాంశాలు; భూ చలనాలు; గ్లోబు, భూ అక్షం; విషువత్తులు; గ్రహణాలు'],
        ['Maps – directions, scale, symbols, patterns, types; village, mandal, district and country maps', 'పటాలు – దిక్కులు, స్కేలు, చిహ్నాలు, అమరికలు, రకాలు; గ్రామం, మండలం, జిల్లా, దేశ పటాలు'],
        ['The Earth – environment and its components; interior; atmosphere; biosphere; pollution; disasters', 'భూమి – పర్యావరణం, అనుఘటకాలు; అంతర్భాగం; వాతావరణం; జీవావరణం; కాలుష్యం; విపత్తులు'],
        ['Landforms – major landforms of AP; podu cultivation; diversity in lifestyles', 'భూస్వరూపాలు – ఆంధ్రప్రదేశ్ ప్రధాన భూస్వరూపాలు; పోడు వ్యవసాయం; జీవన విధానాల్లో వైవిధ్యం'],
        ['Forests and climatic regions – types of forests, forests of AP, uses, deforestation, conservation', 'అడవులు, శీతోష్ణస్థితి మండలాలు – అడవుల రకాలు, ఆంధ్రప్రదేశ్ అడవులు, ఉపయోగాలు, అటవీ నిర్మూలన, సంరక్షణ'],
        ['Land, soil, water, natural vegetation and wildlife resources', 'భూమి, నేలలు, నీరు, సహజ వృక్షసంపద, వన్యప్రాణి వనరులు'],
      ]),
      unit('Theme II – Production, Exchange and Livelihoods', 'థీమ్ II – ఉత్పత్తి, వినిమయం, జీవనోపాధులు', [
        ['Migration – reasons and effects; slums; family budget; professions – farmer, tailor', 'వలసలు – కారణాలు, ప్రభావాలు; మురికివాడలు; కుటుంబ బడ్జెట్; వృత్తులు – రైతు, దర్జీ'],
        ['Resources – types and conservation; minerals – types, distribution, conservation; power resources – conventional and non-conventional', 'వనరులు – రకాలు, సంరక్షణ; ఖనిజాలు – రకాలు, విస్తరణ, సంరక్షణ; శక్తి వనరులు – సాంప్రదాయ, సాంప్రదాయేతర'],
        ['Human resources – distribution, density, change and composition of population', 'మానవ వనరులు – జనాభా విస్తరణ, సాంద్రత, మార్పు, నిర్మాణం'],
        ['Agriculture – types of farming, major crops; industries – classification and distribution', 'వ్యవసాయం – వ్యవసాయ రకాలు, ప్రధాన పంటలు; పరిశ్రమలు – వర్గీకరణ, విస్తరణ'],
        ['Weavers, iron smelters and factory owners; Indian textiles and the world market; Tipu Sultan’s sword and Wootz steel', 'నేత కార్మికులు, ఇనుము కరిగించేవారు, కర్మాగార యజమానులు; భారతీయ వస్త్రాలు, ప్రపంచ మార్కెట్; టిప్పు సుల్తాన్ ఖడ్గం, ఊట్జ్ ఉక్కు'],
        ['Public facilities; water as part of the fundamental right to life – role of government', 'ప్రజా సౌకర్యాలు; జీవించే ప్రాథమిక హక్కులో భాగంగా నీరు – ప్రభుత్వ పాత్ర'],
        ['Markets around us – types of markets; consumer protection', 'మన చుట్టూ మార్కెట్లు – మార్కెట్ల రకాలు; వినియోగదారుల రక్షణ'],
        ['Transport – international transport, exports and imports, global village; transport in hills, forests, deserts, snow and waterways; road safety – traffic symbols, pedestrian and cycling safety', 'రవాణా – అంతర్జాతీయ రవాణా, ఎగుమతులు, దిగుమతులు, ప్రపంచ గ్రామం; కొండలు, అడవులు, ఎడారులు, మంచు, జలమార్గాల్లో రవాణా; రహదారి భద్రత – ట్రాఫిక్ సంకేతాలు, పాదచారులు, సైక్లింగ్ భద్రత'],
      ]),
      unit('Theme III – Political Systems and Governance', 'థీమ్ III – రాజకీయ వ్యవస్థలు, పరిపాలన', [
        ['Early life to settled life – early people, nomadic life, Belum caves, rock paintings; growing plants, rearing animals', 'ఆదిమ జీవనం నుండి స్థిర జీవనం – ఆదిమానవులు, సంచార జీవనం, బెలూం గుహలు, శిలా చిత్రాలు; మొక్కల పెంపకం, పశుపోషణ'],
        ['Kingdoms and republics – Mahajanapadas, Magadha, Vajji; empires – Mauryas, Guptas, Satavahanas, Pallavas, Chalukyas', 'రాజ్యాలు, గణతంత్రాలు – మహాజనపదాలు, మగధ, వజ్జి; సామ్రాజ్యాలు – మౌర్యులు, గుప్తులు, శాతవాహనులు, పల్లవులు, చాళుక్యులు'],
        ['Delhi Sultanate, Kakatiyas, Vijayanagara empire, Mughals and contemporary kingdoms', 'ఢిల్లీ సుల్తానులు, కాకతీయులు, విజయనగర సామ్రాజ్యం, మొఘలులు, సమకాలీన రాజ్యాలు'],
        ['Governments – types, monarchy, democracy, levels; local self-government; state and central governments', 'ప్రభుత్వాలు – రకాలు, రాచరికం, ప్రజాస్వామ్యం, స్థాయిలు; స్థానిక స్వపరిపాలన; రాష్ట్ర, కేంద్ర ప్రభుత్వాలు'],
        ['Parliament – why we need it, its role and members; state government – legislature, executive, judiciary', 'పార్లమెంటు – అవసరం, పాత్ర, సభ్యులు; రాష్ట్ర ప్రభుత్వం – శాసన, కార్యనిర్వాహక, న్యాయ వ్యవస్థలు'],
        ['Independent judiciary; structure of courts; branches of the legal system; criminal justice – police, public prosecutor, judge, fair trial', 'స్వతంత్ర న్యాయవ్యవస్థ; న్యాయస్థానాల నిర్మాణం; న్యాయ వ్యవస్థ శాఖలు; నేర న్యాయం – పోలీసులు, పబ్లిక్ ప్రాసిక్యూటర్, న్యాయమూర్తి, న్యాయమైన విచారణ'],
        ['Law and social justice – Bhopal gas tragedy, enforcement of safety laws, new laws to protect the environment', 'చట్టం, సామాజిక న్యాయం – భోపాల్ గ్యాస్ దుర్ఘటన, భద్రతా చట్టాల అమలు, పర్యావరణ రక్షణకు కొత్త చట్టాలు'],
        ['The Indian Constitution – key features, fundamental rights and duties; understanding secularism and laws', 'భారత రాజ్యాంగం – ముఖ్య లక్షణాలు, ప్రాథమిక హక్కులు, విధులు; లౌకికవాదం, చట్టాల అవగాహన'],
        ['Colonial education – how the British saw education, local schools, the agenda for national education; how we periodise history', 'వలస పాలనలో విద్య – బ్రిటిష్ వారి విద్యా దృక్పథం, స్థానిక పాఠశాలలు, జాతీయ విద్యా ఎజెండా; చరిత్ర కాల విభజన'],
        ['From trade to territory – East India Company, Battle of Plassey, Tipu Sultan, Doctrine of Lapse; a new administration', 'వ్యాపారం నుండి రాజ్యాధికారం – ఈస్ట్ ఇండియా కంపెనీ, ప్లాసీ యుద్ధం, టిప్పు సుల్తాన్, రాజ్యసంక్రమణ సిద్ధాంతం; కొత్త పరిపాలన'],
        ['Ruling the countryside – Diwani, Munro system; indigo and the Blue Rebellion; tribals, dikus and the vision of a golden age; forest laws; Birsa Munda', 'గ్రామీణ పాలన – దివానీ, మన్రో పద్ధతి; నీలిమందు, నీలి తిరుగుబాటు; గిరిజనులు, దికులు, స్వర్ణయుగ దృష్టి; అటవీ చట్టాలు; బిర్సా ముండా'],
        ['1857 and after; the national movement, 1870s–1947 – nationalism, mass nationalism, Dandi March, Quit India', '1857 తిరుగుబాటు, తదనంతరం; జాతీయోద్యమం 1870–1947 – జాతీయవాదం, ప్రజా జాతీయవాదం, దండి యాత్ర, క్విట్ ఇండియా'],
        ['India after Independence – a new and divided nation, writing the Constitution, formation of states, planning for development', 'స్వాతంత్ర్యానంతర భారతదేశం – కొత్త, విభజిత దేశం, రాజ్యాంగ రచన, రాష్ట్రాల ఏర్పాటు, అభివృద్ధి ప్రణాళికలు'],
      ]),
      unit('Theme IV – Social Organisation and Inequities', 'థీమ్ IV – సామాజిక వ్యవస్థ, అసమానతలు', [
        ['Inequality; steps towards equality – constitutional provisions and remedial measures', 'అసమానత; సమానత్వం దిశగా – రాజ్యాంగ నిబంధనలు, నివారణ చర్యలు'],
        ['Women change the world – women’s movement, inspirational women; women, caste and reform – widows, girls’ education, women writers', 'ప్రపంచాన్ని మార్చిన మహిళలు – మహిళా ఉద్యమం, స్ఫూర్తిదాయక మహిళలు; మహిళలు, కులం, సంస్కరణలు – వితంతువులు, బాలికా విద్య, మహిళా రచయితలు'],
        ['Caste and social reform – Gulamgiri, the non-Brahman movement', 'కులం, సాంఘిక సంస్కరణ – గులాంగిరి, బ్రాహ్మణేతర ఉద్యమం'],
        ['Understanding marginalisation – Adivasis and development, minorities; confronting it – fundamental rights, laws for the marginalised, rights of Dalits and Adivasis, the 1989 Act', 'అణచివేతకు గురైన వర్గాలు – ఆదివాసీలు, అభివృద్ధి, అల్పసంఖ్యాకులు; ఎదుర్కోవడం – ప్రాథమిక హక్కులు, చట్టాలు, దళితులు, ఆదివాసీల హక్కులు, 1989 చట్టం'],
      ]),
      unit('Theme V – Religion and Society', 'థీమ్ V – మతం, సమాజం', [
        ['Religions – Hinduism, Jainism, Buddhism, Islam, Sikhism; unity in diversity', 'మతాలు – హిందూ, జైన, బౌద్ధ, ఇస్లాం, సిక్కు మతాలు; భిన్నత్వంలో ఏకత్వం'],
        ['Bhakti and Sufi movements', 'భక్తి, సూఫీ ఉద్యమాలు'],
      ]),
      unit('Theme VI – Culture and Communication', 'థీమ్ VI – సంస్కృతి, సమాచారం', [
        ['Communication – postal services, mobiles, e-mail, mass communication, newspaper, radio, TV, social media', 'సమాచారం – తపాలా సేవలు, మొబైళ్లు, ఈ-మెయిల్, ప్రసార మాధ్యమాలు, వార్తాపత్రిక, రేడియో, టీవీ, సామాజిక మాధ్యమాలు'],
        ['Historical and tourist places of Andhra Pradesh', 'ఆంధ్రప్రదేశ్ చారిత్రక, పర్యాటక ప్రదేశాలు'],
        ['Early civilisations – Indus Valley, the Vedic period and Vedic literature; Indian culture and languages', 'ప్రాచీన నాగరికతలు – సింధు నాగరికత, వేద కాలం, వేద సాహిత్యం; భారతీయ సంస్కృతి, భాషలు'],
      ]),
    ],
    methodology: tenUnits('social', 'Social studies', 'సాంఘిక శాస్త్ర'),
  },
]

/** Science and Social methodology: the syllabus's ten-unit outline. */
function tenUnits(subject: 'science' | 'social', en: string, te: string): Unit[] {
  const science = subject === 'science'
  return [
    unit(`Nature, scope, history and development of ${en.toLowerCase()}`, `${te} స్వభావం, పరిధి, చరిత్ర, అభివృద్ధి`),
    unit(`Aims, values, objectives and specifications of teaching ${en.toLowerCase()}; academic standards`, `${te} బోధనా లక్ష్యాలు, విలువలు, ఉద్దేశాలు, స్పష్టీకరణలు; విద్యా ప్రమాణాలు`),
    unit(`Methods, approaches and techniques of teaching ${en.toLowerCase()}`, `${te} బోధనా పద్ధతులు, ఉపగమాలు, మెళకువలు`),
    unit('Teaching–learning material; improvised teaching aids', 'బోధనాభ్యసన సామగ్రి; స్వయం తయారీ బోధనోపకరణాలు'),
    unit(`${en} curriculum; textbook`, `${te} పాఠ్యప్రణాళిక; పాఠ్యపుస్తకం`),
    unit('Assessment and evaluation', 'మదింపు, మూల్యాంకనం'),
    unit(`${en} laboratories`, `${te} ప్రయోగశాలలు`),
    unit(`Planning in ${en.toLowerCase()} teaching – year plan, lesson plan`, `${te} బోధనలో ప్రణాళిక – వార్షిక, పాఠ్య ప్రణాళిక`),
    science
      ? unit('Role of the science teacher', 'విజ్ఞాన శాస్త్ర ఉపాధ్యాయుని పాత్ర')
      : unit('Roles and responsibilities of the social studies teacher', 'సాంఘిక శాస్త్ర ఉపాధ్యాయుని పాత్ర, బాధ్యతలు'),
    science
      ? unit('Science fairs, science clubs, field trips, science museums', 'సైన్స్ ఫెయిర్లు, సైన్స్ క్లబ్బులు, క్షేత్ర పర్యటనలు, సైన్స్ మ్యూజియంలు')
      : unit('Fairs, clubs, field trips, museums', 'ప్రదర్శనలు, క్లబ్బులు, క్షేత్ర పర్యటనలు, మ్యూజియంలు'),
  ]
}

export interface SyllabusUnitView { title: string; topics: string[] }
export interface SyllabusPartView {
  id: string
  name: string
  teluguName: string
  marks: number
  questions: number
  split?: { content: number; methodology: number }
  note?: string
  content: SyllabusUnitView[]
  methodology?: SyllabusUnitView[]
}

/** The syllabus in one medium, with the marks and names from EXAM_PARTS. */
export function syllabusFor(medium: SyllabusMedium): SyllabusPartView[] {
  const k = medium === 'telugu' ? 'te' : 'en'
  const view = (units: Unit[]) => units.map((u) => ({ title: u.title[k], topics: u.topics.map((t) => t[k]) }))
  return EXAM_PARTS.map((part) => {
    const detail = PARTS.find((p) => p.id === part.id)
    return {
      id: part.id,
      name: part.name,
      teluguName: TELUGU_NAMES[part.id] ?? part.name,
      marks: part.marks,
      questions: Math.round(part.marks / PATTERN.marks_per_question),
      split: part.split,
      note: detail?.note,
      content: detail ? view(detail.content) : [],
      methodology: detail?.methodology ? view(detail.methodology) : undefined,
    }
  })
}
