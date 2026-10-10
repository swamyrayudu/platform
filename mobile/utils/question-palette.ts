import type { DraftAnswer, ExamQuestion } from '../store/exam';

export type PaletteFilter = 'all' | 'unanswered' | 'marked' | 'answered';
export function paletteCounts(questions:ExamQuestion[],answers:Record<string,DraftAnswer>) {
  const answered=questions.filter(question=>!!answers[question.key]?.option).length;
  return {all:questions.length,answered,unanswered:questions.length-answered,marked:questions.filter(question=>answers[question.key]?.marked).length};
}
export function paletteSections(questions:ExamQuestion[],answers:Record<string,DraftAnswer>,filter:PaletteFilter) {
  const sections=new Map<string,{id:string;title:string;questions:{question:ExamQuestion;index:number}[]}>();
  questions.forEach((question,index)=>{
    const answer=answers[question.key];
    if(filter==='unanswered'&&answer?.option||filter==='answered'&&!answer?.option||filter==='marked'&&!answer?.marked)return;
    const title=question.section||question.subject||'Questions';
    const id=question.sectionId||title;
    if(!sections.has(id))sections.set(id,{id,title,questions:[]});
    sections.get(id)!.questions.push({question,index});
  });
  return [...sections.values()];
}
export function paletteGeometry(availableWidth:number,fontScale=1) {
  const width=Math.max(0,Math.min(420,Math.max(Math.min(availableWidth-24,320),availableWidth*.75)));
  const contentWidth=Math.max(0,width-33); // panel padding plus its one-point border
  const target=Math.max(44,Math.ceil(32*fontScale));
  const columns=Math.max(1,Math.min(7,Math.floor((contentWidth+6)/(target+6))));
  return {width,columns,cellWidth:Math.floor((contentWidth-6*(columns-1))/columns),cellHeight:target};
}
