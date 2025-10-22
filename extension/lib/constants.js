export const DEFAULT_HOMESERVER = 'https://app.pubky.network';

export const STORAGE_KEYS = {
  homeserver: 'graphiti.homeserver',
  session: 'graphiti.session',
  tagHistory: 'graphiti.tag-history',
  bookmarks: 'graphiti.bookmarks',
  pending: 'graphiti.pending',
  status: 'graphiti.status-metadata'
};

export const PUBKY_POLL_INTERVAL_MS = 2500;
export const PUBKY_POLL_TIMEOUT_MS = 2 * 60 * 1000;
export const FEED_REFRESH_INTERVAL_MS = 60 * 1000;
export const RETRY_BASE_DELAY_MS = 1500;
export const MAX_RETRY_ATTEMPTS = 5;
