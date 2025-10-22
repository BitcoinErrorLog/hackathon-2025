import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BackgroundMessage,
  BackgroundResponse,
  PubkySessionPayload,
  RuntimeEvent,
} from '../lib/messaging';
import type { FeedItem, GraphitiStatusSnapshot, PendingPublication } from '../lib/types';
import { STORAGE_KEYS } from '../lib/constants';
import { normalizeUrl } from '../lib/records';
import '../styles/index.css';

interface PageMetadata {
  url: string;
  title: string;
  description: string;
  siteName?: string;
  image?: string;
  icon?: string;
  collectedAt: string;
}

interface FeedState {
  items: FeedItem[];
  loading: boolean;
  error?: string;
  lastRefreshed?: string;
}

const sendMessage = (message: BackgroundMessage) =>
  new Promise<BackgroundResponse>((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(lastError);
        } else {
          resolve(response as BackgroundResponse);
        }
      });
    } catch (error) {
      reject(error);
    }
  });

const getPageMetadata = () =>
  new Promise<PageMetadata | null>((resolve) => {
    chrome.storage.session.get(STORAGE_KEYS.pageMetadata, (stored) => {
      const value = stored?.[STORAGE_KEYS.pageMetadata] as PageMetadata | undefined;
      resolve(value ?? null);
    });
  });

const usePageMetadata = () => {
  const [metadata, setMetadata] = useState<PageMetadata | null>(null);

  useEffect(() => {
    getPageMetadata().then(setMetadata).catch(() => undefined);
  }, []);

  useEffect(() => {
    const handleStorageChange: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, areaName) => {
      if (areaName !== 'session') return;
      if (STORAGE_KEYS.pageMetadata in changes) {
        const entry = changes[STORAGE_KEYS.pageMetadata];
        setMetadata((entry?.newValue as PageMetadata | undefined) ?? null);
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  return metadata;
};

const shortId = (value: string | undefined) => {
  if (!value) return 'unknown';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
};

const FeedCard = ({ item }: { item: FeedItem }) => {
  const timestamp = useMemo(() => new Date(item.createdAt).toLocaleString(), [item.createdAt]);
  const homeserverHost = useMemo(() => {
    if (!item.author.homeserver) return undefined;
    try {
      return new URL(item.author.homeserver).hostname;
    } catch (error) {
      console.warn('Invalid homeserver URL', item.author.homeserver, error);
      return undefined;
    }
  }, [item.author.homeserver]);
  return (
    <article className="graphiti-panel rounded-franky bg-franky-ink/70 p-4 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-franky-sky">
            {item.author.displayName || item.author.username || shortId(item.author.pubkey)}
          </p>
          <p className="text-[11px] text-franky-sand/60">
            {item.author.username ? `@${item.author.username}` : shortId(item.author.pubkey)}
            {homeserverHost ? ` · ${homeserverHost}` : ''}
          </p>
        </div>
        <time className="text-[11px] uppercase text-franky-sand/40" dateTime={item.createdAt}>
          {timestamp}
        </time>
      </header>
      {item.comment && <p className="mt-3 text-sm text-franky-sand">{item.comment}</p>}
      {item.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-franky-sky">
          {item.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-franky-sky/20 px-2 py-0.5 transition-all duration-200 hover:-translate-y-0.5">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
};

const EmptyFeed = ({
  loading,
  offline,
  authenticated,
  pendingCount,
}: {
  loading: boolean;
  offline: boolean;
  authenticated: boolean;
  pendingCount: number;
}) => {
  let message = 'No tagged posts for this URL yet. Share something to start the trail!';
  if (loading) {
    message = 'Fetching posts from your Pubky follows…';
  } else if (!authenticated) {
    message = 'Sign in from the popup to see what your Pubky follows have shared about this page.';
  } else if (offline) {
    message = 'Offline mode — showing the latest cached posts for this URL.';
  }
  return (
    <div className="graphiti-panel flex h-full flex-col items-center justify-center rounded-franky border border-dashed border-franky-sky/30 bg-franky-ink/40 p-6 text-center text-sm text-franky-sand/70">
      <p>{message}</p>
      {pendingCount > 0 && (
        <p className="mt-3 text-[11px] uppercase text-franky-sky/80">
          {pendingCount} pending publish{pendingCount === 1 ? '' : 'es'} will sync when you are online.
        </p>
      )}
    </div>
  );
};

export const App = () => {
  const metadata = usePageMetadata();
  const [session, setSession] = useState<PubkySessionPayload | undefined>();
  const [feedState, setFeedState] = useState<FeedState>({ items: [], loading: false });
  const [statusSnapshot, setStatusSnapshot] = useState<GraphitiStatusSnapshot>();
  const [pendingQueue, setPendingQueue] = useState<PendingPublication[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  });

  const normalizedUrl = metadata?.url ? normalizeUrl(metadata.url) : undefined;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const updateTheme = () => setTheme(media.matches ? 'light' : 'dark');
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', updateTheme);
    } else {
      media.addListener(updateTheme);
    }
    updateTheme();
    return () => {
      if (typeof media.removeEventListener === 'function') {
        media.removeEventListener('change', updateTheme);
      } else {
        media.removeListener(updateTheme);
      }
    };
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  const refreshStatus = useCallback(async () => {
    const response = await sendMessage({ type: 'graphiti/get-status' });
    if (response.type === 'graphiti/status') {
      setStatusSnapshot(response.status);
      setPendingQueue(response.status.pendingPublications);
    }
  }, []);

  const fetchFeed = useCallback(
    async (url: string, refresh = false) => {
      setFeedState((prev) => ({ ...prev, loading: true, error: undefined }));
      try {
        const response = await sendMessage({ type: 'graphiti/get-feed', url, refresh });
        if (response.type === 'graphiti/feed') {
          setFeedState({
            items: response.items,
            loading: false,
            lastRefreshed: new Date().toISOString(),
          });
        } else if (response.type === 'error') {
          setFeedState((prev) => ({ ...prev, loading: false, error: response.error }));
        }
      } catch (error) {
        setFeedState((prev) => ({ ...prev, loading: false, error: String(error) }));
      } finally {
        await refreshStatus().catch(() => undefined);
      }
    },
    [refreshStatus],
  );

  useEffect(() => {
    sendMessage({ type: 'pubky/get-session' })
      .then((response) => {
        if (response.type === 'pubky/session-restored') {
          setSession(response.session);
        }
      })
      .catch(() => undefined);
    refreshStatus().catch(() => undefined);
  }, [refreshStatus]);

  useEffect(() => {
    if (normalizedUrl) {
      fetchFeed(normalizedUrl);
    }
  }, [normalizedUrl, fetchFeed]);

  useEffect(() => {
    refreshStatus().catch(() => undefined);
  }, [refreshStatus]);

  useEffect(() => {
    const handler = (event: RuntimeEvent) => {
      if (event.type === 'pubky/auth-state') {
        setSession(event.session);
        if (normalizedUrl) {
          fetchFeed(normalizedUrl, true);
        }
      } else if (event.type === 'graphiti/feed-updated' && normalizedUrl) {
        if (normalizeUrl(event.url) === normalizedUrl) {
          setFeedState({ items: event.items, loading: false, lastRefreshed: new Date().toISOString() });
        }
      } else if (event.type === 'graphiti/status-updated') {
        setStatusSnapshot(event.status);
        setPendingQueue(event.status.pendingPublications);
      } else if (event.type === 'graphiti/pending-publications-updated') {
        setPendingQueue(event.pending);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [fetchFeed, normalizedUrl]);

  const hostname = metadata ? new URL(metadata.url).hostname : '';
  const authenticated = session?.status === 'authenticated';
  const offline = statusSnapshot?.online === false;
  const pendingCount = pendingQueue.length;
  const connectionLabel = offline ? 'Offline' : 'Online';
  const sessionLabel = authenticated ? 'Signed in' : 'Guest';
  const containerThemeClass =
    theme === 'light'
      ? 'from-franky-sand via-white to-franky-lime/10 text-franky-ink'
      : 'from-franky-ink to-franky-night text-franky-sand';
  const feedError =
    feedState.error ?? statusSnapshot?.lastHomeserverError ?? (offline ? 'Offline mode — showing cached results.' : undefined);

  return (
    <div
      className={`graphiti-surface flex h-full flex-col gap-4 bg-gradient-to-b ${containerThemeClass} p-4 transition-colors duration-500`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Graphiti Feed</h1>
          <p className="text-xs text-franky-sand/70">
            {metadata ? `Showing posts linked to ${hostname}` : 'Waiting for active tab metadata…'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-[11px] uppercase">
          <div className="flex gap-2">
            <span
              className={`rounded-full px-3 py-1 font-semibold ${offline ? 'bg-franky-blush/20 text-franky-blush' : 'bg-franky-sky/20 text-franky-sky'}`}
            >
              {connectionLabel}
            </span>
            <span
              className={`rounded-full px-3 py-1 font-semibold ${authenticated ? 'bg-franky-sky/10 text-franky-sky' : 'bg-franky-blush/10 text-franky-blush'}`}
            >
              {sessionLabel}
            </span>
          </div>
          {pendingCount > 0 && (
            <span className="text-[10px] text-franky-sky/80">
              {pendingCount} pending publish{pendingCount === 1 ? '' : 'es'}
            </span>
          )}
          <button
            className="rounded-franky border border-franky-sky/40 px-2 py-1 text-xs text-franky-sky transition hover:bg-franky-sky/10 disabled:cursor-not-allowed disabled:border-franky-sky/20 disabled:text-franky-sky/30"
            disabled={!normalizedUrl || feedState.loading}
            onClick={() => normalizedUrl && fetchFeed(normalizedUrl, true)}
          >
            {feedState.loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {metadata && (
        <section className="graphiti-panel rounded-franky bg-franky-night/70 p-4 shadow-card transition-all duration-300">
          <div className="flex items-center gap-3">
            {metadata.icon && (
              <img src={metadata.icon} alt="favicon" className="h-7 w-7 rounded-lg border border-franky-sky/20 bg-franky-ink/80" />
            )}
            <div>
              <h2 className="text-sm font-semibold text-franky-sand">{metadata.title}</h2>
              <p className="text-xs text-franky-sand/60">{metadata.url}</p>
            </div>
          </div>
        </section>
      )}

      {feedError && (
        <p className="graphiti-panel rounded-franky bg-franky-blush/20 p-3 text-xs text-franky-blush">
          {feedError}
        </p>
      )}

      <section className="flex-1 space-y-3 overflow-y-auto pr-1">
        {feedState.items.length === 0 ? (
          <EmptyFeed
            loading={feedState.loading}
            offline={offline}
            authenticated={Boolean(authenticated)}
            pendingCount={pendingCount}
          />
        ) : (
          feedState.items.map((item) => <FeedCard key={item.id} item={item} />)
        )}
      </section>

      {feedState.lastRefreshed && (
        <p className="text-right text-[10px] uppercase text-franky-sand/40">
          Updated {new Date(feedState.lastRefreshed).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
};

export default App;
