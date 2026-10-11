import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExamJournal, elapsedSeconds, type ExamDraft } from '../store/exam';
function draft():ExamDraft {return {userId:'user',kind:'mock',id:'attempt',title:'Mock',duration:100,elapsed:20,index:0,feedbackMode:'end',questions:[{key:'table:Q1',number:1,question:'Question',option_a:'A',option_b:'B',option_c:'C',option_d:'D',subject:'English',topic:'Grammar'}],answers:{},pending:{},feedback:{},submitIntent:false,updatedAt:0};}
test('answers are durable before attempting network sync and survive failure',async()=>{
  let saved:ExamDraft|undefined;const j=new ExamJournal(draft(),{persist:async d=>{saved=d;},save:async()=>{throw new Error('offline');},state:async()=>'in_progress',submit:async()=>assert.fail()});
  await j.select('table:Q1','B',true,5);assert.equal(saved!.answers['table:Q1'].option,'B');await assert.rejects(j.flush());assert.equal(j.draft.pending['table:Q1'],1);
});
test('newer answer chosen during a save cannot be dropped by stale acknowledgement',async()=>{
  let release:()=>void=()=>{};const gate=new Promise<void>(r=>{release=r;});let count=0;const answers:string[]=[];
  const j=new ExamJournal(draft(),{persist:async()=>{},save:async(_q,a)=>{answers.push(a.option!);if(++count===1)await gate;},state:async()=>'in_progress',submit:async()=>{}});
  await j.select('table:Q1','A',false,1);const syncing=j.flush();await new Promise(r=>setTimeout(r,5));await j.select('table:Q1','C',false,2);release();await syncing;assert.deepEqual(answers,['A','C']);assert.equal(Object.keys(j.draft.pending).length,0);
});
test('lost submit response is reconciled without a duplicate submission',async()=>{
  let state='in_progress',submits=0;const j=new ExamJournal(draft(),{persist:async()=>{},save:async()=>{},state:async()=>state,submit:async()=>{submits++;state='submitted';throw new Error('lost response');}});
  await j.select('table:Q1','D',false,3);await assert.rejects(j.submit());assert.equal(j.draft.submitIntent,true);await j.submit();assert.equal(submits,1);
});
test('concurrent submit taps share one submission, with answers flushed first',async()=>{
  const events:string[]=[];const j=new ExamJournal(draft(),{persist:async()=>{},save:async()=>{events.push('answer');},state:async()=>'in_progress',submit:async()=>{events.push('submit');}});
  await j.select('table:Q1','A',false,4);await Promise.all([j.submit(),j.submit()]);assert.deepEqual(events,['answer','submit']);await assert.rejects(j.select('table:Q1','B',false,5));
});
test('state-check failure never submits or discards answers',async()=>{
  const j=new ExamJournal(draft(),{persist:async()=>{},save:async()=>assert.fail(),state:async()=>{throw new Error('offline');},submit:async()=>assert.fail()});await j.select('table:Q1','C',false,0);await assert.rejects(j.submit());assert.equal(j.draft.answers['table:Q1'].option,'C');
});
test('timer uses elapsed wall time, handles background gaps, and clamps expiry',()=>{
  assert.equal(elapsedSeconds(10,1000,16000,100),25);assert.equal(elapsedSeconds(10,1000,999999,100),100);assert.equal(elapsedSeconds(10,1000,0,100),10);assert.equal(elapsedSeconds(10,1000,999999,0),1008);
});
test('save and leave waits for durable answers, sync and pause before allowing navigation',async()=>{
  const events:string[]=[];let releasePause:()=>void=()=>{};let pauseStarted:()=>void=()=>{};
  const paused=new Promise<void>(resolve=>{releasePause=resolve;});const started=new Promise<void>(resolve=>{pauseStarted=resolve;});
  const j=new ExamJournal(draft(),{persist:async()=>{events.push('persist');},save:async()=>{events.push('answer');},state:async()=>'in_progress',submit:async()=>assert.fail()});
  await j.select('table:Q1','C',true,7);events.length=0;let mayNavigate=false;
  const leaving=j.prepareLeave(false,{abandon:async()=>assert.fail(),clear:async()=>assert.fail(),pause:async elapsed=>{assert.equal(elapsed,20);events.push('pause');pauseStarted();await paused;}}).then(()=>{mayNavigate=true;});
  await started;assert.equal(mayNavigate,false);assert.ok(events.indexOf('persist')<events.indexOf('answer'));assert.ok(events.indexOf('answer')<events.indexOf('pause'));
  releasePause();await leaving;assert.equal(mayNavigate,true);assert.equal(j.draft.answers['table:Q1'].option,'C');
});
test('failed saves or pauses keep the exam available and never approve an exit',async()=>{
  for(const failure of ['persist','answer','pause']){
    const j=new ExamJournal(draft(),{persist:async()=>{if(failure==='persist')throw new Error('storage failure');},save:async()=>{if(failure==='answer')throw new Error('offline');},state:async()=>'in_progress',submit:async()=>assert.fail()});
    j.draft.answers['table:Q1']={option:'B',marked:false,seconds:3,revision:1};j.draft.pending['table:Q1']=1;
    let mayNavigate=false;
    await assert.rejects(j.prepareLeave(false,{abandon:async()=>assert.fail(),clear:async()=>assert.fail(),pause:async()=>{if(failure==='pause')throw new Error('offline');}}).then(()=>{mayNavigate=true;}));
    assert.equal(mayNavigate,false);assert.equal(j.draft.answers['table:Q1'].option,'B');
  }
});
test('practice pause saves and sends answers and checked explanations without ending the session or calling the mock pause API',async()=>{
  const events:string[]=[];const d=draft();d.kind='practice';d.feedbackMode='instant';
  const j=new ExamJournal(d,{persist:async()=>{events.push('persist');},save:async()=>{events.push('answer');return {correct_answer:'B',explanation:'Backend explanation',is_correct:true};},state:async()=>'in_progress',submit:async()=>assert.fail()});
  await j.select('table:Q1','B',false,4);
  await j.prepareLeave(false,{abandon:async()=>assert.fail(),clear:async()=>assert.fail(),pause:async()=>assert.fail()});
  assert.ok(events.includes('answer'));assert.equal(j.draft.pending['table:Q1'],undefined);
  assert.equal(j.draft.feedback['table:Q1'].explanation,'Backend explanation');assert.equal(j.draft.elapsed,20);
  assert.equal(j.draft.submitIntent,false);
});
test('ending an exam clears the local draft only after the server accepts it',async()=>{
  const j=new ExamJournal(draft(),{persist:async()=>{},save:async()=>assert.fail(),state:async()=>'in_progress',submit:async()=>assert.fail()});let cleared=false;
  await assert.rejects(j.prepareLeave(true,{abandon:async()=>{throw new Error('offline');},clear:async()=>{cleared=true;},pause:async()=>assert.fail()}));
  assert.equal(cleared,false);
  await j.prepareLeave(true,{abandon:async()=>{},clear:async()=>{cleared=true;},pause:async()=>assert.fail()});assert.equal(cleared,true);
});
test('checked instant-feedback answers stay locked while review flags remain editable',async()=>{
  const d=draft();d.kind='practice';d.feedbackMode='instant';
  const checked={correct_answer:'B',explanation:'Server explanation',is_correct:true};
  const j=new ExamJournal(d,{persist:async()=>{},save:async()=>checked,state:async()=>'in_progress',submit:async()=>{}});
  await j.select('table:Q1','B',false,2);await j.flush();
  await assert.rejects(j.select('table:Q1','C',false,3),/already been checked/);
  await assert.rejects(j.select('table:Q1',null,false,3),/already been checked/);
  await j.select('table:Q1','B',true,3);
  assert.equal(j.draft.answers['table:Q1'].marked,true);assert.deepEqual(j.draft.feedback['table:Q1'],checked);
});
