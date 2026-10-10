import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient, ApiError, type SessionPort } from '../services/http';
function session() {
  let tokens:{accessToken:string;refreshToken:string}|null={accessToken:'old',refreshToken:'refresh'};
  const port:SessionPort={read:async()=>tokens,write:async next=>{tokens=next;},clear:async()=>{tokens=null;}};
  return {port,current:()=>tokens};
}
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
test('parallel 401s share one refresh and use bearer tokens without cookies',async()=>{
  const s=session();let refreshes=0;const calls:RequestInit[]=[];
  const fetcher:typeof fetch=async(input,init)=>{
    calls.push(init!);
    if(String(input).endsWith('/refresh')){refreshes++;await new Promise(r=>setTimeout(r,5));assert.deepEqual(JSON.parse(init!.body as string),{refreshToken:'refresh'});return json({accessToken:'new',refreshToken:'rotated'});}
    return (init!.headers as Record<string,string>).Authorization==='Bearer old'?json({error:'SESSION_EXPIRED'},401):json({success:true,value:42});
  };
  const api=createApiClient('https://rsd.example',s.port,()=>assert.fail('unexpected revocation'),fetcher);
  const results=await Promise.all([api.request('/api/one'),api.request('/api/two')]);
  assert.equal(refreshes,1);assert.equal(results.length,2);assert.equal(s.current()?.refreshToken,'rotated');assert.ok(calls.every(c=>c.credentials==='omit'));
});
test('revoked session clears tokens and never rotates a revoked refresh token',async()=>{
  const s=session();let revoked=0,calls=0;const api=createApiClient('https://rsd.example',s.port,()=>revoked++,async()=>{calls++;return json({error:'SESSION_REVOKED'},401);});
  await assert.rejects(api.request('/api/private'),ApiError);assert.equal(calls,1);assert.equal(revoked,1);assert.equal(s.current(),null);
});
test('transient refresh failure preserves session for recovery',async()=>{
  const s=session();const api=createApiClient('https://rsd.example',s.port,()=>assert.fail(),async input=>String(input).endsWith('/refresh')?Promise.reject(new Error('offline')):json({error:'SESSION_EXPIRED'},401));
  await assert.rejects(api.request('/api/private'),(e:ApiError)=>e.code==='NETWORK_ERROR');assert.equal(s.current()?.refreshToken,'refresh');
});
test('server quota and rate-limit contracts retain code/message/retryAfter',async()=>{
  const s=session();const api=createApiClient('https://rsd.example',s.port,()=>{},async()=>json({error:'Limited',code:'FREE_LIMIT_REACHED',message:'Upgrade to Pro',retryAfter:30},403));
  await assert.rejects(api.request('/api/practice','POST',{}),(e:ApiError)=>e.status===403&&e.code==='FREE_LIMIT_REACHED'&&e.message==='Upgrade to Pro'&&e.retryAfter===30);
});
test('mutations are not blindly retried on network failure',async()=>{
  const s=session();let count=0;const api=createApiClient('https://rsd.example',s.port,()=>{},async()=>{count++;throw new Error('offline');});
  await assert.rejects(api.request('/api/submit','POST',{}));assert.equal(count,1);
});
test('logout waits for a storage write already in progress and leaves no token behind',async()=>{
  const s=session();let release:()=>void=()=>{},started:()=>void=()=>{};
  const writeStarted=new Promise<void>(r=>{started=r;});const gate=new Promise<void>(r=>{release=r;});
  const port={...s.port,write:async(tokens:{accessToken:string;refreshToken:string})=>{started();await gate;await s.port.write(tokens);}};
  const api=createApiClient('https://rsd.example',port,()=>{},async()=>json({accessToken:'new',refreshToken:'rotated'}));
  const refreshing=api.refresh();await writeStarted;const loggingOut=api.invalidate();release();await Promise.all([refreshing,loggingOut]);assert.equal(s.current(),null);
});
test('a late revoked response from an older session cannot clear a newer login',async()=>{
  const s=session();let release:()=>void=()=>{},started:()=>void=()=>{},revocations=0;
  const requested=new Promise<void>(r=>{started=r;});const gate=new Promise<void>(r=>{release=r;});
  const api=createApiClient('https://rsd.example',s.port,()=>revocations++,async()=>{started();await gate;return json({error:'SESSION_REVOKED'},401);});
  const oldRequest=api.request('/api/private');await requested;await api.invalidate();await s.port.write({accessToken:'another-login',refreshToken:'another-refresh'});release();await assert.rejects(oldRequest);
  assert.equal(s.current()?.accessToken,'another-login');assert.equal(revocations,1);
});
