import { useState } from 'react';
import { Alert, Image } from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Card, Heading, Body, Input, Button, ErrorState, Loading } from '@/components/ui';
import { Preferences } from '@/components/preferences';
import { useAuth } from '@/store/auth';
import { authService } from '@/services/auth-service';
import { api } from '@/services/api-client';
import { API_BASE_URL } from '@/utils/config';
import type { EducationMedium, LearningGoal, PublicDevice } from '@/types/auth';
export default function Profile() {
  const auth=useAuth();const cache=useQueryClient();const [name,setName]=useState(auth.user?.name||'');const [medium,setMedium]=useState<EducationMedium>(auth.user?.educationMedium||'english');const [goals,setGoals]=useState<LearningGoal[]>(auth.user?.learningGoals||['practice']);
  const devices=useQuery({queryKey:['devices'],queryFn:()=>api.request<{devices:PublicDevice[];currentDeviceId:string}>('/api/auth/devices')});
  const save=useMutation({mutationFn:()=>authService.profile({name,educationMedium:medium,learningGoals:goals}),onSuccess:async data=>{auth.update(data.user);await cache.invalidateQueries();}});
  const revoke=useMutation({mutationFn:(id:string)=>api.request(`/api/auth/devices/${encodeURIComponent(id)}`,'DELETE'),onSuccess:async()=>{await auth.reload();await cache.invalidateQueries();}});
  const logout=useMutation({mutationFn:(all:boolean)=>auth.logout(all)});
  return <Screen title="Your profile" subtitle="A study experience that fits you.">
    <Card>{auth.user?.avatarUrl&&<Image accessibilityLabel="Google profile photo" source={{uri:auth.user.avatarUrl}} style={{width:64,height:64,borderRadius:32}}/>}<Heading>{auth.user?.name}</Heading><Body>{auth.user?.email}</Body><Body>Google account · {auth.user?.accountType}</Body><Button secondary label="Subscription & payments" onPress={()=>router.push('/subscription')}/></Card>
    <Card><Heading>Personal details</Heading><Input label="Display name" value={name} onChangeText={t=>setName(t.slice(0,60))}/><Preferences medium={medium} goals={goals} setMedium={setMedium} setGoals={setGoals}/><Button label="Save preferences" busy={save.isPending} disabled={!name.trim()||!goals.length} onPress={()=>save.mutate()}/>{save.isSuccess&&<Body>Preferences saved.</Body>}{save.error&&<ErrorState error={save.error}/>}</Card>
    <Card><Heading>Devices and sessions</Heading><Body>RSD Education allows one active session. A new login ends the preceding session.</Body>{devices.isLoading&&<Loading/>}{devices.error&&<ErrorState error={devices.error} retry={()=>void devices.refetch()}/>} {devices.data?.devices.map(device=><Card key={device.deviceId}><Heading>{device.platform} {device.deviceId===devices.data?.currentDeviceId?'· This device':''}</Heading><Body>{device.currentSessionStatus||'No active session'} · Last login {new Date(device.lastLoginAt).toLocaleString()}</Body>{device.currentSessionStatus==='ACTIVE'&&<Button secondary label="Revoke this session" busy={revoke.isPending} onPress={()=>Alert.alert('Revoke session?','The selected device will be signed out.',[{text:'Cancel',style:'cancel'},{text:'Revoke',style:'destructive',onPress:()=>revoke.mutate(device.deviceId)}])}/>}</Card>)}{revoke.error&&<ErrorState error={revoke.error}/>}</Card>
    <Button secondary label="Terms of service" onPress={()=>void WebBrowser.openBrowserAsync(`${API_BASE_URL}/terms`)}/><Button secondary label="Privacy policy" onPress={()=>void WebBrowser.openBrowserAsync(`${API_BASE_URL}/privacy`)}/>
    <Button label="Sign out" busy={logout.isPending} onPress={()=>logout.mutate(false)}/><Button danger label="Sign out of all devices" busy={logout.isPending} onPress={()=>Alert.alert('Sign out everywhere?','All sessions will be revoked.',[{text:'Cancel',style:'cancel'},{text:'Sign out',onPress:()=>logout.mutate(true)}])}/>{logout.error&&<ErrorState error={logout.error}/>}
  </Screen>;
}
