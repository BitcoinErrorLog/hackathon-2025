import { useEffect, useState } from 'react';
import type { BackgroundMessage, BackgroundResponse, PubkySessionPayload, RuntimeAuthEvent } from '../lib/messaging';
import { STORAGE_KEYS } from '../lib/constants';
import '../styles/index.css';

interface PageMetadata {
  url: string;
  title: string;
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

export const App = () => {
  const [session, setSession] = useState<PubkySessionPayload | undefined>();
  const [metadata, setMetadata] = useState<PageMetadata | null>(null);

  useEffect(() => {
    sendMessage({ type: 'pubky/get-session' })
      .then((response) => {
        if (response.type === 'pubky/session-restored') {
          setSession(response.session);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const handler = (event: RuntimeAuthEvent) => {
      if (event.type === 'pubky/auth-state') {
        setSession(event.session);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  useEffect(() => {
    getPageMetadata().then(setMetadata).catch(() => undefined);
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 bg-gradient-to-b from-franky-ink to-franky-night p-4 text-franky-sand">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Graphiti Feed</h1>
          <p className="text-xs text-franky-sand/70">Stage 1 foundation — feed wiring coming in Stage 2.</p>
        </div>
        {session?.status === 'authenticated' ? (
          <span className="rounded-full bg-franky-sky/20 px-3 py-1 text-[10px] uppercase text-franky-sky">signed in</span>
        ) : (
          <span className="rounded-full bg-franky-blush/20 px-3 py-1 text-[10px] uppercase text-franky-blush">offline</span>
        )}
      </header>

      <section className="rounded-franky bg-franky-night/70 p-4 shadow-card">
        <h2 className="text-sm font-semibold text-franky-sand">Current URL</h2>
        {metadata ? (
          <>
            <p className="mt-2 text-sm font-medium">{metadata.title}</p>
            <p className="mt-1 text-xs text-franky-sand/70">{metadata.url}</p>
          </>
        ) : (
          <p className="mt-2 text-xs text-franky-sand/70">Loading active tab…</p>
        )}
      </section>

      <section className="flex-1 rounded-franky border border-dashed border-franky-sky/30 bg-franky-night/40 p-4">
        <p className="text-sm text-franky-sand/70">
          Sidebar feed will appear here in Stage 2. Authentication plumbing is in place, and the extension is ready to
          subscribe to Pubky link posts for the current URL.
        </p>
      </section>
    </div>
  );
};

export default App;
