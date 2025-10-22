import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import type {
  BackgroundMessage,
  BackgroundResponse,
  PubkySessionPayload,
  RuntimeEvent,
} from '../lib/messaging';
import type { BookmarkEntry } from '../lib/types';
import { STORAGE_KEYS } from '../lib/constants';
import { normalizeTags, slugifyTag } from '../lib/records';
import '../styles/index.css';

interface PageMetadata {
  url: string;
  title: string;
  description: string;
  siteName?: string;
  image?: string;
  icon?: string;
  lang?: string;
  collectedAt: string;
}

type AuthState = {
  session?: PubkySessionPayload;
  loading: boolean;
  homeserver?: string;
  error?: string;
};

const sendMessage = async (message: BackgroundMessage) =>
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

const useRuntimeAuth = () => {
  const [state, setState] = useState<AuthState>({ loading: true });

  useEffect(() => {
    const handler = (event: RuntimeEvent) => {
      if (event.type === 'pubky/auth-state') {
        setState((prev) => ({ ...prev, session: event.session, loading: false }));
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => {
      chrome.runtime.onMessage.removeListener(handler);
    };
  }, []);

  useEffect(() => {
    (async () => {
      const [sessionResp, homeserverResp] = await Promise.all([
        sendMessage({ type: 'pubky/get-session' }),
        sendMessage({ type: 'pubky/get-homeserver' }),
      ]);
      if (sessionResp.type === 'pubky/session-restored') {
        setState((prev) => ({ ...prev, session: sessionResp.session, loading: false }));
      }
      if (homeserverResp.type === 'pubky/homeserver') {
        setState((prev) => ({ ...prev, homeserver: homeserverResp.homeserver }));
      }
    })().catch((error) => {
      setState((prev) => ({ ...prev, error: String(error), loading: false }));
    });
  }, []);

  return [state, setState] as const;
};

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

const QRDisplay = ({ qr }: { qr: string }) => {
  if (!qr) return null;
  const imageSrc = qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`;
  return (
    <div className="flex flex-col items-center gap-2 rounded-franky bg-franky-night/70 p-4 shadow-glow">
      <img src={imageSrc} alt="Pubky Ring QR" className="h-40 w-40 rounded-lg border border-franky-sky/40" />
      <p className="text-center text-sm text-franky-sand/80">Scan with Pubky mobile app to complete sign-in.</p>
    </div>
  );
};

const HomeserverField = ({
  homeserver,
  onChange,
}: {
  homeserver?: string;
  onChange: (value: string) => void;
}) => {
  const [value, setValue] = useState(homeserver ?? '');

  useEffect(() => {
    setValue(homeserver ?? '');
  }, [homeserver]);

  const handleBlur = () => {
    if (!value) return;
    onChange(value.trim());
  };

  return (
    <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-franky-sand/70">
      Homeserver
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={handleBlur}
        placeholder="https://"
        className="rounded-franky border border-franky-sky/30 bg-franky-ink px-3 py-2 text-base text-franky-sand focus:border-franky-sky focus:outline-none"
      />
    </label>
  );
};

const LoginControls = ({
  session,
  onLogin,
  onLogout,
}: {
  session?: PubkySessionPayload;
  onLogin: () => Promise<void>;
  onLogout: () => Promise<void>;
}) => {
  const authenticated = session?.status === 'authenticated';
  return (
    <div className="flex flex-col gap-3">
      {authenticated ? (
        <>
          <p className="text-sm text-franky-sand/80">
            Signed in as{' '}
            <span className="font-semibold text-franky-sky">{session?.identity?.username ?? session?.identity?.pubkey}</span>
          </p>
          <button
            className="rounded-franky bg-franky-blush px-4 py-2 text-sm font-semibold text-franky-ink shadow-card transition hover:brightness-110"
            onClick={() => void onLogout()}
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-franky-sand/80">Start a Pubky Ring session to publish and follow friends.</p>
          <button
            className="rounded-franky bg-franky-sky px-4 py-2 text-sm font-semibold text-franky-ink shadow-card transition hover:brightness-110"
            onClick={() => void onLogin()}
          >
            Start QR Sign-in
          </button>
        </>
      )}
    </div>
  );
};

const TagEditor = ({
  tags,
  onChange,
  suggestions,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
  suggestions: string[];
}) => {
  const [input, setInput] = useState('');

  const addTag = useCallback(
    (raw: string) => {
      const slug = slugifyTag(raw);
      if (!slug || tags.includes(slug)) return;
      onChange([...tags, slug]);
    },
    [onChange, tags],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', 'Tab', ','].includes(event.key)) {
      event.preventDefault();
      if (input) {
        addTag(input);
        setInput('');
      }
    } else if (event.key === 'Backspace' && !input && tags.length) {
      onChange(tags.slice(0, -1));
    }
  };

  const handleBlur = () => {
    if (input) {
      addTag(input);
      setInput('');
    }
  };

  const removeTag = (tag: string) => onChange(tags.filter((item) => item !== tag));

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs uppercase tracking-wide text-franky-sand/70">Tags</label>
      <div className="flex flex-wrap items-center gap-2 rounded-franky border border-franky-sky/30 bg-franky-night/70 p-2 text-sm text-franky-sand shadow-inner">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-franky-sky/20 px-2 py-1 text-xs font-semibold text-franky-sky"
          >
            #{tag}
            <button
              type="button"
              className="text-[10px] text-franky-sand/80 hover:text-franky-blush"
              onClick={() => removeTag(tag)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={tags.length ? 'Add another tag' : 'Add a tag'}
          className="flex-1 min-w-[80px] bg-transparent text-sm text-franky-sand placeholder:text-franky-sand/40 focus:outline-none"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-franky-sand/60">
          <span className="uppercase tracking-wide">Recent:</span>
          {suggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="rounded-full border border-franky-sky/40 px-2 py-0.5 text-xs text-franky-sky transition hover:bg-franky-sky/20"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const CommentField = ({ value, onChange }: { value: string; onChange: (next: string) => void }) => (
  <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-franky-sand/70">
    Caption
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Add an optional note for this URL"
      rows={3}
      className="rounded-franky border border-franky-sky/30 bg-franky-night/70 p-3 text-sm text-franky-sand placeholder:text-franky-sand/40 focus:border-franky-sky focus:outline-none"
    />
  </label>
);

const BookmarkList = ({ bookmarks, onRemove }: { bookmarks: BookmarkEntry[]; onRemove: (id: string) => void }) => (
  <section className="rounded-franky bg-franky-night/60 p-4 shadow-card">
    <header className="flex items-center justify-between">
      <h2 className="text-sm font-semibold text-franky-sand">Local bookmarks</h2>
      <span className="text-[11px] uppercase text-franky-sand/50">syncs via Chrome</span>
    </header>
    {bookmarks.length === 0 ? (
      <p className="mt-3 text-xs text-franky-sand/60">No bookmarks yet. Save one from the current page to start building your list.</p>
    ) : (
      <ul className="mt-3 flex flex-col gap-3">
        {bookmarks.map((bookmark) => (
          <li key={bookmark.id} className="rounded-franky border border-franky-sky/20 bg-franky-ink/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <a
                  href={bookmark.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-franky-sky hover:underline"
                >
                  {bookmark.title || bookmark.url}
                </a>
                {bookmark.note && <p className="mt-1 text-xs text-franky-sand/70">{bookmark.note}</p>}
              </div>
              <button
                className="rounded-full border border-franky-blush/50 px-2 py-1 text-[11px] uppercase text-franky-blush transition hover:bg-franky-blush/20"
                onClick={() => onRemove(bookmark.id)}
              >
                Remove
              </button>
            </div>
            {bookmark.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-franky-sand/60">
                {bookmark.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-franky-sky/10 px-2 py-0.5 text-franky-sky">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 text-[10px] uppercase text-franky-sand/40">
              saved {new Date(bookmark.savedAt).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    )}
  </section>
);

const CurrentPageCard = ({ metadata }: { metadata: PageMetadata | null }) => {
  if (!metadata) return null;
  const url = new URL(metadata.url);
  return (
    <div className="rounded-franky bg-franky-night/70 p-4 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {metadata.icon && (
            <img src={metadata.icon} alt="favicon" className="h-8 w-8 rounded-lg border border-franky-sky/20 bg-franky-ink/80" />
          )}
          <div>
            <h2 className="text-sm font-semibold text-franky-sand">{metadata.siteName ?? url.hostname}</h2>
            <p className="text-xs text-franky-sand/70">{url.hostname}</p>
          </div>
        </div>
        <span className="rounded-full bg-franky-sky/20 px-2 py-1 text-[10px] uppercase text-franky-sky">
          captured {new Date(metadata.collectedAt).toLocaleTimeString()}
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-franky-sand">{metadata.title}</p>
      {metadata.description && <p className="mt-2 text-xs text-franky-sand/70">{metadata.description}</p>}
      <a
        href={metadata.url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center text-xs font-semibold text-franky-sky hover:underline"
      >
        Visit page
      </a>
    </div>
  );
};

export const App = () => {
  const [authState, setAuthState] = useRuntimeAuth();
  const metadata = usePageMetadata();
  const [pendingQr, setPendingQr] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagHistory, setTagHistory] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);

  useEffect(() => {
    sendMessage({ type: 'graphiti/get-tag-history' })
      .then((response) => {
        if (response.type === 'graphiti/tag-history') {
          setTagHistory(normalizeTags(response.tags));
        }
      })
      .catch(() => undefined);
    sendMessage({ type: 'graphiti/get-bookmarks' })
      .then((response) => {
        if (response.type === 'graphiti/bookmarks') {
          setBookmarks(response.bookmarks);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const handler = (event: RuntimeEvent) => {
      if (event.type === 'graphiti/bookmarks-updated') {
        setBookmarks(event.bookmarks);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  useEffect(() => {
    setTags([]);
    setComment('');
    setStatusMessage(null);
    setErrorMessage(null);
  }, [metadata?.url]);

  const handleLogin = useCallback(async () => {
    setAuthState((prev) => ({ ...prev, loading: true, error: undefined }));
    const response = await sendMessage({ type: 'pubky/login' });
    if (response.type === 'pubky/session-created') {
      setPendingQr(response.session.qr);
      setAuthState((prev) => ({ ...prev, session: response.session, loading: false }));
    } else if (response.type === 'error') {
      setAuthState((prev) => ({ ...prev, error: response.error, loading: false }));
    }
  }, [setAuthState]);

  const handleLogout = useCallback(async () => {
    setPendingQr(null);
    setAuthState((prev) => ({ ...prev, loading: true }));
    const response = await sendMessage({ type: 'pubky/logout' });
    if (response.type === 'pubky/session-cleared') {
      setAuthState({ loading: false });
    } else if (response.type === 'error') {
      setAuthState((prev) => ({ ...prev, error: response.error, loading: false }));
    }
  }, [setAuthState]);

  const setHomeserver = useCallback(
    async (value: string) => {
      const response = await sendMessage({ type: 'pubky/set-homeserver', homeserver: value });
      if (response.type === 'pubky/homeserver') {
        setAuthState((prev) => ({ ...prev, homeserver: response.homeserver }));
      }
    },
    [setAuthState],
  );

  const session = authState.session;
  const qrCode = useMemo(() => {
    if (session?.status === 'authenticated') return null;
    return session?.qr ?? pendingQr;
  }, [session, pendingQr]);

  const suggestions = useMemo(
    () => tagHistory.filter((tag) => !tags.includes(tag)).slice(0, 8),
    [tagHistory, tags],
  );

  const handlePublish = useCallback(async () => {
    if (!metadata) return;
    if (!tags.length) {
      setErrorMessage('Add at least one tag before publishing.');
      return;
    }
    setPublishing(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const metadataPayload = Object.fromEntries(
        Object.entries({
          description: metadata.description,
          siteName: metadata.siteName,
          image: metadata.image,
          icon: metadata.icon,
          lang: metadata.lang,
        }).filter(([, value]) => Boolean(value)),
      );
      const response = await sendMessage({
        type: 'graphiti/publish-link',
        payload: {
          url: metadata.url,
          tags,
          title: metadata.title,
          comment: comment.trim() || undefined,
          metadata: metadataPayload,
        },
      });
      if (response.type === 'graphiti/link-published') {
        setStatusMessage('Link published to your Pubky feed.');
        const tagsResp = await sendMessage({ type: 'graphiti/get-tag-history' });
        if (tagsResp.type === 'graphiti/tag-history') {
          setTagHistory(normalizeTags(tagsResp.tags));
        }
      } else if (response.type === 'error') {
        throw new Error(response.error);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPublishing(false);
    }
  }, [metadata, tags, comment]);

  const handleBookmark = useCallback(async () => {
    if (!metadata) return;
    setBookmarking(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const response = await sendMessage({
        type: 'graphiti/save-bookmark',
        payload: {
          url: metadata.url,
          title: metadata.title,
          tags,
          note: comment.trim() || undefined,
        },
      });
      if (response.type === 'graphiti/bookmark-saved') {
        setStatusMessage('Bookmark saved locally.');
        const tagsResp = await sendMessage({ type: 'graphiti/get-tag-history' });
        if (tagsResp.type === 'graphiti/tag-history') {
          setTagHistory(normalizeTags(tagsResp.tags));
        }
      } else if (response.type === 'error') {
        throw new Error(response.error);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBookmarking(false);
    }
  }, [metadata, tags, comment]);

  const handleRemoveBookmark = useCallback(async (id: string) => {
    await sendMessage({ type: 'graphiti/delete-bookmark', id }).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    });
  }, []);

  const canPublish = session?.status === 'authenticated' && Boolean(metadata) && tags.length > 0 && !publishing;

  return (
    <div className="flex min-h-[540px] flex-col gap-4 bg-gradient-to-b from-franky-ink to-franky-night p-4 text-franky-sand">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-franky-sand">Graphiti</h1>
          <p className="text-xs text-franky-sand/60">Tag, publish, and bookmark the current page.</p>
        </div>
        {authState.loading && <span className="animate-pulse text-xs text-franky-sky">loading…</span>}
      </header>

      <HomeserverField homeserver={authState.homeserver} onChange={setHomeserver} />

      <LoginControls session={session} onLogin={handleLogin} onLogout={handleLogout} />

      {qrCode && <QRDisplay qr={qrCode} />}

      <CurrentPageCard metadata={metadata} />

      <TagEditor tags={tags} onChange={setTags} suggestions={suggestions} />

      <CommentField value={comment} onChange={setComment} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-franky bg-franky-sky px-4 py-2 text-sm font-semibold text-franky-ink shadow-card transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-franky-sky/40 disabled:text-franky-ink/50"
          disabled={!canPublish}
          onClick={() => void handlePublish()}
        >
          {publishing ? 'Publishing…' : 'Publish to Pubky'}
        </button>
        <button
          className="rounded-franky border border-franky-sky/40 px-4 py-2 text-sm font-semibold text-franky-sky shadow-card transition hover:bg-franky-sky/10 disabled:cursor-not-allowed disabled:border-franky-sky/20 disabled:text-franky-sky/40"
          disabled={!metadata || bookmarking}
          onClick={() => void handleBookmark()}
        >
          {bookmarking ? 'Saving…' : 'Save bookmark'}
        </button>
      </div>

      {(statusMessage || errorMessage || authState.error) && (
        <div className="rounded-franky border border-franky-sky/20 bg-franky-night/60 p-3 text-xs">
          {statusMessage && <p className="text-franky-sky">{statusMessage}</p>}
          {(errorMessage || authState.error) && (
            <p className="text-franky-blush">{errorMessage ?? authState.error}</p>
          )}
        </div>
      )}

      <BookmarkList bookmarks={bookmarks} onRemove={handleRemoveBookmark} />
    </div>
  );
};

export default App;
