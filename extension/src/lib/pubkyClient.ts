import { createClient, type PubkyClient, type RingSession } from '@synonymdev/pubky';
import { DEFAULT_HOMESERVER, STORAGE_KEYS } from './constants';

let client: PubkyClient | null = null;
let currentHomeserver = DEFAULT_HOMESERVER;

const setLocalStorage = (items: Record<string, unknown>) =>
  new Promise<void>((resolve) => {
    chrome.storage.local.set(items, () => resolve());
  });

const getLocalStorage = <T>(key: string) =>
  new Promise<T | undefined>((resolve) => {
    chrome.storage.local.get(key, (items) => {
      resolve(items?.[key] as T | undefined);
    });
  });

const removeLocalStorage = (keys: string | string[]) =>
  new Promise<void>((resolve) => {
    chrome.storage.local.remove(keys, () => resolve());
  });

export const getPubkyClient = () => {
  if (!client) {
    client = createClient({ homeserver: currentHomeserver });
  }
  return client;
};

export const setHomeserver = (homeserver: string) => {
  currentHomeserver = homeserver || DEFAULT_HOMESERVER;
  if (client) {
    client.setHomeserver(currentHomeserver);
  }
  void setLocalStorage({ [STORAGE_KEYS.homeserver]: currentHomeserver });
};

export const restoreHomeserver = async () => {
  const stored = await getLocalStorage<string>(STORAGE_KEYS.homeserver);
  if (stored) {
    currentHomeserver = stored;
  }
  return currentHomeserver;
};

export const persistSession = async (session: RingSession) => {
  await setLocalStorage({ [STORAGE_KEYS.session]: session });
};

export const clearSession = async () => {
  await removeLocalStorage([STORAGE_KEYS.session]);
};

export const loadSession = async (): Promise<RingSession | undefined> => {
  return getLocalStorage<RingSession>(STORAGE_KEYS.session);
};
