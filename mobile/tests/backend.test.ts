import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import type { PracticeSession, PracticeFilterState } from '../types/practice';
const fixture={id:'q1',question_id:'Q1',question_uid:'english_subject_questions:Q1',medium:'english',subject:'English',topic:'Grammar',question:'Pick A',option_a:'yes',option_b:'no',option_c:'maybe',option_d:'never',correct_answer:'A',explanation:'Because A',class_level:'Class 6',chapter:null,subtopic:null,difficulty:'Easy',question_type:'MCQ',language:'english'};
async function backend() {
  const sessions=new Map<string,Record<string,unknown>>();const attempts:unknown[]=[];let failInsert=false;
  const clone=(x:unknown)=>JSON.parse(JSON.stringify(x));
  const db={from(table:string){
    let operation='read',payload:Record<string,unknown>={},single=false;const predicates:Record<string,unknown>={};
    const q={select(){return q;},eq(name:string,value:unknown){predicates[name]=value;return q;},maybeSingle(){single=true;return q;},single(){single=true;return q;},insert(data:Record<string,unknown>){operation='insert';payload=data;return q;},update(data:Record<string,unknown>){operation='update';payload=data;return q;},upsert(data:Record<string,unknown>){operation='insert';payload=data;return q;},then(onSuccess:(v:unknown)=>unknown,onError?:(e:unknown)=>unknown){
      const execute=()=>{
        if(table==='practice_sessions') {
          if(operation==='insert'){if(failInsert)return {data:null,error:{message:'write failed'}};sessions.set(payload.id as string,clone(payload));return {data:clone(payload),error:null};}
          const rows=[...sessions.values()].filter(row=>Object.entries(predicates).every(([key,value])=>row[key]===value));
          if(operation==='update')rows.forEach(row=>Object.assign(row,clone(payload)));
          return {data:single?clone(rows[0]??null):clone(rows),error:null};
        }
        if(table==='question_attempts'&&operation==='insert')attempts.push(clone(payload));
        return {data:null,error:null};
      };
      return Promise.resolve().then(execute).then(onSuccess,onError);
    }};return q;
  }};
  const out=await build({entryPoints:[resolve('../lib/practice/db.ts')],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'backend-test-ports',setup(b){
    b.onResolve({filter:/supabase-admin|auth\/session|\.\/seed-questions|\.\/question-loader|\.\/engine|\.\/subjects$/},args=>({path:args.path,namespace:'fixture'}));
    b.onLoad({filter:/.*/,namespace:'fixture'},args=>({loader:'js',contents:args.path.includes('supabase-admin')?'export const supabaseAdmin = globalThis.testPorts.db;':args.path.includes('auth/session')?'export const isUserPremium=()=>true;':args.path.includes('seed-questions')?'export const SEED_QUESTIONS=[];':args.path.includes('question-loader')?'export const loadCandidatePool=async()=>({pool:[globalThis.testPorts.question],alreadyHydrated:true}); export const hydrateQuestions=async q=>q;':args.path.includes('engine')?'export const filterQuestionPool=q=>q;export const selectSmartQuestions=q=>q;export const extractFilterOptions=()=>({});':'const p={fetchQuestions:async()=>[globalThis.testPorts.question]};export const getAllSubjectProviders=()=>[p];export const getSubjectProvider=()=>p;'}));
  }}]});
  const module={exports:{}};runInNewContext(out.outputFiles[0].text,{module,exports:module.exports,crypto:{randomUUID},console,testPorts:{db,question:fixture}});
  type Backend={createPracticeSession:(f:PracticeFilterState,u:string)=>Promise<PracticeSession>;recordQuestionAnswer:(id:string,q:string,a:'A'|'B'|null,t:number,m:boolean,u:string)=>Promise<unknown>;submitPracticeSession:(id:string,t:number,u:string)=>Promise<{score:number}>;getPracticeSessionById:(id:string,u:string,mask?:boolean)=>Promise<PracticeSession|null>};
  return {api:module.exports as Backend,sessions,attempts,fail:()=>{failInsert=true;}};
}
const filter:PracticeFilterState={medium:'english',subject:'English',class_levels:[],topics:[],subtopics:[],difficulty:[],question_count:5,mode:'balanced',feedback_mode:'end',has_timer:false,duration_minutes:30};
test('practice writes answers before ack; repeated results/submission do not duplicate attempts',async()=>{
  const {api,sessions,attempts}=await backend();const created=await api.createPracticeSession(filter,'user');assert.equal(created.questions[0].correct_answer,undefined);
  await api.recordQuestionAnswer(created.id,'Q1','A',5,false,'user');assert.equal((sessions.get(created.id)!.user_answers as Record<string,{selected_answer:string}>).Q1.selected_answer,'A');
  await api.recordQuestionAnswer(created.id,'Q1','A',5,false,'user');assert.equal(sessions.get(created.id)!.time_spent_seconds,5);
  const masked=await api.getPracticeSessionById(created.id,'user');assert.equal(masked!.user_answers.Q1.correct_answer,undefined);assert.equal(await api.getPracticeSessionById(created.id,'other'),null);
  const first=await api.submitPracticeSession(created.id,20,'user');await new Promise(r=>setImmediate(r));assert.equal(first.score,1);assert.equal(attempts.length,1);
  await api.submitPracticeSession(created.id,20,'user');await new Promise(r=>setImmediate(r));assert.equal(attempts.length,1);await assert.rejects(api.recordQuestionAnswer(created.id,'Q1','B',6,false,'user'));
});
test('practice creation does not claim success when durable write fails',async()=>{
  const {api,fail}=await backend();fail();await assert.rejects(api.createPracticeSession(filter,'user'),/Could not save practice session/);
});
