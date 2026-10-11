import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Performance, Proficiency } from '../types/analytics';
import type { WeakAreaRecommendation } from '../types/practice';
import { pieRotations, progressFocus, progressLayout, progressPracticeSubject, progressSummary } from '../utils/progress-summary';

function subject(name:string,total:number,correct:number):Proficiency {
  return {subject:name,attempted:total,correct,accuracy_pct:100*correct/total,status:'Moderate'};
}
function performance(subjects:Proficiency[]):Performance {
  const total=subjects.reduce((n,s)=>n+s.attempted,0);const correct=subjects.reduce((n,s)=>n+s.correct,0);
  return {has_data:total>0,overall_accuracy_pct:total?100*correct/total:0,accuracy_delta_pct:null,mocks_completed:0,avg_mock_score:0,mock_total_marks:80,best_rank:null,best_percentile:null,questions_attempted:total,subjects_covered:subjects.length,subject_breakdown:subjects,recent_attempts:[],weak_areas:[]};
}
function topic(name:string,topic:string):WeakAreaRecommendation {
  return {subject:name,topic,total_attempted:10,accuracy_pct:40,incorrect_count:6,recommended_question_count:10,action_label:'Practise'};
}

test('progress pie uses weighted question counts, including non-correct mock questions, instead of averaging subject percentages',()=>{
  const summary=progressSummary(performance([subject('Science',10,10),subject('English',160,40)]));
  assert.equal(summary.total,170);assert.equal(summary.correct,50);assert.equal(summary.remaining,120);
  assert.equal(summary.accuracy,100*50/170);
  assert.notEqual(summary.accuracy,62.5);
  assert.deepEqual(progressSummary(performance([])),{total:0,correct:0,remaining:0,accuracy:null});
  assert.equal(progressSummary(performance([subject('Telugu',160,0)])).accuracy,0);
  assert.equal(progressSummary(performance([subject('Science',10,10)])).accuracy,100);
});

test('native pie fills the correct clockwise fraction at arbitrary and extreme percentages',()=>{
  for(const percent of [0,.5,17,25,49,50,63,75,99.5,100]){
    const rotation=pieRotations(percent);
    assert.ok(rotation.right>=0&&rotation.right<=180);assert.ok(rotation.left>=0&&rotation.left<=180);
    assert.ok(Math.abs(rotation.right+rotation.left-percent*3.6)<1e-8);
    // A point's angle starts at the top and moves clockwise. Inverse-rotate it
    // into the coloured half of the actual clipped disc used by the component.
    for(let angle=.3;angle<360;angle+=1.7){
      const radians=angle*Math.PI/180;const x=Math.sin(radians);const y=-Math.cos(radians);
      const rotate=(degrees:number)=>x*Math.cos(degrees*Math.PI/180)+y*Math.sin(degrees*Math.PI/180);
      const green=x>=0?rotate(rotation.right)<0:rotation.left>0&&rotate(rotation.left)>0;
      assert.equal(green,angle<percent*3.6,`${percent}% at ${angle} degrees`);
    }
  }
  assert.deepEqual(pieRotations(NaN),{right:0,left:0});
  assert.deepEqual(pieRotations(-20),{right:0,left:0});
  assert.deepEqual(pieRotations(120),{right:180,left:180});
});

test('next practice chooses the weakest available subject and a matching real topic without mutating server order',()=>{
  const data=performance([subject('Science',10,4),subject('English (Language II)',10,2)]);
  data.weak_areas=[...data.subject_breakdown];
  const recommendation=progressFocus(data,[topic('Science','Plants'),topic('English','Articles')]);
  assert.deepEqual(recommendation,{subject:'English',label:'English',topic:'Articles'});
  assert.equal(data.weak_areas[0].subject,'Science');
  assert.deepEqual(progressFocus(data,[topic('Science','Plants')]),{subject:'English',label:'English',topic:undefined});
  assert.deepEqual(progressFocus(performance([]),[topic('General science','Plants')]),{subject:'Science',label:'General science',topic:'Plants'});
  assert.equal(progressFocus(performance([]),[topic('Unknown bank','Unknown topic')]),null);
});

test('progress practice links map website analytics labels to existing subject choices only',()=>{
  assert.equal(progressPracticeSubject('English (Language II)'),'English');
  assert.equal(progressPracticeSubject('Telugu (Language I)'),'Telugu');
  assert.equal(progressPracticeSubject('Educational Psychology & Pedagogy'),'Educational Psychology + Perspectives in Education');
  assert.equal(progressPracticeSubject('Perspectives in Education'),'Educational Psychology + Perspectives in Education');
  assert.equal(progressPracticeSubject('Random subject'),null);
});

test('progress chart and equal stat tiles fit narrow phones, landscape and larger text',()=>{
  for(const width of [180,232,280,320,400,680])for(const scale of [1,1.5,2,3]){
    const layout=progressLayout(width,scale);
    assert.ok(layout.chartSize<=width&&layout.chartSize<=180);
    assert.ok(layout.statWidth<=width&&layout.statWidth>=0);
    if(!layout.stackedChart)assert.ok(layout.chartSize+16+170*scale<=width);
    if(width<240*scale+10)assert.equal(layout.statWidth,width);
    else assert.ok(2*layout.statWidth+10<=width);
  }
});
