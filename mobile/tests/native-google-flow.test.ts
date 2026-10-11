import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nativeGoogleLogin } from '../services/native-google-flow';

const origin='https://rsd.example',clientId='existing-web.apps.googleusercontent.com',device='fixture-device';
const nonceResponse=(nonce='nonce')=>Response.json({nonce},{headers:{'Set-Cookie':`dsc_auth_nonce=${nonce}; HttpOnly; Secure; Path=/api/auth; Max-Age=300`}});
test('native Google sign-in keeps the backend nonce cookie and forwards its exact nonce to the chooser',async()=>{
  const requests:string[]=[];
  const tokens=await nativeGoogleLogin(origin,clientId,device,async(id,nonce)=>{
    assert.equal(id,clientId);assert.equal(nonce,'server-issued-nonce');return 'fixture-id-token';
  },async(input,options)=>{
    const url=String(input);requests.push(url);
    assert.equal(options?.credentials,'omit');
    assert.equal(new Headers(options?.headers).get('Authorization'),null);
    if(url.endsWith('/nonce')){assert.equal(new Headers(options?.headers).get('Cookie'),null);return nonceResponse('server-issued-nonce');}
    assert.equal(options?.method,'POST');
    assert.equal(new Headers(options?.headers).get('Cookie'),'dsc_auth_nonce=server-issued-nonce');
    assert.deepEqual(JSON.parse(String(options?.body)),{idToken:'fixture-id-token',deviceId:device,platform:'ANDROID',userAgent:'RSDMobile/1.0 Android CredentialManager'});
    return Response.json({accessToken:'fixture-access',refreshToken:'fixture-refresh',user:{id:'student'}});
  });
  assert.deepEqual(requests,[`${origin}/api/auth/nonce`,`${origin}/api/auth/google`]);
  assert.deepEqual(tokens,{accessToken:'fixture-access',refreshToken:'fixture-refresh'});
});
test('cancelled native Google chooser creates no backend session',async()=>{
  let requests=0;
  const result=await nativeGoogleLogin(origin,clientId,device,async()=>null,async()=>{requests++;return nonceResponse();});
  assert.equal(result,null);assert.equal(requests,1);
});
test('native authorization failures reach the login UI without a token exchange or an automatic retry',async()=>{
  let requests=0,chooserCalls=0;
  const failure=new Error('Google did not complete sign-in. Check the installed app signing certificate.');
  await assert.rejects(nativeGoogleLogin(origin,clientId,device,async()=>{chooserCalls++;throw failure;},async()=>{requests++;return nonceResponse();}),error=>error===failure);
  assert.equal(requests,1);assert.equal(chooserCalls,1);
});
test('native login stops before the chooser on a nonce failure and rejects missing or rejected sessions',async()=>{
  let chooserOpened=false;
  await assert.rejects(nativeGoogleLogin(origin,clientId,device,async()=>{chooserOpened=true;return 'token';},async()=>Response.json({message:'failed'},{status:503})),/prepare secure/);
  assert.equal(chooserOpened,false);
  for(const response of [Response.json({user:{id:'student'}}),Response.json({message:'Google token nonce mismatch'},{status:401})]){
    await assert.rejects(nativeGoogleLogin(origin,clientId,device,async()=> 'token',async input=>String(input).endsWith('/nonce')?nonceResponse():response),/mobile session|nonce mismatch/);
  }
  await assert.rejects(nativeGoogleLogin('http://rsd.example',clientId,device,async()=>null),/HTTPS/);
  await assert.rejects(nativeGoogleLogin(origin,'not-a-client-id',device,async()=>null),/Web OAuth/);
});
test('native exchange forwards only this attempt’s nonce, excluding unrelated cookies and cookie attributes',async()=>{
  const headers=new Headers();headers.append('Set-Cookie','dsc_access_token=old-session; HttpOnly; Path=/');headers.append('Set-Cookie','dsc_auth_nonce=nonce; HttpOnly; Secure; Path=/api/auth');
  await nativeGoogleLogin(origin,clientId,device,async()=> 'fixture-token',async(input,options)=>{
    if(String(input).endsWith('/nonce'))return Response.json({nonce:'nonce'},{headers});
    assert.equal(new Headers(options?.headers).get('Cookie'),'dsc_auth_nonce=nonce');
    return Response.json({accessToken:'fixture-access',refreshToken:'fixture-refresh'});
  });
});
test('native cookie extraction supports React Native headers without getSetCookie',async()=>{
  const response=nonceResponse();Object.defineProperty(response.headers,'getSetCookie',{value:undefined});
  await nativeGoogleLogin(origin,clientId,device,async()=> 'fixture-token',async(input,options)=>{
    if(String(input).endsWith('/nonce'))return response;
    assert.equal(new Headers(options?.headers).get('Cookie'),'dsc_auth_nonce=nonce');
    return Response.json({accessToken:'fixture-access',refreshToken:'fixture-refresh'});
  });
});
test('missing or stale nonce cookies fail before opening the chooser or submitting a Google token',async()=>{
  for(const response of [Response.json({nonce:'nonce'}),Response.json({nonce:'nonce'},{headers:{'Set-Cookie':'dsc_auth_nonce=old-nonce; HttpOnly'}})]){
    let opened=false;
    await assert.rejects(nativeGoogleLogin(origin,clientId,device,async()=>{opened=true;return 'token';},async()=>response),/nonce cookie/);
    assert.equal(opened,false);
  }
});
test('stalled native login request times out rather than leaving sign-in pending',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const pending=nativeGoogleLogin(origin,clientId,device,async()=>null,async(_input,options)=>new Promise((_resolve,reject)=>{
    options?.signal?.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});
  }));
  const rejected=assert.rejects(pending,/Could not finish Google sign-in/);
  t.mock.timers.tick(25000);
  await rejected;
});
test('native login returns the verified backend profile for overview/onboarding without an extra profile request',async()=>{
  for(const onboardingCompleted of [true,false]){
    const user={id:'student',email:'fixture@example.invalid',name:'Student',onboardingCompleted,learningGoals:['practice'],accountType:'FREE'};
    const requests:string[]=[];
    const result=await nativeGoogleLogin(origin,clientId,device,async()=> 'fixture-id-token',async input=>{
      requests.push(String(input));
      return String(input).endsWith('/nonce')?nonceResponse():Response.json({accessToken:'fixture-access',refreshToken:'fixture-refresh',user});
    });
    assert.deepEqual(result,{accessToken:'fixture-access',refreshToken:'fixture-refresh',user});
    assert.equal(requests.length,2);
    assert.ok(requests.every(url=>!url.endsWith('/me')));
  }
});
