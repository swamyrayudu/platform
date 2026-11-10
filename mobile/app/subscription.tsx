import { Heading } from '@/components/heading';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Screen, Body } from '@/components/ui';
import { WebPlans } from '@/components/razorpay-plans';
import { planSource } from '@/services/payment-service';
import { PlaySubscriptionPlans } from '@/components/play-subscription-plans';
import { useAuth } from '@/store/auth';
import { colors } from '@/utils/theme';
import { hasActiveSubscription, subscriptionDate } from '@/utils/subscription';

export default function Subscription() {
  // Direct APK: Razorpay (unchanged). Google Play build: Play Billing. Otherwise: status only.
  return planSource==='web'?<WebPlans/>:planSource==='google_play'?<PlaySubscriptionPlans/>:<AccessStatus/>;
}

/** Store builds without Play Billing: no plans or prices (see planSource), only the user's current access. */
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
const styles=StyleSheet.create({
  header:{flexDirection:'row',alignItems:'center',gap:12},headerButton:{width:44,height:44,borderRadius:14,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card,alignItems:'center',justifyContent:'center'},
  copy:{flex:1,minWidth:0,gap:3},title:{},
  panel:{padding:16,borderRadius:20,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card,gap:12},
  pressed:{opacity:0.7},
});
