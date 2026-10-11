import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExamDraftStore } from '../store/exam-drafts';
import { ExamJournal, type ExamDraft } from '../store/exam';
import { ApiError } from '../services/http';

function draft(id:string,kind:ExamDraft['kind']='mock',userId='user'):ExamDraft {
  return {id,kind,userId,testId:id,title:id,duration:9000,elapsed:123,index:4,feedbackMode:'end',questions:[{key:'Q1',number:1,question:'Question',option_a:'A',option_b:'B',option_c:'C',option_d:'D',subject:'English',topic:'Grammar'}],answers:{Q1:{option:'C',marked:true,seconds:8,revision:2}},pending:{Q1:2},feedback:{},submitIntent:false,updatedAt:0};
}
function fixture() {
  const records=new Map<string,unknown>();
  const storage={read:async<T>(name:string)=>structuredClone(records.get(name)??null) as T|null,write:async(name:string,value:unknown)=>{records.set(name,structuredClone(value));},remove:async(name:string)=>{records.delete(name);}};
  return {records,store:createExamDraftStore(storage)};
}
test('switching medium preserves the installed app legacy paper and resumes its pending answers',async()=>{
  const {records,store}=fixture();records.set('active-exam',draft('telugu'));
  const opened=await store.load('user','mock','english',async()=>({status:'in_progress'}));
  assert.equal(opened.saved,null);await store.save(draft('english'));
  const resumed=await store.load('user','mock','telugu',async()=>({status:'in_progress'}));
  assert.deepEqual(resumed.saved,draft('telugu'));
  const sent:string[]=[];const journal=new ExamJournal(resumed.saved!,{persist:store.save,save:async(_q,answer)=>{sent.push(answer.option!);},state:async()=>'in_progress',submit:async()=>{}});
  await journal.flush();assert.deepEqual(sent,['C']);assert.equal(Object.keys((await store.read('user','mock','telugu'))!.pending).length,0);
  assert.equal((await store.read('user','mock','english'))!.pending.Q1,2);
});
test('opening a mock preserves an unrelated practice draft',async()=>{
  const {records,store}=fixture();records.set('active-exam',draft('practice','practice'));
  await store.read('user','mock','paper');await store.save(draft('paper'));
  assert.deepEqual(await store.read('user','practice','practice'),draft('practice','practice'));
});
test('drafts cannot be reused across users or exam kinds with the same ID',async()=>{
  const {store}=fixture();await store.save(draft('id'));
  assert.equal(await store.read('another-user','mock','id'),null);
  assert.equal(await store.read('user','practice','id'),null);
});
test('submitted, abandoned and expired papers never resume stale local answers',async()=>{
  for(const status of ['submitted','abandoned','expired']){
    const {records,store}=fixture();records.set('active-exam',draft('old'));
    const loaded=await store.load('user','mock','old',async()=>({status}));
    assert.equal(loaded.saved,null);assert.equal(loaded.state!.status,status);
    assert.equal(await store.read('user','mock','old'),null);assert.equal(records.has('active-exam'),false);
  }
});
test('clearing an older submitted paper does not erase a different active paper',async()=>{
  const {records,store}=fixture();await store.save(draft('old'));await store.save(draft('new'));
  await store.load('user','mock','old',async()=>({status:'submitted'}));
  assert.equal((records.get('active-exam') as ExamDraft).id,'new');
  assert.deepEqual(await store.read('user','mock','new'),draft('new'));
  assert.equal(await store.read('user','mock','old'),null);
});
test('offline resume retains cached answers, while missing drafts and auth errors remain errors',async()=>{
  const {store}=fixture();await store.save(draft('paper'));
  const network=async()=>{throw new ApiError(0,'NETWORK_ERROR','offline');};
  assert.deepEqual((await store.load('user','mock','paper',network)).saved,draft('paper'));
  await assert.rejects(store.load('user','mock','missing',network));
  await assert.rejects(store.load('user','mock','paper',async()=>{throw new ApiError(401,'UNAUTHORIZED','sign in');}));
  assert.deepEqual(await store.read('user','mock','paper'),draft('paper'));
});
test('storage failure prevents switching from overwriting an unarchived legacy draft',async()=>{
  let active=draft('old');const store=createExamDraftStore({read:async<T>(name:string)=>name==='active-exam'?structuredClone(active) as T:null,write:async(name,value)=>{if(name!=='active-exam')throw new Error('disk full');active=value as ExamDraft;},remove:async()=>assert.fail()});
  await assert.rejects(store.save(draft('new')),/disk full/);assert.equal(active.id,'old');
});
test('serialized saves and clearing keep a submitted draft removed',async()=>{
  const {records,store}=fixture();await Promise.all([store.save(draft('paper')),store.save({...draft('paper'),elapsed:456}),store.clear('user','mock','paper')]);
  assert.equal(records.has('active-exam'),false);assert.equal(await store.read('user','mock','paper'),null);
});
test('a failed Home shortcut write cannot overwrite a newer saved answer on resume',async()=>{
  const records=new Map<string,unknown>();let failShortcut=false;
  const store=createExamDraftStore({read:async<T>(name:string)=>structuredClone(records.get(name)??null) as T|null,write:async(name,value)=>{if(name==='active-exam'&&failShortcut)throw new Error('disk full');records.set(name,structuredClone(value));},remove:async name=>{records.delete(name);}});
  await store.save(draft('paper'));failShortcut=true;
  const latest=draft('paper');latest.answers.Q1={option:'D',marked:false,seconds:9,revision:3};latest.pending.Q1=3;
  await assert.rejects(store.save(latest),/disk full/);
  assert.deepEqual(await store.read('user','mock','paper'),latest);
});
