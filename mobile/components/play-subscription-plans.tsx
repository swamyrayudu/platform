import { Heading } from '@/components/heading';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen, Body, Button, ErrorState, Badge } from '@/components/ui';
import { playBilling, manageSubscriptionUrl } from '@/services/play-billing-service';
import { describePeriod, PlayFlowError, type PlayPlanOffer, type PurchaseOutcome } from '@/services/play-billing-flow';
import { useAuth } from '@/store/auth';
import { colors } from '@/utils/theme';
import { hasActiveSubscription, subscriptionDate } from '@/utils/subscription';

/**
 * Google Play build: RSD Pro as auto-renewing Google Play subscriptions.
 * Prices, currency and taxes come from Google; nothing here is hard-coded.
 * Access changes only after the server confirms the purchase with Google.
 */
export function PlaySubscriptionPlans() {
  const {user,update}=useAuth();
  const cache=useQueryClient();
  const [message,setMessage]=useState('');
  const [expanded,setExpanded]=useState(false);
  const busy=useRef(false);
  const offers=useQuery({queryKey:['play-offers',user?.id],queryFn:playBilling.offers,enabled:!!user?.id,staleTime:5*60_000,retry:1});
  const {refetch}=offers;
  useFocusEffect(useCallback(()=>{void refetch({cancelRefetch:false});},[refetch]));

  const subscribed=hasActiveSubscription(user);
  const viaPlay=subscribed&&user?.subscriptionSource==='google_play';
  const viaWeb=subscribed&&user?.subscriptionSource==='web';
  const currentPlanKey=user?.playPlan??(viaPlay?user?.subscriptionPlan??null:null);
  const expires=subscriptionDate(user?.subscriptionExpiresAt);

  const settle=async(outcome:PurchaseOutcome,success:string)=>{
    if(outcome.kind==='active'){update(outcome.user);setMessage(success);}
    else if(outcome.kind==='pending'){update(outcome.user);setMessage('Your payment is pending with Google Play. Pro starts automatically once Google confirms it — you do not need to pay again.');}
    else setMessage('No active Google Play subscription was found for this account.');
    await cache.invalidateQueries();
  };
  const buy=useMutation({
    mutationFn:(offer:PlayPlanOffer)=>playBilling.buy(offer,currentPlanKey),
    onMutate:()=>setMessage(''),
    onSuccess:outcome=>settle(outcome,'Subscription confirmed. RSD Pro is active on this account, in the app and on the website.'),
    onError:error=>{if(error instanceof PlayFlowError&&error.code==='CANCELLED')buy.reset();},
    onSettled:()=>{busy.current=false;},
  });
  const restore=useMutation({
    mutationFn:()=>playBilling.restore(false),
    onMutate:()=>setMessage(''),
    onSuccess:outcome=>settle(outcome,'Purchases restored. RSD Pro is active.'),
    onSettled:()=>{busy.current=false;},
  });
  const working=buy.isPending||restore.isPending;
  usePreventRemove(working,()=>Alert.alert('Confirming purchase','Please wait until Google Play has confirmed your purchase.'));

  const start=(action:()=>void)=>{if(working||busy.current)return;busy.current=true;action();};
  const back=()=>{if(router.canGoBack())router.back();else router.replace('/profile');};
  const config=offers.data?.config;
  const manage=()=>{if(config?.configured)void Linking.openURL(manageSubscriptionUrl(config.productId,config.packageName));};
  const features=config?.configured?config.features:[];

  return <Screen title="Plans" pageHeader={
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" disabled={working} onPress={back} style={({pressed})=>[styles.headerButton,pressed&&styles.pressed,working&&styles.disabled]}>
        <Ionicons name="arrow-back" size={22} color={colors.primary}/>
      </Pressable>
      <View style={styles.copy}><Heading>Plans</Heading><Text style={styles.caption}>RSD Pro on Google Play</Text></View>
    </View>
  }>
    <View style={styles.intro}>
      <Heading>{viaPlay?'Your subscription':'Choose your plan'}</Heading>
      <Text style={styles.caption}>Auto-renewing subscription billed by Google Play. Cancel anytime in Google Play.</Text>
    </View>

    {message?<View accessibilityLiveRegion="polite" style={[styles.panel,styles.message]}><Body color={colors.primary}>{message}</Body></View>:null}
    {buy.error&&!(buy.error instanceof PlayFlowError&&buy.error.code==='CANCELLED')?<ErrorState error={buy.error}/>:null}
    {restore.error?<ErrorState error={restore.error}/>:null}

    {currentPlanKey&&!viaPlay?<View style={styles.panel}>
      <Body>Your Google Play subscription is active alongside your website access.</Body>
      <Button secondary icon="open-outline" label="Manage in Google Play" onPress={manage}/>
    </View>:null}
    {viaPlay?<View style={styles.panel}>
      <View style={styles.row}><Ionicons name="checkmark-circle" size={20} color={colors.green}/><Body>RSD Pro is active{expires?` — renews or ends on ${expires}`:''}.</Body></View>
      <Button secondary icon="open-outline" label="Manage in Google Play" onPress={manage}/>
    </View>:null}
    {viaWeb&&!currentPlanKey?<View style={[styles.panel,styles.notice]}>
      <Body>You already have RSD Pro{expires?` until ${expires}`:''} from a website purchase. A Google Play subscription is separate and billed in addition.</Body>
    </View>:null}

    {offers.isLoading?<View style={[styles.panel,styles.row]}><ActivityIndicator color={colors.primary}/><Text style={styles.caption}>Loading prices from Google Play…</Text></View>:null}
    {offers.error?<ErrorState error={offers.error} retry={()=>void refetch()}/>:null}
    {offers.data&&offers.data.offers.length===0?<View style={styles.panel}><Body>No plans are available on Google Play right now. Please try again later.</Body></View>:null}

    {offers.data?.offers.map(offer=>{
      const current=offer.plan.key===currentPlanKey;
      const paying=buy.isPending&&buy.variables?.plan.key===offer.plan.key;
      return <View key={offer.plan.key} style={[styles.card,offer.plan.popular&&styles.recommended]}>
        <View style={styles.cardHeader}>
          <View style={styles.copy}><Heading>{offer.plan.name}</Heading><Text style={styles.caption}>{offer.plan.period}</Text></View>
          {current?<Badge label="Current plan" color={colors.green}/>:offer.plan.badge?<Badge label={offer.plan.badge}/>:null}
        </View>
        <Text style={styles.price}>{offer.price}<Text style={styles.per}>{' / '+describePeriod(offer.billingPeriod)}</Text></Text>
        {offer.intro.map((phase,index)=><Text key={index} style={styles.intro2}>
          {phase.priceAmountMicros===0?`Free for ${describePeriod(phase.billingPeriod)}`:`${phase.formattedPrice} / ${describePeriod(phase.billingPeriod)} for ${phase.billingCycleCount} ${phase.billingCycleCount===1?'period':'periods'}`}, then {offer.price} / {describePeriod(offer.billingPeriod)}
        </Text>)}
        <Button label={current?'Current plan':currentPlanKey?'Switch to this plan':'Subscribe'} disabled={current||working||!config?.configured} busy={paying}
          onPress={()=>start(()=>{restore.reset();buy.mutate(offer);})}/>
      </View>;
    })}

    {features.length?<View style={styles.panel}>
      <Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={()=>setExpanded(value=>!value)} style={styles.row}>
        <Heading style={styles.flex}>Every plan includes</Heading><Ionicons name={expanded?'chevron-up':'chevron-down'} size={18} color={colors.primary}/>
      </Pressable>
      {(expanded?features:features.slice(0,3)).map(feature=><View key={feature} style={styles.row}><Ionicons name="checkmark" size={16} color={colors.green}/><Text style={styles.feature}>{feature}</Text></View>)}
    </View>:null}

    <Button secondary icon="refresh-outline" label="Restore purchases" busy={restore.isPending} disabled={working} onPress={()=>start(()=>{buy.reset();restore.mutate();})}/>

    <View style={styles.note}>
      <Ionicons name="lock-closed-outline" size={15} color={colors.muted}/>
      <Text style={styles.noteText}>
        Payment is charged to your Google Play account at confirmation. The subscription renews automatically at the price shown until you cancel. Cancel anytime in Google Play → Payments & subscriptions → Subscriptions; Pro stays active until the end of the period you paid for. Pro works in this app and on the RSD Education website with the same account.
      </Text>
    </View>
  </Screen>;
}

const styles=StyleSheet.create({
  header:{flexDirection:'row',alignItems:'center',gap:12},
  headerButton:{width:44,height:44,borderRadius:14,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card,alignItems:'center',justifyContent:'center'},
  copy:{flex:1,minWidth:0,gap:3},flex:{flex:1},caption:{fontSize:12,lineHeight:19,color:colors.muted,flexShrink:1},
  intro:{gap:6},row:{flexDirection:'row',alignItems:'center',gap:8},
  panel:{padding:16,borderRadius:20,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card,gap:12},
  message:{backgroundColor:colors.primarySoft,borderColor:'#D7D1E8'},notice:{backgroundColor:'#FCF6EA',borderColor:'#E4CFA9'},
  card:{padding:16,borderRadius:20,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card,gap:10},
  recommended:{borderColor:colors.primary,borderWidth:1.5},
  cardHeader:{flexDirection:'row',flexWrap:'wrap',alignItems:'flex-start',gap:8},
  price:{fontSize:24,lineHeight:32,fontWeight:'700',color:colors.primary},per:{fontSize:14,fontWeight:'500',color:colors.muted},
  intro2:{fontSize:12,lineHeight:19,color:colors.green,fontWeight:'600'},
  feature:{flex:1,minWidth:0,fontSize:13,lineHeight:20,color:colors.ink},
  note:{flexDirection:'row',alignItems:'flex-start',gap:8,paddingHorizontal:4},noteText:{flex:1,minWidth:0,fontSize:11,lineHeight:18,color:colors.muted},
  pressed:{opacity:0.7},disabled:{opacity:0.5},
});
