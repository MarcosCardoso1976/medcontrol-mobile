import * as SecureStore from 'expo-secure-store';
import { generateId } from './ids';
import { getMeta, setMeta } from './db/repo';

const CHAVE = 'medcontrol_device_id';
let cache: string | null = null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const codigoValido = (c: string) => UUID.test(c.trim());

/** Identidade do usuário no MVP (header X-Device-Id). Guardada no Keychain/Keystore e espelhada no SQLite. */
export async function obterDeviceId(): Promise<string> {
  if (cache) return cache;
  let id: string | null = null;
  try {
    id = await SecureStore.getItemAsync(CHAVE);
  } catch {
    id = null;
  }
  if (!id) id = await getMeta('device_id');
  if (!id) id = generateId();
  await definirDeviceId(id);
  return id;
}

export async function definirDeviceId(id: string): Promise<void> {
  cache = id;
  try {
    await SecureStore.setItemAsync(CHAVE, id);
  } catch {
    /* o espelho no SQLite garante a persistência */
  }
  await setMeta('device_id', id);
}

export function deviceIdCurto(id: string): string {
  return `${id.slice(0, 8)}…`;
}
