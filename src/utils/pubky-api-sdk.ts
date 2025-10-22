import { logger } from './logger';
import { storage } from './storage';
import { nexusClient, NexusPost } from './nexus-client';
import { PubkySpecsBuilder, PubkyAppPostKind } from 'pubky-app-specs';

/**
 * Pubky API using official SDK for homeserver operations
 */

class PubkyAPISDK {
  private static instance: PubkyAPISDK;
  private pubky: any = null;

  private constructor() {
    this.initializePubky();
  }

  static getInstance(): PubkyAPISDK {
    if (!PubkyAPISDK.instance) {
      PubkyAPISDK.instance = new PubkyAPISDK();
    }
    return PubkyAPISDK.instance;
  }

  /**
   * Initialize Pubky client
   */
  private async initializePubky() {
    try {
      const { Client } = await import('@synonymdev/pubky');
      this.pubky = new Client();
      logger.info('PubkyAPISDK', 'Pubky Client initialized');
    } catch (error) {
      logger.error('PubkyAPISDK', 'Failed to initialize Pubky Client', error as Error);
    }
  }

  /**
   * Ensure Pubky is initialized
   */
  private async ensurePubky(): Promise<any> {
    if (!this.pubky) {
      await this.initializePubky();
    }
    return this.pubky;
  }

  /**
   * Get authenticated session for storage operations
   */
  private async getAuthenticatedSession(): Promise<any> {
    const session = await storage.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }
    return session;
  }

  /**
   * Create a bookmark on the homeserver using SDK
   */
  async createBookmark(url: string): Promise<{ fullPath: string; bookmarkId: string }> {
    try {
      const session = await this.getAuthenticatedSession();
      logger.info('PubkyAPISDK', 'Creating bookmark', { url });

      // Use official pubky-app-specs builder
      const builder = new PubkySpecsBuilder(session.pubky);
      const result = builder.createBookmark(url);
      
      const bookmark = result.bookmark.toJson();
      const fullPath = result.meta.url;
      const bookmarkId = result.meta.id;
      
      // Write to homeserver using SDK
      await this.ensurePubky();
      
      try {
        await this.pubky.fetch(fullPath, {
          method: 'PUT',
          body: JSON.stringify(bookmark),
        });
        
        logger.info('PubkyAPISDK', 'Bookmark written to homeserver', { 
          path: fullPath,
          id: bookmarkId,
          data: bookmark 
        });
      } catch (writeError) {
        logger.warn('PubkyAPISDK', 'Failed to write to homeserver, saving locally only', writeError as Error);
      }
      
      return { fullPath, bookmarkId };
    } catch (error) {
      logger.error('PubkyAPISDK', 'Failed to create bookmark', error as Error);
      throw error;
    }
  }

  /**
   * Delete a bookmark from the homeserver using SDK
   */
  async deleteBookmark(url: string): Promise<void> {
    try {
      const session = await this.getAuthenticatedSession();
      logger.info('PubkyAPISDK', 'Deleting bookmark', { url });

      // Use official pubky-app-specs builder to regenerate the same ID
      const builder = new PubkySpecsBuilder(session.pubky);
      const result = builder.createBookmark(url);
      
      const fullPath = result.meta.url;
      
      // Delete from homeserver using SDK
      await this.ensurePubky();
      
      try {
        await this.pubky.fetch(fullPath, {
          method: 'DELETE',
        });
        
        logger.info('PubkyAPISDK', 'Bookmark deleted from homeserver', { 
          path: fullPath,
          id: result.meta.id
        });
      } catch (deleteError) {
        logger.warn('PubkyAPISDK', 'Failed to delete from homeserver', deleteError as Error);
      }
    } catch (error) {
      logger.error('PubkyAPISDK', 'Failed to delete bookmark', error as Error);
      throw error;
    }
  }

  /**
   * Create tags on the homeserver using SDK
   */
  async createTags(url: string, labels: string[]): Promise<string[]> {
    try {
      const session = await this.getAuthenticatedSession();
      logger.info('PubkyAPISDK', 'Creating tags', { url, labels });

      await this.ensurePubky();
      const builder = new PubkySpecsBuilder(session.pubky);
      const tagUrls: string[] = [];

      for (const label of labels) {
        // Use official pubky-app-specs builder (it handles normalization)
        const result = builder.createTag(url, label);
        
        const tag = result.tag.toJson();
        const fullPath = result.meta.url;

        // Write to homeserver using SDK
        try {
          await this.pubky.fetch(fullPath, {
            method: 'PUT',
            body: JSON.stringify(tag),
          });
          
          logger.info('PubkyAPISDK', 'Tag written to homeserver', {
            path: fullPath,
            id: result.meta.id,
            data: tag
          });
        } catch (writeError) {
          logger.warn('PubkyAPISDK', `Failed to write tag '${label}' to homeserver: ${(writeError as Error).message}`);
        }

        tagUrls.push(fullPath);
        logger.debug('PubkyAPISDK', 'Tag created', { tagUrl: fullPath, label });
      }

      logger.info('PubkyAPISDK', 'All tags created successfully');
      return tagUrls;
    } catch (error) {
      logger.error('PubkyAPISDK', 'Failed to create tags', error as Error);
      throw error;
    }
  }

  /**
   * Create a link post with tags
   */
  async createLinkPost(url: string, content: string, tags: string[]): Promise<string> {
    try {
      const session = await this.getAuthenticatedSession();
      logger.info('PubkyAPISDK', 'Creating link post', { url, tags });

      await this.ensurePubky();

      // Use official pubky-app-specs builder
      const builder = new PubkySpecsBuilder(session.pubky);
      const result = builder.createPost(
        content || url,
        PubkyAppPostKind.Link,  // Use the enum for link posts
        null,  // parent
        null,  // embed
        []     // attachments (empty for link posts)
      );

      const post = result.post.toJson();
      const fullPath = result.meta.url;

      // Write post to homeserver
      try {
        await this.pubky.fetch(fullPath, {
          method: 'PUT',
          body: JSON.stringify(post),
        });
        
        logger.info('PubkyAPISDK', 'Post written to homeserver', { 
          path: fullPath,
          id: result.meta.id,
          data: post 
        });
      } catch (writeError) {
        logger.warn('PubkyAPISDK', `Failed to write post to homeserver: ${(writeError as Error).message}`);
      }

      // Also create tags for the post
      if (tags.length > 0) {
        await this.createTags(fullPath, tags);
      }

      logger.info('PubkyAPISDK', 'Link post created', { postUrl: fullPath });
      return fullPath;
    } catch (error) {
      logger.error('PubkyAPISDK', 'Failed to create link post', error as Error);
      throw error;
    }
  }

  /**
   * Read public data from a user's homeserver
   */
  async readPublicData(pubky: string, path: string): Promise<any> {
    try {
      await this.ensurePubky();
      
      const fullPath = `pubky://${pubky}${path}`;
      logger.debug('PubkyAPISDK', 'Reading public data', { fullPath });

      // Use the client's fetch method to get data
      const response = await this.pubky.fetch(fullPath);
      const data = await response.json();
      
      logger.info('PubkyAPISDK', 'Public data read successfully', { path });
      return data;
    } catch (error) {
      logger.error('PubkyAPISDK', 'Failed to read public data', error as Error, { pubky, path });
      throw error;
    }
  }

  /**
   * List files in a directory on a user's homeserver
   */
  async listPublicDirectory(pubky: string, path: string, limit: number = 10): Promise<string[]> {
    try {
      await this.ensurePubky();
      
      const fullPath = `pubky://${pubky}${path}`;
      logger.debug('PubkyAPISDK', 'Listing directory', { fullPath });

      // Use the client's list method
      const entries = await this.pubky.list(fullPath, null, false, limit, false);

      const paths = entries.map((entry: any) => entry);
      
      logger.info('PubkyAPISDK', 'Directory listed successfully', { path, count: paths.length });
      return paths;
    } catch (error) {
      logger.error('PubkyAPISDK', 'Failed to list directory', error as Error, { pubky, path });
      throw error;
    }
  }

  /**
   * Search for posts containing a specific URL using Nexus API
   */
  async searchPostsByUrl(url: string, viewerId?: string): Promise<NexusPost[]> {
    try {
      logger.info('PubkyAPISDK', 'Searching posts by URL via Nexus', { url });
      const posts = await nexusClient.searchPostsByUrl(url, viewerId);
      logger.info('PubkyAPISDK', 'Found posts', { count: posts.length });
      return posts;
    } catch (error) {
      logger.error('PubkyAPISDK', 'Failed to search posts', error as Error);
      return [];
    }
  }

  /**
   * Get posts from users the current user follows using Nexus API
   */
  async getFollowingPosts(viewerId: string, limit: number = 20): Promise<NexusPost[]> {
    try {
      logger.info('PubkyAPISDK', 'Fetching following posts via Nexus', { viewerId, limit });
      
      const response = await nexusClient.streamPosts({
        source: 'following',
        observer_id: viewerId,
        limit,
      });

      logger.info('PubkyAPISDK', 'Following posts fetched', { count: response.data.length });
      return response.data;
    } catch (error) {
      logger.error('PubkyAPISDK', 'Failed to fetch following posts', error as Error);
      return [];
    }
  }

}

export const pubkyAPISDK = PubkyAPISDK.getInstance();

