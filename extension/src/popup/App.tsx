import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BackgroundMessage, BackgroundResponse, PubkySessionPayload, RuntimeAuthEvent } from '../lib/messaging';
import { STORAGE_KEYS } from '../lib/constants';
import '../styles/index.css';

interface PageMetadata {
  url: string;
  title: string;
  description: string;
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
    const handler = (event: RuntimeAuthEvent) => {
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
            Signed in as <span className="font-semibold text-franky-sky">{session?.identity?.username ?? session?.identity?.pubkey}</span>
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

const CurrentPageCard = ({ metadata }: { metadata: PageMetadata | null }) => {
  if (!metadata) return null;
  return (
    <div className="rounded-franky bg-franky-night/70 p-4 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-franky-sand">Current page</h2>
          <p className="text-xs text-franky-sand/70">{new URL(metadata.url).hostname}</p>
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
    [setAuthState]
  );

  const loading = authState.loading;
  const session = authState.session;

  const qrCode = useMemo(() => {
    if (session?.status === 'authenticated') return null;
    return session?.qr ?? pendingQr;
  }, [session, pendingQr]);

  return (
    <div className="flex min-h-[360px] flex-col gap-4 bg-gradient-to-b from-franky-ink to-franky-night p-4 text-franky-sand">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-franky-sand">Graphiti</h1>
        {loading && <span className="animate-pulse text-xs text-franky-sky">loading…</span>}
      </header>

      <HomeserverField homeserver={authState.homeserver} onChange={setHomeserver} />

      <LoginControls session={session} onLogin={handleLogin} onLogout={handleLogout} />

      {qrCode && <QRDisplay qr={qrCode} />}

      <CurrentPageCard metadata={metadata} />

      {authState.error && (
        <p className="rounded-franky bg-franky-blush/20 p-3 text-xs text-franky-blush">{authState.error}</p>
      )}
    </div>
  );
};

export default App;
