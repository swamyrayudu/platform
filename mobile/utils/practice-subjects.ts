// Match the website's practice/setup/SubjectSelector SUBJECT_LIST.
// Raw question-bank subject names are not additional practice choices.
export const PRACTICE_SUBJECTS = [
  {name:'English',teluguName:'ఇంగ్లీష్ (భాష II)'},
  {name:'Telugu',teluguName:'తెలుగు (భాష I)'},
  {name:'Mathematics',teluguName:'గణితం'},
  {name:'Science',teluguName:'సాధారణ సైన్స్'},
  {name:'Social Studies',teluguName:'సాంఘిక శాస్త్రం'},
  {name:'Educational Psychology + Perspectives in Education',teluguName:'విద్యా మనోవిజ్ఞాన శాస్త్రం & విద్యా దృక్పథాలు'},
  {name:'GK & Current Affairs',teluguName:'సాధారణ జ్ఞానం & వర్తమాన వ్యవహారాలు'},
] as const;
type PracticeSubject = typeof PRACTICE_SUBJECTS[number]['name'];
// Existing backend registry aliases may occur in saved weak-topic links.
// Resolve them to a website group instead of adding a separate tile.
const aliases:Record<string,PracticeSubject>={
  math:'Mathematics',maths:'Mathematics','గణిత శాస్త్రం':'Mathematics','telugu medium math':'Mathematics','telugu medium mathematics':'Mathematics',
  pedagogy:'Educational Psychology + Perspectives in Education','educational psychology':'Educational Psychology + Perspectives in Education','perspectives in education':'Educational Psychology + Perspectives in Education',psychology:'Educational Psychology + Perspectives in Education',cdp:'Educational Psychology + Perspectives in Education','child development':'Educational Psychology + Perspectives in Education',
  'educational psychology & perspectives in education':'Educational Psychology + Perspectives in Education','educational psychology and perspectives in education':'Educational Psychology + Perspectives in Education','సైకాలజీ & బోధన':'Educational Psychology + Perspectives in Education','సైకాలజీ':'Educational Psychology + Perspectives in Education','విద్యా దృక్పథాలు':'Educational Psychology + Perspectives in Education','విద్యా మనోవిజ్ఞాన శాస్త్రం':'Educational Psychology + Perspectives in Education',
  sci:'Science','general science':'Science','సైన్స్':'Science','భౌతిక రసాయన శాస్త్రాలు':'Science','జీవశాస్త్రం':'Science','biological science':'Science','physical science':'Science','telugu medium science':'Science','english medium science':'Science',evs:'Science','పరిసరాల విజ్ఞానం':'Science',
  gk:'GK & Current Affairs','current affairs':'GK & Current Affairs','general knowledge':'GK & Current Affairs','general knowledge & current affairs':'GK & Current Affairs','gk & ca':'GK & Current Affairs','gk and current affairs':'GK & Current Affairs','సాధారణ జ్ఞానం':'GK & Current Affairs','వర్తమాన వ్యవహారాలు':'GK & Current Affairs',gk_english_medium:'GK & Current Affairs',gk_telugu_medium:'GK & Current Affairs',
};
export function websitePracticeSubject(value:string|undefined):PracticeSubject|null {
  const key=value?.trim().toLowerCase();
  if(!key)return null;
  return PRACTICE_SUBJECTS.find(subject=>subject.name.toLowerCase()===key||subject.teluguName.toLowerCase()===key)?.name
    ?? (Object.hasOwn(aliases,key)?aliases[key]:null);
}

// The existing AP SGT blueprint includes methodology within these sections;
// it is not an additional practice subject or an extra set of exam marks.
const methodologySubjects=new Set<PracticeSubject>(['English','Telugu','Mathematics','Science','Social Studies']);
export function hasSubjectMethodology(value:string|undefined) {
  const subject=websitePracticeSubject(value);
  return subject!==null&&methodologySubjects.has(subject);
}
export function methodologyLabel(medium:'english'|'telugu'='english') {
  return medium==='telugu'?'విషయ జ్ఞానం + మెథడాలజీ':'Content + Methodology';
}
