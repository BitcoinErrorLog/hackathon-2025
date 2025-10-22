export interface LinkRecordPayload {
  url: string;
  tags: string[];
  title?: string;
  comment?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface FeedItem {
  id: string;
  url: string;
  tags: string[];
  comment?: string;
  title?: string;
  createdAt: string;
  author: {
    pubkey: string;
    username?: string;
    homeserver?: string;
    displayName?: string;
    avatarUrl?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface BookmarkEntry {
  id: string;
  url: string;
  title?: string;
  tags: string[];
  note?: string;
  savedAt: string;
}

export interface PendingPublication {
  id: string;
  payload: LinkRecordPayload;
  createdAt: string;
  lastAttemptAt?: string;
  attempts: number;
  error?: string;
}

export interface GraphitiStatusSnapshot {
  online: boolean;
  lastHomeserverError?: string;
  lastSuccessfulPublishAt?: string;
  pendingPublications: PendingPublication[];
}
