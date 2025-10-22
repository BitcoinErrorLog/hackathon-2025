export type BackgroundMessage =
  | { type: 'pubky/login' }
  | { type: 'pubky/logout' }
  | { type: 'pubky/get-session' }
  | { type: 'pubky/get-homeserver' }
  | { type: 'pubky/set-homeserver'; homeserver: string };

export interface PubkySessionPayload {
  id: string;
  qr: string;
  status: 'pending' | 'authenticated' | 'expired';
  identity?: {
    pubkey: string;
    username?: string;
    homeserver: string;
  };
}

export type BackgroundResponse =
  | { type: 'pubky/session-created'; session: PubkySessionPayload }
  | { type: 'pubky/session-restored'; session?: PubkySessionPayload }
  | { type: 'pubky/session-cleared' }
  | { type: 'pubky/homeserver'; homeserver: string }
  | { type: 'error'; error: string };

export interface RuntimeAuthEvent {
  type: 'pubky/auth-state';
  session?: PubkySessionPayload;
}
