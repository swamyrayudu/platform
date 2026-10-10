import { p256 } from '@noble/curves/nist.js';
import { gcm } from '@noble/ciphers/aes.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hexToBytes, bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
const bytesToUtf8 = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
export { bytesToHex, hexToBytes, utf8ToBytes };
export function decryptHandoff(privateKey: Uint8Array, url: string, state: string, now = Date.now()) {
  const callback = new URL(url);
  if (callback.protocol !== 'rsdeducation:' || callback.hostname !== 'auth' || callback.pathname !== '/callback' || callback.searchParams.get('state') !== state) {
    throw new Error('Sign-in response did not match this request.');
  }
  const key = hexToBytes(callback.searchParams.get('key') ?? '');
  const iv = hexToBytes(callback.searchParams.get('iv') ?? '');
  const ciphertext = hexToBytes(callback.searchParams.get('payload') ?? '');
  if (key.length !== 65 || iv.length !== 12 || ciphertext.length > 10000) throw new Error('Invalid sign-in response.');
  const shared = p256.getSharedSecret(privateKey, key, false).slice(1, 33);
  const decoded = gcm(sha256(shared), iv, utf8ToBytes(state)).decrypt(ciphertext);
  const tokens = JSON.parse(bytesToUtf8(decoded)) as { accessToken: string; refreshToken: string; issuedAt: number };
  if (!tokens.accessToken || !tokens.refreshToken || !Number.isFinite(tokens.issuedAt) || now - tokens.issuedAt > 60000 || tokens.issuedAt > now + 10000) {
    throw new Error('Sign-in response expired. Start again.');
  }
  return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
}
export function encryptJson(key: Uint8Array, nonce: Uint8Array, value: unknown, context: string) {
  return bytesToHex(nonce) + ':' + bytesToHex(gcm(key, nonce, utf8ToBytes(context)).encrypt(utf8ToBytes(JSON.stringify(value))));
}
export function decryptJson<T>(key: Uint8Array, value: string, context: string): T {
  const [nonce, ciphertext] = value.split(':');
  return JSON.parse(bytesToUtf8(gcm(key, hexToBytes(nonce), utf8ToBytes(context)).decrypt(hexToBytes(ciphertext)))) as T;
}
