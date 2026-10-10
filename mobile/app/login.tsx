import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Screen, Card, Heading, Body, Button, ErrorState, Stats } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { API_BASE_URL } from '@/utils/config';
export default function Login() {
  const auth = useAuth(); const [busy,setBusy] = useState(false); const [error,setError] = useState<unknown>();
  async function login() { setBusy(true);setError(undefined);try{await auth.signIn();}catch(e){setError(e);}finally{setBusy(false);} }
  return <Screen title="Your teaching journey starts here." subtitle="Prepare for AP DSC SGT, one focused session at a time.">
    <Card><Heading>Welcome to RSD Education</Heading><Body>Sign in with your Google account to sync your progress. Signing in replaces your previous active device session.</Body><Button label="Continue with Google" busy={busy} onPress={()=>void login()}/></Card>
    {!!error && <ErrorState error={error}/>}
    <Card gold><Heading>Learn. Practice. Grow.</Heading><Body>Subject practice, full-length mock papers, explanations and progress — together in your pocket.</Body><Stats items={[{label:'Study mediums',value:'English + తెలుగు'},{label:'Built for',value:'AP DSC SGT'}]}/></Card>
    <Body>By continuing, you agree to the terms and privacy policy.</Body>
    <Button secondary label="Terms of service" onPress={()=>void WebBrowser.openBrowserAsync(`${API_BASE_URL}/terms`)}/><Button secondary label="Privacy policy" onPress={()=>void WebBrowser.openBrowserAsync(`${API_BASE_URL}/privacy`)}/>
  </Screen>;
}
