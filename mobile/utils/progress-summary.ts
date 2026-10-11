import type { Performance } from '../types/analytics';
import type { WeakAreaRecommendation } from '../types/practice';
import { websitePracticeSubject } from './practice-subjects';

const practiceAliases:Record<string,string>={
  'english (language ii)':'English',
  'telugu (language i)':'Telugu',
  'educational psychology & pedagogy':'Educational Psychology + Perspectives in Education',
  'classroom psychology':'Educational Psychology + Perspectives in Education',
};
export function progressPracticeSubject(subject:string) {
  const key=subject.trim().toLowerCase();
  return websitePracticeSubject(subject)||(Object.hasOwn(practiceAliases,key)?practiceAliases[key]:null);
}
export function progressSubjectLabel(subject:string) {
  const labels:Record<string,string>={
    'English (Language II)':'English',
    'Telugu (Language I)':'Telugu',
    'Educational Psychology & Pedagogy':'Psychology & Pedagogy',
  };
  return Object.hasOwn(labels,subject)?labels[subject]:subject;
}

export function progressSummary(data:Performance) {
  // The API combines practice attempts and entire submitted mock sections.
  // Non-correct mock questions include skipped answers; never label all Wrong.
  const total=data.subject_breakdown.reduce((sum,item)=>sum+item.attempted,0);
  const correct=data.subject_breakdown.reduce((sum,item)=>sum+item.correct,0);
  return {total,correct,remaining:total-correct,accuracy:total?100*correct/total:null};
}

export function progressFocus(data:Performance,recommendations:WeakAreaRecommendation[]) {
  const weak=[...data.weak_areas].sort((a,b)=>a.accuracy_pct-b.accuracy_pct);
  const subject=weak.find(item=>progressPracticeSubject(item.subject));
  const practiceSubject=subject?progressPracticeSubject(subject.subject):null;
  const topic=recommendations.find(item=>progressPracticeSubject(item.subject)&&(practiceSubject===null||progressPracticeSubject(item.subject)===practiceSubject));
  if(topic)return {subject:progressPracticeSubject(topic.subject)!,label:progressSubjectLabel(topic.subject),topic:topic.topic};
  if(subject)return {subject:practiceSubject!,label:progressSubjectLabel(subject.subject),topic:undefined};
  return null;
}

export function pieRotations(percent:number) {
  const angle=Math.max(0,Math.min(100,Number.isFinite(percent)?percent:0))*3.6;
  return {right:Math.min(180,angle),left:Math.max(0,angle-180)};
}
export function progressLayout(width:number,fontScale=1) {
  const available=Math.max(0,width);
  const scale=Math.max(1,fontScale);
  const chartSize=Math.min(180,available);
  const columns=available>=2*120*scale+10?2:1;
  return {chartSize,stackedChart:available<chartSize+16+170*scale,statWidth:Math.max(0,Math.floor((available-(columns-1)*10)/columns))};
}
