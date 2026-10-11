import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExamJournal, type ExamDraft } from '../store/exam';
import { createSubmissionFlow } from '../services/submission-flow';
function draft():ExamDraft {return {userId:'user',kind:'mock',id:'attempt',title:'Mock',duration:100,elapsed:30,index:0,feedbackMode:'end',questions:[{key:'q1',number:1,question:'Question',option_a:'A',option_b:'B',option_c:'C',option_d:'D',subject:'English',topic:'Grammar'}],answers:{q1:{option:'B',marked:false,seconds:4,revision:1}},pending:{q1:1},feedback:{},submitIntent:false,updatedAt:0};}
function gate() {let release:()=>void=()=>{};const promise=new Promise<void>(resolve=>{release=resolve;});return {promise,release};}
test('exam and results join one pending submission; durable answers precede submit and cleanup',async()=>{
  const disk=gate();const events:string[]=[];
  const j=new ExamJournal(draft(),{persist:async()=>{await disk.promise;events.push('persist');},save:async()=>{events.push('answer');},state:async()=>'in_progress',submit:async()=>{events.push('submit');}});
  const flow=createSubmissionFlow({restore:async()=>assert.fail(),state:async()=>assert.fail(),clear:async()=>{events.push('clear');}});
  const first=flow.run('user','mock','attempt',j),second=flow.run('user','mock','attempt');
  assert.equal(first,second);assert.equal(events.length,0);disk.release();await first;
  assert.ok(events.indexOf('persist')<events.indexOf('answer'));assert.ok(events.indexOf('answer')<events.indexOf('submit'));assert.ok(events.indexOf('submit')<events.indexOf('clear'));
  const previous=events.length;await flow.run('user','mock','attempt');assert.equal(events.length,previous);
});
test('failed submission preserves the journal and reconciles a lost response on retry',async()=>{
  let status='in_progress',submits=0,clears=0;
  const j=new ExamJournal(draft(),{persist:async()=>{},save:async()=>{},state:async()=>status,submit:async()=>{submits++;status='submitted';throw new Error('lost response');}});
  const flow=createSubmissionFlow({restore:async()=>assert.fail(),state:async()=>assert.fail(),clear:async()=>{clears++;}});
  await assert.rejects(flow.run('user','mock','attempt',j),/lost response/);assert.equal(clears,0);assert.equal(j.draft.submitIntent,true);
  await flow.run('user','mock','attempt');assert.equal(submits,1);assert.equal(clears,1);
});
test('cold result-page recovery submits the saved journal and does not discard failed local saves',async()=>{
  let fails=true,clears=0,sends=0;
  const j=new ExamJournal(draft(),{persist:async()=>{if(fails)throw new Error('disk full');},save:async()=>{sends++;},state:async()=>'in_progress',submit:async()=>{}});
  const flow=createSubmissionFlow({restore:async()=>j,state:async()=>assert.fail(),clear:async()=>{clears++;}});
  await assert.rejects(flow.run('user','mock','attempt'),/disk full/);assert.equal(clears,0);assert.equal(sends,0);assert.equal(j.draft.pending.q1,1);
  fails=false;await flow.run('user','mock','attempt');assert.equal(sends,1);assert.equal(clears,1);
});
test('missing local drafts only succeed for a server-confirmed completed attempt',async()=>{
  for(const state of ['submitted','completed','in_progress','abandoned']){
    const flow=createSubmissionFlow({restore:async()=>null,state:async()=>state,clear:async()=>assert.fail()});
    if(['submitted','completed'].includes(state))assert.equal(await flow.run('user','mock','attempt'),true);
    else await assert.rejects(flow.run('user','mock','attempt'),/recover your answers/);
  }
});
test('handoff and restored journals cannot cross users, kinds or attempt IDs',async()=>{
  let sends=0;
  const j=new ExamJournal(draft(),{persist:async()=>{},save:async()=>{sends++;},state:async()=>'in_progress',submit:async()=>assert.fail()});
  const flow=createSubmissionFlow({restore:async()=>j,state:async()=>assert.fail(),clear:async()=>assert.fail()});
  await assert.rejects(flow.run('another','mock','attempt',j));await assert.rejects(flow.run('user','practice','attempt',j));await assert.rejects(flow.run('user','mock','another',j));
  await assert.rejects(flow.run('another','mock','attempt'));assert.equal(sends,0);
});
test('cleanup failure is retried without submitting an accepted exam again',async()=>{
  let status='in_progress',submits=0,clears=0;
  const j=new ExamJournal(draft(),{persist:async()=>{},save:async()=>{},state:async()=>status,submit:async()=>{submits++;status='submitted';}});
  const flow=createSubmissionFlow({restore:async()=>j,state:async()=>assert.fail(),clear:async()=>{if(++clears===1)throw new Error('disk busy');}});
  await assert.rejects(flow.run('user','mock','attempt',j),/disk busy/);await flow.run('user','mock','attempt');assert.equal(submits,1);assert.equal(clears,2);
});
