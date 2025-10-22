import type { LinkRecordPayload } from './types';

const APP_ID = 'pubky.app.link';
const COLLECTION = 'link';

let specsModule: Promise<any> | null = null;

const loadSpecs = async () => {
  if (!specsModule) {
    specsModule = import('pubky-app-specs').catch(() => null);
  }
  return specsModule;
};

const sha256 = async (input: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
};

export const slugifyTag = (tag: string) =>
  tag
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

export const normalizeTags = (tags: string[]) => {
  const unique = new Set<string>();
  tags
    .map((tag) => slugifyTag(tag))
    .filter(Boolean)
    .forEach((tag) => unique.add(tag));
  return Array.from(unique);
};

export const normalizeUrl = (url: string) => {
  try {
    const normalized = new URL(url);
    normalized.hash = '';
    if ((normalized.protocol === 'http:' || normalized.protocol === 'https:') && normalized.pathname === '/') {
      normalized.pathname = '';
    }
    return normalized.toString();
  } catch (error) {
    console.warn('Failed to normalize URL', url, error);
    return url;
  }
};

export const computeRecordId = async (url: string, tags: string[]) => {
  const normalizedTags = normalizeTags(tags);
  const normalizedUrl = normalizeUrl(url);
  const specs = await loadSpecs();

  const candidate = [
    () => specs?.link?.hash?.({ url: normalizedUrl, tags: normalizedTags }),
    () => specs?.link?.records?.link?.hash?.({ url: normalizedUrl, tags: normalizedTags }),
    () => specs?.apps?.link?.records?.link?.hash?.({ url: normalizedUrl, tags: normalizedTags }),
  ];

  for (const attempt of candidate) {
    try {
      const value = await attempt?.();
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    } catch (error) {
      console.warn('Failed to compute record id via pubky-app-specs', error);
    }
  }

  return sha256([normalizedUrl, ...normalizedTags].join('|'));
};

export const buildLinkRecord = async (payload: LinkRecordPayload) => {
  const tags = normalizeTags(payload.tags ?? []);
  const url = normalizeUrl(payload.url);
  const createdAt = payload.createdAt ?? new Date().toISOString();
  const recordId = await computeRecordId(url, tags);
  const specs = await loadSpecs();

  const baseRecord = {
    appId: APP_ID,
    collection: COLLECTION,
    recordId,
    value: {
      url,
      tags,
      title: payload.title,
      comment: payload.comment,
      createdAt,
      metadata: payload.metadata ?? {},
    },
  };

  const attemptBuilders = [
    () => specs?.link?.records?.link?.build?.({ ...baseRecord.value, recordId }),
    () => specs?.link?.buildRecord?.({ ...baseRecord.value, recordId }),
    () => specs?.apps?.link?.records?.link?.build?.({ ...baseRecord.value, recordId }),
  ];

  for (const builder of attemptBuilders) {
    try {
      const record = await builder?.();
      if (record) {
        return {
          appId: APP_ID,
          collection: COLLECTION,
          recordId,
          value: record,
        };
      }
    } catch (error) {
      console.warn('pubky-app-specs builder failed', error);
    }
  }

  return baseRecord;
};

export type GraphitiLinkRecord = Awaited<ReturnType<typeof buildLinkRecord>>;
