import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paletteCounts, paletteGeometry, paletteSections } from '../utils/question-palette';
import type { DraftAnswer, ExamQuestion } from '../store/exam';

const makeQuestion=(key:string,number:number,section:string,sectionId?:string):ExamQuestion=>({key,number,section,sectionId,subject:'English',topic:'Grammar',question:'Sample',option_a:'A',option_b:'B',option_c:'C',option_d:'D'});
const answer=(option:DraftAnswer['option'],marked=false):DraftAnswer=>({option,marked,seconds:1,revision:1});
test('palette filters retain original jump indices and distinguish source identities with the same raw question ID',()=>{
  const questions=[makeQuestion('gk:Q1',1,'General Knowledge','gk'),makeQuestion('gk:Q2',2,'General Knowledge','gk'),makeQuestion('english:Q1',65,'English','english'),makeQuestion('english:Q2',66,'English','english')];
  const answers={'gk:Q1':answer('A'),'gk:Q2':answer(null,true),'english:Q1':answer('B',true),orphan:answer('D',true)};
  assert.deepEqual(paletteCounts(questions,answers),{all:4,answered:2,unanswered:2,marked:2});
  assert.deepEqual(paletteSections(questions,answers,'all').map(section=>[section.id,section.questions.length]),[['gk',2],['english',2]]);
  assert.deepEqual(paletteSections(questions,answers,'unanswered').flatMap(section=>section.questions.map(row=>row.index)),[1,3]);
  assert.deepEqual(paletteSections(questions,answers,'marked').flatMap(section=>section.questions.map(row=>row.question.number)),[2,65]);
  assert.deepEqual(paletteSections(questions,answers,'answered').flatMap(section=>section.questions.map(row=>row.question.key)),['gk:Q1','english:Q1']);
  answers['gk:Q1']=answer(null);
  assert.equal(paletteCounts(questions,answers).unanswered,3);
});
test('160-question papers group every question exactly once and older saved drafts work without section IDs',()=>{
  const sectionSizes=[16,8,16,24,24,24,24,24];let number=0;
  const questions=sectionSizes.flatMap((size,section)=>Array.from({length:size},()=>makeQuestion(`section${section}:${++number}`,number,`Section ${section}`)));
  const sections=paletteSections(questions,{},'all');
  assert.equal(sections.length,8);
  assert.deepEqual(sections.map(section=>section.questions.length),sectionSizes);
  assert.equal(new Set(sections.flatMap(section=>section.questions.map(row=>row.index))).size,160);
  assert.equal(sections.at(-1)?.questions.at(-1)?.index,159);
  assert.deepEqual(paletteSections(questions,{},'answered'),[]);
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
