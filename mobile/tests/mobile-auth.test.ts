import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { webcrypto, randomBytes } from 'node:crypto';
import { p256 } from '@noble/curves/nist.js';
import { decryptHandoff, bytesToHex } from '../utils/crypto';
import { GET } from '../../app/mobile-auth/route';
test('browser adapter rejects arbitrary redirect input and malformed keys',async()=>{
  assert.equal((await GET(new Request('https://rsd.example/mobile-auth?redirect=https://evil.example'))).status,400);
});
test('browser adapter preserves existing nonce endpoints and encrypts credentials',async()=>{
  const previous=process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID, previousServer=process.env.GOOGLE_CLIENT_ID;
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID=process.env.GOOGLE_CLIENT_ID='test.apps.googleusercontent.com';
  try{
    const q=new URLSearchParams({state:'a'.repeat(64),publicKey:'04'+'b'.repeat(128),deviceId:'12345678-1234-1234-1234-123456789abc',platform:'ANDROID'});
    const response=await GET(new Request(`https://rsd.example/mobile-auth?${q}`));assert.equal(response.status,200);assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');assert.equal(response.headers.get('Cache-Control'),'no-store');
    const html=await response.text();assert.ok(html.includes('/api/auth/nonce'));assert.ok(html.includes('/api/auth/google'));assert.ok(html.includes('AES-GCM'));assert.ok(!html.includes('client_secret'));assert.ok(html.includes('rsdeducation://auth/callback'));
    const inline=html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/);assert.ok(inline);assert.doesNotThrow(()=>new Script(inline![1]));
  }finally{if(previous===undefined)delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;else process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID=previous;if(previousServer===undefined)delete process.env.GOOGLE_CLIENT_ID;else process.env.GOOGLE_CLIENT_ID=previousServer;}
});

test('readiness rejects mismatched OAuth clients without issuing a session',async()=>{
  const previous=process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID, previousServer=process.env.GOOGLE_CLIENT_ID;
  try {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID='web.apps.googleusercontent.com';process.env.GOOGLE_CLIENT_ID='different.apps.googleusercontent.com';
    const bad=await GET(new Request('https://rsd.example/mobile-auth?check=1'));
    assert.equal(bad.status,503);assert.equal(bad.headers.get('set-cookie'),null);
    process.env.GOOGLE_CLIENT_ID=process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const good=await GET(new Request('https://rsd.example/mobile-auth?check=1'));
    assert.deepEqual(await good.json(),{ready:true,protocol:1,callback:'rsdeducation://auth/callback'});
    assert.equal(good.headers.get('Cache-Control'),'no-store');
  } finally {if(previous===undefined)delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;else process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID=previous;if(previousServer===undefined)delete process.env.GOOGLE_CLIENT_ID;else process.env.GOOGLE_CLIENT_ID=previousServer;}
});

test('actual browser bridge binds Google nonce and hands fixture sessions to native encrypted',async()=>{
  const previous=process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID, previousServer=process.env.GOOGLE_CLIENT_ID;
  try {
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID=process.env.GOOGLE_CLIENT_ID='test.apps.googleusercontent.com';
    const privateKey=randomBytes(32),state='c'.repeat(64);
    const query=new URLSearchParams({state,publicKey:bytesToHex(p256.getPublicKey(privateKey,false)),deviceId:'12345678-1234-1234-1234-123456789abc',platform:'ANDROID'});
    const html=await (await GET(new Request(`https://rsd.example/mobile-auth?${query}`))).text();
    const inline=html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)![1];
    let initialized:Record<string,unknown>={};let callbackUrl='';
    const elements=new Map<string,Record<string,unknown>>();
    const document={getElementById(id:string){if(!elements.has(id))elements.set(id,{replaceChildren(){}});return elements.get(id);},createElement(){return {};},head:{appendChild(){}}};
    const fetch=async(path:string,options:RequestInit)=>{
      assert.equal(options.credentials,'same-origin');
      if(path==='/api/auth/nonce')return Response.json({nonce:'issued-cookie-nonce'});
      assert.equal(path,'/api/auth/google');assert.equal(options.method,'POST');
      const body=JSON.parse(options.body as string);
      assert.equal(body.idToken,'fixture-google-token');assert.equal(body.platform,'ANDROID');assert.equal(body.deviceId,query.get('deviceId'));
      return Response.json({accessToken:'fixture-access',refreshToken:'fixture-refresh'});
    };
    const context={document,crypto:webcrypto,TextEncoder,URL,Uint8Array,navigator:{userAgent:'test-browser'},fetch,google:{accounts:{id:{initialize(config:Record<string,unknown>){initialized=config;},renderButton(){}}}},location:{replace(url:string){callbackUrl=url;}}};
    const script=new Script(inline+'\n globalThis.bridge={initialize,finish};');
    const {createContext}=await import('node:vm');const vm=createContext(context);script.runInContext(vm);
    const bridge=vm.bridge as {initialize():Promise<void>;finish(credential:{credential:string}):Promise<void>};
    await bridge.initialize();assert.equal(initialized.nonce,'issued-cookie-nonce');assert.equal(initialized.client_id,'test.apps.googleusercontent.com');
    await bridge.finish({credential:'fixture-google-token'});
    assert.equal(elements.get('return')?.href,callbackUrl);assert.equal(elements.get('return')?.hidden,false);
    assert.ok(callbackUrl.startsWith('rsdeducation://auth/callback'));assert.ok(!callbackUrl.includes('fixture-access'));
    assert.deepEqual(decryptHandoff(privateKey,callbackUrl,state),{accessToken:'fixture-access',refreshToken:'fixture-refresh'});
  } finally {if(previous===undefined)delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;else process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID=previous;if(previousServer===undefined)delete process.env.GOOGLE_CLIENT_ID;else process.env.GOOGLE_CLIENT_ID=previousServer;}
});
