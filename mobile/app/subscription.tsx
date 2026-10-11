import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen, Card, Heading, Body, Button, Input, ErrorState, Loading, Badge, s } from '@/components/ui';
import { paymentService, canCheckout, type Plan } from '@/services/payment-service';
import { useAuth } from '@/store/auth';
import { colors } from '@/utils/theme';
import { formatPrice, hasActiveSubscription, subscriptionDate } from '@/utils/subscription';
import type { PublicUser } from '@/types/auth';

export default function Subscription() {
  const {user,update}=useAuth();
  const userId=user?.id;
  const cache=useQueryClient();
  const [code,setCode]=useState('');
  const [message,setMessage]=useState('');
  const [refreshing,setRefreshing]=useState(false);
  const [expandedPlan,setExpandedPlan]=useState<string|null>(null);
  const paymentInProgress=useRef(false);
  const historyKey=['payments',userId];
  const plans=useQuery({queryKey:['plans'],queryFn:paymentService.plans,enabled:!!userId});
  const history=useQuery({queryKey:historyKey,queryFn:paymentService.history,enabled:!!userId});
  const pending=useQuery({queryKey:['pending-payment',userId],queryFn:()=>paymentService.pending(userId!),enabled:!!userId});
  const coupon=useMutation({mutationFn:(value:string)=>paymentService.coupon(value)});
  const normalizedCode=code.trim().toUpperCase();
  // Ignore old coupon responses when the input changes during a request.
  const appliedCoupon=coupon.data?.valid&&coupon.variables===normalizedCode?coupon.data:null;
  const subscribed=hasActiveSubscription(user);
  const expires=subscriptionDate(user?.subscriptionExpiresAt);
  const currentPlan=plans.data?.plans.find(plan=>plan.id===user?.subscriptionPlan);
  const previouslyPaid=!!user?.subscriptionPlan||!!history.data?.orders.some(order=>order.status==='PAID');

  useEffect(()=>{if(history.data)update(history.data.user);},[history.data,update]);
  const {refetch:refetchPlans}=plans;
  const {refetch:refetchHistory}=history;
  const {refetch:refetchPending}=pending;
  useFocusEffect(useCallback(()=>{
    if(userId)void Promise.all([refetchPlans({cancelRefetch:false}),refetchHistory({cancelRefetch:false}),refetchPending({cancelRefetch:false})]);
  },[userId,refetchPlans,refetchHistory,refetchPending]));

  const acceptVerifiedUser=(next:PublicUser)=>{
    update(next);
    cache.setQueryData<Awaited<ReturnType<typeof paymentService.history>>>(historyKey,old=>old?{...old,user:next}:old);
  };
  const buy=useMutation({
    mutationFn:({planId,couponCode}:{planId:string;couponCode?:string})=>paymentService.buy(userId!,planId,couponCode),
    onMutate:async()=>{setMessage('');await cache.cancelQueries({queryKey:historyKey});},
    onSuccess:async next=>{
      acceptVerifiedUser(next);
      setMessage(`Payment verified. Your subscription is up to date.${subscriptionDate(next.subscriptionExpiresAt)?` Access until ${subscriptionDate(next.subscriptionExpiresAt)}.`:''}`);
      await cache.invalidateQueries();
    },
    onSettled:async()=>{try{await refetchPending();}finally{paymentInProgress.current=false;}},
  });
  const recover=useMutation({
    mutationFn:()=>paymentService.recover(userId!),
    onMutate:async()=>{setMessage('');await cache.cancelQueries({queryKey:historyKey});},
    onSuccess:async data=>{
      if(data){
        acceptVerifiedUser(data.user);
        const messages:Record<string,string>={activated:'Payment confirmed. Your subscription has been updated.',already_paid:'Payment already confirmed. Your access is up to date.',pending:'Payment is still processing. Check again shortly before making another payment.',no_payment:'No payment was received. You can choose a plan and try again.',failed:'This payment failed. You can choose a plan and try again.',error:'Payment could not be confirmed yet. Please check again shortly.'};
        setMessage(messages[data.outcome]??'Please check payment status again shortly.');
      }
      await cache.invalidateQueries();
    },
    onSettled:async()=>{try{await refetchPending();}finally{paymentInProgress.current=false;}},
  });
  const working=buy.isPending||recover.isPending;
  usePreventRemove(working,()=>Alert.alert('Checking payment','Please wait until your payment status has been saved.'));
  const refresh=async()=>{
    if(working||refreshing)return;
    setRefreshing(true);
    try{await Promise.all([refetchPlans(),refetchHistory(),refetchPending()]);}finally{setRefreshing(false);}
  };
  const checkoutBlocked=working||coupon.isPending||pending.isPending||pending.isError||!!pending.data||history.isPending||history.isError||plans.isFetching||plans.isError||!userId;
  const pay=(plan:Plan)=>{
    if(checkoutBlocked||paymentInProgress.current)return;
    paymentInProgress.current=true;
    recover.reset();
    buy.mutate({planId:plan.id,couponCode:appliedCoupon?.code});
  };
  const checkPayment=()=>{
    if(working||paymentInProgress.current)return;
    paymentInProgress.current=true;
    buy.reset();recover.mutate();
  };
  const status=subscribed?'Active':user?.subscriptionStatus==='CANCELLED'?'Cancelled':user?.subscriptionStatus==='EXPIRED'||user?.subscriptionStatus==='ACTIVE'?'Expired':'Free account';
  return <Screen title="Manage subscription" subtitle="Choose a plan, pay or renew your RSD Pro access." refreshing={refreshing} onRefresh={()=>void refresh()} action={<Button secondary icon="arrow-back" label="Back" disabled={working} onPress={()=>router.canGoBack()?router.back():router.replace('/')}/> }>
    <Card gold>
      <View style={s.between}><Heading>{subscribed?'You have RSD Pro':'Your subscription'}</Heading><Badge label={status} color={subscribed?colors.green:colors.muted}/></View>
      <Body>{currentPlan?.name??(user?.subscriptionPlan?'RSD Pro plan':'No paid plan yet')}</Body>
      <Body>{expires?`${subscribed?'Active until':'Expiry date'}: ${expires}`:subscribed?'Your access is active.':'Choose any plan below to unlock Pro.'}</Body>
      {subscribed?<Body>Your current access is already active. Renew whenever you want; purchased days are added to your remaining access.</Body>:previouslyPaid?<Body>Pay again with any plan below to restart your subscription.</Body>:null}
      <Button secondary label="Refresh subscription" busy={refreshing} disabled={working} onPress={()=>void refresh()}/>
    </Card>
    {history.isLoading?<Loading/>:null}
    {history.error?<ErrorState error={history.error} retry={()=>void refetchHistory()}/>:null}
    {message?<View accessibilityLiveRegion="polite"><Card><Body color={colors.primary}>{message}</Body></Card></View>:null}
    {buy.error?<ErrorState error={buy.error}/>:null}
    {recover.error?<ErrorState error={recover.error}/>:null}
    {pending.error?<ErrorState error={pending.error} retry={()=>void refetchPending()}/>:null}
    {pending.data?<Card><Heading>Check your previous payment</Heading><Body>A checkout is awaiting confirmation. Check it before paying again.</Body><Button label="Check payment status" busy={recover.isPending} disabled={buy.isPending} onPress={checkPayment}/></Card>:null}
    {!canCheckout?<Card><Heading>Subscription access</Heading><Body>Your plans and existing access are shown here. Direct payment is available in the RSD Android development or direct APK build.</Body></Card>:null}
    <Heading>{subscribed?'Renew with any plan':'All subscription plans'}</Heading>
    {plans.isLoading?<Loading/>:null}
    {plans.error?<ErrorState error={plans.error} retry={()=>void refetchPlans()}/>:null}
    {canCheckout?<Card><Input label="Coupon code (optional)" value={code} onChangeText={text=>{setCode(text);coupon.reset();}}/><Button secondary label="Apply coupon" disabled={!normalizedCode||working} busy={coupon.isPending} onPress={()=>coupon.mutate(normalizedCode)}/>{appliedCoupon?<Body color={colors.green}>{appliedCoupon.discountPercent}% discount applied.</Body>:coupon.data&&coupon.variables===normalizedCode?<Body>This coupon is not valid.</Body>:null}{coupon.error?<ErrorState error={coupon.error}/>:null}</Card>:null}
    {plans.data?.plans.map(plan=>{
      const price=appliedCoupon?.prices?.[plan.id]??plan.amountPaise;
      const isCurrent=subscribed&&plan.id===user?.subscriptionPlan;
      const expanded=expandedPlan===plan.id;
      const paying=buy.isPending&&buy.variables?.planId===plan.id;
      return <Card key={plan.id} gold={isCurrent||plan.popular}>
        <View style={s.between}><Heading>{plan.name}</Heading>{isCurrent?<Badge label="Current plan · Active" color={colors.green}/>:plan.popular?<Badge label="Recommended" color={colors.gold}/>:null}</View>
        <Body>{plan.badge}</Body>
        <View style={styles.priceRow}><Text style={styles.price}>{formatPrice(price)}</Text><Body>{plan.period}</Body>{plan.originalAmountPaise>price?<Text style={styles.originalPrice}>{formatPrice(plan.originalAmountPaise)}</Text>:null}</View>
        <Body>{plan.durationDays} days of Pro access{subscribed?' added to your remaining subscription':''}.</Body>
        {canCheckout?<Button icon="card-outline" label={`${subscribed||previouslyPaid?'Renew':'Pay'} ${formatPrice(price)}${isCurrent?' · current plan':''}`} busy={paying} disabled={checkoutBlocked} onPress={()=>pay(plan)}/>:null}
        <Pressable accessibilityRole="button" accessibilityLabel={`${expanded?'Hide':'Show'} ${plan.name} features`} accessibilityState={{expanded}} onPress={()=>setExpandedPlan(expanded?null:plan.id)} style={styles.featuresToggle}><Text style={styles.featureLabel}>{expanded?'Hide features':'See included features'}</Text><Ionicons name={expanded?'chevron-up':'chevron-down'} size={18} color={colors.primary}/></Pressable>
        {expanded?plan.features.map(feature=><Body key={feature}>✓ {feature}</Body>):null}
      </Card>;
    })}
    {canCheckout?<Body>One-time payment · No automatic renewal · Secure checkout with Razorpay. Your subscription updates after the server confirms payment.</Body>:null}
    <Card><Heading>Payment history</Heading>{history.data?.orders.length===0?<Body>No payments yet.</Body>:null}{history.data?.orders.map(order=><View key={order.id} style={styles.historyRow}><View style={s.between}><Heading>{plans.data?.plans.find(plan=>plan.id===order.planId)?.name??'RSD Pro plan'}</Heading><Badge label={order.status==='PAID'?'Paid':order.status==='FAILED'?'Failed':'Awaiting payment'} color={order.status==='PAID'?colors.green:colors.muted}/></View><Body>{formatPrice(order.amount)} · {subscriptionDate(order.paidAt??order.createdAt)}</Body></View>)}</Card>
  </Screen>;
}
const styles=StyleSheet.create({
  priceRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8},price:{fontSize:28,fontWeight:'800',color:colors.ink,flexShrink:1},originalPrice:{fontSize:15,color:colors.muted,textDecorationLine:'line-through'},
  featuresToggle:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},featureLabel:{fontSize:14,fontWeight:'600',color:colors.primary,flexShrink:1},historyRow:{gap:8,borderTopWidth:1,borderTopColor:colors.border,paddingTop:14},
});
