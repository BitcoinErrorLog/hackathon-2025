import {
  DEFAULT_HOMESERVER,
  STORAGE_KEYS,
  PUBKY_POLL_INTERVAL_MS,
  PUBKY_POLL_TIMEOUT_MS,
  FEED_REFRESH_INTERVAL_MS,
  RETRY_BASE_DELAY_MS,
  MAX_RETRY_ATTEMPTS,
} from '../lib/constants.js';
import { getLocal, setLocal, removeLocal, getSync, setSync } from '../lib/storage.js';
import { normalizeTags } from '../lib/tags.js';
import {
  startRingSession,
  pollRingSession,
  cancelRingSession,
  fetchFollows,
  fetchPostsForUrl,
  publishLinkPost,
} from '../lib/pubky.js';

let homeserver = DEFAULT_HOMESERVER;
let session = null;
let tagHistory = [];
let bookmarks = [];
let pendingQueue = [];
let status = {
  lastHomeserverError: null,
  lastSuccessfulPublishAt: null,
  lastFeedRefreshAt: null,
};
const feeds = new Map();
const metadataByUrl = new Map();
let pollHandle = null;
let pollDeadline = null;

const notify = (message) => {
  chrome.runtime.sendMessage(message).catch(() => {});
};

const broadcastState = () => {
  notify({
    type: 'graphiti/state',
    payload: {
      homeserver,
      session,
      tagHistory,
      bookmarks,
      pendingQueue,
      status,
    },
  });
};

const broadcastFeed = (url) => {
  notify({
    type: 'graphiti/feed',
    url,
    items: feeds.get(url) ?? [],
  });
};

const persistBasics = async () => {
  await setLocal({
    [STORAGE_KEYS.homeserver]: homeserver,
    [STORAGE_KEYS.session]: session,
    [STORAGE_KEYS.tagHistory]: tagHistory,
    [STORAGE_KEYS.pending]: pendingQueue,
    [STORAGE_KEYS.status]: status,
  });
};

const persistBookmarks = async () => {
  await setSync({ [STORAGE_KEYS.bookmarks]: bookmarks });
};

const loadFromStorage = async () => {
  const local = await getLocal([
    STORAGE_KEYS.homeserver,
    STORAGE_KEYS.session,
    STORAGE_KEYS.tagHistory,
    STORAGE_KEYS.pending,
    STORAGE_KEYS.status,
  ]);
  homeserver = local[STORAGE_KEYS.homeserver] ?? DEFAULT_HOMESERVER;
  session = local[STORAGE_KEYS.session] ?? null;
  tagHistory = local[STORAGE_KEYS.tagHistory] ?? [];
  pendingQueue = local[STORAGE_KEYS.pending] ?? [];
  status = local[STORAGE_KEYS.status] ?? status;

  const sync = await getSync([STORAGE_KEYS.bookmarks]);
  bookmarks = sync[STORAGE_KEYS.bookmarks] ?? [];
};

const updateTagHistory = async (tags) => {
  const normalized = normalizeTags(tags);
  if (!normalized.length) return tagHistory;
  const merged = Array.from(new Set([...tagHistory, ...normalized])).sort();
  tagHistory = merged;
  await persistBasics();
  broadcastState();
  return merged;
};

const withBackoff = async (operation) => {
  let attempt = 0;
  while (attempt < MAX_RETRY_ATTEMPTS) {
    try {
      return await operation(attempt);
    } catch (error) {
      attempt += 1;
      if (attempt >= MAX_RETRY_ATTEMPTS) throw error;
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Operation failed after retries');
};

const ensureAlarm = () => {
  chrome.alarms.create('graphiti-pending-drain', { delayInMinutes: 1, periodInMinutes: 1 });
};

const clearSessionState = async () => {
  session = null;
  await removeLocal([STORAGE_KEYS.session]);
  broadcastState();
};

const handleMetadata = async ({ payload }) => {
  if (!payload || !payload.url) return;
  metadataByUrl.set(payload.url, payload);
  await refreshFeed(payload.url);
};

const getFollows = async () => {
  if (!session?.identity?.pubkey) return [];
  try {
    const response = await fetchFollows(homeserver, session.identity.pubkey);
    if (Array.isArray(response?.follows)) {
      return response.follows;
    }
    if (Array.isArray(response)) return response;
    return [];
  } catch (error) {
    console.warn('Graphiti follow fetch failed', error);
    status.lastHomeserverError = error.message;
    await persistBasics();
    broadcastState();
    return [];
  }
};

const refreshFeed = async (url) => {
  if (!url) return;
  const follows = await getFollows();
  try {
    const response = await fetchPostsForUrl(homeserver, url, follows);
    const items = Array.isArray(response?.items) ? response.items : Array.isArray(response) ? response : [];
    feeds.set(url, items);
    status.lastFeedRefreshAt = new Date().toISOString();
    status.lastHomeserverError = null;
    await persistBasics();
    broadcastFeed(url);
    broadcastState();
  } catch (error) {
    console.warn('Graphiti feed refresh failed', error);
    status.lastHomeserverError = error.message;
    await persistBasics();
    broadcastState();
  }
};

const attemptPublish = async (entry) => {
  if (!session?.token) {
    throw new Error('Missing authenticated session');
  }
  await publishLinkPost(homeserver, session.token, entry.payload);
  status.lastSuccessfulPublishAt = new Date().toISOString();
  status.lastHomeserverError = null;
  await persistBasics();
};

const processPendingQueue = async () => {
  if (!pendingQueue.length) return;
  const remaining = [];
  for (const entry of pendingQueue) {
    try {
      await attemptPublish(entry);
    } catch (error) {
      console.warn('Graphiti pending publish failed', error);
      entry.lastError = error.message;
      entry.attempts = (entry.attempts ?? 0) + 1;
      remaining.push(entry);
    }
  }
  pendingQueue = remaining;
  await persistBasics();
  broadcastState();
};

const queuePending = async (payload, metadata) => {
  pendingQueue.push({
    id: crypto.randomUUID(),
    payload,
    metadata,
    createdAt: new Date().toISOString(),
    attempts: 0,
  });
  await persistBasics();
  ensureAlarm();
  broadcastState();
};

const publishOrQueue = async (payload, metadata) => {
  try {
    await withBackoff(() => attemptPublish({ payload }));
    await updateTagHistory(payload.tags);
    await refreshFeed(payload.url);
  } catch (error) {
    console.warn('Graphiti publish failed, queueing', error);
    await queuePending(payload, metadata);
    status.lastHomeserverError = error.message;
    await persistBasics();
    broadcastState();
  }
};

const setHomeserverValue = async (value) => {
  homeserver = value || DEFAULT_HOMESERVER;
  await persistBasics();
  broadcastState();
};

const addBookmark = async (bookmark) => {
  const entry = {
    ...bookmark,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  };
  bookmarks.unshift(entry);
  await persistBookmarks();
  broadcastState();
  return entry;
};

const removeBookmark = async (id) => {
  bookmarks = bookmarks.filter((entry) => entry.id !== id);
  await persistBookmarks();
  broadcastState();
};

const handleMessage = async (message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;
  switch (message.type) {
    case 'graphiti/page-metadata':
      await handleMetadata(message);
      break;
    case 'graphiti/request-state':
      sendResponse({
        homeserver,
        session,
        tagHistory,
        bookmarks,
        pendingQueue,
        status,
      });
      break;
    case 'graphiti/set-homeserver':
      await setHomeserverValue(message.value);
      sendResponse({ ok: true });
      break;
    case 'graphiti/start-login': {
      if (pollHandle) {
        clearInterval(pollHandle);
        pollHandle = null;
      }
      try {
        const sessionInfo = await startRingSession(homeserver);
        session = {
          id: sessionInfo.id,
          qr: sessionInfo.qr ?? sessionInfo.qrCode ?? sessionInfo.qr_uri,
          status: sessionInfo.status ?? 'pending',
          token: sessionInfo.token ?? null,
          identity: sessionInfo.identity ?? null,
        };
        await persistBasics();
        broadcastState();

        pollDeadline = Date.now() + PUBKY_POLL_TIMEOUT_MS;
        pollHandle = setInterval(async () => {
          if (!session?.id) return;
          if (Date.now() > pollDeadline) {
            await cancelRingSession(homeserver, session.id);
            clearInterval(pollHandle);
            pollHandle = null;
            session.status = 'expired';
            await persistBasics();
            broadcastState();
            return;
          }
          try {
            const update = await pollRingSession(homeserver, session.id);
            session.status = update.status ?? session.status;
            session.identity = update.identity ?? session.identity;
            session.token = update.token ?? session.token;
            await persistBasics();
            broadcastState();
            if (session.status === 'authenticated' && session.token) {
              clearInterval(pollHandle);
              pollHandle = null;
              await updateTagHistory([]);
              if (metadataByUrl.size) {
                const [firstUrl] = metadataByUrl.keys();
                await refreshFeed(firstUrl);
              }
            }
          } catch (error) {
            console.warn('Graphiti session poll failed', error);
          }
        }, PUBKY_POLL_INTERVAL_MS);

        sendResponse({ ok: true, session });
      } catch (error) {
        console.warn('Graphiti login start failed', error);
        status.lastHomeserverError = error.message;
        await persistBasics();
        broadcastState();
        sendResponse({ ok: false, error: error.message });
      }
      break;
    }
    case 'graphiti/logout':
      if (session?.id) {
        await cancelRingSession(homeserver, session.id);
      }
      await clearSessionState();
      sendResponse({ ok: true });
      break;
    case 'graphiti/publish': {
      const payload = {
        url: message.url,
        canonicalUrl: message.canonicalUrl,
        title: message.title,
        description: message.description,
        tags: normalizeTags(message.tags ?? []),
        comment: message.comment ?? '',
      };
      const metadata = message.metadata ?? {};
      await publishOrQueue(payload, metadata);
      sendResponse({ ok: true });
      break;
    }
    case 'graphiti/request-feed':
      await refreshFeed(message.url);
      sendResponse({ ok: true });
      break;
    case 'graphiti/bookmark-add': {
      const entry = await addBookmark(message.bookmark);
      sendResponse({ ok: true, entry });
      break;
    }
    case 'graphiti/bookmark-remove':
      await removeBookmark(message.id);
      sendResponse({ ok: true });
      break;
    case 'graphiti/pending-retry':
      await processPendingQueue();
      sendResponse({ ok: true });
      break;
    case 'graphiti/tag-history-add':
      await updateTagHistory(message.tags ?? []);
      sendResponse({ ok: true });
      break;
    default:
      break;
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'graphiti-pending-drain') {
    processPendingQueue().catch((error) => console.warn('Graphiti alarm drain failed', error));
  }
});

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm();
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab?.url) {
      await refreshFeed(tab.url);
      chrome.tabs.sendMessage(tab.id, { type: 'graphiti/request-page-metadata' }).catch(() => {});
    }
  } catch (error) {
    console.warn('Graphiti tab activation error', error);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    chrome.tabs.sendMessage(tabId, { type: 'graphiti/request-page-metadata' }).catch(() => {});
    refreshFeed(tab.url);
  }
});

(async () => {
  await loadFromStorage();
  broadcastState();
  ensureAlarm();
  if (session?.token) {
    processPendingQueue().catch(() => {});
  }
})();

setInterval(async () => {
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (activeTab?.url) {
    await refreshFeed(activeTab.url);
  }
}, FEED_REFRESH_INTERVAL_MS);
