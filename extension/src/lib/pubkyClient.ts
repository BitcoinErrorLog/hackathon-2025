import { createClient, type PubkyClient, type RingSession } from '@synonymdev/pubky';
import { DEFAULT_HOMESERVER, STORAGE_KEYS } from './constants';
import { getLocal, removeLocal, setLocal } from './storage';

let client: PubkyClient | null = null;
let currentHomeserver = DEFAULT_HOMESERVER;

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
  void setLocal({ [STORAGE_KEYS.homeserver]: currentHomeserver });
};

export const restoreHomeserver = async () => {
  const stored = await getLocal<string>(STORAGE_KEYS.homeserver);
  if (stored) {
    currentHomeserver = stored;
  }
  return currentHomeserver;
};

export const persistSession = async (session: RingSession) => {
  await setLocal({ [STORAGE_KEYS.session]: session });
};

export const clearSession = async () => {
  await removeLocal([STORAGE_KEYS.session]);
};

export const loadSession = async (): Promise<RingSession | undefined> => {
  return getLocal<RingSession>(STORAGE_KEYS.session);
};

export const getHomeserverValue = () => currentHomeserver;
