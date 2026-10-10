// The website's Bloom palette, adapted to native controls.
export const colors = {
  background: '#F2F0EB', card: '#FFFFFF', primary: '#2E2B55', primarySoft: '#EBE9F7',
  gold: '#A8792F', soft: '#F0E3CB', ink: '#1B1A2E', muted: '#5A5770',
  border: '#E4E1DA', green: '#18734B', greenSoft: '#EAF4EE', red: '#C0442F', redSoft: '#FBEDE9', purple: '#6F66BA',
};

export function subjectStyle(name: string) {
  const value = name.toLowerCase();
  if (/english|ఇంగ్లీష్/.test(value)) return { color: '#4F8B81', icon: 'language-outline' as const, tag: 'Grammar & Pedagogy' };
  if (/telugu|తెలుగు/.test(value)) return { color: '#B3835A', icon: 'book-outline' as const, tag: 'వ్యాకరణం & సాహిత్యం' };
  if (/math|గణిత/.test(value)) return { color: '#8B7FD0', icon: 'calculator-outline' as const, tag: 'Arithmetic & Geometry' };
  if (/science|సైన్స్/.test(value)) return { color: '#74945A', icon: 'flask-outline' as const, tag: 'Biology & Physics' };
  if (/social|సాంఘిక/.test(value)) return { color: '#BD7F52', icon: 'earth-outline' as const, tag: 'Geography & Polity' };
  if (/psychology|pedagogy|మనోవి/.test(value)) return { color: '#A06D9C', icon: 'bulb-outline' as const, tag: 'Psychology & Perspectives' };
  if (/perspective|దృక్పథ/.test(value)) return { color: '#6F66BA', icon: 'school-outline' as const, tag: 'Education & Teaching' };
  return { color: '#5878B8', icon: 'newspaper-outline' as const, tag: 'Syllabus-aligned practice' };
}
