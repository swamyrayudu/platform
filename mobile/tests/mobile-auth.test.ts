import { test, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Script, createContext, runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { p256 } from '@noble/curves/nist.js';
import { decryptHandoff, bytesToHex } from '../utils/crypto';
import { readMobileContext, sealMobileContext, exchangeMobileCredential, mobileAppReturnUrl, MOBILE_GOOGLE_COOKIE } from '../../lib/mobile-google-bridge';

// Server aliases belong to the website's TypeScript config, not Expo's config.
let GET:(request:Request)=>Promise<Response>,POST:(request:Request)=>Promise<Response>;
async function loadServerRoute(fixtureLogin?: (request:Request)=>Promise<Response>) {
  const serverBundle=await build({entryPoints:[resolve('../app/mobile-auth/route.ts')],tsconfig:resolve('../tsconfig.json'),bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:fixtureLogin?[{name:'login-test-port',setup(builder){
    builder.onResolve({filter:/^\.\.\/api\/auth\/google\/route$/},()=>({path:'existing-login',namespace:'fixture'}));
    builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:'export const POST=request=>globalThis.fixtureLogin(request);'}));
  }}]:[]});
  const serverModule={exports:{}};
  runInNewContext(serverBundle.outputFiles[0].text,{module:serverModule,exports:serverModule.exports,require:createRequire(resolve('../package.json')),process,Buffer,Request,Response,Headers,URL,URLSearchParams,console,setTimeout,clearTimeout,fixtureLogin});
  return serverModule.exports as {GET:(request:Request)=>Promise<Response>;POST:(request:Request)=>Promise<Response>};
}
before(async()=>{({GET,POST}=await loadServerRoute());});

const fixtureSecret='test-only-mobile-bridge-secret-32-characters';
let previous: Record<string,string|undefined>;
beforeEach(()=>{
  previous={NEXT_PUBLIC_GOOGLE_CLIENT_ID:process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,GOOGLE_CLIENT_ID:process.env.GOOGLE_CLIENT_ID,JWT_SECRET:process.env.JWT_SECRET};
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID=process.env.GOOGLE_CLIENT_ID='test.apps.googleusercontent.com';
  process.env.JWT_SECRET=fixtureSecret;
});
afterEach(()=>{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
async function start(platform:'ANDROID'|'IOS'='ANDROID') {
  const privateKey=randomBytes(32),state='c'.repeat(64);
  const query=new URLSearchParams({state,publicKey:bytesToHex(p256.getPublicKey(privateKey,false)),deviceId:'12345678-1234-1234-1234-123456789abc',platform});
  const response=await GET(new Request('https://rsd.example/mobile-auth?'+query));
  const cookie=response.headers.getSetCookie().find(value=>value.startsWith(MOBILE_GOOGLE_COOKIE+'='))!;
  const signed=cookie.split(';')[0].slice(MOBILE_GOOGLE_COOKIE.length+1);
  return {privateKey,state,response,cookie,signed,context:readMobileContext(signed,fixtureSecret)};
}
function googlePost(signed:string,csrf='fixture-csrf',submitted=csrf) {
  return new Request('https://rsd.example/mobile-auth',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:MOBILE_GOOGLE_COOKIE+'='+signed+'; g_csrf_token='+csrf},
    body:new URLSearchParams({credential:'fixture-google-token',g_csrf_token:submitted})});
}
test('mobile redirect rejects arbitrary return URLs and invalid public keys before setting context cookies',async()=>{
  for(const url of ['https://rsd.example/mobile-auth?redirect=https://evil.example','https://rsd.example/mobile-auth?'+new URLSearchParams({state:'a'.repeat(64),publicKey:'04'+'b'.repeat(128),deviceId:'12345678-1234-1234-1234-123456789abc',platform:'ANDROID'})]) {
    const response=await GET(new Request(url));assert.equal(response.status,400);assert.equal(response.headers.get('Set-Cookie'),null);
  }
});
test('Google uses full-page redirect to a fixed existing URI and keeps signed context HttpOnly and short-lived',async()=>{
  const {response,cookie,context}=await start();
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Referrer-Policy'),'strict-origin-when-cross-origin');
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.match(cookie,/HttpOnly; Secure; SameSite=None; Max-Age=300/);
  const html=await response.text(),inline=html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)![1];
  assert.doesNotThrow(()=>new Script(inline));assert.ok(!html.includes('fixtureSecret'));assert.ok(!html.includes('client_secret'));
  let config:Record<string,unknown>={};
  const message={textContent:''};
  const vm=createContext({document:{getElementById(){return message;},createElement(){return {};},head:{appendChild(){}}},google:{accounts:{id:{initialize(value:Record<string,unknown>){config=value;},renderButton(){}}}}});
  new Script(inline+'\ninitialize();').runInContext(vm);
  assert.equal(config.ux_mode,'redirect');assert.equal(config.login_uri,'https://rsd.example/mobile-auth');assert.equal(config.nonce,context.nonce);
  assert.equal(config.callback,undefined);
});
test('readiness reports the redirect capability and rejects mismatched existing client IDs or missing signing configuration',async()=>{
  process.env.GOOGLE_CLIENT_ID='different.apps.googleusercontent.com';
  assert.equal((await GET(new Request('https://rsd.example/mobile-auth?check=1'))).status,503);
  process.env.GOOGLE_CLIENT_ID=process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const good=await GET(new Request('https://rsd.example/mobile-auth?check=1'));
  assert.deepEqual(await good.json(),{ready:true,protocol:1,browserMode:'redirect',callback:'rsdeducation://auth/callback'});
  assert.equal(good.headers.get('Set-Cookie'),null);
  delete process.env.JWT_SECRET;
  assert.equal((await GET(new Request('https://rsd.example/mobile-auth?check=1'))).status,503);
});
test('Google POST delegates token verification to the existing API and returns only an encrypted app-bound session',async()=>{
  for(const platform of ['ANDROID','IOS'] as const) {
    const {privateKey,state,signed,context}=await start(platform);
    const result=await exchangeMobileCredential(googlePost(signed),fixtureSecret,async request=>{
      assert.equal(new URL(request.url).pathname,'/api/auth/google');
      assert.equal(request.headers.get('cookie'),'dsc_auth_nonce='+context.nonce);
      assert.equal(request.headers.get('authorization'),null);
      assert.deepEqual(await request.json(),{idToken:'fixture-google-token',deviceId:context.deviceId,platform,userAgent:'RSDMobile browser redirect'});
      return Response.json({accessToken:'fixture-access',refreshToken:'fixture-refresh'});
    });
    assert.deepEqual(decryptHandoff(privateKey,result.callback,state),{accessToken:'fixture-access',refreshToken:'fixture-refresh'});
    assert.throws(()=>decryptHandoff(randomBytes(32),result.callback,state));
    assert.throws(()=>decryptHandoff(privateKey,result.callback,'a'.repeat(64)));
    const appUrl=mobileAppReturnUrl(result.callback,platform);
    if(platform==='ANDROID')assert.ok(appUrl.startsWith('intent://auth/callback?')&&appUrl.endsWith('#Intent;scheme=rsdeducation;package=com.rsdeducation.student;end'));
    else assert.equal(appUrl,result.callback);
    assert.ok(!appUrl.includes('fixture-access'));assert.ok(!appUrl.includes('fixture-refresh'));
  }
});
test('missing or mismatched CSRF, expired or tampered context never invokes existing authentication',async()=>{
  const {signed,context}=await start();let called=false;
  const exchange=async()=>{called=true;return Response.json({});};
  const expired=sealMobileContext({...context,issuedAt:Date.now()-300001},fixtureSecret);
  for(const request of [googlePost(signed,'',''),googlePost(signed,'one','two'),googlePost(signed.slice(1)),googlePost(expired),googlePost('')])await assert.rejects(exchangeMobileCredential(request,fixtureSecret,exchange));
  assert.equal(called,false);
  const failure=await POST(googlePost(signed,'one','two'));
  assert.equal(failure.status,400);assert.match(await failure.text(),/MOBILE_GOOGLE_RETURN_FAILED/);
  assert.ok(failure.headers.getSetCookie().some(value=>value.includes('Max-Age=0')));
});
test('accepted Google POST renders a visible package-targeted app button without exposing session tokens',async()=>{
  const {signed,privateKey,state}=await start();let calls=0;
  const fixtureRoute=await loadServerRoute(async request=>{
    calls++;assert.equal((await request.json()).platform,'ANDROID');
    return Response.json({accessToken:'fixture-access',refreshToken:'fixture-refresh'});
  });
  const response=await fixtureRoute.POST(googlePost(signed)),html=await response.text();
  assert.equal(response.status,200);assert.equal(calls,1);
  assert.match(html,/Open RSD Education/);
  assert.ok(!html.includes('fixture-access'));assert.ok(!html.includes('fixture-refresh'));assert.ok(!html.includes('location.replace'));
  const intent=html.match(/href="([^"]+)"/)![1].replace(/&amp;/g,'&');
  assert.ok(intent.endsWith('#Intent;scheme=rsdeducation;package=com.rsdeducation.student;end'));
  assert.equal(decryptHandoff(privateKey,intent.split('#')[0].replace('intent:','rsdeducation:'),state).accessToken,'fixture-access');
  assert.match(response.headers.get('Set-Cookie')!,/Max-Age=0/);
});
test('rejected backend login or missing app session cannot produce an app return',async()=>{
  const {signed}=await start();
  for(const response of [Response.json({message:'bad token'},{status:401}),Response.json({user:{id:'student'}})])await assert.rejects(exchangeMobileCredential(googlePost(signed),fixtureSecret,async()=>response));
});
