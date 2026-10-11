import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, webcrypto } from 'node:crypto';
import { browserGoogleLogin } from '../services/browser-google-flow';
import { AUTH_CALLBACK } from '../services/auth-readiness';
import { bytesToHex, hexToBytes } from '../utils/crypto';

const origin='https://rsd.example',device='12345678-1234-1234-1234-123456789abc';
const ready:typeof fetch=async()=>Response.json({ready:true,protocol:1,browserMode:'redirect',callback:AUTH_CALLBACK});
async function encryptedReturn(startUrl:string) {
  const query=new URL(startUrl).searchParams,state=query.get('state')!;
  const subtle=webcrypto.subtle;
  const recipient=await subtle.importKey('raw',hexToBytes(query.get('publicKey')!),{name:'ECDH',namedCurve:'P-256'},false,[]);
  const sender=await subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const shared=await subtle.deriveBits({name:'ECDH',public:recipient},sender.privateKey,256);
  const key=await subtle.importKey('raw',await subtle.digest('SHA-256',shared),'AES-GCM',false,['encrypt']);
  const iv=randomBytes(12);
  const payload=await subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(state)},key,new TextEncoder().encode(JSON.stringify({accessToken:'fixture-access',refreshToken:'fixture-refresh',issuedAt:Date.now()})));
  const result=new URL(AUTH_CALLBACK);
  result.searchParams.set('state',state);result.searchParams.set('iv',bytesToHex(iv));
  result.searchParams.set('key',bytesToHex(new Uint8Array(await subtle.exportKey('raw',sender.publicKey))));
  result.searchParams.set('payload',bytesToHex(new Uint8Array(payload)));
  return result.toString();
}

test('Android and iOS browser sign-in use the existing bridge and decrypt only a matching encrypted app return',async()=>{
  for(const platform of ['ANDROID','IOS'] as const) {
    const entropy:Uint8Array[]=[];const stages:string[]=[];
    const result=await browserGoogleLogin(origin,platform,device,size=>{const value=randomBytes(size);entropy.push(value);return value;},async(url,callback)=>{
      const start=new URL(url);
      assert.equal(start.origin,origin);assert.equal(start.pathname,'/mobile-auth');
      assert.equal(start.searchParams.get('platform'),platform);assert.equal(start.searchParams.get('deviceId'),device);
      assert.equal(callback,AUTH_CALLBACK);assert.equal(start.searchParams.has('client_secret'),false);
      assert.equal(start.searchParams.has('idToken'),false);
      return {type:'success',url:await encryptedReturn(url)};
    },ready,stage=>stages.push(stage));
    assert.deepEqual(result,{accessToken:'fixture-access',refreshToken:'fixture-refresh'});
    assert.deepEqual(stages,['preparing','browser','exchanging']);
    assert.ok(entropy[0].every(byte=>byte===0),'ephemeral private key must be wiped');
  }
});

test('closing the browser returns no session and destroys the private key',async()=>{
  for(const type of ['cancel','dismiss']) {
    const entropy:Uint8Array[]=[];
    const result=await browserGoogleLogin(origin,'ANDROID',device,size=>{const value=randomBytes(size);entropy.push(value);return value;},async()=>({type}),ready);
    assert.equal(result,null);assert.ok(entropy[0].every(byte=>byte===0));
  }
});

test('browser failures and unrelated callback links never create a session or retain the private key',async()=>{
  for(const opener of [async()=>{throw new Error('browser unavailable');},async()=>({type:'success',url:'rsdeducation://auth/callback?state=wrong'}),async()=>({type:'success',url:'https://evil.example/auth/callback'}),async()=>({type:'success'})]) {
    const entropy:Uint8Array[]=[];
    await assert.rejects(browserGoogleLogin(origin,'ANDROID',device,size=>{const value=randomBytes(size);entropy.push(value);return value;},opener,ready));
    assert.ok(entropy[0].every(byte=>byte===0));
  }
});

test('an incompatible backend or non-HTTPS address stops before opening a browser',async()=>{
  let opened=false;
  const open=async()=>{opened=true;return {type:'dismiss'};};
  await assert.rejects(browserGoogleLogin(origin,'ANDROID',device,randomBytes,open,async()=>new Response('',{status:404})),/not deployed/);
  await assert.rejects(browserGoogleLogin('http://rsd.example','ANDROID',device,randomBytes,open,ready),/HTTPS/);
  assert.equal(opened,false);
});
