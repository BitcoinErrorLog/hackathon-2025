import { deterministicRecordId } from './hash.js';

const jsonFetch = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pubky request failed (${response.status}): ${text}`);
  }

  if (response.status === 204) return undefined;
  return response.json();
};

export const startRingSession = async (homeserver) => {
  const endpoint = new URL('/ring/v1/sessions', homeserver).toString();
  return jsonFetch(endpoint, { method: 'POST', body: JSON.stringify({}) });
};

export const pollRingSession = async (homeserver, sessionId) => {
  const endpoint = new URL(`/ring/v1/sessions/${encodeURIComponent(sessionId)}`, homeserver).toString();
  return jsonFetch(endpoint, { method: 'GET' });
};

export const cancelRingSession = async (homeserver, sessionId) => {
  const endpoint = new URL(`/ring/v1/sessions/${encodeURIComponent(sessionId)}`, homeserver).toString();
  try {
    await jsonFetch(endpoint, { method: 'DELETE' });
  } catch (error) {
    console.warn('Graphiti cancel session failed', error);
  }
};

export const fetchFollows = async (homeserver, pubkey) => {
  const endpoint = new URL(`/graph/v1/follows/${encodeURIComponent(pubkey)}`, homeserver).toString();
  return jsonFetch(endpoint, { method: 'GET' });
};

export const fetchPostsForUrl = async (homeserver, url, follows) => {
  const endpoint = new URL('/apps/link-posts', homeserver);
  endpoint.searchParams.set('url', url);
  if (Array.isArray(follows) && follows.length) {
    endpoint.searchParams.set('authors', follows.join(','));
  }
  return jsonFetch(endpoint.toString(), { method: 'GET' });
};

export const publishLinkPost = async (homeserver, sessionToken, payload) => {
  const recordId = await deterministicRecordId({ url: payload.url, tags: payload.tags });
  const endpoint = new URL('/apps/link-posts', homeserver).toString();
  const body = {
    ...payload,
    recordId,
  };
  return jsonFetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify(body),
  });
};
