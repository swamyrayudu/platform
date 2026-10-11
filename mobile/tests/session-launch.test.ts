import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { createExamDraftStore } from '../store/exam-drafts';
import { ExamJournal, type ExamDraft } from '../store/exam';
import { createSubmissionFlow } from '../services/submission-flow';
import type { launchPractice } from '../services/session-launch';

const compiled=transformSync(readFileSync(new URL('../services/session-launch.ts',import.meta.url),'utf8'),{loader:'ts',format:'cjs'}).code;
function draft(id:string,kind:ExamDraft['kind']='mock',userId='user'):ExamDraft {
  return {id,kind,userId,title:id,duration:9000,elapsed:123,index:0,feedbackMode:'end',questions:[{key:'Q1',number:1,question:'Question',option_a:'A',option_b:'B',option_c:'C',option_d:'D',subject:'English',topic:'Grammar'}],answers:{Q1:{option:'C',marked:true,seconds:8,revision:2}},pending:{Q1:2},feedback:{},submitIntent:false,updatedAt:0};
}
function fixture({failArchive=false,failSubmit=false}:{failArchive?:boolean;failSubmit?:boolean}={}) {
  const records=new Map<string,unknown>(),statuses=new Map<string,string>(),checked:string[]=[],submitted:string[]=[],savedAnswers:string[]=[];
  const storage={
    read:async<T>(name:string)=>structuredClone(records.get(name)??null) as T|null,
    write:async(name:string,value:unknown)=>{if(failArchive&&name.startsWith('exam-draft:'))throw new Error('disk full');records.set(name,structuredClone(value));},
    remove:async(name:string)=>{records.delete(name);},
  };
  const store=createExamDraftStore(storage);
  const submit=async(id:string)=>{if(failSubmit)throw new Error('offline');submitted.push(id);statuses.set(id,'completed');};
  const flow=createSubmissionFlow({
    restore:async(userId,kind,id)=>{
      const saved=await store.read(userId,kind,id);
      return saved?new ExamJournal(saved,{persist:store.save,save:async()=>{savedAnswers.push(id);},state:async()=>statuses.get(id)??'in_progress',submit:async()=>submit(id)}):null;
    },state:async(_kind,id)=>statuses.get(id)??'in_progress',clear:store.clear,
  });
  const ports:Record<string,unknown>={
    './vault':{vault:storage},'./exam-drafts':{examDrafts:store},
    './question-service':{practiceService:{get:async(id:string)=>{checked.push(id);return {session:{id,status:statuses.get(id)??'in_progress',subject:'English',time_spent_seconds:12}};},submit}},
    './exam-submission':{examSubmission:flow},
  };
  const module={exports:{}};
  runInNewContext(compiled,{module,exports:module.exports,require:(name:string)=>{assert.ok(name in ports,`Unexpected native import ${name}`);return ports[name];}});
  const launcher=module.exports as {launchPractice:typeof launchPractice};
  return {records,statuses,checked,submitted,savedAnswers,store,...launcher};
}

test('starting practice beside a saved mock preserves its answers, timer and pending sync through practice completion',async()=>{
  const app=fixture(),mock=draft('mock-160');app.records.set('active-exam',mock);
  const result=await app.launchPractice('user',async()=>{
    assert.deepEqual(await app.store.read('user','mock',mock.id),mock,'Archive before the server creates practice.');
    return {session:{id:'practice-new'}};
  });
  assert.equal(result.session.id,'practice-new');
  assert.deepEqual(app.records.get('active-exam'),mock);
  assert.deepEqual(app.records.get('created-practice'),{id:'practice-new',userId:'user'});
  await app.store.save(draft('practice-new','practice'));
  await app.store.clear('user','practice','practice-new');
  const resumed=await app.store.load('user','mock',mock.id,async()=>({status:'in_progress'}));
  assert.deepEqual(resumed.saved,mock);
  assert.deepEqual(app.checked,[],'No practice state lookup is needed for an unrelated saved mock.');
});

test('an older saved practice is synced and completed before starting a new one',async()=>{
  const app=fixture();app.records.set('active-exam',draft('practice','practice'));
  await app.launchPractice('user',async()=>{
    assert.deepEqual(app.savedAnswers,['practice']);assert.deepEqual(app.submitted,['practice']);
    assert.equal(await app.store.read('user','practice','practice'),null);
    return {session:{id:'new-practice'}};
  });
});

test('completed practice creation markers do not block a new practice beside a saved mock',async()=>{
  const app=fixture(),mock=draft('mock');app.records.set('active-exam',mock);
  app.records.set('created-practice',{id:'old-practice',userId:'user'});app.statuses.set('old-practice','completed');
  await app.launchPractice('user',async()=>({session:{id:'new-practice'}}));
  assert.deepEqual(await app.store.read('user','mock','mock'),mock);
  assert.deepEqual(app.records.get('created-practice'),{id:'new-practice',userId:'user'});
});

test('an older saved practice is completed while Home points to an independent mock',async()=>{
  const app=fixture(),practice=draft('saved-practice','practice');
  app.records.set('created-practice',{id:practice.id,userId:'user'});
  await app.store.save(practice);await app.store.save(draft('saved-mock'));
  await app.launchPractice('user',async()=>({session:{id:'new'}}));
  assert.deepEqual(app.submitted,[practice.id]);
  assert.equal(await app.store.read('user','practice',practice.id),null);
  assert.deepEqual(await app.store.read('user','mock','saved-mock'),draft('saved-mock'));
});

test('a created practice with no mounted draft is completed before a new start',async()=>{
  const app=fixture();app.records.set('active-exam',draft('mock'));
  app.records.set('created-practice',{id:'created-only',userId:'user'});
  await app.launchPractice('user',async()=>({session:{id:'new'}}));
  assert.deepEqual(app.submitted,['created-only']);
  assert.deepEqual(app.records.get('created-practice'),{id:'new',userId:'user'});
});

test('completed practice is not submitted again and never clears a different saved mock',async()=>{
  const app=fixture(),mock=draft('mock');
  await app.store.save(draft('done-practice','practice'));await app.store.save(mock);
  app.records.set('created-practice',{id:'done-practice',userId:'user'});app.statuses.set('done-practice','completed');
  await app.launchPractice('user',async()=>({session:{id:'new'}}));
  assert.deepEqual(app.submitted,[]);
  assert.equal(await app.store.read('user','practice','done-practice'),null);
  assert.deepEqual(app.records.get('active-exam'),mock);
  assert.deepEqual(await app.store.read('user','mock','mock'),mock);
});

test('another account’s drafts and creation marker are never completed or checked as this user',async()=>{
  const app=fixture();app.records.set('active-exam',draft('foreign-practice','practice','other-user'));
  app.records.set('created-practice',{id:'foreign-created',userId:'other-user'});
  await app.launchPractice('user',async()=>({session:{id:'own-practice'}}));
  assert.deepEqual(app.checked,[]);
  assert.equal((app.records.get('active-exam') as ExamDraft).userId,'other-user');
});

test('failed completion preserves queued practice answers and blocks a new server session',async()=>{
  const app=fixture({failSubmit:true});app.records.set('active-exam',draft('old','practice'));
  await assert.rejects(app.launchPractice('user',async()=>assert.fail('Do not create before completion')),/offline/);
  const saved=await app.store.read('user','practice','old');
  assert.equal(saved?.submitIntent,true);assert.equal(saved?.answers.Q1.option,'C');
});

test('an already abandoned legacy practice is cleared without blocking a new practice',async()=>{
  const app=fixture();app.records.set('active-exam',draft('abandoned','practice'));app.statuses.set('abandoned','abandoned');
  await app.launchPractice('user',async()=>({session:{id:'new'}}));
  assert.deepEqual(app.submitted,[]);assert.equal(await app.store.read('user','practice','abandoned'),null);
});

test('failed legacy mock archiving stops creation without discarding that mock',async()=>{
  const app=fixture({failArchive:true}),mock=draft('legacy-mock');app.records.set('active-exam',mock);
  await assert.rejects(app.launchPractice('user',async()=>assert.fail('Do not spend quota before the mock is safe')),/disk full/);
  assert.deepEqual(app.records.get('active-exam'),mock);
  assert.equal(app.records.has('created-practice'),false);
});

test('rapid Start taps cannot create two practices and failed creation releases the guard',async()=>{
  const app=fixture();let finish!:(result:{session:{id:string}})=>void;
  const pending=new Promise<{session:{id:string}}>(resolve=>{finish=resolve;});
  const first=app.launchPractice('user',()=>pending);
  await assert.rejects(app.launchPractice('user',async()=>assert.fail()),/already being started/);
  finish({session:{id:'one'}});await first;
  app.statuses.set('one','completed');
  await assert.rejects(app.launchPractice('user',async()=>{throw new Error('network');}),/network/);
  await app.launchPractice('user',async()=>({session:{id:'retry'}}));
  assert.equal((app.records.get('created-practice') as {id:string}).id,'retry');
});
