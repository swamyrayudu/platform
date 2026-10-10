type GooglePicker = (webClientId:string,nonce:string)=>Promise<string|null>;

// Unauthenticated transport: preserve the backend's HttpOnly nonce cookie
// between these requests. Never attach an old bearer/refresh token here.
export async function nativeGoogleLogin(origin:string,webClientId:string,deviceId:string,pick:GooglePicker,transport:typeof fetch=fetch) {
  if(new URL(origin).protocol!=='https:')throw new Error('Google sign-in requires an HTTPS backend.');
  if(!/^[\w-]+\.apps\.googleusercontent\.com$/.test(webClientId))throw new Error('Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to the existing backend Web OAuth client ID.');
  const nonceResponse=await transport(`${origin}/api/auth/nonce`,{credentials:'include',cache:'no-store',headers:{Accept:'application/json'}});
  const nonceBody=await nonceResponse.json().catch(()=>null);
  if(!nonceResponse.ok||typeof nonceBody?.nonce!=='string'||!nonceBody.nonce)throw new Error('Could not prepare secure Google sign-in. Check your connection and try again.');
  const idToken=await pick(webClientId,nonceBody.nonce);
  if(!idToken)return null;
  const response=await transport(`${origin}/api/auth/google`,{method:'POST',credentials:'include',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({idToken,deviceId,platform:'ANDROID',userAgent:'RSDMobile/1.0 Android CredentialManager'})});
  const body=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(typeof body?.message==='string'?body.message:'Google sign-in was rejected by RSD Education. Check the Web OAuth client ID and Android signing configuration.');
  if(typeof body?.accessToken!=='string'||!body.accessToken||typeof body?.refreshToken!=='string'||!body.refreshToken)throw new Error('The backend did not return a mobile session. Please try again.');
  return {accessToken:body.accessToken,refreshToken:body.refreshToken};
}
