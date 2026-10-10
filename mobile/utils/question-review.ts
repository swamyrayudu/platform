export type ReviewFilter = 'all' | 'incorrect' | 'skipped' | 'marked';
export interface ReviewQuestion {
  question_id:string; question_uid?:string; question_number?:number; question:string;
  option_a:string; option_b:string; option_c:string; option_d:string;
  user_answer:string|null; correct_answer:string; explanation:string|null;
  is_correct:boolean; is_skipped:boolean; is_marked:boolean; edited_since_attempt?:boolean;
}
export function selectReviewQuestions<T extends ReviewQuestion>(questions:T[], filter:ReviewFilter) {
  // Number and identity belong to the original paper, not the filtered list.
  return questions.map((question,index)=>({question,number:question.question_number??index+1,key:`${question.question_uid||question.question_id}:${index}`})).filter(({question})=>
    filter==='all'||filter==='incorrect'&&!question.is_correct&&!question.is_skipped||filter==='skipped'&&question.is_skipped||filter==='marked'&&question.is_marked);
}
