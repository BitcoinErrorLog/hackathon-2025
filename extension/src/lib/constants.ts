export const STORAGE_KEYS = {
  session: 'graphiti.pubky.session',
  homeserver: 'graphiti.pubky.homeserver',
  pageMetadata: 'graphiti.page-metadata',
  feedCache: 'graphiti.feed-cache',
  bookmarks: 'graphiti.bookmarks',
  tagHistory: 'graphiti.tag-history',
  pendingPublications: 'graphiti.pending-publications',
  lastKnownStatus: 'graphiti.last-known-status',
} as const;

export const DEFAULT_HOMESERVER = 'https://app.pubky.org';
