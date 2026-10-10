import { Redirect } from 'expo-router';
// openAuthSessionAsync consumes the encrypted response. Never accept login from
// a cold-start deep link without the in-memory private key and request state.
export default function Callback() { return <Redirect href="/"/>; }
