import type { BookmarkEntry, FeedItem, LinkRecordPayload } from './types';

export type BackgroundMessage =
  | { type: 'pubky/login' }
  | { type: 'pubky/logout' }
  | { type: 'pubky/get-session' }
  | { type: 'pubky/get-homeserver' }
  | { type: 'pubky/set-homeserver'; homeserver: string }
  | { type: 'graphiti/get-feed'; url: string; refresh?: boolean }
  | { type: 'graphiti/publish-link'; payload: LinkRecordPayload }
  | { type: 'graphiti/get-bookmarks' }
  | { type: 'graphiti/save-bookmark'; payload: Omit<BookmarkEntry, 'id' | 'savedAt'> & { id?: string } }
  | { type: 'graphiti/delete-bookmark'; id: string }
  | { type: 'graphiti/get-tag-history' };

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
  | { type: 'graphiti/feed'; url: string; items: FeedItem[] }
  | { type: 'graphiti/link-published'; recordId: string }
  | { type: 'graphiti/bookmarks'; bookmarks: BookmarkEntry[] }
  | { type: 'graphiti/bookmark-saved'; bookmark: BookmarkEntry }
  | { type: 'graphiti/bookmark-deleted'; id: string }
  | { type: 'graphiti/tag-history'; tags: string[] }
  | { type: 'error'; error: string };

export interface RuntimeAuthEvent {
  type: 'pubky/auth-state';
  session?: PubkySessionPayload;
}

export interface RuntimeFeedEvent {
  type: 'graphiti/feed-updated';
  url: string;
  items: FeedItem[];
}

export interface RuntimeBookmarksEvent {
  type: 'graphiti/bookmarks-updated';
  bookmarks: BookmarkEntry[];
}

export type RuntimeEvent = RuntimeAuthEvent | RuntimeFeedEvent | RuntimeBookmarksEvent;
