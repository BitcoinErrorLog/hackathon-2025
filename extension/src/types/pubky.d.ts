declare module '@synonymdev/pubky' {
  export interface PubkyIdentity {
    pubkey: string;
    username?: string;
    homeserver: string;
  }

  export interface RingSession {
    id: string;
    qr: string;
    status: 'pending' | 'authenticated' | 'expired';
    identity?: PubkyIdentity;
    payload?: unknown;
  }

  export interface RingModule {
    createSession(): Promise<RingSession>;
    restoreSession(session: unknown): Promise<RingSession | undefined>;
    clearSession(): Promise<void>;
    onSessionAuthenticated(callback: (session: RingSession) => void): () => void;
  }

  export interface PubkyClient {
    ring: RingModule;
    setHomeserver(homeserver: string): void;
  }

  export function createClient(config: { homeserver: string }): PubkyClient;
}
