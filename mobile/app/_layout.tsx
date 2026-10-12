import { Heading, HeadingFontProvider } from '@/components/heading';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Pressable } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/store/auth';
import { Loading, Screen, ErrorState } from '@/components/ui';
import { ApiError } from '@/services/api-client';
import { AppOpening } from '@/components/app-opening';
import { AppUpdate } from '@/components/app-update';
const cache = new QueryClient({defaultOptions:{queries:{staleTime:30000, retry:(count,err)=>count<1 && !(err instanceof ApiError && [401,403,404,429].includes(err.status))},mutations:{retry:false}}});
// A screen rendering failure must offer recovery instead of leaving a blank app.
// Do not display exception details that might contain session data.
export function ErrorBoundary({retry}:ErrorBoundaryProps) {
  return <View style={{flex:1,padding:24,paddingTop:64,justifyContent:'center',gap:20,backgroundColor:'#F4F2ED'}}>
    <Heading>Unable to open this screen</Heading>
    <Text style={{fontSize:16,lineHeight:24,color:'#302D55'}}>Please reload this screen and try again. If this keeps happening, contact support with code APP_SCREEN_ERROR.</Text>
    <Pressable accessibilityRole="button" onPress={()=>void retry()} style={{padding:16,borderRadius:16,backgroundColor:'#302D55'}}><Text style={{color:'#FFF',textAlign:'center',fontWeight:'700'}}>Reload screen</Text></Pressable>
  </View>;
}
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
export default function Root() { return <SafeAreaProvider><HeadingFontProvider><QueryClientProvider client={cache}><AuthProvider><StatusBar style="dark"/><View style={{flex:1}}><Navigation/><AppOpening/><AppUpdate/></View></AuthProvider></QueryClientProvider></HeadingFontProvider></SafeAreaProvider>; }
