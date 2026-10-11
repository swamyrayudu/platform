import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paletteCounts, paletteGeometry, paletteSections, paletteRows } from '../utils/question-palette';
import type { DraftAnswer, ExamQuestion } from '../store/exam';

const makeQuestion=(key:string,number:number,section:string,sectionId?:string):ExamQuestion=>({key,number,section,sectionId,subject:'English',topic:'Grammar',question:'Sample',option_a:'A',option_b:'B',option_c:'C',option_d:'D'});
const answer=(option:DraftAnswer['option'],marked=false):DraftAnswer=>({option,marked,seconds:1,revision:1});
test('all-question palette retains original jump indices and distinguishes source identities with the same raw question ID',()=>{
  const questions=[makeQuestion('gk:Q1',1,'General Knowledge','gk'),makeQuestion('gk:Q2',2,'General Knowledge','gk'),makeQuestion('english:Q1',65,'English','english'),makeQuestion('english:Q2',66,'English','english')];
  const answers={'gk:Q1':answer('A'),'gk:Q2':answer(null,true),'english:Q1':answer('B',true),orphan:answer('D',true)};
  assert.deepEqual(paletteCounts(questions,answers),{all:4,answered:2,unanswered:2,marked:2});
  const sections=paletteSections(questions);
  assert.deepEqual(sections.map(section=>[section.id,section.questions.length]),[['gk',2],['english',2]]);
  assert.deepEqual(sections.flatMap(section=>section.questions.map(row=>row.index)),[0,1,2,3]);
  assert.deepEqual(sections.flatMap(section=>section.questions.map(row=>row.question.key)),['gk:Q1','gk:Q2','english:Q1','english:Q2']);
  answers['gk:Q1']=answer(null);
  assert.equal(paletteCounts(questions,answers).unanswered,3);
});
test('160-question papers group every question exactly once and older saved drafts work without section IDs',()=>{
  const sectionSizes=[16,8,16,24,24,24,24,24];let number=0;
  const questions=sectionSizes.flatMap((size,section)=>Array.from({length:size},()=>makeQuestion(`section${section}:${++number}`,number,`Section ${section}`)));
  const sections=paletteSections(questions);
  assert.equal(sections.length,8);
  assert.deepEqual(sections.map(section=>section.questions.length),sectionSizes);
  assert.equal(new Set(sections.flatMap(section=>section.questions.map(row=>row.index))).size,160);
  assert.equal(sections.at(-1)?.questions.at(-1)?.index,159);
  assert.deepEqual(paletteSections([]),[]);
});
test('progressive drawer rows reach all 160 questions without duplicates or lost jump indices across phone sizes',()=>{
  const sectionSizes=[16,8,16,24,24,24,24,24];let number=0;
  const questions=sectionSizes.flatMap((size,section)=>Array.from({length:size},()=>makeQuestion(`section${section}:${++number}`,number,`Section ${section}`)));
  for(const width of [280,360,414,768])for(const scale of [1,1.3,2]){
    const geometry=paletteGeometry(width,scale),rows=paletteRows(questions,geometry.columns,geometry.cellHeight,scale);
    assert.equal(new Set(rows.map(row=>row.key)).size,rows.length);
    assert.equal(rows.filter(row=>row.type==='heading').length,8);
    let offset=0;
    for(const row of rows){assert.equal(row.offset,offset);assert.ok(row.height>0);offset+=row.height;if(row.type==='questions')assert.ok(row.questions.length<=geometry.columns);}
    const initial=rows.slice(0,10).flatMap(row=>row.type==='questions'?row.questions:[]);
    assert.ok(initial.length>0&&initial.length<160);
    const loaded=[];
    for(let page=0;page<rows.length;page+=10)loaded.push(...rows.slice(page,page+10).flatMap(row=>row.type==='questions'?row.questions:[]));
    assert.deepEqual(loaded.map(row=>row.index),Array.from({length:160},(_,index)=>index));
    assert.deepEqual(loaded.map(row=>row.question.key),questions.map(question=>question.key));
  }
});
test('palette geometry keeps the overlay visible and all touch targets inside narrow, wide and large-text layouts',()=>{
  for(const width of [280,320,360,390,414,480,768,1024])for(const scale of [1,1.3,2]){
    const layout=paletteGeometry(width,scale);
    assert.ok(layout.width<=width-24&&layout.width<=420);
    assert.ok(layout.columns>=1&&layout.columns<=7);
    assert.ok(layout.cellWidth>=44);
    assert.ok(layout.cellHeight>=44&&layout.cellHeight>=32*scale);
    assert.ok(layout.columns*layout.cellWidth+(layout.columns-1)*6<=layout.width-33+.001);
  }
});
