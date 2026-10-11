import type { PublicUser } from '../types/auth';

export interface CheckoutOrder {orderId:string;amount:number;currency:string;keyId:string;plan:{id:string;name:string};prefill:{name:string;email:string}}
export interface PaymentReceipt {razorpay_order_id:string;razorpay_payment_id:string;razorpay_signature:string}
export interface PendingPayment {userId:string;orderId:string;receipt?:PaymentReceipt}
export interface Recovery {settled:boolean;outcome:string;user:PublicUser}
interface PaymentPorts {
  request:<T>(path:string,method?:string,body?:unknown)=>Promise<T>;
  storage:{read:<T>(key:string)=>Promise<T|null>;write:(key:string,value:unknown)=>Promise<void>;remove:(key:string)=>Promise<void>};
  checkout:(order:CheckoutOrder)=>Promise<PaymentReceipt>;
  canCheckout:()=>boolean;
}

// Keep interrupted orders encrypted and grant access only from a server response.
export function createPaymentFlow({request,storage,checkout,canCheckout}:PaymentPorts) {
  let working=false;
  async function pending(userId:string) {
    const saved=await storage.read<PendingPayment>('pending-payment');
    return saved?.userId===userId?saved:null;
  }
  async function exclusively<T>(action:()=>Promise<T>) {
    if(working)throw new Error('A payment is already being checked. Please wait.');
    working=true;
    try{return await action();}finally{working=false;}
  }
  return {
    pending,
    recover:(userId:string)=>exclusively(async()=>{
      const saved=await pending(userId);
      if(!saved)return null;
      const result=await request<Recovery>('/api/payments/recover','POST',{orderId:saved.orderId});
      if(result.settled)await storage.remove('pending-payment');
      return result;
    }),
    buy:(userId:string,planId:string,couponCode?:string)=>exclusively(async()=>{
      if(!canCheckout())throw new Error('Checkout is unavailable in this distribution.');
      if(await pending(userId))throw new Error('Check your pending payment before starting another checkout.');
      const order=await request<CheckoutOrder>('/api/payments/orders','POST',{planId,couponCode});
      const saved:PendingPayment={userId,orderId:order.orderId};
      await storage.write('pending-payment',saved);
      const receipt=await checkout(order);
      if(receipt.razorpay_order_id!==order.orderId)throw new Error('Payment confirmation did not match this order. Check payment status.');
      saved.receipt=receipt;
      await storage.write('pending-payment',saved);
      const verified=await request<{user:PublicUser}>('/api/payments/verify','POST',receipt);
      await storage.remove('pending-payment');
      return verified.user;
    }),
  };
}
