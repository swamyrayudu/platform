import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTH_CALLBACK, checkGoogleAuthBackend } from '../services/auth-readiness';

test('login preflight recognizes missing deployment, config mismatch, and incompatible callbacks',async()=>{
  await assert.rejects(checkGoogleAuthBackend('https://rsd.example',async()=>new Response('',{status:404})),/not deployed/);
  await assert.rejects(checkGoogleAuthBackend('https://rsd.example',async()=>Response.json({error:'GOOGLE_CONFIG_REQUIRED'},{status:503})),/two Google client ID/);
  await assert.rejects(checkGoogleAuthBackend('https://rsd.example',async()=>Response.json({ready:true,protocol:1,callback:'evil://callback'})),/compatible mobile/);
  await assert.rejects(checkGoogleAuthBackend('https://rsd.example',async()=>{throw new TypeError('offline');}),/Check your connection/);
});

test('login preflight sends no previous session and accepts only the expected bridge',async()=>{
  await checkGoogleAuthBackend('https://rsd.example',async(url,options)=>{
    assert.equal(url,'https://rsd.example/mobile-auth?check=1');assert.equal(options?.credentials,'omit');
    assert.equal(new Headers(options?.headers).get('Authorization'),null);
    return Response.json({ready:true,protocol:1,callback:AUTH_CALLBACK});
  });
});
