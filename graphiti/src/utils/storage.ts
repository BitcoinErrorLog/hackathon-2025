import { logger } from './logger';

/**
 * Storage utility for managing extension state
 */

export interface Session {
  pubky: string;
  homeserver: string;
  sessionId: string;
  capabilities: string[];
  timestamp: number;
}

export interface StoredBookmark {
  url: string;
  title: string;
  timestamp: number;
  pubkyUrl?: string; // Bookmark URL on homeserver
  bookmarkId?: string; // Bookmark ID for deletion
  postUri?: string; // The post URI that the bookmark points to
}

export interface StoredTag {
  url: string;
  label: string;
  timestamp: number;
  pubkyUrl?: string;
}

// Pubky App standard profile.json structure
// This matches the official Pubky App data model
export interface ProfileData {
  name: string;
  bio?: string;
  image?: string; // Avatar URL
  status?: string; // Combined status text and emoji
  links?: Array<{
    title: string;
    url: string;
  }>;
}

export interface CachedProfile {
  data: ProfileData;
  cachedAt: number;
  ttl: number; // Time to live in milliseconds
}

export interface Drawing {
  id: string;
  url: string;
  canvasData: string; // base64 PNG
  timestamp: number;
  author: string;
  pubkyUrl?: string; // URL on homeserver
}

class Storage {
  private static instance: Storage;

  private constructor() {}

  static getInstance(): Storage {
    if (!Storage.instance) {
      Storage.instance = new Storage();
    }
    return Storage.instance;
  }

  // Session management
  async saveSession(session: Session): Promise<void> {
    try {
      await chrome.storage.local.set({ session });
      logger.info('Storage', 'Session saved', { pubky: session.pubky });
    } catch (error) {
      logger.error('Storage', 'Failed to save session', error as Error);
      throw error;
    }
  }

  async getSession(): Promise<Session | null> {
    try {
      const result = await chrome.storage.local.get('session');
      return result.session || null;
    } catch (error) {
      logger.error('Storage', 'Failed to get session', error as Error);
      return null;
    }
  }

  async clearSession(): Promise<void> {
    try {
      await chrome.storage.local.remove('session');
      logger.info('Storage', 'Session cleared');
    } catch (error) {
      logger.error('Storage', 'Failed to clear session', error as Error);
      throw error;
    }
  }

  // Bookmarks
  async saveBookmark(bookmark: StoredBookmark): Promise<void> {
    try {
      const bookmarks = await this.getBookmarks();
      bookmarks.push(bookmark);
      await chrome.storage.local.set({ bookmarks });
      logger.info('Storage', 'Bookmark saved', { url: bookmark.url });
    } catch (error) {
      logger.error('Storage', 'Failed to save bookmark', error as Error);
      throw error;
    }
  }

  async getBookmarks(): Promise<StoredBookmark[]> {
    try {
      const result = await chrome.storage.local.get('bookmarks');
      return result.bookmarks || [];
    } catch (error) {
      logger.error('Storage', 'Failed to get bookmarks', error as Error);
      return [];
    }
  }

  async isBookmarked(url: string): Promise<boolean> {
    const bookmarks = await this.getBookmarks();
    return bookmarks.some(b => b.url === url);
  }

  async getBookmark(url: string): Promise<StoredBookmark | null> {
    const bookmarks = await this.getBookmarks();
    return bookmarks.find(b => b.url === url) || null;
  }

  async removeBookmark(url: string): Promise<void> {
    try {
      const bookmarks = await this.getBookmarks();
      const filtered = bookmarks.filter(b => b.url !== url);
      await chrome.storage.local.set({ bookmarks: filtered });
      logger.info('Storage', 'Bookmark removed', { url });
    } catch (error) {
      logger.error('Storage', 'Failed to remove bookmark', error as Error);
      throw error;
    }
  }

  // Tags
  async saveTags(url: string, tags: string[]): Promise<void> {
    try {
      const allTags = await this.getAllTags();
      // Remove existing tags for this URL
      const filteredTags = allTags.filter(t => t.url !== url);
      // Add new tags
      const newTags = tags.map(label => ({
        url,
        label: label.toLowerCase().trim(),
        timestamp: Date.now(),
      }));
      await chrome.storage.local.set({ tags: [...filteredTags, ...newTags] });
      logger.info('Storage', 'Tags saved', { url, tags });
    } catch (error) {
      logger.error('Storage', 'Failed to save tags', error as Error);
      throw error;
    }
  }

  async getAllTags(): Promise<StoredTag[]> {
    try {
      const result = await chrome.storage.local.get('tags');
      return result.tags || [];
    } catch (error) {
      logger.error('Storage', 'Failed to get tags', error as Error);
      return [];
    }
  }

  async getTagsForUrl(url: string): Promise<string[]> {
    const allTags = await this.getAllTags();
    return allTags
      .filter(t => t.url === url)
      .map(t => t.label);
  }

  // Profile management
  async saveProfile(profile: ProfileData): Promise<void> {
    try {
      await chrome.storage.local.set({ profile });
      logger.info('Storage', 'Profile saved', { name: profile.name });
    } catch (error) {
      logger.error('Storage', 'Failed to save profile', error as Error);
      throw error;
    }
  }

  async getProfile(): Promise<ProfileData | null> {
    try {
      const result = await chrome.storage.local.get('profile');
      return result.profile || null;
    } catch (error) {
      logger.error('Storage', 'Failed to get profile', error as Error);
      return null;
    }
  }

  async cacheProfile(pubkey: string, profile: ProfileData, ttl: number = 3600000): Promise<void> {
    try {
      const cached: CachedProfile = {
        data: profile,
        cachedAt: Date.now(),
        ttl,
      };
      const key = `profile_cache_${pubkey}`;
      await chrome.storage.local.set({ [key]: cached });
      logger.debug('Storage', 'Profile cached', { pubkey });
    } catch (error) {
      logger.error('Storage', 'Failed to cache profile', error as Error);
    }
  }

  async getCachedProfile(pubkey: string): Promise<ProfileData | null> {
    try {
      const key = `profile_cache_${pubkey}`;
      const result = await chrome.storage.local.get(key);
      const cached: CachedProfile = result[key];
      
      if (!cached) return null;
      
      // Check if cache is still valid
      const now = Date.now();
      if (now - cached.cachedAt > cached.ttl) {
        // Cache expired, remove it
        await chrome.storage.local.remove(key);
        return null;
      }
      
      return cached.data;
    } catch (error) {
      logger.error('Storage', 'Failed to get cached profile', error as Error);
      return null;
    }
  }

  // Settings
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key] !== undefined ? result[key] : defaultValue;
    } catch (error) {
      logger.error('Storage', `Failed to get setting: ${key}`, error as Error);
      return defaultValue;
    }
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
      logger.debug('Storage', `Setting saved: ${key}`, { value });
    } catch (error) {
      logger.error('Storage', `Failed to save setting: ${key}`, error as Error);
      throw error;
    }
  }

  // Drawings
  async saveDrawing(drawing: Drawing): Promise<void> {
    try {
      const drawings = await this.getAllDrawings();
      drawings[drawing.url] = drawing;
      await chrome.storage.local.set({ pubky_drawings: drawings });
      logger.info('Storage', 'Drawing saved', { url: drawing.url });
    } catch (error) {
      logger.error('Storage', 'Failed to save drawing', error as Error);
      throw error;
    }
  }

  async getDrawing(url: string): Promise<Drawing | null> {
    try {
      const drawings = await this.getAllDrawings();
      return drawings[url] || null;
    } catch (error) {
      logger.error('Storage', 'Failed to get drawing', error as Error);
      return null;
    }
  }

  async getAllDrawings(): Promise<{ [url: string]: Drawing }> {
    try {
      const result = await chrome.storage.local.get('pubky_drawings');
      return result.pubky_drawings || {};
    } catch (error) {
      logger.error('Storage', 'Failed to get all drawings', error as Error);
      return {};
    }
  }

  async deleteDrawing(url: string): Promise<void> {
    try {
      const drawings = await this.getAllDrawings();
      delete drawings[url];
      await chrome.storage.local.set({ pubky_drawings: drawings });
      logger.info('Storage', 'Drawing deleted', { url });
    } catch (error) {
      logger.error('Storage', 'Failed to delete drawing', error as Error);
      throw error;
    }
  }
}

export const storage = Storage.getInstance();

