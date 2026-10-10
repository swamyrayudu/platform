import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, randomBytes } from 'node:crypto';
import { p256 } from '@noble/curves/nist.js';
import { decryptHandoff, bytesToHex, encryptJson, decryptJson } from '../utils/crypto';
test('browser WebCrypto handoff decrypts on native using the app’s ephemeral key',async()=>{
  const privateKey=randomBytes(32),state='a'.repeat(64);const subtle=webcrypto.subtle;
  const recipient=await subtle.importKey('raw',p256.getPublicKey(privateKey,false),{name:'ECDH',namedCurve:'P-256'},false,[]);
  const ephemeral=await subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const secret=await subtle.deriveBits({name:'ECDH',public:recipient},ephemeral.privateKey,256);
  const key=await subtle.importKey('raw',await subtle.digest('SHA-256',secret),'AES-GCM',false,['encrypt']);
  const iv=randomBytes(12);const now=Date.now();
  const ciphertext=await subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(state)},key,new TextEncoder().encode(JSON.stringify({accessToken:'access',refreshToken:'refresh',issuedAt:now})));
  const url=new URL('rsdeducation://auth/callback');url.searchParams.set('state',state);url.searchParams.set('key',bytesToHex(new Uint8Array(await subtle.exportKey('raw',ephemeral.publicKey))));url.searchParams.set('iv',bytesToHex(iv));url.searchParams.set('payload',bytesToHex(new Uint8Array(ciphertext)));
  assert.deepEqual(decryptHandoff(privateKey,url.toString(),state,now),{accessToken:'access',refreshToken:'refresh'});
  assert.throws(()=>decryptHandoff(randomBytes(32),url.toString(),state,now));assert.throws(()=>decryptHandoff(privateKey,url.toString(),'b'.repeat(64),now));assert.throws(()=>decryptHandoff(privateKey,url.toString(),state,now+61000));
  url.searchParams.set('payload','00'.repeat(ciphertext.byteLength));assert.throws(()=>decryptHandoff(privateKey,url.toString(),state,now));
});
test('encrypted exam journal preserves Telugu text and rejects tampering/context swap',()=>{
  const key=randomBytes(32),nonce=randomBytes(12);const value={question:'తెలుగు',answer:'B',elapsed:20};const sealed=encryptJson(key,nonce,value,'active-exam');
  assert.ok(!sealed.includes('తెలుగు'));assert.deepEqual(decryptJson(key,sealed,'active-exam'),value);assert.throws(()=>decryptJson(key,sealed,'pending-payment'));assert.throws(()=>decryptJson(randomBytes(32),sealed,'active-exam'));
});
