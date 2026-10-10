import { useState } from 'react';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Card, Heading, Body, Button, Input, ErrorState, Loading } from '@/components/ui';
import { paymentService, canCheckout } from '@/services/payment-service';
import { useAuth } from '@/store/auth';
export default function Subscription() {
  const auth=useAuth();const cache=useQueryClient();const [code,setCode]=useState('');const [message,setMessage]=useState('');
  const plans=useQuery({queryKey:['plans'],queryFn:paymentService.plans});const history=useQuery({queryKey:['payments'],queryFn:paymentService.history});
  const pending=useQuery({queryKey:['pending-payment',auth.user?.id],queryFn:()=>paymentService.pending(auth.user!.id)});
  const coupon=useMutation({mutationFn:()=>paymentService.coupon(code)});
  const refresh=async()=>{await auth.reload();await cache.invalidateQueries();};
  const buy=useMutation({mutationFn:(id:string)=>paymentService.buy(auth.user!.id,id,coupon.data?.valid?coupon.data.code:undefined),onSuccess:async user=>{auth.update(user);setMessage('Payment verified. Your subscription is active.');await cache.invalidateQueries();},onSettled:()=>pending.refetch()});
  const recover=useMutation({mutationFn:()=>paymentService.recover(auth.user!.id),onSuccess:async data=>{if(data){auth.update(data.user);setMessage(data.outcome==='activated'||data.outcome==='already_paid'?'Payment confirmed. Your access is up to date.':data.outcome==='pending'?'Payment is still processing. Check again shortly.':`Payment status: ${data.outcome}`);}await cache.invalidateQueries();}});
  return <Screen title="Your subscription" subtitle="Keep your preparation moving." refreshing={history.isRefetching} onRefresh={()=>void refresh()}>
    <Card gold><Heading>{auth.user?.accountType==='PREMIUM'?'RSD Pro':'Free account'}</Heading><Body>Status: {auth.user?.subscriptionStatus}</Body><Body>Plan: {auth.user?.subscriptionPlan||'Free'}</Body><Body>{auth.user?.subscriptionExpiresAt?`Expires ${new Date(auth.user.subscriptionExpiresAt).toLocaleDateString()}`:'No active subscription'}</Body><Button secondary label="Refresh access" onPress={()=>void refresh()}/></Card>
    {!canCheckout&&<Card><Heading>Existing subscription access</Heading><Body>This build supports your existing RSD Education subscription. In-app purchasing is not available in this distribution.</Body></Card>}
    {plans.isLoading&&<Loading/>}{plans.error&&<ErrorState error={plans.error} retry={()=>void plans.refetch()}/>}
    {canCheckout&&<Card><Input label="Coupon code (optional)" value={code} onChangeText={text=>{setCode(text);coupon.reset();}}/><Button secondary label="Apply coupon" disabled={!code.trim()} busy={coupon.isPending} onPress={()=>coupon.mutate()}/>{coupon.data&&<Body>{coupon.data.valid?`${coupon.data.discountPercent}% discount applied`:'This coupon is not valid.'}</Body>}{coupon.error&&<ErrorState error={coupon.error}/>}</Card>}
    {plans.data?.plans.map(plan=><Card key={plan.id} gold={plan.popular}><Heading>{plan.name}</Heading><Body>{plan.badge}</Body><Heading>₹{((coupon.data?.prices?.[plan.id]??plan.amountPaise)/100).toLocaleString('en-IN')} {plan.period}</Heading>{plan.features.map(feature=><Body key={feature}>• {feature}</Body>)}{canCheckout&&<Button label={`Choose ${plan.name}`} busy={buy.isPending} disabled={!!pending.data||recover.isPending} onPress={()=>buy.mutate(plan.id)}/>}</Card>)}
    {message&&<Card><Body>{message}</Body></Card>}{buy.error&&<ErrorState error={buy.error}/>}{recover.error&&<ErrorState error={recover.error}/>}
    {pending.data&&<Card><Heading>Pending payment</Heading><Body>Your checkout may have been interrupted. The server can check the payment directly with Razorpay.</Body><Button label="Check payment status" busy={recover.isPending} onPress={()=>recover.mutate()}/></Card>}
    <Card><Heading>Payment history</Heading>{history.isLoading&&<Loading/>}{history.error&&<ErrorState error={history.error} retry={()=>void history.refetch()}/>} {!history.data?.orders.length&&<Body>No payments to show.</Body>}{history.data?.orders.map(order=><Body key={order.id}>{order.planId} · ₹{order.amount/100} · {order.status} · {new Date(order.createdAt).toLocaleDateString()}</Body>)}</Card><Button secondary label="Back home" onPress={()=>router.replace('/')}/>
  </Screen>;
}
