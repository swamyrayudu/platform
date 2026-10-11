import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/store/auth';
import { API_BASE_URL } from '@/utils/config';
import { colors } from '@/utils/theme';
import { pageLayout } from '@/utils/layout';
import type { SignInStage } from '@/services/native-google-flow';
const logo=require('../assets/icon.png');
const progressLabels:Record<SignInStage,string>={preparing:'Preparing secure sign-in…',choosing:'Choose your Google account.',browser:'Complete Google sign-in in your browser, then return to RSD Education.',exchanging:'Completing Google sign-in…',profile:'Opening your overview…'};
export default function Login() {
  const auth = useAuth(); const [busy,setBusy] = useState(false); const [error,setError] = useState<unknown>(); const [stage,setStage]=useState<SignInStage>(); const [notice,setNotice]=useState<string>();
  const signing=useRef(false);
  const {width,height,fontScale}=useWindowDimensions();const insets=useSafeAreaInsets();
  const layout=pageLayout(width-insets.left-insets.right,height-insets.top-insets.bottom,fontScale);
  const pending=busy||auth.signingIn;const signInError=error||auth.signInError;
  async function login() {
    if(signing.current||auth.signingIn)return;
    signing.current=true;setBusy(true);setError(undefined);setNotice(undefined);
    try{if(!await auth.signIn(setStage))setNotice('Google sign-in was closed before it completed. Please try again.');}
    catch(e){setError(e);}
    finally{signing.current=false;setBusy(false);setStage(undefined);}
  }
  async function openPolicy(path:'terms'|'privacy') {
    try{await WebBrowser.openBrowserAsync(`${API_BASE_URL}/${path}`);}
    catch{setError(new Error('Could not open this page. Check your connection and try again.'));}
  }
  return <SafeAreaView style={styles.screen}>
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content,{paddingHorizontal:layout.padding,paddingVertical:layout.inlineFooter?20:36}]}>
      <View style={styles.brand}>
        <Image source={logo} accessible={false} resizeMode="contain" style={styles.logo}/>
        <Text accessibilityRole="header" style={styles.name}>RSD Education</Text>
        <Text style={styles.caption}>AP DSC / SGT preparation</Text>
      </View>
      <View style={styles.signIn}>
        <Text accessibilityRole="header" style={styles.title}>Welcome</Text>
        <Text style={styles.description}>Sign in to save your practice and track your progress.</Text>
        {signInError?<View accessibilityLiveRegion="assertive" style={styles.error}><Text style={styles.errorText}>{signInError instanceof Error?signInError.message:'Google sign-in could not finish. Please try again.'}</Text></View>:null}
        {notice?<Text accessibilityLiveRegion="polite" style={styles.description}>{notice}</Text>:null}
        <Pressable accessibilityRole="button" accessibilityLabel="Continue with Google" accessibilityState={{disabled:pending,busy:pending}} disabled={pending} onPress={()=>void login()} style={({pressed})=>[styles.google,pending&&{opacity:.6},pressed&&{opacity:.75}]}>
          {pending?<ActivityIndicator accessible={false} color={colors.primary}/>:<Ionicons name="logo-google" size={20} color={colors.primary}/>}
          <Text style={styles.googleText}>{pending?'Signing in…':'Continue with Google'}</Text>
        </Pressable>
        {pending&&stage?<Text accessibilityLiveRegion="polite" style={styles.description}>{progressLabels[stage]}</Text>:null}
        <Text style={styles.sessionNote}>Signing in makes this your active device.</Text>
      </View>
      <View style={styles.about}>
        <Text accessibilityRole="header" style={styles.aboutTitle}>About this app</Text>
        <Text style={styles.description}>Prepare for AP DSC / SGT with subject practice, methodology and mock tests in English or Telugu. Review explanations and follow your progress.</Text>
      </View>
      <View style={styles.legal}>
        <Text style={styles.legalNote}>By continuing, you agree to our terms and privacy policy.</Text>
        <View style={styles.links}>
          <Pressable accessibilityRole="link" accessibilityLabel="Terms of service" onPress={()=>void openPolicy('terms')} style={styles.link}><Text style={styles.linkText}>Terms</Text></Pressable>
          <Pressable accessibilityRole="link" accessibilityLabel="Privacy policy" onPress={()=>void openPolicy('privacy')} style={styles.link}><Text style={styles.linkText}>Privacy</Text></Pressable>
        </View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.background},content:{flexGrow:1,justifyContent:'center',gap:24,width:'100%',maxWidth:480,alignSelf:'center'},
  brand:{alignItems:'center',gap:5},logo:{width:80,height:80,marginBottom:5},name:{fontSize:28,lineHeight:38,fontWeight:'800',textAlign:'center',color:colors.primary},caption:{fontSize:12,lineHeight:20,textAlign:'center',color:colors.gold,fontWeight:'600'},
  signIn:{padding:20,gap:12,borderRadius:24,borderWidth:1,borderColor:colors.border,backgroundColor:colors.card},title:{fontSize:21,lineHeight:30,fontWeight:'700',color:colors.ink},description:{fontSize:14,lineHeight:23,color:colors.muted},
  google:{minHeight:54,paddingHorizontal:14,paddingVertical:14,borderRadius:14,borderWidth:1,borderColor:colors.primary,backgroundColor:colors.primarySoft,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},googleText:{flexShrink:1,fontSize:14,lineHeight:22,fontWeight:'700',color:colors.primary,textAlign:'center'},sessionNote:{fontSize:11,lineHeight:18,color:colors.muted},
  error:{padding:12,borderRadius:12,backgroundColor:colors.redSoft},errorText:{fontSize:13,lineHeight:22,color:colors.red},
  about:{gap:7,paddingHorizontal:4},aboutTitle:{fontSize:15,lineHeight:23,fontWeight:'700',color:colors.ink},
  legal:{gap:2},legalNote:{fontSize:11,lineHeight:18,textAlign:'center',color:colors.muted},links:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:12},link:{minHeight:44,paddingHorizontal:12,paddingVertical:12,justifyContent:'center'},linkText:{fontSize:12,lineHeight:20,fontWeight:'600',color:colors.primary,textDecorationLine:'underline'},
});
