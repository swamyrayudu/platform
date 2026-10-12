import { Heading } from '@/components/heading';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Badge, Button } from './ui';
import type { Plan } from '@/services/payment-service';
import { colors } from '@/utils/theme';
import { formatPrice } from '@/utils/subscription';

interface Props {
  plan:Plan;price:number;current:boolean;renew:boolean;extending:boolean;
  checkout:boolean;blocked:boolean;paying:boolean;expanded:boolean;
  onPay:()=>void;onToggle:()=>void;
}

export function SubscriptionPlanCard({plan,price,current,renew,extending,checkout,blocked,paying,expanded,onPay,onToggle}:Props) {
  const features=expanded?plan.features:plan.features.slice(0,2);
  return <View style={[styles.card,plan.popular&&styles.recommended]}>
    <View style={styles.header}>
      <View style={styles.planIdentity}>
        <View style={styles.icon}><Ionicons name="ribbon-outline" size={21} color={colors.primary}/></View>
        <View style={styles.copy}>
          <Heading style={styles.name}>{plan.name}</Heading>
          {plan.badge?<Text style={styles.caption}>{plan.badge}</Text>:null}
        </View>
      </View>
      {current?<Badge label="Current plan" color={colors.green}/>:plan.popular?<Badge label="Recommended"/>:null}
    </View>

    <View style={styles.priceBlock}>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatPrice(price)}</Text>
        {plan.originalAmountPaise>price?<Text accessibilityLabel={'Original price '+formatPrice(plan.originalAmountPaise)} style={styles.originalPrice}>{formatPrice(plan.originalAmountPaise)}</Text>:null}
      </View>
      <View style={styles.durationRow}>
        <Text style={styles.period}>{plan.period}</Text>
        <View style={styles.duration}><Ionicons name="time-outline" size={13} color={colors.primary}/><Text style={styles.durationText}>{plan.durationDays+' days'}</Text></View>
      </View>
    </View>

    <View style={styles.benefits}>
      {features.map(feature=><View key={feature} style={styles.benefit}><Ionicons name="checkmark-circle-outline" size={16} color={colors.green}/><Text style={styles.benefitText}>{feature}</Text></View>)}
    </View>
    {extending?<Text style={styles.caption}>Added to your remaining Pro access.</Text>:null}
    {checkout?<Button icon="card-outline" label={(renew?'Renew ':'Pay ')+formatPrice(price)} busy={paying} disabled={blocked} onPress={onPay}/>:null}
    {plan.features.length>2?<Pressable accessibilityRole="button" accessibilityLabel={(expanded?'Show fewer ':'Show all ')+plan.name+' features'} accessibilityState={{expanded}} onPress={onToggle} style={({pressed})=>[styles.featuresToggle,pressed&&styles.pressed]}>
      <Text style={styles.featureLabel}>{expanded?'Show fewer benefits':'See all benefits'}</Text>
      <Ionicons name={expanded?'chevron-up':'chevron-down'} size={16} color={colors.primary}/>
    </Pressable>:null}
  </View>;
}

const styles=StyleSheet.create({
  card:{padding:16,borderRadius:20,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card,gap:14},
  recommended:{borderColor:'#A69EC3',backgroundColor:'#FAF9FD'},
  header:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:10,minHeight:48},
  planIdentity:{flexDirection:'row',alignItems:'center',gap:10,flex:1,minWidth:150},
  icon:{width:38,height:38,borderRadius:12,backgroundColor:colors.primarySoft,alignItems:'center',justifyContent:'center'},
  copy:{flex:1,minWidth:0,gap:3},name:{},caption:{fontSize:12,lineHeight:19,color:colors.muted,flexShrink:1},
  priceBlock:{gap:6},priceRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:10},price:{fontSize:32,lineHeight:42,fontWeight:'800',color:colors.primary,flexShrink:1},originalPrice:{fontSize:13,lineHeight:20,color:colors.muted,textDecorationLine:'line-through',flexShrink:1},
  durationRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8},period:{fontSize:12,lineHeight:19,color:colors.muted,flexShrink:1},duration:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:4,borderRadius:10,backgroundColor:colors.primarySoft},durationText:{fontSize:11,lineHeight:17,color:colors.primary,flexShrink:1},
  benefits:{gap:8,paddingTop:12,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:colors.border},benefit:{flexDirection:'row',alignItems:'flex-start',gap:8},benefitText:{flex:1,minWidth:0,fontSize:12,lineHeight:20,color:colors.ink},
  featuresToggle:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},featureLabel:{fontSize:12,lineHeight:20,fontWeight:'600',color:colors.primary,flexShrink:1},pressed:{opacity:0.7},
});
