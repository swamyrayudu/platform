import { Redirect } from 'expo-router';
import { useAuth } from '@/store/auth';
import { Screen, Loading, Body } from '@/components/ui';
// openAuthSessionAsync consumes the encrypted response. Never accept login from
// a cold-start deep link without the in-memory private key and request state.
export default function Callback() {
  const auth=useAuth();
  if(auth.loading||auth.signingIn)return <Screen title="Completing Google sign-in"><Loading/><Body>Verifying your session and opening RSD Education…</Body></Screen>;
  if(!auth.user)return <Redirect href="/login"/>;
  return <Redirect href={auth.user.onboardingCompleted?'/(tabs)':'/onboarding'}/>;
}
