import type { DraftAnswer, ExamQuestion } from '../store/exam';

export function paletteCounts(questions:ExamQuestion[],answers:Record<string,DraftAnswer>) {
  const answered=questions.filter(question=>!!answers[question.key]?.option).length;
  return {all:questions.length,answered,unanswered:questions.length-answered,marked:questions.filter(question=>answers[question.key]?.marked).length};
}
export function paletteSections(questions:ExamQuestion[]) {
  const sections=new Map<string,{id:string;title:string;questions:{question:ExamQuestion;index:number}[]}>();
  questions.forEach((question,index)=>{
    const title=question.section||question.subject||'Questions';
    const id=question.sectionId||title;
    if(!sections.has(id))sections.set(id,{id,title,questions:[]});
    sections.get(id)!.questions.push({question,index});
  });
  return [...sections.values()];
}
export type PaletteRow = { key:string; height:number; offset:number } & (
  { type:'heading'; title:string; count:number } |
  { type:'questions'; questions:{question:ExamQuestion;index:number}[] }
);
// Virtualize rows of buttons, rather than whole subjects containing dozens of
// questions. Fixed heights let the list skip measuring off-screen content.
export function paletteRows(questions:ExamQuestion[],columns:number,cellHeight:number,fontScale=1):PaletteRow[] {
  const rows:PaletteRow[]=[];let offset=0;
  for(const section of paletteSections(questions)) {
    const height=Math.ceil(34*fontScale)+14;
    rows.push({key:`heading:${section.id}`,type:'heading',title:section.title,count:section.questions.length,height,offset});offset+=height;
    for(let start=0;start<section.questions.length;start+=Math.max(1,columns)) {
      const height=cellHeight+6;
      rows.push({key:`questions:${section.questions[start].question.key}`,type:'questions',questions:section.questions.slice(start,start+Math.max(1,columns)),height,offset});offset+=height;
    }
  }
  return rows;
}
export function paletteGeometry(availableWidth:number,fontScale=1) {
  const width=Math.max(0,Math.min(420,Math.max(Math.min(availableWidth-24,320),availableWidth*.75)));
  const contentWidth=Math.max(0,width-33); // panel padding plus its one-point border
  const target=Math.max(44,Math.ceil(32*fontScale));
  const columns=Math.max(1,Math.min(7,Math.floor((contentWidth+6)/(target+6))));
  return {width,columns,cellWidth:Math.floor((contentWidth-6*(columns-1))/columns),cellHeight:target};
}
