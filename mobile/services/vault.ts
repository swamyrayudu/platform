import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import Storage from 'expo-sqlite/kv-store';
import { bytesToHex, hexToBytes, encryptJson, decryptJson } from '@/utils/crypto';
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
export interface Tokens { accessToken: string; refreshToken: string }
export const tokenStore = {
  async read(): Promise<Tokens | null> { const raw = await SecureStore.getItemAsync('rsd.session', options); return raw ? JSON.parse(raw) : null; },
  async write(tokens: Tokens) { await SecureStore.setItemAsync('rsd.session', JSON.stringify(tokens), options); },
  async clear() { await SecureStore.deleteItemAsync('rsd.session', options); },
};
export async function getDeviceId() {
  let id = await SecureStore.getItemAsync('rsd.device', options);
  if (!id) { id = Crypto.randomUUID(); await SecureStore.setItemAsync('rsd.device', id, options); }
  return id;
}
let vaultKey: Promise<Uint8Array> | undefined;
function key() {
  return vaultKey ??= (async () => {
    let raw = await SecureStore.getItemAsync('rsd.vault-key', options);
    if (!raw) { raw = bytesToHex(Crypto.getRandomBytes(32)); await SecureStore.setItemAsync('rsd.vault-key', raw, options); }
    return hexToBytes(raw);
  })();
}
// SQLite contains only AES-GCM ciphertext; the key is kept in OS secure storage.
export const vault = {
  async read<T>(name: string): Promise<T | null> { const raw = await Storage.getItem(name); return raw ? decryptJson<T>(await key(), raw, name) : null; },
  async write(name: string, data: unknown) { await Storage.setItem(name, encryptJson(await key(), Crypto.getRandomBytes(12), data, name)); },
  async remove(name: string) { await Storage.removeItem(name); },
  async clear() { await Storage.clear(); },
};
