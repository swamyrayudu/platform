declare module 'react-native-razorpay' {
  interface Options { key:string; order_id:string; amount:number; currency:string; name:string; description:string; prefill:{name:string;email:string};theme:{color:string} }
  interface Receipt {razorpay_order_id:string;razorpay_payment_id:string;razorpay_signature:string}
  const RazorpayCheckout:{open(options:Options):Promise<Receipt>};
  export default RazorpayCheckout;
}
