import { logger } from './logger';

/**
 * Nexus API Client for querying Pubky posts and users
 * Based on official Nexus API documentation
 */

const NEXUS_API_URL = 'https://nexus.pubky.app';

export interface NexusPost {
  details: {
    id: string;
    author: string;
    content: string;
    kind: string;
    uri: string;
    indexed_at: number;
    attachments?: string[];
  };
  counts?: {
    tags?: number;
    replies?: number;
    reposts?: number;
  };
  tags?: Array<{
    label: string;
    taggers: string[];
    taggers_count: number;
    relationship: boolean;
  }>;
  relationships?: any;
  bookmark?: any;
  // Legacy flat format support (for backwards compatibility)
  id?: string;
  author_id?: string;
  content?: string;
  kind?: string;
  uri?: string;
  indexed_at?: number;
  attachments?: string[];
  embed?: {
    kind: string;
    uri: string;
  };
  author?: {
    id: string;
    name?: string;
    bio?: string;
    image?: string;
  };
}

export interface NexusUser {
  id: string;
  name?: string;
  bio?: string;
  image?: string;
  links?: Array<{
    title: string;
    url: string;
  }>;
}

export interface PostsStreamResponse {
  data: NexusPost[];
  cursor?: string;
}

export interface UsersStreamResponse {
  data: NexusUser[];
  cursor?: string;
}

class NexusClient {
  private apiUrl: string;

  constructor(apiUrl: string = NEXUS_API_URL) {
    this.apiUrl = apiUrl;
  }

  /**
   * Get a specific post
   */
  async getPost(authorId: string, postId: string, viewerId?: string): Promise<NexusPost> {
    try {
      let url = `${this.apiUrl}/v0/post/${authorId}/${postId}`;
      
      const params = new URLSearchParams();
      if (viewerId) params.append('viewer_id', viewerId);
      if (params.toString()) url += '?' + params.toString();

      logger.debug('NexusClient', 'Fetching post', { authorId, postId, url });

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      
      const data = await response.json();
      logger.info('NexusClient', 'Post fetched successfully', { postId });
      
      return data;
    } catch (error) {
      logger.error('NexusClient', 'Failed to fetch post', error as Error, { authorId, postId });
      throw error;
    }
  }

  /**
   * Stream posts with various filters
   */
  async streamPosts(options: {
    source?: 'all' | 'following' | 'followers' | 'friends' | 'bookmarks' | 'author' | 'author_replies' | 'post_replies';
    viewer_id?: string;
    observer_id?: string;
    author_id?: string;
    post_id?: string;
    sorting?: 'latest' | 'oldest';
    order?: 'asc' | 'desc';
    tags?: string;
    kind?: string;
    skip?: number;
    limit?: number;
    start?: number;
    end?: number;
  } = {}): Promise<PostsStreamResponse> {
    try {
      let url = `${this.apiUrl}/v0/stream/posts`;

      const params = new URLSearchParams();
      if (options.source) params.append('source', options.source);
      if (options.viewer_id) params.append('viewer_id', options.viewer_id);
      if (options.observer_id) params.append('observer_id', options.observer_id);
      if (options.author_id) params.append('author_id', options.author_id);
      if (options.post_id) params.append('post_id', options.post_id);
      if (options.sorting) params.append('sorting', options.sorting);
      if (options.order) params.append('order', options.order);
      if (options.tags) params.append('tags', options.tags);
      if (options.kind) params.append('kind', options.kind);
      if (options.skip !== undefined) params.append('skip', options.skip.toString());
      if (options.limit !== undefined) params.append('limit', options.limit.toString());
      if (options.start !== undefined) params.append('start', options.start.toString());
      if (options.end !== undefined) params.append('end', options.end.toString());
      
      if (params.toString()) url += '?' + params.toString();

      logger.debug('NexusClient', 'Streaming posts', { options, url });

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      
      const data = await response.json();
      
      // Handle different response formats:
      // - With tags parameter: returns array directly
      // - Without tags: returns { data: [...], cursor: ... }
      const normalizedData = Array.isArray(data) 
        ? { data, cursor: undefined } 
        : data;
      
      logger.info('NexusClient', 'Posts stream fetched', { count: normalizedData.data?.length || 0 });
      
      return normalizedData;
    } catch (error) {
      logger.error('NexusClient', 'Failed to stream posts', error as Error, { options });
      throw error;
    }
  }

  /**
   * Search posts by tag
   */
  async searchPostsByTag(tag: string, options: {
    observer_id?: string;
    sorting?: 'latest' | 'oldest';
    start?: number;
    end?: number;
    skip?: number;
    limit?: number;
  } = {}): Promise<NexusPost[]> {
    try {
      let url = `${this.apiUrl}/v0/search/posts/by_tag/${encodeURIComponent(tag)}`;

      const params = new URLSearchParams();
      if (options.observer_id) params.append('observer_id', options.observer_id);
      if (options.sorting) params.append('sorting', options.sorting);
      if (options.start !== undefined) params.append('start', options.start.toString());
      if (options.end !== undefined) params.append('end', options.end.toString());
      if (options.skip !== undefined) params.append('skip', options.skip.toString());
      if (options.limit !== undefined) params.append('limit', options.limit.toString());
      
      if (params.toString()) url += '?' + params.toString();

      logger.debug('NexusClient', 'Searching posts by tag', { tag, url });

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      
      const data = await response.json();
      logger.info('NexusClient', 'Posts search complete', { tag, count: data.data?.length || 0 });
      
      // Return just the posts array
      return data.data || [];
    } catch (error) {
      logger.error('NexusClient', 'Failed to search posts by tag', error as Error, { tag });
      throw error;
    }
  }

  /**
   * Get a user profile
   */
  async getUser(userId: string, viewerId?: string, depth?: number): Promise<NexusUser> {
    try {
      let url = `${this.apiUrl}/v0/user/${userId}`;
      
      const params = new URLSearchParams();
      if (viewerId) params.append('viewer_id', viewerId);
      if (depth !== undefined) params.append('depth', depth.toString());
      if (params.toString()) url += '?' + params.toString();

      logger.debug('NexusClient', 'Fetching user', { userId, url });

      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      
      const data = await response.json();
      logger.info('NexusClient', 'User fetched successfully', { userId });
      
      return data;
    } catch (error) {
      logger.error('NexusClient', 'Failed to fetch user', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Search posts containing a specific URL
   * This is a helper that searches by attachments
   */
  async searchPostsByUrl(url: string, observerId?: string, limit: number = 20): Promise<NexusPost[]> {
    try {
      logger.info('NexusClient', 'Searching posts by URL', { url });

      // Strategy: Search posts from multiple sources and combine results
      const allPosts: NexusPost[] = [];

      // 1. Get user's own posts (if observerId provided)
      if (observerId) {
        try {
          const ownPostsResponse = await this.streamPosts({
            source: 'author',
            author_id: observerId,
            limit: 50,
          });
          allPosts.push(...(ownPostsResponse.data || []));
        } catch (error) {
          logger.warn('NexusClient', 'Failed to fetch own posts', error as Error);
        }
      }

      // 2. Get posts from following
      try {
        const followingResponse = await this.streamPosts({
          source: observerId ? 'following' : 'all',
          observer_id: observerId,
          limit: 50,
        });
        allPosts.push(...(followingResponse.data || []));
      } catch (error) {
        logger.warn('NexusClient', 'Failed to fetch following posts', error as Error);
      }

      // Filter posts that have the URL in content
      // Remove duplicates by URI
      const uniquePosts = new Map<string, NexusPost>();
      for (const post of allPosts) {
        const content = post.details?.content || post.content || '';
        const attachments = post.details?.attachments || post.attachments || [];
        const uri = post.details?.uri || post.uri || '';
        
        if (content.includes(url) || attachments.some(attachment => attachment.includes(url))) {
          uniquePosts.set(uri, post);
        }
      }

      const filtered = Array.from(uniquePosts.values()).slice(0, limit);

      logger.info('NexusClient', 'URL search complete', { url, found: filtered.length, total: allPosts.length });
      
      return filtered;
    } catch (error) {
      logger.error('NexusClient', 'Failed to search posts by URL', error as Error, { url });
      return [];
    }
  }
}

export const nexusClient = new NexusClient();

