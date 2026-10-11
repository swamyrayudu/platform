import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Screen, Card, Heading, Body, Button, ErrorState, Stats } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { API_BASE_URL } from '@/utils/config';
import type { SignInStage } from '@/services/native-google-flow';
const progressLabels:Record<SignInStage,string>={preparing:'Preparing secure sign-in…',choosing:'Choose your Google account.',browser:'Complete Google sign-in in your browser, then return to RSD Education.',exchanging:'Completing Google sign-in…',profile:'Opening your overview…'};
export default function Login() {
  const auth = useAuth(); const [busy,setBusy] = useState(false); const [error,setError] = useState<unknown>(); const [stage,setStage]=useState<SignInStage>(); const [notice,setNotice]=useState<string>();
  async function login() {
    setBusy(true);setError(undefined);setNotice(undefined);
    try{if(!await auth.signIn(setStage))setNotice('Google sign-in was closed before it completed. Please try again.');}
    catch(e){setError(e);}
    finally{setBusy(false);setStage(undefined);}
  }
  return <Screen title="Your teaching journey starts here." subtitle="Prepare for AP DSC SGT, one focused session at a time.">
    <Card><Heading>Welcome to RSD Education</Heading><Body>Sign in with your Google account to sync your progress. Signing in replaces your previous active device session.</Body>
      {!!(error||auth.signInError) ? <ErrorState error={error||auth.signInError}/> : null}
      {notice ? <Body>{notice}</Body> : null}
      {busy&&stage ? <Body>{progressLabels[stage]}</Body> : null}
      <Button label="Continue with Google" busy={busy||auth.signingIn} onPress={()=>void login()}/>
    </Card>
    <Card gold><Heading>Learn. Practice. Grow.</Heading><Body>Subject practice, full-length mock papers, explanations and progress — together in your pocket.</Body><Stats items={[{label:'Study mediums',value:'English + తెలుగు'},{label:'Built for',value:'AP DSC SGT'}]}/></Card>
    <Body>By continuing, you agree to the terms and privacy policy.</Body>
    <Button secondary label="Terms of service" onPress={()=>void WebBrowser.openBrowserAsync(`${API_BASE_URL}/terms`)}/><Button secondary label="Privacy policy" onPress={()=>void WebBrowser.openBrowserAsync(`${API_BASE_URL}/privacy`)}/>
  </Screen>;
}
