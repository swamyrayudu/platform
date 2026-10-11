import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/store/auth';
import { colors } from '@/utils/theme';
import { hasActiveSubscription } from '@/utils/subscription';

export function StudentHeader() {
  const {user}=useAuth();
  const subscribed=hasActiveSubscription(user);
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Go to home" onPress={()=>router.push('/')} style={styles.brand}><View style={styles.mark}><Text allowFontScaling={false} style={styles.markText}>DSC</Text></View><Text style={styles.name}>DSC / SGT</Text><View style={styles.region}><Text style={styles.regionText}>AP</Text></View></Pressable>
    <View style={styles.actions}><Pressable accessibilityRole="button" accessibilityLabel={subscribed?'Manage or renew your active subscription':'View subscription prices and pay'} onPress={()=>router.push('/subscription')} style={[styles.pro,styles.subscriptionAction]}><Ionicons name={subscribed?'checkmark-circle':'ribbon'} size={18} color={subscribed?colors.green:colors.gold}/><Text style={styles.proText}>{subscribed?'Manage':'Plans'}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Open your profile" onPress={()=>router.push('/profile')} style={styles.action}><View style={styles.avatar}><Text maxFontSizeMultiplier={2} style={styles.initial}>{user?.name?.trim().charAt(0).toUpperCase()||'R'}</Text></View></Pressable></View>
  </View>;
}
const styles=StyleSheet.create({
  proText:{fontSize:12,fontWeight:'700',color:colors.primary,flexShrink:1},
  subscriptionAction:{minHeight:44,maxWidth:'100%',paddingHorizontal:10,paddingVertical:8,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5},
  header:{minHeight:58,paddingHorizontal:12,paddingVertical:6,flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8,borderBottomWidth:1,borderBottomColor:colors.border,backgroundColor:colors.card},brand:{flexDirection:'row',alignItems:'center',gap:8,minHeight:44,flexShrink:1,minWidth:0},mark:{width:34,height:34,borderRadius:17,backgroundColor:colors.primary,justifyContent:'center',alignItems:'center'},markText:{fontSize:11,fontWeight:'800',color:'#fff'},name:{fontSize:13,fontWeight:'600',color:colors.ink,flexShrink:1},region:{borderRadius:12,paddingHorizontal:6,paddingVertical:3,backgroundColor:colors.primarySoft},regionText:{fontSize:10,color:colors.primary},actions:{flexDirection:'row',gap:6,alignItems:'center',marginLeft:'auto'},action:{width:44,height:44,justifyContent:'center',alignItems:'center'},pro:{borderRadius:20,borderWidth:1,borderColor:'#EBCB94',backgroundColor:'#FCF4E6'},avatar:{width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',backgroundColor:'#485A63'},initial:{fontSize:16,fontWeight:'700',color:'#fff'},
});
