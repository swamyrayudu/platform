export type ReviewFilter = 'all' | 'incorrect' | 'skipped' | 'marked';
export interface ReviewQuestion {
  question_id:string; question_uid?:string; question_number?:number; question:string;
  option_a:string; option_b:string; option_c:string; option_d:string;
  user_answer:string|null; correct_answer:string; explanation:string|null;
  is_correct:boolean; is_skipped:boolean; is_marked:boolean; edited_since_attempt?:boolean;
  subject?:string; section_id?:string; section_name?:string;
}
export const REVIEW_PAGE_SIZE = 10;
export interface ReviewSubject { value:string; label:string; count:number }
function questionSubject(question:ReviewQuestion) {
  const subject=question.subject?.trim();
  const section=question.section_id?.trim();
  return {
    value:section?`section:${section}`:subject?`subject:${subject}`:'unknown',
    label:question.section_name?.trim()||subject||'Other questions',
  };
}
export function reviewSubjects(questions:ReviewQuestion[]):ReviewSubject[] {
  const subjects=new Map<string,ReviewSubject>();
  for(const question of questions){
    const {value,label}=questionSubject(question);
    const existing=subjects.get(value);
    if(existing)existing.count++;
    else subjects.set(value,{value,label,count:1});
  }
  return [...subjects.values()];
}
export function selectReviewQuestions<T extends ReviewQuestion>(questions:T[], filter:ReviewFilter, subject='') {
  // Number and identity belong to the original paper, not the filtered list.
  return questions.map((question,index)=>({question,number:question.question_number??index+1,key:`${question.question_uid||question.question_id}:${index}`})).filter(({question})=>
    (!subject||questionSubject(question).value===subject)&&(filter==='all'||filter==='incorrect'&&!question.is_correct&&!question.is_skipped||filter==='skipped'&&question.is_skipped||filter==='marked'&&question.is_marked));
}
export function reviewPage<T>(rows:T[], requestedPage:number) {
  const total=rows.length;
  const pages=Math.ceil(total/REVIEW_PAGE_SIZE);
  const page=pages?Math.max(1,Math.min(pages,Math.floor(requestedPage)||1)):0;
  const start=page?(page-1)*REVIEW_PAGE_SIZE:0;
  return {items:rows.slice(start,start+REVIEW_PAGE_SIZE),page,pages,total,from:total?start+1:0,to:Math.min(start+REVIEW_PAGE_SIZE,total)};
}
