import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentFlow, type CheckoutOrder, type PaymentReceipt, type Recovery } from '../services/payment-flow';
import { hasActiveSubscription, formatPrice, subscriptionDate } from '../utils/subscription';
import type { PublicUser } from '../types/auth';

const user:PublicUser={id:'student',email:'student@example.test',name:'Student',avatarUrl:null,accountType:'PREMIUM',subscriptionStatus:'ACTIVE',subscriptionExpiresAt:'2027-04-01T00:00:00Z',subscriptionPlan:'pro_full',role:'user',onboardingCompleted:true,learningGoals:[]};
const order:CheckoutOrder={orderId:'order_test',amount:48750,currency:'INR',keyId:'public-test-key',plan:{id:'pro_full',name:'Server plan'},prefill:{name:'Student',email:'student@example.test'}};
const receipt:PaymentReceipt={razorpay_order_id:order.orderId,razorpay_payment_id:'pay_test',razorpay_signature:'test-signature'};
function fixture() {
  const records=new Map<string,unknown>();
  const calls:{path:string;body:unknown}[]=[];
  const opened:CheckoutOrder[]=[];
  let checkout:()=>Promise<PaymentReceipt>=async()=>receipt;
  let verify:()=>Promise<{user:PublicUser}>=async()=>({user});
  let recovery:Recovery={settled:true,outcome:'activated',user};
  let enabled=true;
  const flow=createPaymentFlow({
    canCheckout:()=>enabled,
    storage:{read:async<T>(key:string)=>structuredClone(records.get(key)??null) as T|null,write:async(key,value)=>{records.set(key,structuredClone(value));},remove:async key=>{records.delete(key);}},
    request:async<T>(path:string,_method?:string,body?:unknown)=>{
      calls.push({path,body});
      return (path.endsWith('/orders')?order:path.endsWith('/verify')?await verify():recovery) as T;
    },
    checkout:async input=>{opened.push(input);return checkout();},
  });
  return {flow,records,calls,opened,setCheckout:(next:typeof checkout)=>{checkout=next;},setVerify:(next:typeof verify)=>{verify=next;},setRecovery:(next:Recovery)=>{recovery=next;},disable:()=>{enabled=false;}};
}
test('checkout uses the server amount and sends only the chosen plan and coupon; renewal returns verified expiry',async()=>{
  const f=fixture();const renewed={...user,subscriptionExpiresAt:'2027-09-28T00:00:00Z'};
  f.setVerify(async()=>({user:renewed}));
  assert.deepEqual(await f.flow.buy(user.id,'pro_full','PROMO'),renewed);
  assert.deepEqual(f.calls[0],{path:'/api/payments/orders',body:{planId:'pro_full',couponCode:'PROMO'}});
  assert.equal(f.opened[0].amount,48750);
  assert.deepEqual(f.calls[1],{path:'/api/payments/verify',body:receipt});
  assert.equal(await f.flow.pending(user.id),null);
});
test('native success followed by verification failure keeps the receipt and does not grant access',async()=>{
  const f=fixture();f.setVerify(async()=>{throw new Error('Verification unavailable');});
  await assert.rejects(f.flow.buy(user.id,'pro_full'),/Verification unavailable/);
  assert.deepEqual((await f.flow.pending(user.id))?.receipt,receipt);
  await assert.rejects(f.flow.buy(user.id,'pro_full'),/pending payment/);
  assert.equal(f.opened.length,1);
});
test('cancelled checkout keeps the order for recovery; an unpaid result allows a fresh checkout',async()=>{
  const f=fixture();f.setCheckout(async()=>{throw new Error('Closed');});
  await assert.rejects(f.flow.buy(user.id,'pro_full'),/Closed/);
  assert.equal(f.calls.some(call=>call.path.endsWith('/verify')),false);
  f.setRecovery({settled:true,outcome:'no_payment',user:{...user,accountType:'FREE',subscriptionStatus:'NONE'}});
  assert.equal((await f.flow.recover(user.id))?.outcome,'no_payment');
  assert.equal(await f.flow.pending(user.id),null);
  f.setCheckout(async()=>receipt);
  await f.flow.buy(user.id,'pro_full');assert.equal(f.opened.length,2);
});
test('pending and transient recovery errors retain the order until the server confirms settlement',async()=>{
  for(const outcome of ['pending','error']){
    const f=fixture();f.records.set('pending-payment',{userId:user.id,orderId:order.orderId});
    f.setRecovery({settled:false,outcome,user});
    assert.equal((await f.flow.recover(user.id))?.outcome,outcome);
    assert.ok(await f.flow.pending(user.id));
    await assert.rejects(f.flow.buy(user.id,'pro_full'),/pending payment/);
    f.setRecovery({settled:true,outcome:'already_paid',user});
    assert.deepEqual((await f.flow.recover(user.id))?.user,user);
    assert.equal(await f.flow.pending(user.id),null);
  }
});
test('rapid duplicate taps create one checkout and recovery cannot run during it',async()=>{
  const f=fixture();let complete!:(value:PaymentReceipt)=>void;
  f.setCheckout(()=>new Promise(resolve=>{complete=resolve;}));
  const first=f.flow.buy(user.id,'pro_full');
  await assert.rejects(f.flow.buy(user.id,'pro_full'),/already being checked/);
  await assert.rejects(f.flow.recover(user.id),/already being checked/);
  complete(receipt);await first;
  assert.equal(f.calls.filter(call=>call.path.endsWith('/orders')).length,1);
});
test('another user cannot recover a stored payment and unsupported builds cannot create orders',async()=>{
  const f=fixture();f.records.set('pending-payment',{userId:'other-student',orderId:order.orderId});
  assert.equal(await f.flow.pending(user.id),null);assert.equal(await f.flow.recover(user.id),null);
  f.disable();await assert.rejects(f.flow.buy(user.id,'pro_full'),/unavailable/);
  assert.equal(f.calls.length,0);
});
test('a receipt for a different order is never submitted for verification',async()=>{
  const f=fixture();f.setCheckout(async()=>({...receipt,razorpay_order_id:'order_other'}));
  await assert.rejects(f.flow.buy(user.id,'pro_full'),/did not match/);
  assert.equal(f.calls.some(call=>call.path.endsWith('/verify')),false);
  assert.ok(await f.flow.pending(user.id));
});
test('active-plan labels distinguish free, expired and cancelled access; prices keep paise',()=>{
  const now=Date.parse('2026-10-11T00:00:00Z');
  assert.equal(hasActiveSubscription(user,now),true);
  for(const changed of [{accountType:'FREE' as const},{subscriptionStatus:'CANCELLED' as const},{subscriptionExpiresAt:'2026-01-01T00:00:00Z'},{subscriptionExpiresAt:'invalid'}])assert.equal(hasActiveSubscription({...user,...changed},now),false);
  assert.equal(hasActiveSubscription(null,now),false);
  assert.equal(formatPrice(48750),'₹487.5');assert.equal(formatPrice(59900),'₹599');
  assert.equal(subscriptionDate('invalid'),null);
});
