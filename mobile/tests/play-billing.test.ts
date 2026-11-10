import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIRM_RETRY_DELAYS, PAID_NOT_CONFIRMED, isTransient, createPlayBillingFlow, describePeriod, isPrepaidOffer, matchOffers, PlayFlowError, type PlayConfig, type PlayNative, type PlayProduct, type PlayPurchase, type VerifyResponse } from '../services/play-billing-flow';
import type { PublicUser } from '../types/auth';

const user:PublicUser={id:'student',email:'student@example.test',name:'Student',avatarUrl:null,accountType:'PREMIUM',subscriptionStatus:'ACTIVE',subscriptionExpiresAt:'2027-01-07T00:00:00Z',subscriptionPlan:'play_monthly',subscriptionSource:'google_play',role:'user',onboardingCompleted:true,learningGoals:[]};
const config:PlayConfig={configured:true,packageName:'com.rsdeducation.student',productId:'rsd_pro',obfuscatedAccountId:'acct-me',features:['All mocks'],plans:[
  {key:'play_monthly',basePlanIds:['monthly','monthly-prepaid'],name:'Pro 1 Month',period:'1 month',badge:null,popular:false},
  {key:'play_quarterly',basePlanIds:['quarterly','quarterly-prepaid'],name:'Pro 3 Months',period:'3 months',badge:'Most popular',popular:true},
  {key:'play_yearly',basePlanIds:['yearly','yearly-prepaid'],name:'Pro 1 Year',period:'12 months',badge:'Best value',popular:false},
]};
const phase=(price:string,period:string,mode=1,micros=1)=>({formattedPrice:price,priceAmountMicros:micros,priceCurrencyCode:'INR',billingPeriod:period,billingCycleCount:mode===1?0:1,recurrenceMode:mode});
const product:PlayProduct={productId:'rsd_pro',title:'RSD Pro',name:'RSD Pro',offers:[
  // monthly: an old auto-renewing base plan AND a prepaid one under the alias id: prepaid wins
  {basePlanId:'monthly',offerId:null,offerToken:'tok-monthly-autorenew',offerTags:[],pricingPhases:[phase('₹199.00','P1M',1)]},
  {basePlanId:'monthly-prepaid',offerId:null,offerToken:'tok-monthly-prepaid',offerTags:[],pricingPhases:[phase('₹199.00','P1M',3)]},
  // quarterly: prepaid under the main id
  {basePlanId:'quarterly',offerId:null,offerToken:'tok-quarterly-prepaid',offerTags:[],pricingPhases:[phase('₹499.00','P3M',3)]},
  // yearly: only auto-renewing exists, so it is never shown (no auto-pay is ever sold)
  {basePlanId:'yearly',offerId:null,offerToken:'tok-yearly-autorenew',offerTags:[],pricingPhases:[phase('₹999.00','P1Y',1)]},
]};
const purchase=(token:string,extra:Partial<PlayPurchase>={}):PlayPurchase=>({purchaseToken:token,products:['rsd_pro'],orderId:'GPA.1',purchaseState:1,purchaseTime:1,isAcknowledged:false,isAutoRenewing:true,obfuscatedAccountId:'acct-me',...extra});

function fixture(waits:number[]=[]) {
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
  },wait:async ms=>{waits.push(ms);}});
  return {flow,calls,launches,setOwned:(p:PlayPurchase[])=>{owned=p;},setSheet:(f:typeof sheet)=>{sheet=f;},setVerify:(f:typeof verify)=>{verify=f;}};
}
const serverError=(code:string,status=409)=>Object.assign(new Error(code),{code,status});

test('billing periods read naturally',()=>{
  assert.equal(describePeriod('P1M'),'month');assert.equal(describePeriod('P3M'),'3 months');
  assert.equal(describePeriod('P1Y'),'year');assert.equal(describePeriod('P7D'),'7 days');
});

test('only prepaid (no auto-pay) offers are sold, with Google prices; auto-renewing ones are never shown',()=>{
  const offers=matchOffers(config.configured?config.plans:[],product);
  assert.deepEqual(offers.map(o=>o.plan.key),['play_monthly','play_quarterly']);
  assert.equal(offers[0].offerToken,'tok-monthly-prepaid');assert.equal(offers[0].price,'₹199.00');
  assert.equal(offers[1].offerToken,'tok-quarterly-prepaid');assert.equal(offers[1].billingPeriod,'P3M');
  assert.ok(isPrepaidOffer(product.offers[1]));assert.ok(!isPrepaidOffer(product.offers[0]));
  assert.deepEqual(matchOffers(config.configured?config.plans:[],null),[]);
});

test('a purchase is granted only from the server verify answer, with the account id passed to Google',async()=>{
  const f=fixture();
  const {offers}=await f.flow.offers();
  const outcome=await f.flow.buy(offers[1]);
  assert.equal(outcome.kind,'active');
  assert.deepEqual(f.launches[0],['rsd_pro','tok-quarterly-prepaid','acct-me',null,null]);
  assert.deepEqual(f.calls.at(-1),{path:'/api/payments/google-play/verify',body:{purchaseToken:'token-new'}});
});

test('a pending (UPI / cash) purchase is reported as pending, not active',async()=>{
  const f=fixture();
  f.setSheet(async()=>[purchase('token-pending',{purchaseState:2})]);
  f.setVerify(async()=>({user:{...user,accountType:'FREE',subscriptionStatus:'NONE'},subscription:{planKey:'play_monthly',state:'SUBSCRIPTION_STATE_PENDING',entitled:false,pending:true,autoRenewing:true,expiresAt:null}}));
  const {offers}=await f.flow.offers();
  assert.equal((await f.flow.buy(offers[0])).kind,'pending');
});

test('buying again while Pro is active is a plain top-up: no replacement token, nothing auto-renews',async()=>{
  const f=fixture();
  f.setOwned([purchase('token-old')]);
  const {offers}=await f.flow.offers();
  await f.flow.buy(offers[1]);
  assert.deepEqual(f.launches[0].slice(3),[null,null]);
});

test('cancel maps to CANCELLED; already-owned links the existing subscription instead of failing',async()=>{
  const f=fixture();
  const {offers}=await f.flow.offers();
  f.setSheet(async()=>{throw Object.assign(new Error('x'),{code:'E_PLAY_CANCELLED'});});
  await assert.rejects(f.flow.buy(offers[0]),(e:unknown)=>e instanceof PlayFlowError&&e.code==='CANCELLED');
  f.setSheet(async()=>{throw Object.assign(new Error('x'),{code:'E_PLAY_ALREADY_OWNED'});});
  f.setOwned([purchase('token-owned')]);
  assert.equal((await f.flow.buy(offers[0])).kind,'active');
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
  const first=f.flow.buy(offers[0]);
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

// ---- Money safety: the connection drops after Google has charged ----------

const ok:VerifyResponse={user,subscription:{planKey:'play_monthly',state:'SUBSCRIPTION_STATE_ACTIVE',entitled:true,pending:false,autoRenewing:false,expiresAt:'2027-02-07T00:00:00Z'}};
const offline=()=>Object.assign(new Error('Could not reach RSD Education.'),{code:'NETWORK_ERROR',status:0});

test('connection drops after Google charged: the confirmation is retried and Pro turns on',async()=>{
  const waits:number[]=[];
  const f=fixture(waits);
  let calls=0;
  f.setVerify(async()=>{calls++;if(calls<3)throw offline();return ok;});
  const {offers}=await f.flow.offers();
  const outcome=await f.flow.buy(offers[0]);
  assert.equal(outcome.kind,'active');
  assert.equal(calls,3,'verified on the third try');
  assert.deepEqual(waits,CONFIRM_RETRY_DELAYS.slice(0,2));
  assert.equal(f.launches.length,1,'Google was asked to charge exactly once');
});

test('still offline after every retry: says "do not pay again" and never grants or re-charges',async()=>{
  const waits:number[]=[];
  const f=fixture(waits);
  f.setVerify(async()=>{throw offline();});
  const {offers}=await f.flow.offers();
  await assert.rejects(f.flow.buy(offers[0]),(e:unknown)=>e instanceof PlayFlowError&&e.code==='NOT_VERIFIED'&&e.message===PAID_NOT_CONFIRMED&&/Do not pay again/.test(e.message));
  assert.equal(waits.length,CONFIRM_RETRY_DELAYS.length,'every retry was used');
  assert.equal(f.launches.length,1,'no second charge');
});

test('the server is busy (5xx / 429) after the charge: retried like a dropped connection',async()=>{
  const f=fixture();
  let calls=0;
  f.setVerify(async()=>{calls++;if(calls===1)throw serverError('GATEWAY_ERROR',502);if(calls===2)throw serverError('RATE_LIMITED',429);return ok;});
  const {offers}=await f.flow.offers();
  assert.equal((await f.flow.buy(offers[0])).kind,'active');
});

test('a clear refusal after the charge (4xx) is not retried, and still says do not pay again',async()=>{
  const waits:number[]=[];
  const f=fixture(waits);
  let calls=0;
  f.setVerify(async()=>{calls++;throw serverError('TOKEN_NOT_FOUND',400);});
  const {offers}=await f.flow.offers();
  await assert.rejects(f.flow.buy(offers[0]),(e:unknown)=>e instanceof PlayFlowError&&e.code==='NOT_VERIFIED');
  assert.equal(calls,1);assert.deepEqual(waits,[]);
});

test('a purchase owned by another RSD account is explained, not retried and not hidden as "not confirmed"',async()=>{
  const f=fixture();
  f.setVerify(async()=>{throw serverError('OWNED_BY_OTHER_USER');});
  const {offers}=await f.flow.offers();
  await assert.rejects(f.flow.buy(offers[0]),(e:unknown)=>e instanceof PlayFlowError&&e.code==='OWNED_BY_OTHER_ACCOUNT');
});

test('after an unconfirmed payment, the next quiet sync (app start, back online, plans screen) turns Pro on',async()=>{
  const f=fixture();
  f.setVerify(async()=>{throw offline();});
  const {offers}=await f.flow.offers();
  await assert.rejects(f.flow.buy(offers[0]));
  f.setOwned([purchase('token-new',{isAcknowledged:false})]);
  f.setVerify(async()=>ok);
  assert.equal((await f.flow.restore(true)).kind,'active');
  assert.deepEqual(f.calls.at(-1)?.body,{purchaseToken:'token-new'});
});

test('a pending UPI payment whose confirmation drops is retried and reported as pending, not paid',async()=>{
  const f=fixture();
  f.setSheet(async()=>[purchase('token-pending',{purchaseState:2})]);
  let calls=0;
  f.setVerify(async()=>{calls++;if(calls===1)throw offline();return {user:{...user,accountType:'FREE',subscriptionStatus:'NONE'},subscription:{planKey:'play_monthly',state:'SUBSCRIPTION_STATE_PENDING',entitled:false,pending:true,autoRenewing:false,expiresAt:null}};});
  const {offers}=await f.flow.offers();
  assert.equal((await f.flow.buy(offers[0])).kind,'pending');
});

test('only dropped connections and busy servers count as worth retrying',()=>{
  assert.equal(isTransient(offline()),true);
  assert.equal(isTransient(serverError('X',503)),true);
  assert.equal(isTransient(serverError('X',429)),true);
  assert.equal(isTransient(new Error('socket hang up')),true);
  assert.equal(isTransient(serverError('X',400)),false);
  assert.equal(isTransient(serverError('X',409)),false);
});
