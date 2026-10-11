import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
import { REVIEW_PAGE_SIZE, reviewPage, reviewSubjects, selectReviewQuestions, type ReviewQuestion } from '../utils/question-review';

function question(index:number):ReviewQuestion {
  return {question_id:`Q${index%24}`,question_uid:`bank${Math.floor(index/24)}:Q${index%24}`,question_number:index+1,section_id:index<16?'general':index<40?'psychology':'math',section_name:index<16?'General knowledge':index<40?'Classroom psychology':'Mathematics',subject:index<40?'General studies':'Mathematics',question:`Question ${index+1}`,option_a:'A',option_b:'B',option_c:'C',option_d:'D',user_answer:index%3===0?null:index%3===1?'B':'A',correct_answer:'A',explanation:`Explanation ${index+1}`,is_correct:index%3===2,is_skipped:index%3===0,is_marked:index%5===0};
}

test('all 160 submitted questions are reachable once in bounded pages, with original answers and numbering',()=>{
  const questions=Array.from({length:160},(_,index)=>question(index));
  const rows=selectReviewQuestions(questions,'all');
  const visited:typeof rows=[];
  for(let page=1;page<=16;page++){
    const slice=reviewPage(rows,page);
    assert.equal(slice.pages,16);assert.equal(slice.page,page);
    assert.equal(slice.items.length,REVIEW_PAGE_SIZE);
    assert.equal(slice.from,(page-1)*10+1);assert.equal(slice.to,page*10);
    visited.push(...slice.items);
  }
  assert.deepEqual(visited.map(row=>row.number),Array.from({length:160},(_,index)=>index+1));
  assert.equal(new Set(visited.map(row=>row.key)).size,160);
  visited.forEach((row,index)=>assert.equal(row.question,questions[index]));
});

test('subjects use actual paper sections in order and combine with every answer filter',()=>{
  const questions=Array.from({length:160},(_,index)=>question(index));
  assert.deepEqual(reviewSubjects(questions),[
    {value:'section:general',label:'General knowledge',count:16},
    {value:'section:psychology',label:'Classroom psychology',count:24},
    {value:'section:math',label:'Mathematics',count:120},
  ]);
  for(const filter of ['all','incorrect','skipped','marked'] as const){
    const rows=selectReviewQuestions(questions,filter,'section:psychology');
    const expected=questions.filter(q=>q.section_id==='psychology'&&(filter==='all'||filter==='incorrect'&&!q.is_correct&&!q.is_skipped||filter==='skipped'&&q.is_skipped||filter==='marked'&&q.is_marked));
    assert.deepEqual(rows.map(row=>row.question),expected);
    assert.deepEqual(rows.map(row=>row.number),expected.map(q=>q.question_number));
    for(const row of rows)assert.equal(row.key,selectReviewQuestions(questions,'all').find(all=>all.question===row.question)!.key);
  }
});

test('practice subject fallback keeps global numbers, and subject keys cannot collide with section keys',()=>{
  const questions=[
    {...question(0),section_id:undefined,section_name:undefined,subject:'Mathematics',question_number:undefined},
    {...question(1),section_id:undefined,section_name:undefined,subject:'Science',question_number:undefined},
    {...question(2),section_id:'Mathematics',section_name:'Other math section',subject:'Mathematics',question_number:undefined},
  ];
  assert.equal(reviewSubjects(questions).length,3);
  assert.deepEqual(selectReviewQuestions(questions,'all','subject:Science').map(row=>row.number),[2]);
  assert.deepEqual(selectReviewQuestions(questions,'all','section:Mathematics').map(row=>row.number),[3]);
  assert.deepEqual(reviewSubjects([]),[]);
});

test('partial, empty and refreshed pages clamp safely without fabricating questions',()=>{
  const rows=selectReviewQuestions(Array.from({length:24},(_,index)=>question(index)),'all');
  const last=reviewPage(rows,99);
  assert.equal(last.page,3);assert.equal(last.pages,3);assert.equal(last.from,21);assert.equal(last.to,24);
  assert.deepEqual(last.items.map(row=>row.number),[21,22,23,24]);
  assert.equal(reviewPage(rows,-1).page,1);
  assert.equal(reviewPage(rows,NaN).page,1);
  assert.equal(reviewPage(rows.slice(0,4),3).page,1);
  assert.deepEqual(reviewPage([],3),{items:[],page:0,pages:0,total:0,from:0,to:0});
});

test('actual filter callbacks reset page one even when switching back to an earlier subject or verdict',()=>{
  const source=readFileSync(new URL('../app/result.tsx',import.meta.url),'utf8');
  const tree=ts.createSourceFile('result.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const callbacks=new Map<string,string>();
  function visit(node:ts.Node){
    if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&['changeSubject','changeFilter'].includes(node.name.text)&&node.initializer)callbacks.set(node.name.text,node.initializer.getText(tree));
    ts.forEachChild(node,visit);
  }
  visit(tree);
  for(const [name,current,value] of [['changeSubject','section:general','section:math'],['changeFilter','all','incorrect']]){
    let reset:unknown;let chosen:unknown;
    const context={selectedSubject:current,filter:current,scrollRequested:{current:false},setPageState:(next:unknown)=>{reset=next;},setSubject:(next:unknown)=>{chosen=next;},setFilter:(next:unknown)=>{chosen=next;}};
    const js=ts.transpileModule(`const callback=${callbacks.get(name)};callback;`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    const change=vm.runInNewContext(js,context);
    change(value);
    assert.deepEqual(structuredClone(reset),{scope:'',page:1});
    assert.equal(chosen,value);assert.equal(context.scrollRequested.current,true);
    reset=undefined;change(current);assert.equal(reset,undefined);
  }
});
