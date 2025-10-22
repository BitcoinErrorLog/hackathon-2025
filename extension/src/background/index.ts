import type { RingSession } from '@synonymdev/pubky';
import {
  clearSession,
  getHomeserverValue,
  getPubkyClient,
  loadSession,
  persistSession,
  restoreHomeserver,
  setHomeserver,
} from '../lib/pubkyClient';
import {
  type BackgroundMessage,
  type BackgroundResponse,
  type PubkySessionPayload,
  type RuntimeAuthEvent,
  type RuntimeBookmarksEvent,
  type RuntimeFeedEvent,
} from '../lib/messaging';
import { STORAGE_KEYS } from '../lib/constants';
import { buildLinkRecord, computeRecordId, normalizeTags, normalizeUrl } from '../lib/records';
import type { BookmarkEntry, FeedItem, GraphitiStatusSnapshot, PendingPublication } from '../lib/types';
import {
  getLocal,
  getSession as getSessionStorage,
  getSync,
  setLocal,
  setSession as setSessionStorage,
  setSync,
} from '../lib/storage';

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

const broadcastFeed = (url: string, items: FeedItem[]) => {
  const event: RuntimeFeedEvent = { type: 'graphiti/feed-updated', url, items };
  try {
    chrome.runtime.sendMessage(event);
  } catch (error) {
    console.warn('Graphiti feed broadcast error', error);
  }
};

const broadcastBookmarks = (bookmarks: BookmarkEntry[]) => {
  const event: RuntimeBookmarksEvent = { type: 'graphiti/bookmarks-updated', bookmarks };
  try {
    chrome.runtime.sendMessage(event);
  } catch (error) {
    console.warn('Graphiti bookmarks broadcast error', error);
  }
};

const broadcastPending = (pending: PendingPublication[]) => {
  try {
    chrome.runtime.sendMessage({ type: 'graphiti/pending-publications-updated', pending });
  } catch (error) {
    console.warn('Graphiti pending broadcast error', error);
  }
};

const broadcastStatus = (status: GraphitiStatusSnapshot) => {
  try {
    chrome.runtime.sendMessage({ type: 'graphiti/status-updated', status });
  } catch (error) {
    console.warn('Graphiti status broadcast error', error);
  }
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isOnline = () => {
  if (typeof navigator === 'undefined') return true;
  if (typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
};

const withRetry = async <T>(operation: (attempt: number) => Promise<T>, attempts = 3, baseDelayMs = 500) => {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      const delay = baseDelayMs * Math.pow(2, attempt);
      await wait(delay);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Operation failed after retries');
};

const loadTagHistory = async () => {
  try {
    const stored = await getLocal<string[]>(STORAGE_KEYS.tagHistory);
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    console.warn('Failed to load tag history', error);
    return [];
  }
};

const mergeTagHistory = async (tags: string[]) => {
  const normalized = normalizeTags(tags);
  if (!normalized.length) return loadTagHistory();
  const existing = await loadTagHistory();
  const merged = Array.from(new Set([...existing, ...normalized])).sort();
  await setLocal({ [STORAGE_KEYS.tagHistory]: merged });
  return merged;
};

type StatusMetadata = {
  lastHomeserverError?: string;
  lastSuccessfulPublishAt?: string;
};

const loadStatusMetadata = async (): Promise<StatusMetadata> => {
  try {
    const stored = await getLocal<StatusMetadata>(STORAGE_KEYS.lastKnownStatus);
    if (stored && typeof stored === 'object') {
      return stored;
    }
    return {};
  } catch (error) {
    console.warn('Failed to load status metadata', error);
    return {};
  }
};

const persistStatusMetadata = async (metadata: StatusMetadata) => {
  await setLocal({ [STORAGE_KEYS.lastKnownStatus]: metadata });
  return metadata;
};

const loadBookmarks = async () => {
  try {
    const stored = await getSync<BookmarkEntry[]>(STORAGE_KEYS.bookmarks);
    if (!stored) return [];
    return stored
      .filter((entry): entry is BookmarkEntry => typeof entry?.id === 'string' && typeof entry?.url === 'string')
      .sort((a, b) => new Date(b.savedAt).valueOf() - new Date(a.savedAt).valueOf());
  } catch (error) {
    console.warn('Failed to load bookmarks', error);
    return [];
  }
};

const persistBookmarks = async (bookmarks: BookmarkEntry[]) => {
  await setSync({ [STORAGE_KEYS.bookmarks]: bookmarks });
  broadcastBookmarks(bookmarks);
  return bookmarks;
};

const randomId = () => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const saveBookmark = async (payload: Omit<BookmarkEntry, 'id' | 'savedAt'> & { id?: string }) => {
  const bookmarks = await loadBookmarks();
  const normalizedTags = normalizeTags(payload.tags ?? []);
  const normalizedUrl = normalizeUrl(payload.url);
  const bookmark: BookmarkEntry = {
    id: payload.id ?? randomId(),
    url: normalizedUrl,
    title: payload.title,
    note: payload.note,
    tags: normalizedTags,
    savedAt: new Date().toISOString(),
  };

  const existingIndex = bookmarks.findIndex((entry) => entry.id === bookmark.id || entry.url === bookmark.url);
  if (existingIndex >= 0) {
    bookmarks[existingIndex] = { ...bookmarks[existingIndex], ...bookmark };
  } else {
    bookmarks.unshift(bookmark);
  }

  await persistBookmarks(bookmarks);
  await mergeTagHistory(normalizedTags);
  return bookmark;
};

const deleteBookmark = async (id: string) => {
  const bookmarks = await loadBookmarks();
  const filtered = bookmarks.filter((entry) => entry.id !== id);
  await persistBookmarks(filtered);
};

const loadPendingPublications = async () => {
  try {
    const stored = await getLocal<PendingPublication[]>(STORAGE_KEYS.pendingPublications);
    if (!Array.isArray(stored)) return [];
    return stored
      .filter((entry): entry is PendingPublication => Boolean(entry?.id) && Boolean(entry?.payload?.url))
      .map((entry) => ({ ...entry, attempts: typeof entry.attempts === 'number' ? entry.attempts : 0 }))
      .sort((a, b) => new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf());
  } catch (error) {
    console.warn('Failed to load pending publications', error);
    return [];
  }
};

const composeStatusSnapshot = async (): Promise<GraphitiStatusSnapshot> => {
  const [metadata, pending] = await Promise.all([loadStatusMetadata(), loadPendingPublications()]);
  return {
    online: isOnline(),
    lastHomeserverError: metadata.lastHomeserverError,
    lastSuccessfulPublishAt: metadata.lastSuccessfulPublishAt,
    pendingPublications: pending,
  };
};

const broadcastStatusSnapshot = async () => {
  const snapshot = await composeStatusSnapshot();
  broadcastStatus(snapshot);
  return snapshot;
};

const persistPendingPublications = async (pending: PendingPublication[]) => {
  await setLocal({ [STORAGE_KEYS.pendingPublications]: pending });
  broadcastPending(pending);
  await broadcastStatusSnapshot();
  return pending;
};

const enqueuePendingPublication = async (
  payload: Parameters<typeof buildLinkRecord>[0],
  error?: string,
) => {
  const pending = await loadPendingPublications();
  const entry: PendingPublication = {
    id: randomId(),
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    error,
  };
  pending.push(entry);
  await persistPendingPublications(pending);
  return entry;
};

const upsertPendingPublication = async (entry: PendingPublication) => {
  const pending = await loadPendingPublications();
  const next = pending.map((item) => (item.id === entry.id ? entry : item));
  await persistPendingPublications(next);
  return entry;
};

const removePendingPublication = async (id: string) => {
  const pending = await loadPendingPublications();
  const next = pending.filter((entry) => entry.id !== id);
  await persistPendingPublications(next);
  return next;
};

const recordHomeserverError = async (message: string) => {
  const metadata = await loadStatusMetadata();
  const next: StatusMetadata = { ...metadata, lastHomeserverError: message };
  await persistStatusMetadata(next);
  await broadcastStatusSnapshot();
};

const recordSuccessfulPublish = async () => {
  const metadata = await loadStatusMetadata();
  const next: StatusMetadata = {
    ...metadata,
    lastHomeserverError: undefined,
    lastSuccessfulPublishAt: new Date().toISOString(),
  };
  await persistStatusMetadata(next);
  await broadcastStatusSnapshot();
};

const loadFeedCache = async () => {
  try {
    const stored = await getSessionStorage<Record<string, FeedItem[]>>(STORAGE_KEYS.feedCache);
    return stored ?? {};
  } catch (error) {
    console.warn('Failed to load feed cache', error);
    return {};
  }
};

const storeFeedCache = async (url: string, items: FeedItem[]) => {
  const cache = await loadFeedCache();
  cache[normalizeUrl(url)] = items;
  await setSessionStorage({ [STORAGE_KEYS.feedCache]: cache });
};

const coerceFeedItems = (records: any[], fallbackUrl: string): Promise<FeedItem>[] => {
  return records.map(async (record) => {
    const value = record?.value ?? record?.data ?? record?.record ?? record?.body ?? {};
    const tags = normalizeTags(Array.isArray(value?.tags) ? value.tags : value?.tag ? [value.tag] : []);
    const url = normalizeUrl(value?.url ?? record?.url ?? fallbackUrl);
    const createdAt =
      value?.createdAt ?? record?.createdAt ?? record?.updatedAt ?? record?.timestamp ?? new Date().toISOString();
    const author = record?.author ?? record?.identity ?? record?.owner ?? {};
    const pubkey = author?.pubkey ?? author?.id ?? author?.key ?? '';
    let id = record?.id ?? record?.recordId ?? record?.key;
    if (!id) {
      try {
        const hash = await computeRecordId(url, tags);
        id = `${pubkey || 'anon'}:${hash}`;
      } catch (error) {
        console.warn('Failed to derive deterministic feed id', error);
        id = randomId();
      }
    }
    return {
      id,
      url,
      tags,
      comment: value?.comment ?? value?.note ?? value?.description ?? '',
      title: value?.title ?? value?.name ?? value?.label ?? '',
      createdAt,
      author: {
        pubkey,
        username: author?.username ?? author?.handle ?? author?.name,
        homeserver: author?.homeserver ?? author?.server ?? author?.origin,
        displayName: author?.displayName ?? author?.nickname ?? author?.name ?? author?.username,
        avatarUrl: author?.avatar ?? author?.avatarUrl ?? value?.avatarUrl,
      },
      metadata: value?.metadata ?? record?.metadata ?? {},
    } satisfies FeedItem;
  });
};

const resolveFeedItems = async (records: any[], fallbackUrl: string) => {
  const resolved = await Promise.all(coerceFeedItems(records, fallbackUrl));
  const unique = new Map<string, FeedItem>();
  for (const item of resolved) {
    unique.set(item.id, item);
  }
  return Array.from(unique.values()).sort(
    (a, b) => new Date(b.createdAt).valueOf() - new Date(a.createdAt).valueOf(),
  );
};

const fetchFollows = async (identity?: { pubkey?: string }) => {
  const pubkey = identity?.pubkey;
  if (!pubkey) return [] as string[];
  const clientAny = client as any;
  const attempts = [
    () => clientAny?.social?.listFollowing?.(pubkey),
    () => clientAny?.social?.getFollowing?.({ pubkey }),
    () => clientAny?.graph?.listFollowing?.(pubkey),
    () => clientAny?.graph?.getFollowing?.({ pubkey }),
    () => clientAny?.contacts?.listFollowing?.(pubkey),
  ];

  for (const attempt of attempts) {
    try {
      const result = await attempt?.();
      if (!result) continue;
      if (Array.isArray(result)) {
        return result;
      }
      if (Array.isArray(result.following)) {
        return result.following;
      }
      if (Array.isArray(result.pubkeys)) {
        return result.pubkeys;
      }
    } catch (error) {
      console.warn('Failed to load follows', error);
    }
  }

  return [] as string[];
};

const requestLinkRecords = async (url: string, follows: string[]) => {
  const normalizedUrl = normalizeUrl(url);
  const hash = await computeRecordId(normalizedUrl, []);
  const clientAny = client as any;
  const session = await loadSession();
  const attempts = [
    () =>
      clientAny?.apps?.records?.list?.({
        appId: 'pubky.app.link',
        collection: 'link',
        url: normalizedUrl,
        hash,
        authors: follows.length ? follows : undefined,
        includeAuthors: true,
      }),
    () =>
      clientAny?.apps?.listRecords?.('pubky.app.link', {
        collection: 'link',
        url: normalizedUrl,
        hash,
        authors: follows,
      }),
    () =>
      clientAny?.apps?.query?.('pubky.app.link', {
        record: 'link',
        url: normalizedUrl,
        hash,
        authors: follows,
      }),
  ];

  for (const attempt of attempts) {
    try {
      const result = await attempt?.();
      if (!result) continue;
      if (Array.isArray(result)) return result;
      if (Array.isArray(result.records)) return result.records;
      if (Array.isArray(result.items)) return result.items;
    } catch (error) {
      console.warn('Failed to query Pubky apps API', error);
    }
  }

  try {
    const homeserver = getHomeserverValue();
    const base = new URL('/apps/pubky.app.link/records', homeserver);
    base.searchParams.set('url', normalizedUrl);
    base.searchParams.set('hash', hash);
    if (follows.length) {
      base.searchParams.set('authors', follows.join(','));
    }
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (session?.id) {
      headers['X-Pubky-Session'] = session.id;
    }
    const response = await fetch(base.toString(), { headers });
    if (!response.ok) {
      throw new Error(`Feed request failed with status ${response.status}`);
    }
    const json = await response.json();
    if (Array.isArray(json)) return json;
    if (Array.isArray(json.records)) return json.records;
    if (Array.isArray(json.items)) return json.items;
    return [];
  } catch (error) {
    console.warn('HTTP fallback for link records failed', error);
    return [];
  }
};

const fetchFeed = async (url: string, forceRefresh = false) => {
  const normalizedUrl = normalizeUrl(url);
  if (!forceRefresh) {
    const cache = await loadFeedCache();
    const cached = cache[normalizedUrl];
    if (cached) {
      return cached;
    }
  }

  if (!isOnline()) {
    const cache = await loadFeedCache();
    const cached = cache[normalizedUrl];
    if (cached) {
      return cached;
    }
    const offlineError = 'You appear to be offline. Graphiti will retry once the connection returns.';
    await recordHomeserverError(offlineError);
    throw new Error(offlineError);
  }

  const session = await loadSession();
  const follows = await fetchFollows(session?.identity);
  let rawRecords: any[] = [];
  try {
    rawRecords = await withRetry(() => requestLinkRecords(normalizedUrl, follows));
  } catch (error) {
    const message = (error as Error)?.message ?? 'Unable to load feed from Pubky homeserver.';
    await recordHomeserverError(message);
    const cache = await loadFeedCache();
    const cached = cache[normalizedUrl];
    if (cached) {
      return cached;
    }
    throw error;
  }
  const feed = await resolveFeedItems(rawRecords, normalizedUrl);
  const filtered = follows.length
    ? feed.filter((item) => follows.includes(item.author.pubkey))
    : feed;

  await storeFeedCache(normalizedUrl, filtered);
  broadcastFeed(normalizedUrl, filtered);
  return filtered;
};

const attemptPublishPayload = async (payload: Parameters<typeof buildLinkRecord>[0]) => {
  const record = await buildLinkRecord(payload);
  const clientAny = client as any;

  const publishAttempt = async () => {
    if (!isOnline()) {
      throw new Error('You appear to be offline. Saved to pending queue.');
    }
    const attempts = [
      () => clientAny?.apps?.records?.put?.(record.appId, record.collection, record.recordId, record.value),
      () => clientAny?.apps?.putRecord?.(record),
      () => clientAny?.apps?.publish?.(record),
      () =>
        clientAny?.apps?.records?.set?.({
          appId: record.appId,
          collection: record.collection,
          recordId: record.recordId,
          value: record.value,
        }),
    ];

    let lastError: unknown;
    for (const attempt of attempts) {
      try {
        if (!attempt) continue;
        await attempt();
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        console.warn('Pubky publish attempt failed', error);
      }
    }

    if (lastError) {
      throw lastError instanceof Error
        ? lastError
        : new Error('Unable to publish link record to Pubky homeserver.');
    }

    return record;
  };

  const finalRecord = await withRetry(publishAttempt, 3, 750);
  const value = finalRecord.value as { url?: string; tags?: string[] };
  const url = value?.url ?? payload.url;
  const tags = Array.isArray(value?.tags) ? value.tags : payload.tags ?? [];
  return { recordId: finalRecord.recordId, url, tags };
};

const flushPendingPublications = async (force = false) => {
  const pending = await loadPendingPublications();
  if (!pending.length) return pending;
  if (!isOnline() && !force) {
    return pending;
  }

  const remaining: PendingPublication[] = [];
  let publishedAny = false;
  for (const entry of pending) {
    try {
      const result = await attemptPublishPayload(entry.payload);
      publishedAny = true;
      await mergeTagHistory(result.tags);
      await fetchFeed(result.url, true).catch((error) => console.warn('Feed refresh after pending publish failed', error));
    } catch (error) {
      const message = (error as Error)?.message ?? 'Unable to publish pending link record.';
      const next: PendingPublication = {
        ...entry,
        attempts: (entry.attempts ?? 0) + 1,
        lastAttemptAt: new Date().toISOString(),
        error: message,
      };
      remaining.push(next);
      await recordHomeserverError(message);
    }
  }

  if (publishedAny) {
    await recordSuccessfulPublish();
  }

  await persistPendingPublications(remaining);
  return remaining;
};

const publishLink = async (payload: Parameters<typeof buildLinkRecord>[0]) => {
  try {
    const result = await attemptPublishPayload(payload);
    await mergeTagHistory(result.tags);
    await recordSuccessfulPublish();
    await fetchFeed(result.url, true).catch((error) => console.warn('Feed refresh after publish failed', error));
    await flushPendingPublications();
    return result.recordId;
  } catch (error) {
    const message = (error as Error)?.message ?? 'Unable to publish link record to Pubky homeserver.';
    await recordHomeserverError(message);
    await enqueuePendingPublication(payload, message);
    throw new Error(`${message} Saved to pending queue for retry.`);
  }
};

client.ring.onSessionAuthenticated(async (session) => {
  await persistSession(session);
  broadcastAuth(session);
  await flushPendingPublications(true).catch((error) => console.warn('Pending publish flush after auth failed', error));
  await broadcastStatusSnapshot().catch((error) => console.warn('Status broadcast after auth failed', error));
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
  await flushPendingPublications().catch((error) => console.warn('Initial pending flush failed', error));
  await broadcastStatusSnapshot().catch((error) => console.warn('Initial status broadcast failed', error));
};

void bootstrap();

if (chrome?.alarms) {
  chrome.alarms.create('graphiti.flush-pending', { delayInMinutes: 1, periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'graphiti.flush-pending') {
      void flushPendingPublications().catch((error) => console.warn('Scheduled pending flush failed', error));
    }
  });
}

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
      case 'graphiti/get-feed': {
        const items = await fetchFeed(message.url, Boolean(message.refresh));
        respond({ type: 'graphiti/feed', url: normalizeUrl(message.url), items });
        break;
      }
      case 'graphiti/publish-link': {
        const recordId = await publishLink(message.payload);
        respond({ type: 'graphiti/link-published', recordId });
        break;
      }
      case 'graphiti/get-bookmarks': {
        const bookmarks = await loadBookmarks();
        respond({ type: 'graphiti/bookmarks', bookmarks });
        break;
      }
      case 'graphiti/save-bookmark': {
        const bookmark = await saveBookmark(message.payload);
        respond({ type: 'graphiti/bookmark-saved', bookmark });
        break;
      }
      case 'graphiti/delete-bookmark': {
        await deleteBookmark(message.id);
        respond({ type: 'graphiti/bookmark-deleted', id: message.id });
        break;
      }
      case 'graphiti/get-tag-history': {
        const tags = await loadTagHistory();
        respond({ type: 'graphiti/tag-history', tags });
        break;
      }
      case 'graphiti/get-status': {
        const status = await composeStatusSnapshot();
        respond({ type: 'graphiti/status', status });
        break;
      }
      case 'graphiti/get-pending-publications': {
        const pending = await loadPendingPublications();
        respond({ type: 'graphiti/pending-publications', pending });
        break;
      }
      case 'graphiti/retry-pending-publication': {
        const pending = await loadPendingPublications();
        const entry = pending.find((item) => item.id === message.id);
        if (!entry) {
          respond({ type: 'error', error: 'Pending publication not found.' });
          break;
        }

        try {
          const result = await attemptPublishPayload(entry.payload);
          await mergeTagHistory(result.tags);
          await removePendingPublication(entry.id);
          await recordSuccessfulPublish();
          await fetchFeed(result.url, true).catch((error) => console.warn('Feed refresh after retry failed', error));
          const next = await loadPendingPublications();
          respond({ type: 'graphiti/pending-publications', pending: next });
        } catch (error) {
          const messageText = (error as Error)?.message ?? 'Retry failed.';
          const updated: PendingPublication = {
            ...entry,
            attempts: (entry.attempts ?? 0) + 1,
            lastAttemptAt: new Date().toISOString(),
            error: messageText,
          };
          await upsertPendingPublication(updated);
          await recordHomeserverError(messageText);
          const next = await loadPendingPublications();
          respond({ type: 'graphiti/pending-publications', pending: next });
        }
        break;
      }
      case 'graphiti/cancel-pending-publication': {
        await removePendingPublication(message.id);
        const next = await loadPendingPublications();
        respond({ type: 'graphiti/pending-publications', pending: next });
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
