// ============================================================
// lib/roadmap-practice.ts — What a roadmap day's Practice button opens
// ============================================================
// Each Phase 1 study unit names its practice subject and keywords that pick
// the matching topics out of the question bank's live topic list (topic
// names differ by table and medium, and grow as questions are added, so they
// are matched, not listed). Used by lib/study-plan.ts, the website's practice
// setup and, through /api/dsc-sgt/roadmap, the mobile app.
//
// A key matches a topic name, ignoring case:
//   "=name"  the whole name
//   Latin    at the start of a word ("angles" matches "Types of angles",
//            "iq" does not match "technique")
//   Telugu   anywhere in the name
// ============================================================

export interface RoadmapPractice {
  /** A practice subject id (app/components/dsc-sgt/practice/setup/SubjectSelector.tsx). */
  subject: string
  keys: string[]
}

type Spec = { subject: string | { en: string; te: string }; keys: string[] }

const PSY = 'Educational Psychology + Perspectives in Education'
// Telugu-medium Perspectives questions are kept with Social Studies.
const PERSP = { en: PSY, te: 'Social Studies' }
const GK = 'GK & Current Affairs'
const TELUGU_BIOLOGY = 'జీవశాస్త్రం'

/** By the unit's English title (lib/study-plan.ts). */
const SPECS: Record<string, Spec> = {
  // Educational Psychology
  'Development of the child I': { subject: PSY, keys: ['growth', 'maturation', 'principles of development', 'heredity', 'వృద్ధి', 'వికాస సూత్రాలు', 'వారసత్వం', 'పర్యావరణం', 'జీవశాస్త్రీయ కారకాలు', 'మానసిక కారకాలు', 'సామాజిక కారకాలు', 'భావోద్వేగ కారకాలు'] },
  'Development of the child II': { subject: PSY, keys: ['piaget', 'kohlberg', 'erikson', 'language and humanistic', 'chomsky', 'rogers', 'పియాజే', 'కోల్బర్గ్', 'ఎరిక్సన్', 'చోమ్స్కీ', 'రోగర్స్', 'భాషా వికాసం', 'శారీరక', 'జ్ఞానాత్మక వికాసం', 'భావోద్వేగ వికాసం', 'సామాజిక వికాసం', 'నైతిక వికాసం', 'శైశవ', 'బాల్యం', 'కౌమార'] },
  'Individual differences': { subject: PSY, keys: ['intelligence', 'creativity', 'individual differences', 'మేధస్సు', 'గార్డ్నర్', 'గోల్మన్', 'iq', 'సృజనాత్మకత', 'అభిరుచి', 'ఆప్టిట్యూడ్', 'వైఖరి', 'అలవాట్లు', 'వ్యక్తిగత భేదాలు'] },
  'Learning I': { subject: PSY, keys: ['behaviourist', 'constructivism', 'learning theories', 'థార్న్‌డైక్', 'పావ్‌లోవ్', 'స్కిన్నర్', 'బండూరా', 'కోహ్లర్', 'వైగోట్స్కీ', 'నిర్మాణవాదం', 'అభ్యసన స్వభావం', 'అభ్యసన వక్రాలు', 'అభ్యసన కారకాలు', 'అభ్యసన దశలు', 'అభ్యసన పరిమాణాలు', 'అభ్యసన రకాలు', 'బదిలీ'] },
  'Learning II': { subject: PSY, keys: ['memory', 'inclusive', 'స్మృతి', 'మరచిపోవడం', 'సమగ్ర విద్య', 'అభ్యసన మూల్యాంకనం', 'ఫార్మేటివ్', 'సమ్మేటివ్', 'నిర్ధారణాత్మక', 'ప్రతిభావంతులు', 'నెమ్మదిగా', 'వినికిడి', 'దృష్టి లోపం', 'అభ్యసన లోపాలు', 'ప్రత్యేక అవసరాల'] },
  'Personality': { subject: PSY, keys: ['personality', 'వ్యక్తిత్వ', 'మానసిక ఆరోగ్యం', 'సర్దుబాటు', 'ఒత్తిడి', 'భావోద్వేగ మేధస్సు', 'భావోద్వేగాల నిర్వహణ'] },

  // Perspectives in Education
  'History of Education': { subject: PERSP, keys: ['education in india', 'ancient and medieval education', 'వలస కాల విద్య', 'స్వాతంత్ర్యానంతర విద్య'] },
  'Teachers and educational concerns': { subject: PERSP, keys: ['teacher professional', 'contemporary educational issues', 'ఉపాధ్యాయ సాధికారత'] },
  'Programmes, acts and policies': { subject: PERSP, keys: ['programmes and projects', 'right to education', 'perspectives and guiding principles', 'school education', 'విద్యా కార్యక్రమాలు', 'విద్యా హక్కు', 'విద్యా ప్రోత్సాహకాలు'] },

  // GK
  'Andhra Pradesh GK': { subject: GK, keys: ['andhra', 'ఆంధ్ర', 'indian geography', 'rivers', 'dams', 'నదులు'] },
  'Indian polity and economy': { subject: GK, keys: ['constitution', 'polity', 'parliament', 'amendments', 'economy', 'banking', 'presidents', 'రాజ్యాంగ', 'ఆర్థిక'] },
  'India and the world': { subject: GK, keys: ['world geography', 'physical geography', 'countries', 'currencies', 'national movement', 'modern india', 'ancient india', 'medieval india', 'international organi', 'united nations', 'దేశాల', 'దేశాలు', 'ఖండాలు', 'ప్రపంచ', 'సమయ మండలాలు', 'భౌగోళిక', 'సంస్థలు'] },
  'Science, sports and awards': { subject: GK, keys: ['biology', 'physics', 'chemistry', 'general science', 'space', 'isro', 'awards', 'padma', 'nobel', 'sports', 'icc', 'olympics', 'books', 'important days', 'observances', 'రసాయన', 'క్రీడా', 'పుస్తకాలు', 'దినోత్సవాలు', 'అంతరిక్షం'] },

  // Mathematics
  'Numbers I': { subject: 'Mathematics', keys: ['four fundamental', 'numeration', 'place value', 'comparing', 'whole numbers', 'even and odd', 'prime', 'factors and multiples', 'common factors', 'divisibility', 'hcf', 'lcm', 'ప్రాథమిక గణిత క్రియలు', 'స్థాన విలువ', 'సంఖ్యా అవగాహన', 'సంఖ్యలు మరియు గుణకాలు', 'విభాజ్యత', 'కారకాలు మరియు గుణితాలు'] },
  'Numbers II': { subject: 'Mathematics', keys: ['integers', 'fractions', 'decimals', 'rational', 'reciprocals', 'squares', 'square roots', 'cubes', 'cube roots', 'playing with numbers', 'letters for digits', 'భిన్నాలు', 'వర్గాలు', 'హేతుబద్ధ'] },
  'Arithmetic': { subject: 'Mathematics', keys: ['ratio', 'proportion', 'percentage', 'profit', 'discount', 'sales tax', 'interest', 'అనువర్తనాలు', 'వడ్డీ', 'నిష్పత్తి', 'శాతం', 'శాతాలు', 'లాభ'] },
  'Geometry': { subject: 'Mathematics', keys: ['basic geometry', 'pairs of lines', 'angles', 'angle sum', 'triangles', 'polygons', 'quadrilateral', 'special parallelograms', '3d', 'edges', 'euler', 'nets', 'త్రిభుజాలు', 'కోణాలు', 'చతుర్భుజాలు', 'వృత్తాలు'] },
  'Algebra': { subject: 'Mathematics', keys: ['patterns', 'variables', 'algebraic', 'terms factors', 'linear equations', 'monomial', 'polynomial', 'identities', '=factorisation', 'exponents', 'negative exponents', 'standard form', 'linear graphs', 'value of expressions', 'వ్యక్తీకరణలు', 'సమీకరణాలు', 'ఘాతాలు', 'బీజగణిత'] },
  'Mensuration and data handling': { subject: 'Mathematics', keys: ['length weight', 'time seasons', 'symmetry', 'line symmetry', 'perimeter', 'surface area', 'volume', 'pictographs', 'bar graphs', 'double bar', 'pie charts', 'tally', 'mean', 'mode', 'median', 'probability', 'చుట్టుకొలత', 'వైశాల్యం', 'ఘనపరిమాణం', 'కొలమానాలు', 'గణాంక', 'సంభావ్యత'] },
  'Maths methodology I': { subject: 'Mathematics', keys: ['nature and definitions', 'aims values', 'methods of teaching', 'remedial', 'బోధనా శాస్త్రం'] },
  'Maths methodology II': { subject: 'Mathematics', keys: ['tlm', 'curriculum', 'evaluation and cce', 'బోధనా శాస్త్రం'] },

  // Science
  'Living world I': { subject: 'Science', keys: ['=plants', 'plant structure', 'classification', 'food chain', 'ecosystem', 'మొక్కల నిర్మాణం', 'జీవుల వర్గీకరణ', 'పర్యావరణ వ్యవస్థ', TELUGU_BIOLOGY] },
  'Living world II': { subject: 'Science', keys: ['human body', 'health', 'food and nutrition', '=food', 'vitamins', 'deficiency', 'agriculture', 'మానవ శరీరం', 'ఆరోగ్యం', 'ఆహారం', 'విటమిన్లు', TELUGU_BIOLOGY] },
  'Living world III, nutrition': { subject: 'Science', keys: ['cell', 'microorganisms', 'digestion', 'plant life processes', 'కణ', 'సూక్ష్మజీవులు', 'జీర్ణక్రియ', 'మొక్కల జీవక్రియలు', TELUGU_BIOLOGY] },
  'Life processes': { subject: 'Science', keys: ['respiration', 'blood circulation', 'transport in plants', 'excretion', 'reproduction', 'heredity', 'శ్వాసక్రియ', 'రక్త ప్రసరణ', 'మొక్కల రవాణా', 'విసర్జన', 'ప్రజననం', 'నాడీ వ్యవస్థ', 'వారసత్వం', TELUGU_BIOLOGY] },
  'Materials, motion, force, heat': { subject: 'Science', keys: ['matter', 'metals', 'acids', 'separation', 'mixtures', 'chemical reactions', 'changes', 'change of state', 'elements', 'measurements', 'motion', 'force', 'pressure', 'friction', 'heat', 'రసాయన', 'లోహాలు', 'ఆమ్లాలు', 'వేర్పాటు', 'మిశ్రమాలు', 'మార్పులు', 'స్థితి', 'కొలతలు', 'చలనం', 'బలం', 'పీడనం', 'ఉష్ణం', 'పదార్థ'] },
  'Light, electricity, magnetism, sound': { subject: 'Science', keys: ['light', 'electricity', 'magnetism', 'sound', 'కాంతి', 'విద్యుత్', 'చుంబకత్వం', 'శబ్దం', 'భౌతిక శాస్త్రం'] },
  'Fuels, nature, environment': { subject: 'Science', keys: ['combustion', 'energy sources', 'astronomy', 'solar system', 'moon', 'disasters', 'pollution', 'climate', 'weather', 'water', 'atmosphere', 'environmental', 'natural resources', 'forests', 'waste', 'దహనం', 'ఖగోళ', 'కాలుష్యం', 'వాతావరణం', 'నీరు', 'పర్యావరణ', 'వ్యర్థ'] },
  'Science methodology I': { subject: 'Science', keys: ['nature of science', 'history of science', 'teaching objectives', 'principles of teaching', 'teaching methods', 'scientific method', 'విజ్ఞాన శాస్త్ర స్వభావం', 'విజ్ఞాన చరిత్ర', 'బోధనా లక్ష్యాలు', 'బోధనా సూత్రాలు', 'బోధనా పద్ధతులు', 'శాస్త్రీయ పద్ధతి'] },
  'Science methodology II': { subject: 'Science', keys: ['teaching learning material', 'curriculum', 'assessment', 'మూల్యాంకనం', 'పాఠ్యపుస్తకాలు'] },
  'Science methodology III': { subject: 'Science', keys: ['laboratory', 'planning', 'scientific instruments', 'ప్రయోగశాల', 'ప్రణాళికా', 'శాస్త్రీయ పరికరాలు'] },

  // Social Studies
  'Our universe and maps': { subject: 'Social Studies', keys: ['latitude', 'longitude', 'earth movements', 'solar system', 'universe', 'maps', 'map skills', 'globe', 'eclipse', 'అక్షాంశాలు', 'రేఖాంశాలు', 'భూమి కదలికలు', 'సౌర కుటుంబం', 'విశ్వం', 'పటాలు', 'పట నైపుణ్యాలు', 'అంతరిక్ష'] },
  'The Earth and its resources': { subject: 'Social Studies', keys: ['interior', 'atmosphere', 'landforms', 'forest', 'soil', 'climate', 'pollution', 'disaster', 'భూమి అంతర్భాగం', 'వాయుమండలం', 'భూస్వరూపాలు', 'భూమి ఉపరితలం', 'శిలలు', 'నేలలు', 'అటవీ', 'వాతావరణం', 'పర్యావరణం', 'ఆంధ్రప్రదేశ్ భూగోళం', 'భారత నదులు'] },
  'Production, exchange, livelihoods': { subject: 'Social Studies', keys: ['migration', 'resources', 'population', 'agriculture', 'industries', 'market', 'consumer', 'transport', 'trade', 'వ్యవసాయం', 'వనరులు', 'మార్కెట్', 'ఆర్థిక రంగాలు', 'ఉత్పత్తి కారకాలు', 'వాణిజ్యం', 'డబ్బు', 'బ్యాంకింగ్', 'ప్రజా ఆర్థికం'] },
  'Early and medieval history': { subject: 'Social Studies', keys: ['early', 'stone age', 'mauryas', 'guptas', 'satavahana', 'pallava', 'chalukya', 'mahajanapada', 'south indian kingdoms', 'delhi sultanate', 'kakatiya', 'vijayanagara', 'mughals', 'మౌర్యులు', 'గుప్తులు', 'మహాజనపదాలు', 'దక్షిణ భారత రాజ్యాలు', 'మొఘలులు', 'మధ్యయుగ', 'ప్రాగైతిహాసిక'] },
  'Government and the Constitution': { subject: 'Social Studies', keys: ['parliament', 'constitution', 'elections', 'government', 'judiciary', 'rights', 'local gov', 'local self', 'village government', 'urban government', 'urban local', 'రాజ్యాంగం', 'పార్లమెంట్', 'స్థానిక ప్రభుత్వం', 'ఎన్నికలు', 'మౌలిక హక్కులు', 'న్యాయవ్యవస్థ', 'కార్యనిర్వాహక', 'సామాజిక న్యాయం', 'చట్టాలు'] },
  'Colonial rule, freedom struggle': { subject: 'Social Studies', keys: ['british', 'european', 'plassey', 'colonial', 'tribal', '1857', 'rebellion', 'national movement', 'gandhian', 'civil disobedience', 'indian national congress', 'nationalism', 'independence', 'బ్రిటిష్', 'యూరోపియన్ల', 'జాతీయ ఉద్యమం', 'స్వాతంత్ర్య దశ'] },
  'Society, religion, culture': { subject: 'Social Studies', keys: ['social reform', 'caste', 'women', 'marginal', 'religion', 'bhakti', 'sufi', 'buddhism', 'jainism', 'media', 'communication', 'indus civ', 'vedic', 'culture', 'సామాజిక సంస్కరణలు', 'సూఫీ', 'బౌద్ధం', 'జైనం', 'మీడియా', 'వేద కాలం', 'ప్రాచీన నాగరికతలు', 'ఆంధ్రప్రదేశ్ చరిత్ర'] },
  'Social studies methodology I': { subject: 'Social Studies', keys: ['dialogic', 'inquiry', 'experiential', 'source and heritage', 'geography and spatial', 'digital and active', 'learning and cognition', 'motivation and participation', 'inclusive pedagogy', 'సామాజిక శాస్త్ర బోధనా', 'అభ్యసన సిద్ధాంతాలు', 'బ్లూమ్', 'సమావేశ బోధన'] },
  'Social studies methodology II': { subject: 'Social Studies', keys: ['assessment', 'evaluation', 'curriculum and professionalism', 'మూల్యాంకనం', 'పాఠ్య ప్రణాళిక', 'బోధనా సాధనాలు', 'మూలాధారాలు'] },

  // Telugu (the paper is in Telugu in both mediums)
  'Telugu: textbook lessons': { subject: 'Telugu', keys: ['కవి', 'కవుల', 'పాఠ్యభాగ', 'సాహిత్య ప్రక్రియలు'] },
  'Telugu: vocabulary': { subject: 'Telugu', keys: ['పర్యాయ', 'నానార్థ', 'వ్యుత్పత్య', 'జాతీయాలు', 'సామెతలు', 'పొడుపు', 'పదజాలం'] },
  'Telugu grammar I': { subject: 'Telugu', keys: ['విభక్తు', 'విభక్తి', 'ఔపవిభక్తి', 'పారిభాషిక', 'సంధులు', 'కాలాలు', 'భాషాంశాలు'] },
  'Telugu grammar II': { subject: 'Telugu', keys: ['సమాసాలు', 'ఛందస్సు', 'అలంకారాలు', 'వాక్యాలు', 'భాషాంశాలు'] },
  'Telugu methodology I': { subject: 'Telugu', keys: ['తెలుగు భాషా బోధన', 'భాష — సమాజం', 'బోధన–అభ్యసనం', 'తెలుగు బోధనా పద్ధతులు'] },
  'Telugu methodology II': { subject: 'Telugu', keys: ['మాతృభాష', 'పాఠ్యపుస్తకాలు', 'భాషా సామర్థ్యాలు', 'తెలుగు బోధనా పద్ధతులు'] },
  'Telugu methodology III': { subject: 'Telugu', keys: ['బోధనా పద్ధతులు', 'ప్రణాళికా', 'బోధనాభ్యసన', 'భాషాభివృద్ధి', 'భాషా మూల్యాంకనం'] },

  // English (the paper is in English in both mediums)
  'Parts of speech, articles, prepositions': { subject: 'English', keys: ['parts of speech', 'articles'] },
  'Tenses and types of sentences': { subject: 'English', keys: ['tenses', 'types of sentences'] },
  'Pronunciation and writing': { subject: 'English', keys: ['pronunciation', 'writing'] },
  'English literature': { subject: 'English', keys: ['writers', 'poets'] },
  'English methodology I': { subject: 'English', keys: ['english methodology'] },
  'English methodology II': { subject: 'English', keys: ['english methodology'] },
  'English methodology III': { subject: 'English', keys: ['english methodology'] },
}

/** The practice a unit opens, in this medium; undefined for units without one. */
export function practiceFor(titleEn: string, medium: 'english' | 'telugu'): RoadmapPractice | undefined {
  const spec = SPECS[titleEn]
  if (!spec) return undefined
  const subject = typeof spec.subject === 'string' ? spec.subject : spec.subject[medium === 'telugu' ? 'te' : 'en']
  return { subject, keys: spec.keys }
}

/** A topic name the database stored with broken characters. */
export const isBrokenTopicName = (name: string) => name.includes('�')

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function keyMatches(key: string, name: string): boolean {
  const k = key.toLowerCase()
  const n = name.toLowerCase().trim()
  if (k.startsWith('=')) return n === k.slice(1)
  if (/^[\x00-\x7f]+$/.test(k)) return new RegExp(`(^|[^a-z0-9])${escapeRegExp(k)}`).test(n)
  return n.includes(k)
}

/** The topic names, out of those given, that a day's keys pick. */
export function matchPracticeTopics(names: readonly string[], keys: readonly string[]): string[] {
  return names.filter((name) => !isBrokenTopicName(name) && keys.some((key) => keyMatches(key, name)))
}
