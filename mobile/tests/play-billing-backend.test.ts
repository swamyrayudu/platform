// Website backend: Google Play Billing server logic (lib/payments/google-play, lib/auth/types).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { evaluateSubscription } from '../../lib/payments/google-play/evaluate';
import type { SubscriptionPurchaseV2 } from '../../lib/payments/google-play/api';
import { decodePushEnvelope, parseNotification } from '../../lib/payments/google-play/rtdn';
import { effectiveSubscription, toPublicUser, type DbUser } from '../../lib/auth/types';

const NOW=Date.parse('2026-11-07T00:00:00Z');
const days=(d:number)=>new Date(NOW+d*864e5).toISOString();
function v2(over:Partial<SubscriptionPurchaseV2>={},item:Record<string,unknown>={}):SubscriptionPurchaseV2 {
  return {subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING',startTime:days(-1),
    externalAccountIdentifiers:{obfuscatedExternalAccountId:'acct-a'},
    lineItems:[{productId:'rsd_pro',expiryTime:days(30),autoRenewingPlan:{autoRenewEnabled:true},offerDetails:{basePlanId:'monthly'},latestSuccessfulOrderId:'GPA.1',...item}],...over};
}

// ---- evaluateSubscription ----------------------------------------------------

test('Play states map to access the way Google documents',()=>{
  const cases:[SubscriptionPurchaseV2['subscriptionState'],boolean][]=[
    ['SUBSCRIPTION_STATE_ACTIVE',true],['SUBSCRIPTION_STATE_IN_GRACE_PERIOD',true],['SUBSCRIPTION_STATE_CANCELED',true],
    ['SUBSCRIPTION_STATE_ON_HOLD',false],['SUBSCRIPTION_STATE_PAUSED',false],['SUBSCRIPTION_STATE_PENDING',false],
    ['SUBSCRIPTION_STATE_EXPIRED',false],['SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED',false],
  ];
  for(const [state,entitled] of cases) {
    const r=evaluateSubscription(v2({subscriptionState:state}),'rsd_pro',NOW);
    assert.ok(r.ok);assert.equal(r.value.entitled,entitled,state);
  }
});
test('cancelled keeps access only until expiry; past expiry never entitles',()=>{
  const r=evaluateSubscription(v2({subscriptionState:'SUBSCRIPTION_STATE_CANCELED'},{expiryTime:days(-1)}),'rsd_pro',NOW);
  assert.ok(r.ok);assert.equal(r.value.entitled,false);
});
test('only live, unacknowledged purchases need acknowledgement',()=>{
  const live=evaluateSubscription(v2(),'rsd_pro',NOW);assert.ok(live.ok);assert.equal(live.value.needsAcknowledgement,true);
  const pending=evaluateSubscription(v2({subscriptionState:'SUBSCRIPTION_STATE_PENDING'}),'rsd_pro',NOW);assert.ok(pending.ok);assert.equal(pending.value.needsAcknowledgement,false);assert.equal(pending.value.pending,true);
  const done=evaluateSubscription(v2({acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'}),'rsd_pro',NOW);assert.ok(done.ok);assert.equal(done.value.needsAcknowledgement,false);
});
test('unknown product, unknown base plan and absurd expiry are rejected',()=>{
  assert.deepEqual(evaluateSubscription(v2({},{productId:'other'}),'rsd_pro',NOW),{ok:false,reason:'UNKNOWN_PRODUCT'});
  assert.deepEqual(evaluateSubscription(v2({},{offerDetails:{basePlanId:'weekly'}}),'rsd_pro',NOW),{ok:false,reason:'UNKNOWN_BASE_PLAN'});
  assert.deepEqual(evaluateSubscription(v2({},{expiryTime:days(5000)}),'rsd_pro',NOW),{ok:false,reason:'INVALID_EXPIRY'});
});
test('base plans map to plan keys, test purchases are flagged',()=>{
  const q=evaluateSubscription(v2({testPurchase:{}},{offerDetails:{basePlanId:'quarterly'},expiryTime:days(90)}),'rsd_pro',NOW);
  assert.ok(q.ok);assert.equal(q.value.planKey,'play_quarterly');assert.equal(q.value.isTest,true);
  const y=evaluateSubscription(v2({},{offerDetails:{basePlanId:'yearly'},expiryTime:days(365)}),'rsd_pro',NOW);
  assert.ok(y.ok);assert.equal(y.value.planKey,'play_yearly');
});

// ---- shared premium rule ------------------------------------------------------

const base:DbUser={id:'u',supabase_uid:'s',google_id:'g',email:'e@x.test',name:null,avatar_url:null,account_type:'FREE',subscription_status:'NONE',
  subscription_started_at:null,subscription_expires_at:null,subscription_plan:null,role:'user',learning_goals:[],education_medium:null,
  onboarding_completed:true,session_version:1,created_at:days(-10),updated_at:days(-10)};
test('premium = web access OR Play access; the later expiry is reported',()=>{
  const now=Date.now();const inDays=(d:number)=>new Date(now+d*864e5).toISOString();
  assert.equal(effectiveSubscription(base).active,false);
  const web={...base,account_type:'PREMIUM' as const,subscription_status:'ACTIVE' as const,subscription_expires_at:inDays(10),subscription_plan:'pro_sprint'};
  assert.deepEqual(effectiveSubscription(web),{active:true,source:'web',expiresAt:web.subscription_expires_at,plan:'pro_sprint'});
  const play={...base,play_expires_at:inDays(20),play_plan:'play_monthly'};
  assert.equal(effectiveSubscription(play).source,'google_play');
  assert.equal(effectiveSubscription({...web,play_expires_at:inDays(20),play_plan:'play_monthly'}).source,'google_play');
  assert.equal(effectiveSubscription({...web,play_expires_at:inDays(5),play_plan:'play_monthly'}).source,'web');
  assert.equal(effectiveSubscription({...base,play_expires_at:inDays(-1)}).active,false);
  // Columns absent (migration not applied yet) behave exactly as before
  assert.equal(effectiveSubscription(web).active,true);
});
test('PublicUser reports Play access through the fields existing clients already read',()=>{
  const pub=toPublicUser({...base,play_expires_at:new Date(Date.now()+864e5).toISOString(),play_plan:'play_yearly'});
  assert.equal(pub.accountType,'PREMIUM');assert.equal(pub.subscriptionStatus,'ACTIVE');
  assert.equal(pub.subscriptionPlan,'play_yearly');assert.equal(pub.subscriptionSource,'google_play');
  const free=toPublicUser(base);
  assert.equal(free.accountType,'FREE');assert.equal(free.subscriptionSource,null);
});

// ---- RTDN decoding --------------------------------------------------------

const push=(n:unknown,id='m1')=>({message:{data:Buffer.from(JSON.stringify(n)).toString('base64'),messageId:id},subscription:'projects/p/subscriptions/s'});
test('RTDN envelopes decode to subscription, voided and test notifications',()=>{
  const sub=decodePushEnvelope(push({packageName:'com.rsdeducation.student',eventTimeMillis:'1762473600000',subscriptionNotification:{notificationType:2,purchaseToken:'tok'}}));
  assert.ok(sub);assert.equal(sub.messageId,'m1');
  assert.deepEqual(parseNotification(sub.notification),{kind:'subscription',purchaseToken:'tok',notificationType:2,eventTime:'2025-11-07T00:00:00.000Z'});
  const voided=decodePushEnvelope(push({packageName:'x',voidedPurchaseNotification:{purchaseToken:'tok',orderId:'GPA.1',productType:1,refundType:1}}));
  assert.ok(voided);assert.equal(parseNotification(voided.notification).kind,'voided');
  const t=decodePushEnvelope(push({packageName:'x',testNotification:{version:'1.0'}}));
  assert.ok(t);assert.equal(parseNotification(t.notification).kind,'test');
  assert.equal(decodePushEnvelope({message:{data:'%%%not-base64-json',messageId:'m'}}),null);
  assert.equal(decodePushEnvelope({hello:'world'}),null);
});

// ---- syncPlayPurchase with stubbed Google API + database ---------------------

interface Port {google:Map<string,SubscriptionPurchaseV2>;owners:Map<string,string>;accounts:Map<string,string>;voided:Map<string,(string|null)[]>;rpc:Record<string,unknown>[];acks:string[];events:unknown[];rpcError?:{code:string;message:string}}
async function loadSync() {
  const out=await build({entryPoints:[resolve('../lib/payments/google-play/sync.ts')],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'ports',setup(b){
    b.onResolve({filter:/supabase-admin$|auth\/db$|^\.\/api$/},args=>({path:args.path,namespace:'port'}));
    b.onLoad({filter:/.*/,namespace:'port'},args=>({loader:'js',contents:
      args.path.endsWith('supabase-admin')?'export const supabaseAdmin=globalThis.port.db;':
      args.path.endsWith('auth/db')?'export const logSecurityEvent=async e=>{globalThis.port.events.push(e)};':
      `export class PlayApiError extends Error{constructor(kind,m){super(m);this.kind=kind}}
       export const getSubscriptionV2=async t=>{const p=globalThis.port.google.get(t);if(!p)throw new PlayApiError('NOT_FOUND','nf');return JSON.parse(JSON.stringify(p))};
       export const acknowledgeSubscription=async(_p,t)=>{globalThis.port.acks.push(t)};`}));
  }}]});
  const port:Port={google:new Map(),owners:new Map(),accounts:new Map(),voided:new Map(),rpc:[],acks:[],events:[]};
  // Minimal PostgREST-shaped fake for the reads sync.ts makes.
  const db={
    from(table:string){
      const filters:Record<string,unknown>={};
      const q={select(){return q;},eq(k:string,v:unknown){filters[k]=v;return q;},or(){return q;},limit(){return q;},is(){return q;},update(){return q;},
        maybeSingle:async()=>{
          if(table==='play_subscriptions'){const u=port.owners.get(filters.purchase_token as string);return {data:u?{user_id:u}:null,error:null};}
          if(table==='users'){const u=port.accounts.get(filters.play_account_id as string);return {data:u?{id:u}:null,error:null};}
          return {data:null,error:null};
        },
        then(ok:(v:unknown)=>unknown){return Promise.resolve({data:table==='play_rtdn_events'?(port.voided.get(filters.purchase_token as string)??[]).map(orderId=>({payload:{voidedPurchaseNotification:orderId?{orderId}:{}}})):[],error:null}).then(ok);},
      };
      return q;
    },
    rpc:async(_name:string,args:Record<string,unknown>)=>{
      port.rpc.push(args);
      if(port.rpcError)return {data:null,error:port.rpcError};
      port.owners.set(args.p_purchase_token as string,args.p_user_id as string);
      const entitled=!!args.p_entitled&&!args.p_revoked;
      return {data:[{user_id:args.p_user_id,play_expires_at:entitled?args.p_expiry_time:null,entitled,stale:false}],error:null};
    },
  };
  const module={exports:{} as Record<string,unknown>};
  // The sandbox object is the bundle's global, so `globalThis.port` is this same object.
  runInNewContext(out.outputFiles[0].text,{module,exports:module.exports,require,process,console,Buffer,URL,setTimeout,port:Object.assign(port,{db})});
  const syncPlayPurchase=(module.exports as {syncPlayPurchase:(i:Record<string,unknown>)=>Promise<Record<string,unknown>>}).syncPlayPurchase;
  // Results come from the vm realm; copy them into this realm for deepStrictEqual.
  return {sync:async(input:Record<string,unknown>)=>JSON.parse(JSON.stringify(await syncPlayPurchase(input))) as Record<string,unknown>,port};
}

test('sync: valid purchase is stored for the claimant, then acknowledged AFTER saving',async()=>{
  const {sync,port}=await loadSync();
  port.google.set('tok-1',v2({},{expiryTime:new Date(Date.now()+30*864e5).toISOString()}));
  port.accounts.set('acct-a','user-a');
  const r=await sync({purchaseToken:'tok-1',via:'client',claimantUserId:'user-a'});
  assert.equal(r.status,'synced');assert.equal(r.entitled,true);
  assert.equal(port.rpc[0].p_user_id,'user-a');assert.deepEqual(port.acks,['tok-1']);
});
test('sync: a token bought by another account is rejected and never stored',async()=>{
  const {sync,port}=await loadSync();
  port.google.set('tok-2',v2());port.accounts.set('acct-a','user-a');
  const r=await sync({purchaseToken:'tok-2',via:'client',claimantUserId:'user-b'});
  assert.deepEqual(r,{status:'rejected',reason:'OWNED_BY_OTHER_USER'});
  assert.equal(port.rpc.length,0);assert.equal(port.acks.length,0);
});
test('sync: an already-stored token stays with its first owner',async()=>{
  const {sync,port}=await loadSync();
  port.google.set('tok-3',v2({externalAccountIdentifiers:{}}));port.owners.set('tok-3','user-a');
  assert.deepEqual(await sync({purchaseToken:'tok-3',via:'client',claimantUserId:'user-b'}),{status:'rejected',reason:'OWNED_BY_OTHER_USER'});
});
test('sync: RTDN maps the token to its owner by obfuscatedAccountId, or leaves it unclaimed',async()=>{
  const {sync,port}=await loadSync();
  port.google.set('tok-4',v2({},{expiryTime:new Date(Date.now()+30*864e5).toISOString()}));port.accounts.set('acct-a','user-a');
  const r=await sync({purchaseToken:'tok-4',via:'rtdn',claimantUserId:null});
  assert.equal(r.status,'synced');assert.equal(r.userId,'user-a');
  port.google.set('tok-5',v2({externalAccountIdentifiers:{obfuscatedExternalAccountId:'acct-unknown'}}));
  assert.deepEqual(await sync({purchaseToken:'tok-5',via:'rtdn',claimantUserId:null}),{status:'unclaimed'});
});
test('sync: a plan change follows the replaced token’s owner',async()=>{
  const {sync,port}=await loadSync();
  port.owners.set('tok-old','user-a');
  port.google.set('tok-new',v2({linkedPurchaseToken:'tok-old',externalAccountIdentifiers:{}}));
  const r=await sync({purchaseToken:'tok-new',via:'rtdn',claimantUserId:null});
  assert.equal(r.status,'synced');assert.equal(r.userId,'user-a');assert.equal(port.rpc[0].p_linked_purchase_token,'tok-old');
});
test('sync: a refund recorded before the token was claimed still revokes it, and is not acknowledged',async()=>{
  const {sync,port}=await loadSync();
  port.google.set('tok-6',v2());port.accounts.set('acct-a','user-a');port.voided.set('tok-6',['GPA.1']);
  const r=await sync({purchaseToken:'tok-6',via:'client',claimantUserId:'user-a'});
  assert.equal(r.status,'synced');assert.equal(r.entitled,false);
  assert.equal(port.rpc[0].p_revoked,true);assert.equal(port.acks.length,0);
});
test('sync: tokens Google does not know, and unknown products, are rejected',async()=>{
  const {sync,port}=await loadSync();
  assert.deepEqual(await sync({purchaseToken:'tok-missing',via:'client',claimantUserId:'user-a'}),{status:'rejected',reason:'TOKEN_NOT_FOUND'});
  port.google.set('tok-7',v2({},{productId:'other_app_product'}));
  assert.deepEqual(await sync({purchaseToken:'tok-7',via:'client',claimantUserId:'user-a'}),{status:'rejected',reason:'UNKNOWN_PRODUCT'});
});
test('sync: the database ownership guard (race) is reported as OWNED_BY_OTHER_USER',async()=>{
  const {sync,port}=await loadSync();
  port.google.set('tok-8',v2({externalAccountIdentifiers:{}}));
  port.rpcError={code:'42501',message:'PLAY_PURCHASE_OWNED_BY_OTHER_USER'};
  assert.deepEqual(await sync({purchaseToken:'tok-8',via:'client',claimantUserId:'user-b'}),{status:'rejected',reason:'OWNED_BY_OTHER_USER'});
  assert.equal(port.acks.length,0);
});
test('sync: refunding an older month does not block a later paid renewal',async()=>{
  const {sync,port}=await loadSync();
  // Month 1 (GPA.1) was refunded; Google has since renewed with a new paid order GPA.1..1
  port.google.set('tok-9',v2({},{latestSuccessfulOrderId:'GPA.1..1',expiryTime:new Date(Date.now()+30*864e5).toISOString()}));
  port.accounts.set('acct-a','user-a');port.voided.set('tok-9',['GPA.1']);
  const r=await sync({purchaseToken:'tok-9',via:'rtdn',claimantUserId:null});
  assert.equal(r.status,'synced');assert.equal(r.entitled,true);assert.equal(port.rpc[0].p_revoked,false);
});
test('sync: a voided notice without an order id revokes the current order (conservative)',async()=>{
  const {sync,port}=await loadSync();
  port.google.set('tok-10',v2());port.accounts.set('acct-a','user-a');port.voided.set('tok-10',[null]);
  const r=await sync({purchaseToken:'tok-10',via:'rtdn',claimantUserId:null});
  assert.equal(r.entitled,false);assert.equal(port.rpc[0].p_revoked,true);
});
