import type { RingSession } from '@synonymdev/pubky';
import {
  clearSession,
  getPubkyClient,
  loadSession,
  persistSession,
  restoreHomeserver,
  setHomeserver,
} from '../lib/pubkyClient';
import type { BackgroundMessage, BackgroundResponse, PubkySessionPayload, RuntimeAuthEvent } from '../lib/messaging';

const client = getPubkyClient();

const toPayload = (session: RingSession | undefined): PubkySessionPayload | undefined => {
  if (!session) return undefined;
  return {
    id: session.id,
    qr: session.qr,
    status: session.status,
    identity: session.identity
      ? {
          pubkey: session.identity.pubkey,
          username: session.identity.username,
          homeserver: session.identity.homeserver,
        }
      : undefined,
  };
};

const broadcastAuth = (session?: RingSession) => {
  const event: RuntimeAuthEvent = {
    type: 'pubky/auth-state',
    session: toPayload(session),
  };
  try {
    chrome.runtime.sendMessage(event);
  } catch (error) {
    console.warn('Graphiti broadcast error', error);
  }
};

client.ring.onSessionAuthenticated(async (session) => {
  await persistSession(session);
  broadcastAuth(session);
});

const bootstrap = async () => {
  await restoreHomeserver();
  const stored = await loadSession();
  if (stored) {
    try {
      const restored = await client.ring.restoreSession(stored);
      if (restored) {
        broadcastAuth(restored);
        return;
      }
    } catch (error) {
      console.warn('Failed to restore Pubky session', error);
    }
  }
  if (stored) {
    await clearSession();
  }
  broadcastAuth(undefined);
};

void bootstrap();

chrome.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse) => {
  const respond = (response: BackgroundResponse) => {
    try {
      sendResponse(response);
    } catch (error) {
      console.warn('Response error', error);
    }
  };

  const handle = async () => {
    switch (message.type) {
      case 'pubky/login': {
        const session = await client.ring.createSession();
        await persistSession(session);
        respond({ type: 'pubky/session-created', session: toPayload(session)! });
        break;
      }
      case 'pubky/logout': {
        await client.ring.clearSession().catch(() => undefined);
        await clearSession();
        broadcastAuth(undefined);
        respond({ type: 'pubky/session-cleared' });
        break;
      }
      case 'pubky/get-session': {
        const session = await loadSession();
        respond({ type: 'pubky/session-restored', session: toPayload(session) });
        break;
      }
      case 'pubky/get-homeserver': {
        const homeserver = await restoreHomeserver();
        respond({ type: 'pubky/homeserver', homeserver });
        break;
      }
      case 'pubky/set-homeserver': {
        setHomeserver(message.homeserver);
        respond({ type: 'pubky/homeserver', homeserver: message.homeserver });
        break;
      }
      default: {
        respond({ type: 'error', error: 'Unknown message type' });
      }
    }
  };

  handle().catch((error) => {
    respond({ type: 'error', error: (error as Error).message ?? 'Unexpected background error' });
  });

  return true;
});
