import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nativeGoogleLogin } from '../services/native-google-flow';

const origin='https://rsd.example',clientId='existing-web.apps.googleusercontent.com',device='fixture-device';
test('native Google sign-in keeps the backend nonce cookie and forwards its exact nonce to the chooser',async()=>{
  const requests:string[]=[];
  const tokens=await nativeGoogleLogin(origin,clientId,device,async(id,nonce)=>{
    assert.equal(id,clientId);assert.equal(nonce,'server-issued-nonce');return 'fixture-id-token';
  },async(input,options)=>{
    const url=String(input);requests.push(url);
    assert.equal(options?.credentials,'include');
    assert.equal(new Headers(options?.headers).get('Authorization'),null);
    if(url.endsWith('/nonce'))return Response.json({nonce:'server-issued-nonce'});
    assert.equal(options?.method,'POST');
    assert.deepEqual(JSON.parse(String(options?.body)),{idToken:'fixture-id-token',deviceId:device,platform:'ANDROID',userAgent:'RSDMobile/1.0 Android CredentialManager'});
    return Response.json({accessToken:'fixture-access',refreshToken:'fixture-refresh',user:{id:'student'}});
  });
  assert.deepEqual(requests,[`${origin}/api/auth/nonce`,`${origin}/api/auth/google`]);
  assert.deepEqual(tokens,{accessToken:'fixture-access',refreshToken:'fixture-refresh'});
});
test('cancelled native Google chooser creates no backend session',async()=>{
  let requests=0;
  const result=await nativeGoogleLogin(origin,clientId,device,async()=>null,async()=>{requests++;return Response.json({nonce:'nonce'});});
  assert.equal(result,null);assert.equal(requests,1);
});
test('native login stops before the chooser on a nonce failure and rejects missing or rejected sessions',async()=>{
  let chooserOpened=false;
  await assert.rejects(nativeGoogleLogin(origin,clientId,device,async()=>{chooserOpened=true;return 'token';},async()=>Response.json({message:'failed'},{status:503})),/prepare secure/);
  assert.equal(chooserOpened,false);
  for(const response of [Response.json({user:{id:'student'}}),Response.json({message:'Google token nonce mismatch'},{status:401})]){
    await assert.rejects(nativeGoogleLogin(origin,clientId,device,async()=> 'token',async input=>String(input).endsWith('/nonce')?Response.json({nonce:'nonce'}):response),/mobile session|nonce mismatch/);
  }
  await assert.rejects(nativeGoogleLogin('http://rsd.example',clientId,device,async()=>null),/HTTPS/);
  await assert.rejects(nativeGoogleLogin(origin,'not-a-client-id',device,async()=>null),/Web OAuth/);
});
