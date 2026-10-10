import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/store/auth';
import { Loading, Screen, ErrorState } from '@/components/ui';
import { ApiError } from '@/services/api-client';
const cache = new QueryClient({defaultOptions:{queries:{staleTime:30000, retry:(count,err)=>count<1 && !(err instanceof ApiError && [401,403,404,429].includes(err.status))},mutations:{retry:false}}});
function Navigation() {
  const auth = useAuth();
  if (auth.loading) return <Screen title="RSD Education"><Loading/></Screen>;
  if (auth.error) return <Screen title="Reconnect"><ErrorState error={auth.error} retry={()=>void auth.reload()}/></Screen>;
  return <Stack screenOptions={{headerShown:false}}>
    <Stack.Protected guard={!auth.user}><Stack.Screen name="login"/></Stack.Protected>
    <Stack.Protected guard={!!auth.user && !auth.user.onboardingCompleted}><Stack.Screen name="onboarding"/></Stack.Protected>
    <Stack.Protected guard={!!auth.user && auth.user.onboardingCompleted}>
      <Stack.Screen name="(tabs)"/><Stack.Screen name="exam"/><Stack.Screen name="result"/><Stack.Screen name="mock/[id]"/><Stack.Screen name="subscription"/>
    </Stack.Protected>
    <Stack.Screen name="auth/callback"/>
  </Stack>;
}
export default function Root() { return <SafeAreaProvider><QueryClientProvider client={cache}><AuthProvider><StatusBar style="dark"/><Navigation/></AuthProvider></QueryClientProvider></SafeAreaProvider>; }
