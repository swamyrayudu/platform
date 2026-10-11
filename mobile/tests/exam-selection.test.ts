import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import ts from 'typescript';
import { ExamJournal, type ExamDraft } from '../store/exam';
import type { SelectedOption } from '../types/mock-tests';

// Exercise the hook's actual tap handler with the real journal, isolating native
// storage/network through ports. No phone, live session or React mock is needed.
const source=readFileSync(new URL('../hooks/use-exam.ts',import.meta.url),'utf8');
const compiled=transformSync(source,{loader:'ts'}).code;
const tree=ts.createSourceFile('use-exam.js',compiled,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
let handler='';
function visit(node:ts.Node) {
  if(ts.isFunctionDeclaration(node)&&node.name?.text==='select')handler=node.getText(tree);
  ts.forEachChild(node,visit);
}
visit(tree);
assert.ok(handler,'The selection handler must be available for the tap regression.');

function gate() {
  let release:()=>void=()=>{};
  const promise=new Promise<void>(resolve=>{release=resolve;});
  return {promise,release};
}
function setup({persist,save,instant=false}: {persist:(draft:ExamDraft)=>Promise<void>;save:()=>Promise<void>;instant?:boolean}) {
  const draft:ExamDraft={userId:'fixture',kind:instant?'practice':'mock',id:'attempt',title:'Test',duration:9000,elapsed:0,index:0,feedbackMode:instant?'instant':'end',questions:[{key:'table:q1',number:1,question:'Question',option_a:'A',option_b:'B',option_c:'C',option_d:'D',subject:'English',topic:'Grammar'}],answers:{},pending:{},feedback:{},submitIntent:false,updatedAt:0};
  const journal=new ExamJournal(draft,{persist,save,state:async()=>'in_progress',submit:async()=>assert.fail()});
  let visible:ExamDraft|undefined,error:unknown,busy=false;
  const select=runInNewContext(`(${handler})`,{
    journal:{current:journal},busy:false,finishing:{current:false},checkingAnswer:{current:false},confirmationOpen:{current:false},questionTime:{current:Date.now()},
    setError:(next:unknown)=>{error=next;},setBusy:(next:boolean)=>{busy=next;},
    publish:()=>{visible=structuredClone(journal.draft);},
  }) as (option:SelectedOption,marked?:boolean)=>Promise<void>;
  return {journal,select,visible:()=>visible,error:()=>error,busy:()=>busy};
}

test('tap highlights the answer before slow storage resolves, but never sends an unsaved answer',async()=>{
  const disk=gate();const sent=gate();let requests=0;
  const app=setup({persist:async()=>disk.promise,save:async()=>{requests++;sent.release();}});
  const selecting=app.select('B');
  try {
    assert.equal(app.visible()?.answers['table:q1'].option,'B');
    assert.equal(app.visible()?.pending['table:q1'],1);
    assert.equal(requests,0);
    assert.equal(app.busy(),false);
  } finally {disk.release();await selecting;}
  await sent.promise;
  assert.equal(requests,1);assert.equal(app.visible()?.pending['table:q1'],undefined);
});

test('rapid mock taps show the latest choice while storage and network are pending',async()=>{
  const disk=gate();const network=gate();const started=gate();const saved:SelectedOption[]=[];
  const app=setup({persist:async d=>{await disk.promise;saved.push(d.answers['table:q1'].option);},save:async()=>{started.release();await network.promise;}});
  const first=app.select('A');const second=app.select('D');
  try {
    assert.equal(app.visible()?.answers['table:q1'].option,'D');
    assert.equal(app.visible()?.answers['table:q1'].revision,2);
    disk.release();await started.promise;
    assert.equal(app.visible()?.answers['table:q1'].option,'D');
    assert.ok(saved.includes('D'));
  } finally {disk.release();network.release();await Promise.all([first,second]);}
  assert.equal(app.journal.draft.answers['table:q1'].option,'D');
  assert.equal(app.journal.draft.pending['table:q1'],undefined);
});

test('storage failure retains the visible choice and pending retry without sending it',async()=>{
  const disk=gate();let requests=0;
  const app=setup({persist:async()=>{await disk.promise;throw new Error('disk full');},save:async()=>{requests++;}});
  const selecting=app.select('C');
  try {assert.equal(app.visible()?.answers['table:q1'].option,'C');}
  finally {disk.release();await selecting;}
  assert.equal((app.error() as Error).message,'disk full');
  assert.equal(app.visible()?.pending['table:q1'],1);assert.equal(requests,0);
});

test('instant practice highlights immediately but blocks a second answer until checking finishes',async()=>{
  const disk=gate();const network=gate();const started=gate();
  const app=setup({instant:true,persist:async()=>disk.promise,save:async()=>{started.release();await network.promise;}});
  const first=app.select('B');
  try {
    assert.equal(app.visible()?.answers['table:q1'].option,'B');assert.equal(app.busy(),true);
    await app.select('C');assert.equal(app.journal.draft.answers['table:q1'].option,'B');
    disk.release();await started.promise;assert.equal(app.busy(),true);
  } finally {disk.release();network.release();await first;}
  assert.equal(app.busy(),false);
});
