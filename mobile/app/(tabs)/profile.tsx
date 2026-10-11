import { useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Body, Input, Button, ErrorState, Badge } from '@/components/ui';
import { goalItems } from '@/components/preferences';
import { PracticeChoices } from '@/components/practice-choices';
import { PracticeMediumTabs } from '@/components/practice-selectors';
import { useAuth } from '@/store/auth';
import { authService } from '@/services/auth-service';
import { paymentService } from '@/services/payment-service';
import { api } from '@/services/api-client';
import { API_BASE_URL } from '@/utils/config';
import { colors } from '@/utils/theme';
import { hasActiveSubscription, subscriptionDate } from '@/utils/subscription';
import type { EducationMedium, LearningGoal, PublicDevice } from '@/types/auth';

type IconName = ComponentProps<typeof Ionicons>['name'];

function ProfileSection({title,icon,action,children}:{title:string;icon:IconName;action?:ReactNode;children:ReactNode}) {
  return <View style={styles.panel}>
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitle}>
        <View style={styles.sectionIcon}><Ionicons name={icon} size={18} color={colors.primary}/></View>
        <Text accessibilityRole="header" style={styles.sectionText}>{title}</Text>
      </View>
      {action}
    </View>
    {children}
  </View>;
}

function ProfileAction({label,detail,icon,onPress,danger=false,busy=false,disabled=false,last=false,link=false}:{label:string;detail?:string;icon:IconName;onPress:()=>void;danger?:boolean;busy?:boolean;disabled?:boolean;last?:boolean;link?:boolean}) {
  const color=danger?colors.red:colors.primary;
  return <Pressable accessibilityRole={link?'link':'button'} accessibilityLabel={detail?label+'. '+detail:label} accessibilityState={{busy,disabled:disabled||busy}}
    disabled={disabled||busy} onPress={onPress} style={({pressed})=>[styles.actionRow,last&&styles.lastRow,pressed&&styles.pressed,(disabled||busy)&&styles.disabled]}>
    <View style={[styles.actionIcon,danger&&styles.dangerIcon]}><Ionicons name={icon} size={19} color={color}/></View>
    <View style={styles.copy}>
      <Text style={[styles.actionLabel,{color}]}>{label}</Text>
      {detail?<Text style={styles.caption}>{detail}</Text>:null}
    </View>
    {busy?<ActivityIndicator size="small" color={color}/>:<Ionicons name="chevron-forward" size={17} color={colors.muted}/>}
  </Pressable>;
}

function loginDate(value:string) {
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'Unavailable';
}

export default function Profile() {
  const {width,fontScale}=useWindowDimensions();
  const auth=useAuth();
  const user=auth.user;
  const cache=useQueryClient();
  const [name,setName]=useState(user?.name||'');
  const [medium,setMedium]=useState<EducationMedium>(user?.educationMedium||'english');
  const [goals,setGoals]=useState<LearningGoal[]>(user?.learningGoals||['practice']);
  const [editing,setEditing]=useState(false);
  const [showDevices,setShowDevices]=useState(false);
  const [failedAvatar,setFailedAvatar]=useState<string|null>(null);
  const devices=useQuery({queryKey:['devices',user?.id],queryFn:()=>api.request<{devices:PublicDevice[];currentDeviceId:string}>('/api/auth/devices'),enabled:!!user?.id});
  const plans=useQuery({queryKey:['plans'],queryFn:paymentService.plans,enabled:!!user?.id&&!!user.subscriptionPlan});
  const save=useMutation({
    mutationFn:()=>authService.profile({name:name.trim(),educationMedium:medium,learningGoals:goals}),
    onSuccess:async data=>{
      auth.update(data.user);
      setName(data.user.name||'');
      setMedium(data.user.educationMedium||'english');
      setGoals(data.user.learningGoals);
      setEditing(false);
      await cache.invalidateQueries();
    },
  });
  const revoke=useMutation({mutationFn:(id:string)=>api.request('/api/auth/devices/'+encodeURIComponent(id),'DELETE'),onSuccess:async()=>{await auth.reload();await cache.invalidateQueries();}});
  const logout=useMutation({mutationFn:(all:boolean)=>auth.logout(all)});
  const subscribed=hasActiveSubscription(user);
  const expires=subscriptionDate(user?.subscriptionExpiresAt);
  const currentPlan=plans.data?.plans.find(plan=>plan.id===user?.subscriptionPlan);
  const status=subscribed?'Active':user?.subscriptionStatus==='CANCELLED'?'Cancelled':user?.subscriptionStatus==='EXPIRED'||user?.subscriptionStatus==='ACTIVE'?'Expired':'Free account';
  const avatar=user?.avatarUrl;
  const savedGoals=goalItems.filter(goal=>user?.learningGoals.includes(goal.value)).map(goal=>goal.label).join(' · ');
  const activeDevices=devices.data?.devices.filter(device=>device.currentSessionStatus==='ACTIVE').length;
  const back=()=>{if(router.canGoBack())router.back();else router.replace('/');};
  const toggleEdit=()=>{
    if(save.isPending)return;
    setName(user?.name||'');
    setMedium(user?.educationMedium||'english');
    setGoals(user?.learningGoals||['practice']);
    save.reset();
    setEditing(value=>!value);
  };
  const revokeDevice=(deviceId:string)=>Alert.alert('Revoke session?','The selected device will be signed out.',[
    {text:'Cancel',style:'cancel'},
    {text:'Revoke',style:'destructive',onPress:()=>revoke.mutate(deviceId)},
  ]);

  return <Screen title="Profile" pageHeader={
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={({pressed})=>[styles.back,pressed&&styles.pressed]}>
        <Ionicons name="arrow-back" size={22} color={colors.primary}/>
      </Pressable>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.title}>Profile</Text>
        <Text style={styles.caption}>Your account, your learning</Text>
      </View>
    </View>
  }>
    <View style={[styles.panel,styles.identity]}>
      <View style={styles.avatarRing}>
        {avatar&&avatar!==failedAvatar?
          <Image accessibilityLabel="Google profile photo" source={{uri:avatar}} onError={()=>setFailedAvatar(avatar)} style={styles.avatar}/>:
          <View style={[styles.avatar,styles.avatarFallback]}><Text style={styles.initial}>{user?.name?.trim().charAt(0).toUpperCase()||'R'}</Text></View>}
      </View>
      <Text accessibilityRole="header" style={styles.name}>{user?.name||'RSD Student'}</Text>
      <Text selectable style={styles.email}>{user?.email}</Text>
      <View style={styles.googleAccount}><Ionicons name="checkmark-circle" size={14} color={colors.green}/><Text style={styles.googleLabel}>Connected with Google</Text></View>
    </View>

    <ProfileSection title="Your subscription" icon="ribbon-outline" action={<Badge label={status} color={subscribed?colors.green:colors.muted}/>}>
      <Text style={styles.planName}>{currentPlan?.name??(user?.subscriptionPlan?'RSD Pro plan':'Start with RSD Pro')}</Text>
      <View style={styles.subscriptionDetail}>
        <Ionicons name={expires?'calendar-outline':'sparkles-outline'} size={16} color={colors.gold}/>
        <Text style={styles.detailText}>{expires?(subscribed?'Valid until ':'Expiry date: ')+expires:subscribed?'Your Pro access is active.':'Unlock more practice and mock tests.'}</Text>
      </View>
      {subscribed?<Text style={styles.caption}>Renewal adds days to your remaining access.</Text>:null}
      <Button icon="card-outline" label={subscribed?'View plans & renew':'View plans & pay'} onPress={()=>router.push('/subscription')}/>
    </ProfileSection>

    <ProfileSection title="Study preferences" icon="options-outline" action={
      <Pressable accessibilityRole="button" accessibilityLabel={editing?'Cancel editing preferences':'Edit study preferences'} accessibilityState={{expanded:editing,disabled:save.isPending}} disabled={save.isPending}
        onPress={toggleEdit} style={({pressed})=>[styles.edit,pressed&&styles.pressed,save.isPending&&styles.disabled]}>
        <Ionicons name={editing?'close-outline':'create-outline'} size={16} color={colors.primary}/>
        <Text style={styles.editText}>{editing?'Cancel':'Edit'}</Text>
      </Pressable>
    }>
      {editing?<View style={styles.form}>
        <Input label="Display name" value={name} onChangeText={text=>{setName(text.slice(0,60));if(!save.isPending)save.reset();}}/>
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Study medium</Text>
          <PracticeMediumTabs value={medium} onChange={value=>{setMedium(value);if(!save.isPending)save.reset();}}/>
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>Study goals</Text>
          <PracticeChoices compact columns={width/fontScale>=360?2:1} items={goalItems} selected={goals}
            onSelect={goal=>{setGoals(current=>current.includes(goal)?current.filter(value=>value!==goal):[...current,goal]);if(!save.isPending)save.reset();}}/>
        </View>
        <Button icon="checkmark-outline" label="Save changes" busy={save.isPending} disabled={!name.trim()||!goals.length} onPress={()=>save.mutate()}/>
        {save.error?<ErrorState error={save.error}/>:null}
      </View>:<View style={styles.summary}>
        <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Medium</Text><Text style={styles.summaryValue}>{user?.educationMedium==='telugu'?'తెలుగు మీడియం':'English Medium'}</Text></View>
        <View style={[styles.summaryRow,styles.lastRow]}><Text style={styles.summaryLabel}>Goals</Text><Text style={styles.summaryValue}>{savedGoals||'Choose your study goals'}</Text></View>
      </View>}
      {save.isSuccess?<View accessibilityLiveRegion="polite" style={styles.success}><Ionicons name="checkmark-circle-outline" size={17} color={colors.green}/><Text style={styles.successText}>Preferences saved.</Text></View>:null}
    </ProfileSection>

    <ProfileSection title="Devices & security" icon="shield-checkmark-outline">
      <Pressable accessibilityRole="button" accessibilityLabel={showDevices?'Hide devices and sessions':'View devices and sessions'} accessibilityState={{expanded:showDevices}}
        onPress={()=>setShowDevices(value=>!value)} style={({pressed})=>[styles.deviceToggle,pressed&&styles.pressed]}>
        <View style={styles.copy}>
          <Text style={styles.actionLabel}>Devices and sessions</Text>
          <Text style={styles.caption}>{devices.data?String(activeDevices)+' active · '+devices.data.devices.length+' devices':'Manage where you are signed in'}</Text>
        </View>
        <Ionicons name={showDevices?'chevron-up':'chevron-down'} size={18} color={colors.primary}/>
      </Pressable>
      <Text style={styles.caption}>Signing in on another device ends your previous session.</Text>
      {showDevices?<View style={styles.deviceList}>
        {devices.isPending?<View style={styles.loading}><ActivityIndicator color={colors.primary}/><View style={styles.copy}><Body>Loading your devices…</Body></View></View>:null}
        {devices.error?<ErrorState error={devices.error} retry={()=>void devices.refetch()}/>:null}
        {devices.data?.devices.map(device=>{
          const current=device.deviceId===devices.data?.currentDeviceId;
          return <View key={device.deviceId} style={styles.device}>
            <View style={styles.deviceHeader}>
              <Ionicons name={device.platform==='WEB'?'desktop-outline':'phone-portrait-outline'} size={18} color={colors.primary}/>
              <Text style={styles.deviceName}>{device.platform==='ANDROID'?'Android':device.platform==='IOS'?'iPhone / iPad':device.platform}</Text>
              {current?<Badge label="This device" color={colors.green}/>:null}
            </View>
            <Text style={styles.caption}>{device.currentSessionStatus==='ACTIVE'?'Active session':device.currentSessionStatus==='REVOKED'?'Signed out':device.currentSessionStatus==='EXPIRED'?'Session expired':'No active session'}</Text>
            <Text style={styles.caption}>{'Last login: '+loginDate(device.lastLoginAt)}</Text>
            {device.currentSessionStatus==='ACTIVE'?<Button secondary label="Revoke session" busy={revoke.isPending&&revoke.variables===device.deviceId} disabled={revoke.isPending} onPress={()=>revokeDevice(device.deviceId)}/>:null}
          </View>;
        })}
        {devices.data?.devices.length===0?<Body>No devices to display.</Body>:null}
        {revoke.error?<ErrorState error={revoke.error}/>:null}
      </View>:null}
    </ProfileSection>

    <ProfileSection title="Legal" icon="document-text-outline">
      <View>
        <ProfileAction label="Terms of service" icon="reader-outline" link onPress={()=>void WebBrowser.openBrowserAsync(API_BASE_URL+'/terms')}/>
        <ProfileAction label="Privacy policy" icon="lock-closed-outline" link last onPress={()=>void WebBrowser.openBrowserAsync(API_BASE_URL+'/privacy')}/>
      </View>
    </ProfileSection>

    <ProfileSection title="Account" icon="person-outline">
      <View>
        <ProfileAction label="Sign out" detail="On this device" icon="log-out-outline" danger busy={logout.isPending&&logout.variables===false} disabled={logout.isPending} onPress={()=>logout.mutate(false)}/>
        <ProfileAction label="Sign out everywhere" detail="Sign out of all devices" icon="exit-outline" danger last busy={logout.isPending&&logout.variables===true} disabled={logout.isPending}
          onPress={()=>Alert.alert('Sign out everywhere?','All sessions will be revoked.',[
            {text:'Cancel',style:'cancel'},
            {text:'Sign out',style:'destructive',onPress:()=>logout.mutate(true)},
          ])}/>
      </View>
      {logout.error?<ErrorState error={logout.error}/>:null}
    </ProfileSection>
    <Text style={styles.footer}>RSD Education · AP DSC / SGT</Text>
  </Screen>;
}

const styles=StyleSheet.create({
  header:{flexDirection:'row',alignItems:'center',gap:12},
  back:{width:44,height:44,borderRadius:14,backgroundColor:colors.card,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},
  copy:{flex:1,minWidth:0,gap:3},
  title:{fontSize:23,lineHeight:31,fontWeight:'700',color:colors.ink},
  caption:{fontSize:12,lineHeight:19,color:colors.muted,flexShrink:1},
  panel:{padding:16,borderRadius:20,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card,gap:12},
  identity:{alignItems:'center',backgroundColor:'#F5F4FA',borderColor:'#DED9EE',paddingVertical:22,gap:8},
  avatarRing:{padding:4,borderRadius:42,borderWidth:1,borderColor:'#D7D1E8',backgroundColor:colors.card,marginBottom:4},
  avatar:{width:64,height:64,borderRadius:32},
  avatarFallback:{backgroundColor:colors.primarySoft,alignItems:'center',justifyContent:'center'},
  initial:{fontSize:27,fontWeight:'700',color:colors.primary},
  name:{fontSize:20,lineHeight:28,fontWeight:'700',color:colors.ink,textAlign:'center',maxWidth:'100%'},
  email:{fontSize:12,lineHeight:20,color:colors.muted,textAlign:'center',maxWidth:'100%'},
  googleAccount:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',alignItems:'center',gap:5,marginTop:3},
  googleLabel:{fontSize:11,lineHeight:18,color:colors.muted,textAlign:'center',flexShrink:1},
  sectionHeader:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8},
  sectionTitle:{flexDirection:'row',alignItems:'center',gap:8,flex:1,minWidth:130},
  sectionIcon:{width:30,height:30,borderRadius:10,backgroundColor:colors.primarySoft,alignItems:'center',justifyContent:'center'},
  sectionText:{fontSize:14,lineHeight:21,fontWeight:'700',color:colors.ink,flex:1},
  planName:{fontSize:18,lineHeight:26,fontWeight:'700',color:colors.primary},
  subscriptionDetail:{flexDirection:'row',alignItems:'center',gap:8},
  detailText:{fontSize:12,lineHeight:20,color:colors.muted,flex:1,minWidth:0},
  edit:{minHeight:44,paddingHorizontal:10,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,borderRadius:12,backgroundColor:'#F5F4FA'},
  editText:{fontSize:12,lineHeight:20,fontWeight:'600',color:colors.primary,flexShrink:1},
  summary:{gap:0},
  summaryRow:{flexDirection:'row',flexWrap:'wrap',gap:8,paddingVertical:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},
  summaryLabel:{fontSize:12,lineHeight:20,color:colors.muted,minWidth:66},
  summaryValue:{fontSize:13,lineHeight:21,fontWeight:'500',color:colors.ink,flex:1,minWidth:140},
  form:{gap:16},formGroup:{gap:8},fieldLabel:{fontSize:13,lineHeight:20,fontWeight:'600',color:colors.muted},
  success:{flexDirection:'row',alignItems:'center',gap:6,padding:10,borderRadius:12,backgroundColor:colors.greenSoft},
  successText:{fontSize:12,lineHeight:20,color:colors.green,flex:1,minWidth:0},
  deviceToggle:{minHeight:48,flexDirection:'row',alignItems:'center',gap:10,paddingVertical:4},
  deviceList:{gap:10},loading:{flexDirection:'row',alignItems:'center',gap:10},
  device:{borderWidth:1,borderColor:colors.border,borderRadius:14,padding:12,gap:6,backgroundColor:'#FAF9F7'},
  deviceHeader:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:7},
  deviceName:{fontSize:13,lineHeight:21,fontWeight:'600',color:colors.ink,flexShrink:1},
  actionRow:{minHeight:56,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},
  actionIcon:{width:32,height:32,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:colors.primarySoft},
  dangerIcon:{backgroundColor:colors.redSoft},
  actionLabel:{fontSize:13,lineHeight:21,fontWeight:'600',color:colors.ink,flexShrink:1},
  lastRow:{borderBottomWidth:0},
  footer:{fontSize:11,lineHeight:18,color:colors.muted,textAlign:'center',paddingBottom:4},
  pressed:{opacity:0.7},disabled:{opacity:0.5},
});
