import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayBillingFlow, describePeriod, matchOffers, PlayFlowError, type PlayConfig, type PlayNative, type PlayProduct, type PlayPurchase, type VerifyResponse } from '../services/play-billing-flow';
import type { PublicUser } from '../types/auth';

const user:PublicUser={id:'student',email:'student@example.test',name:'Student',avatarUrl:null,accountType:'PREMIUM',subscriptionStatus:'ACTIVE',subscriptionExpiresAt:'2027-01-07T00:00:00Z',subscriptionPlan:'play_monthly',subscriptionSource:'google_play',role:'user',onboardingCompleted:true,learningGoals:[]};
const config:PlayConfig={configured:true,packageName:'com.rsdeducation.student',productId:'rsd_pro',obfuscatedAccountId:'acct-me',features:['All mocks'],plans:[
  {key:'play_monthly',basePlanId:'monthly',name:'Pro Monthly',period:'Billed every month',badge:null,popular:false},
  {key:'play_quarterly',basePlanId:'quarterly',name:'Pro Quarterly',period:'Billed every 3 months',badge:'Most popular',popular:true},
  {key:'play_yearly',basePlanId:'yearly',name:'Pro Yearly',period:'Billed every year',badge:'Best value',popular:false},
]};
const phase=(price:string,period:string,mode=1,micros=1)=>({formattedPrice:price,priceAmountMicros:micros,priceCurrencyCode:'INR',billingPeriod:period,billingCycleCount:mode===1?0:1,recurrenceMode:mode});
const product:PlayProduct={productId:'rsd_pro',title:'RSD Pro',name:'RSD Pro',offers:[
  {basePlanId:'monthly',offerId:null,offerToken:'tok-monthly',offerTags:[],pricingPhases:[phase('₹199.00','P1M')]},
  {basePlanId:'quarterly',offerId:null,offerToken:'tok-quarterly-base',offerTags:[],pricingPhases:[phase('₹499.00','P3M')]},
  {basePlanId:'quarterly',offerId:'trial7',offerToken:'tok-quarterly-trial',offerTags:[],pricingPhases:[phase('Free','P7D',3,0),phase('₹499.00','P3M')]},
  // yearly not activated in Play Console → not returned → not shown
]};
const purchase=(token:string,extra:Partial<PlayPurchase>={}):PlayPurchase=>({purchaseToken:token,products:['rsd_pro'],orderId:'GPA.1',purchaseState:1,purchaseTime:1,isAcknowledged:false,isAutoRenewing:true,obfuscatedAccountId:'acct-me',...extra});

function fixture() {
  const calls:{path:string;body:unknown}[]=[];
  const launches:unknown[][]=[];
  let owned:PlayPurchase[]=[];
  let sheet:()=>Promise<PlayPurchase[]>=async()=>[purchase('token-new')];
  let verify:(token:string)=>Promise<VerifyResponse>=async()=>({user,subscription:{planKey:'play_quarterly',state:'SUBSCRIPTION_STATE_ACTIVE',entitled:true,pending:false,autoRenewing:true,expiresAt:'2027-02-07T00:00:00Z'}});
  const native:PlayNative={
    getSubscription:async()=>product,
    purchase:async(...args)=>{launches.push(args);return sheet();},
    queryActivePurchases:async()=>owned,
  };
  const flow=createPlayBillingFlow({native,request:async<T>(path:string,_m?:string,body?:unknown)=>{
    calls.push({path,body});
    if(path.endsWith('/config'))return config as T;
    return await verify((body as {purchaseToken:string}).purchaseToken) as T;
  }});
  return {flow,calls,launches,setOwned:(p:PlayPurchase[])=>{owned=p;},setSheet:(f:typeof sheet)=>{sheet=f;},setVerify:(f:typeof verify)=>{verify=f;}};
}
const serverError=(code:string,status=409)=>Object.assign(new Error(code),{code,status});

test('billing periods read naturally',()=>{
  assert.equal(describePeriod('P1M'),'month');assert.equal(describePeriod('P3M'),'3 months');
  assert.equal(describePeriod('P1Y'),'year');assert.equal(describePeriod('P7D'),'7 days');
});

test('offers use Google prices, prefer an eligible intro offer, and hide plans Play did not return',()=>{
  const offers=matchOffers(config.configured?config.plans:[],product);
  assert.deepEqual(offers.map(o=>o.plan.key),['play_monthly','play_quarterly']);
  assert.equal(offers[0].price,'₹199.00');
  assert.equal(offers[1].offerToken,'tok-quarterly-trial');
  assert.equal(offers[1].price,'₹499.00');assert.equal(offers[1].billingPeriod,'P3M');
  assert.equal(offers[1].intro[0].priceAmountMicros,0);
  assert.deepEqual(matchOffers(config.configured?config.plans:[],null),[]);
});

test('a purchase is granted only from the server verify answer, with the account id passed to Google',async()=>{
  const f=fixture();
  const {offers}=await f.flow.offers();
  const outcome=await f.flow.buy(offers[1],null);
  assert.equal(outcome.kind,'active');
  assert.deepEqual(f.launches[0],['rsd_pro','tok-quarterly-trial','acct-me',null,null]);
  assert.deepEqual(f.calls.at(-1),{path:'/api/payments/google-play/verify',body:{purchaseToken:'token-new'}});
});

test('a pending (UPI / cash) purchase is reported as pending, not active',async()=>{
  const f=fixture();
  f.setSheet(async()=>[purchase('token-pending',{purchaseState:2})]);
  f.setVerify(async()=>({user:{...user,accountType:'FREE',subscriptionStatus:'NONE'},subscription:{planKey:'play_monthly',state:'SUBSCRIPTION_STATE_PENDING',entitled:false,pending:true,autoRenewing:true,expiresAt:null}}));
  const {offers}=await f.flow.offers();
  assert.equal((await f.flow.buy(offers[0],null)).kind,'pending');
});

test('changing plan hands Google the current token for replacement',async()=>{
  const f=fixture();
  f.setOwned([purchase('token-old'),purchase('token-foreign',{obfuscatedAccountId:'acct-other'})]);
  const {offers}=await f.flow.offers();
  await f.flow.buy(offers[1],'play_monthly');
  assert.deepEqual(f.launches[0].slice(3),['token-old',1]);
});

test('cancel maps to CANCELLED; already-owned links the existing subscription instead of failing',async()=>{
  const f=fixture();
  const {offers}=await f.flow.offers();
  f.setSheet(async()=>{throw Object.assign(new Error('x'),{code:'E_PLAY_CANCELLED'});});
  await assert.rejects(f.flow.buy(offers[0],null),(e:unknown)=>e instanceof PlayFlowError&&e.code==='CANCELLED');
  f.setSheet(async()=>{throw Object.assign(new Error('x'),{code:'E_PLAY_ALREADY_OWNED'});});
  f.setOwned([purchase('token-owned')]);
  assert.equal((await f.flow.buy(offers[0],null)).kind,'active');
  assert.deepEqual(f.calls.at(-1)?.body,{purchaseToken:'token-owned'});
});

test('a subscription owned by another RSD account is explained on restore, and skipped on quiet start-up sync',async()=>{
  const f=fixture();
  f.setOwned([purchase('token-foreign',{obfuscatedAccountId:'acct-other'})]);
  f.setVerify(async()=>{throw serverError('OWNED_BY_OTHER_USER');});
  await assert.rejects(f.flow.restore(false),(e:unknown)=>e instanceof PlayFlowError&&e.code==='OWNED_BY_OTHER_ACCOUNT');
  const before=f.calls.filter(c=>c.path.endsWith('/verify')).length;
  assert.deepEqual(await f.flow.restore(true),{kind:'none'});
  assert.equal(f.calls.filter(c=>c.path.endsWith('/verify')).length,before,'quiet sync never sends other accounts’ tokens');
});

test('quiet start-up sync never throws, even when the server is down',async()=>{
  const f=fixture();
  f.setOwned([purchase('token-mine')]);
  f.setVerify(async()=>{throw serverError('GATEWAY_ERROR',502);});
  assert.deepEqual(await f.flow.restore(true),{kind:'none'});
});

test('only one Play operation runs at a time',async()=>{
  const f=fixture();
  let release!:()=>void;
  f.setSheet(()=>new Promise(resolve=>{release=()=>resolve([purchase('token-new')]);}));
  const {offers}=await f.flow.offers();
  const first=f.flow.buy(offers[0],null);
  await new Promise(r=>setTimeout(r,0));
  await assert.rejects(f.flow.restore(false),(e:unknown)=>e instanceof PlayFlowError&&e.code==='BUSY');
  release();await first;
});

test('unconfigured server or missing native module is unavailable, not a crash',async()=>{
  const flow=createPlayBillingFlow({native:null,request:async<T>()=>config as T});
  await assert.rejects(flow.offers(),(e:unknown)=>e instanceof PlayFlowError&&e.code==='UNAVAILABLE');
  const off=createPlayBillingFlow({native:fixture().flow as unknown as PlayNative,request:async<T>()=>({configured:false}) as T});
  await assert.rejects(off.offers(),(e:unknown)=>e instanceof PlayFlowError&&e.code==='UNAVAILABLE');
});
