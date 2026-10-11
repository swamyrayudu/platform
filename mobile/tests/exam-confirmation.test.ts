import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import ts from 'typescript';
import { ExamJournal, elapsedSeconds, type ExamDraft } from '../store/exam';
import { pauseExamClock, pausedQuestionTime, resumeExamClock, type ExamClock } from '../utils/exam-clock';
import { createSubmissionFlow } from '../services/submission-flow';

// Run the actual hook callbacks against its real journal, with a controlled
// clock and storage/network ports. This checks dialog/background/save races.
const compiled=transformSync(readFileSync(new URL('../hooks/use-exam.ts',import.meta.url),'utf8'),{loader:'ts'}).code;
const tree=ts.createSourceFile('use-exam.js',compiled,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const callbacks:Record<string,string>={};
function visit(node:ts.Node) {
  if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.initializer&&ts.isCallExpression(node.initializer)&&ts.isIdentifier(node.initializer.expression)&&node.initializer.expression.text==='useCallback')callbacks[node.name.text]=node.initializer.arguments[0].getText(tree);
  if(ts.isFunctionDeclaration(node)&&node.name?.text==='submit')callbacks.submit=`(${node.getText(tree)})`;
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.expression.getText(tree)==='AppState'&&node.expression.name.text==='addEventListener')callbacks.appState=node.arguments[1].getText(tree);
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='setInterval')callbacks.tick=node.arguments[0].getText(tree);
  ts.forEachChild(node,visit);
}
visit(tree);
function gate() {let release:()=>void=()=>{};const promise=new Promise<void>(resolve=>{release=resolve;});return {promise,release};}
function setup({pause=async()=>{},submit=async()=>{}}:{pause?:(elapsed:number)=>Promise<void>;submit?:(elapsed:number)=>Promise<void>}={}) {
  let now=10000,error:unknown,exit:unknown,busy=false,persists=0;
  const d:ExamDraft={userId:'user',kind:'mock',id:'attempt',title:'Test',duration:100,elapsed:20,index:0,feedbackMode:'end',questions:[{key:'q1',number:1,question:'Question',option_a:'A',option_b:'B',option_c:'C',option_d:'D',subject:'English',topic:'Grammar'}],answers:{},pending:{},feedback:{},submitIntent:false,updatedAt:0};
  const j=new ExamJournal(d,{persist:async()=>{persists++;},save:async()=>{},state:async()=>'in_progress',submit});
  const flow=createSubmissionFlow({restore:async()=>j,state:async()=>'in_progress',clear:async()=>{}});let job:Promise<true>|undefined;
  const clock={current:{base:20,resumedAt:0,running:true} as ExamClock};
  const questionTime={current:0};let visible=structuredClone(d);
  const env:Record<string,unknown>={
    journal:{current:j as ExamJournal|undefined},clock,questionTime,confirmationOpen:{current:false},finishing:{current:false},checkingAnswer:{current:false},busy:false,
    Date:{now:()=>now},elapsedSeconds,pauseExamClock,pausedQuestionTime,resumeExamClock,
    setDraft:(next:(current:ExamDraft)=>ExamDraft)=>{visible=next(visible);},publish:()=>{visible=structuredClone(j.draft);},setError:(value:unknown)=>{error=value;},setBusy:(value:boolean)=>{busy=value;env.busy=value;},
    kind:'mock',id:'attempt',examService:{pause:(_id:string,elapsed:number)=>pause(elapsed)},examDrafts:{clear:async()=>{}},cache:{invalidateQueries:async()=>{}},setExitDestination:(value:unknown)=>{exit=value;},
    examSubmission:{run:(userId:string,kind:'mock',id:string,journal:ExamJournal)=>{job=flow.run(userId,kind,id,journal);return job;}},
  };
  for(const name of ['checkpoint','resumeClock','pauseForConfirmation','endConfirmation','submit','leave','appState','tick']){
    assert.ok(callbacks[name],`Hook callback ${name} must be exercised`);
    env[name]=runInNewContext(`(${callbacks[name]})`,env);
  }
  return {j,clock,questionTime,now:(value:number)=>{now=value;},error:()=>error,exit:()=>exit,busy:()=>busy,persists:()=>persists,visible:()=>visible,job:()=>job!,
    open:env.pauseForConfirmation as ()=>boolean,close:env.endConfirmation as (resume?:boolean)=>void,tick:env.tick as ()=>void,appState:env.appState as (state:string)=>void,leave:env.leave as ()=>Promise<void>,submit:env.submit as ()=>Promise<void>};
}

test('confirmation pauses elapsed and question time; Stay resumes without charging dialog time',()=>{
  const app=setup();assert.equal(app.open(),true);assert.equal(app.visible().elapsed,30);
  app.now(60000);app.tick();assert.equal(app.visible().elapsed,30);assert.equal(app.persists(),0);
  assert.equal(app.open(),false);assert.equal(app.clock.current.pausedAt,10000);
  app.close();assert.equal(app.questionTime.current,50000);
  app.now(65000);app.tick();assert.equal(app.visible().elapsed,35);
  assert.equal(app.clock.current.running,true);
});
test('switching apps during a confirmation cannot restart the paused timer',async()=>{
  const app=setup();app.open();app.now(60000);app.appState('background');app.appState('active');app.tick();
  assert.equal(app.clock.current.running,false);assert.equal(app.visible().elapsed,30);
  await app.j.persist();assert.equal(app.j.draft.elapsed,30);
  app.close();app.now(61000);app.tick();assert.equal(app.visible().elapsed,31);
});
test('Stop timer & save stays frozen through slow pause and resumes safely on failure',async()=>{
  const started=gate(),pending=gate();let pausedElapsed=-1;
  const app=setup({pause:async elapsed=>{pausedElapsed=elapsed;started.release();await pending.promise;throw new Error('offline');}});
  app.open();app.now(20000);app.close(false);const leaving=app.leave();
  await started.promise;app.now(60000);app.tick();assert.equal(app.busy(),true);assert.equal(app.visible().elapsed,30);assert.equal(pausedElapsed,30);
  pending.release();await leaving;
  assert.equal(app.exit(),undefined);assert.equal((app.error() as Error).message,'offline');assert.equal(app.clock.current.running,true);
  assert.equal(app.questionTime.current,50000);app.now(65000);app.tick();assert.equal(app.visible().elapsed,35);
});
test('Submit opens the result route before server work finishes and keeps the confirmed time frozen',async()=>{
  const started=gate(),pending=gate();let submittedElapsed=-1;
  const app=setup({submit:async elapsed=>{submittedElapsed=elapsed;started.release();await pending.promise;}});
  app.open();app.now(20000);app.close(false);const submitting=app.submit();
  assert.deepEqual(structuredClone(app.exit()),{pathname:'/result',params:{kind:'mock',id:'attempt',submit:'1'}});
  await started.promise;app.now(60000);app.tick();assert.equal(app.clock.current.running,false);assert.equal(app.visible().elapsed,30);assert.equal(submittedElapsed,30);
  pending.release();await submitting;await app.job();assert.ok(app.exit());
});
test('failed submission retains its intent and frozen timer for retry',async()=>{
  const app=setup({submit:async()=>{throw new Error('lost response');}});
  app.open();app.close(false);await app.submit();await assert.rejects(app.job(),/lost response/);app.now(60000);app.tick();
  assert.equal(app.j.draft.submitIntent,true);assert.equal(app.clock.current.running,false);assert.equal(app.j.draft.elapsed,30);
  assert.ok(app.exit(),'The results route owns the error and retry after handoff.');
});
