import { Heading } from '@/components/heading';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen, Body, Button, ErrorState, Badge } from '@/components/ui';
import { SubscriptionPlanCard } from '@/components/subscription-plan-card';
import { paymentService, canCheckout, showsPlans, type Plan } from '@/services/payment-service';
import { useAuth } from '@/store/auth';
import { colors } from '@/utils/theme';
import { formatPrice, hasActiveSubscription, subscriptionDate } from '@/utils/subscription';
import type { PublicUser } from '@/types/auth';

export default function Subscription() {
  return showsPlans?<SubscriptionPlans/>:<AccessStatus/>;
}

/** Store builds: no plans or prices (see showsPlans), only the user's current access. */
function AccessStatus() {
  const {user}=useAuth();
  const subscribed=hasActiveSubscription(user);
  const expires=subscriptionDate(user?.subscriptionExpiresAt);
  const back=()=>{if(router.canGoBack())router.back();else router.replace('/profile');};
  return <Screen title="Your access" pageHeader={
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={({pressed})=>[styles.headerButton,pressed&&styles.pressed]}>
        <Ionicons name="arrow-back" size={22} color={colors.primary}/>
      </Pressable>
      <View style={styles.copy}><Heading style={styles.title}>Your access</Heading></View>
    </View>
  }>
    <View style={styles.panel}><Body>{subscribed?`RSD Pro is active${expires?` until ${expires}`:''}.`:'You are on the free plan.'}</Body></View>
  </Screen>;
}

function SubscriptionPlans() {
  const {user,update}=useAuth();
  const userId=user?.id;
  const cache=useQueryClient();
  const [code,setCode]=useState('');
  const [message,setMessage]=useState('');
  const [refreshing,setRefreshing]=useState(false);
  const [expandedPlan,setExpandedPlan]=useState<string|null>(null);
  const [showHistory,setShowHistory]=useState(false);
  const [historyLimit,setHistoryLimit]=useState(5);
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
  const back=()=>{if(router.canGoBack())router.back();else router.replace('/profile');};
  const checking=history.isPending||pending.isPending||plans.isFetching;
  const orders=history.data?.orders??[];
  return <Screen title="Plans" refreshing={refreshing} onRefresh={()=>void refresh()} pageHeader={
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" disabled={working} onPress={back} style={({pressed})=>[styles.headerButton,pressed&&styles.pressed,working&&styles.disabled]}>
        <Ionicons name="arrow-back" size={22} color={colors.primary}/>
      </Pressable>
      <View style={styles.copy}><Heading style={styles.title}>Plans</Heading><Text style={styles.caption}>RSD Pro access</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh plans and payment status" accessibilityState={{disabled:working||refreshing,busy:refreshing}} disabled={working||refreshing} onPress={()=>void refresh()} style={({pressed})=>[styles.headerButton,pressed&&styles.pressed,working&&styles.disabled]}>
        {refreshing?<ActivityIndicator size="small" color={colors.primary}/>:<Ionicons name="refresh-outline" size={20} color={colors.primary}/>}
      </Pressable>
    </View>
  }>
    <View style={styles.intro}>
      <Heading style={styles.introTitle}>Choose your plan</Heading>
      <Text style={styles.caption}>One-time payment. No automatic renewal.</Text>
      {canCheckout?<View style={styles.hint}><Ionicons name="pricetag-outline" size={15} color={colors.gold}/><Text style={styles.hintText}>Have a coupon? Apply it below before paying.</Text></View>:null}
    </View>

    {message?<View accessibilityLiveRegion="polite" style={[styles.panel,styles.message]}><Body color={colors.primary}>{message}</Body></View>:null}
    {buy.error?<ErrorState error={buy.error}/>:null}
    {recover.error?<ErrorState error={recover.error}/>:null}
    {pending.error?<ErrorState error={pending.error} retry={()=>void refetchPending()}/>:null}
    {pending.data?<View style={[styles.panel,styles.notice]}>
      <View style={styles.sectionHeader}><Ionicons name="time-outline" size={20} color={colors.gold}/><Heading style={styles.sectionTitle}>Check your previous payment</Heading></View>
      <Body>A payment is awaiting confirmation. Check its status before paying again.</Body>
      <Button label="Check payment status" busy={recover.isPending} disabled={buy.isPending} onPress={checkPayment}/>
    </View>:null}
    {!canCheckout?<View style={styles.panel}><Body>Payment is unavailable in this app version. You can view plans here and your current access in Profile.</Body></View>:null}
    {checking&&!plans.isLoading?<View accessibilityLiveRegion="polite" style={styles.hint}><ActivityIndicator size="small" color={colors.primary}/><Text style={styles.hintText}>Checking payment availability…</Text></View>:null}
    {history.error?<ErrorState error={history.error} retry={()=>void refetchHistory()}/>:null}
    {plans.isLoading?<View style={[styles.panel,styles.loading]}><ActivityIndicator color={colors.primary}/><Text style={styles.caption}>Loading available plans…</Text></View>:null}
    {plans.error?<ErrorState error={plans.error} retry={()=>void refetchPlans()}/>:null}
    {plans.data?.plans.length===0?<View style={styles.panel}><Body>No plans are available right now. Please refresh or try again later.</Body></View>:null}

    {plans.data?.plans.map(plan=><SubscriptionPlanCard key={plan.id}
      plan={plan} price={appliedCoupon?.prices?.[plan.id]??plan.amountPaise}
      current={subscribed&&plan.id===user?.subscriptionPlan}
      renew={subscribed||previouslyPaid} extending={subscribed} checkout={canCheckout}
      blocked={checkoutBlocked} paying={buy.isPending&&buy.variables?.planId===plan.id}
      expanded={expandedPlan===plan.id} onPay={()=>pay(plan)}
      onToggle={()=>setExpandedPlan(expandedPlan===plan.id?null:plan.id)}/>)}

    {canCheckout?<View style={styles.panel}>
      <View style={styles.sectionHeader}><View style={styles.sectionIcon}><Ionicons name="pricetag-outline" size={18} color={colors.primary}/></View><Heading style={styles.sectionTitle}>Have a coupon?</Heading><Badge label="Optional" color={colors.muted}/></View>
      <Text style={styles.caption}>Apply before paying. Updated prices appear on the plans above.</Text>
      <View style={styles.couponControls}>
        <TextInput accessibilityLabel="Coupon code" placeholder="Enter coupon code" placeholderTextColor={colors.muted}
          autoCapitalize="characters" autoCorrect={false} editable={!working&&!coupon.isPending} value={code}
          onChangeText={text=>{setCode(text);coupon.reset();}} style={styles.couponInput}/>
        <View style={styles.couponApply}><Button secondary label="Apply" disabled={!normalizedCode||working} busy={coupon.isPending} onPress={()=>coupon.mutate(normalizedCode)}/></View>
      </View>
      {appliedCoupon?<View accessibilityLiveRegion="polite" style={styles.couponSuccess}>
        <Ionicons name="checkmark-circle-outline" size={20} color={colors.green}/>
        <View style={styles.copy}><Text style={styles.couponCode}>{appliedCoupon.code}</Text><Text style={styles.successText}>{appliedCoupon.discountPercent!=null?String(appliedCoupon.discountPercent)+'% discount applied':'Coupon applied'}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Remove coupon" disabled={working} onPress={()=>{setCode('');coupon.reset();}} style={({pressed})=>[styles.removeCoupon,pressed&&styles.pressed,working&&styles.disabled]}><Text style={styles.removeLabel}>Remove</Text></Pressable>
      </View>:coupon.data&&coupon.variables===normalizedCode?<Text accessibilityLiveRegion="polite" style={styles.invalidCoupon}>This coupon is not valid. Check the code and try again.</Text>:null}
      {coupon.error?<ErrorState error={coupon.error}/>:null}
    </View>:null}

    {canCheckout?<View style={styles.checkoutNote}><Ionicons name="lock-closed-outline" size={15} color={colors.muted}/><Text style={styles.noteText}>Secure payment with Razorpay. Access updates after payment is confirmed.</Text></View>:null}

    <View style={styles.panel}>
      <Pressable accessibilityRole="button" accessibilityLabel={showHistory?'Hide payment history':'Show payment history'} accessibilityState={{expanded:showHistory}} onPress={()=>{setShowHistory(value=>!value);setHistoryLimit(5);}} style={({pressed})=>[styles.historyToggle,pressed&&styles.pressed]}>
        <View style={styles.sectionIcon}><Ionicons name="receipt-outline" size={18} color={colors.primary}/></View>
        <View style={styles.copy}><Heading style={styles.sectionTitle}>Payment history</Heading><Text style={styles.caption}>{history.isLoading?'Loading payments…':history.error?'Unable to load payments':orders.length===0?'No payments yet':String(orders.length)+' payments'}</Text></View>
        <Ionicons name={showHistory?'chevron-up':'chevron-down'} size={18} color={colors.primary}/>
      </Pressable>
      {showHistory?<View style={styles.historyList}>
        {history.isLoading?<View style={styles.loading}><ActivityIndicator size="small" color={colors.primary}/><Text style={styles.caption}>Loading payments…</Text></View>:null}
        {history.data&&orders.length===0?<Text style={styles.caption}>Your payments will appear here.</Text>:null}
        {orders.slice(0,historyLimit).map(order=><View key={order.id} style={styles.historyRow}>
          <View style={styles.historyDetails}><Text style={styles.historyName}>{plans.data?.plans.find(plan=>plan.id===order.planId)?.name??'RSD Pro plan'}</Text><Text style={styles.caption}>{subscriptionDate(order.paidAt??order.createdAt)}</Text></View>
          <View style={styles.historyAmount}><Text style={styles.amount}>{formatPrice(order.amount)}</Text><Badge label={order.status==='PAID'?'Paid':order.status==='FAILED'?'Failed':'Awaiting payment'} color={order.status==='PAID'?colors.green:order.status==='FAILED'?colors.red:colors.muted}/></View>
        </View>)}
        {orders.length>historyLimit?<Button secondary label="Show more payments" onPress={()=>setHistoryLimit(value=>value+5)}/>:null}
      </View>:null}
    </View>
  </Screen>;
}
const styles=StyleSheet.create({
  header:{flexDirection:'row',alignItems:'center',gap:12},headerButton:{width:44,height:44,borderRadius:14,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card,alignItems:'center',justifyContent:'center'},
  copy:{flex:1,minWidth:0,gap:3},title:{},caption:{fontSize:12,lineHeight:19,color:colors.muted,flexShrink:1},
  intro:{gap:6},introTitle:{},
  hint:{flexDirection:'row',alignItems:'center',gap:7},hintText:{flex:1,minWidth:0,fontSize:12,lineHeight:20,color:colors.muted},
  panel:{padding:16,borderRadius:20,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card,gap:12},
  sectionHeader:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8},sectionTitle:{flex:1,minWidth:110},
  sectionIcon:{width:30,height:30,borderRadius:10,backgroundColor:colors.primarySoft,alignItems:'center',justifyContent:'center'},
  notice:{backgroundColor:'#FCF6EA',borderColor:'#E4CFA9'},message:{backgroundColor:colors.primarySoft,borderColor:'#D7D1E8'},loading:{flexDirection:'row',alignItems:'center',gap:10},
  couponControls:{flexDirection:'row',flexWrap:'wrap',gap:10},couponInput:{flexGrow:1,flexBasis:180,minWidth:0,minHeight:50,borderWidth:1,borderColor:colors.border,borderRadius:14,paddingHorizontal:12,paddingVertical:10,fontSize:16,color:colors.ink,backgroundColor:'#FAF9F7'},couponApply:{flexGrow:1,flexBasis:80,minWidth:0},
  couponSuccess:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8,padding:10,borderRadius:12,backgroundColor:colors.greenSoft},couponCode:{fontSize:12,lineHeight:19,fontWeight:'700',color:colors.green},successText:{fontSize:12,lineHeight:19,color:colors.green},invalidCoupon:{fontSize:12,lineHeight:20,color:colors.red},
  removeCoupon:{minHeight:44,minWidth:60,padding:8,alignItems:'center',justifyContent:'center'},removeLabel:{fontSize:12,lineHeight:20,color:colors.green,fontWeight:'600'},
  checkoutNote:{flexDirection:'row',alignItems:'flex-start',gap:8,paddingHorizontal:4},noteText:{flex:1,minWidth:0,fontSize:11,lineHeight:18,color:colors.muted},
  historyToggle:{minHeight:48,flexDirection:'row',alignItems:'center',gap:8},historyList:{gap:10},
  historyRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'flex-start',gap:10,paddingTop:12,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border},historyDetails:{flex:1,minWidth:130,gap:4},historyName:{fontSize:13,lineHeight:21,fontWeight:'600',color:colors.ink},historyAmount:{maxWidth:'100%',alignItems:'flex-end',gap:4},amount:{fontSize:14,lineHeight:22,fontWeight:'700',color:colors.primary},
  pressed:{opacity:0.7},disabled:{opacity:0.5},
});
