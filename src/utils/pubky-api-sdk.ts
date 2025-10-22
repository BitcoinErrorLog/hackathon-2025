import { logger } from './logger';
import { storage } from './storage';
import { nexusClient, NexusPost } from './nexus-client';
import { PubkySpecsBuilder, PubkyAppPostKind } from 'pubky-app-specs';
import { generateUrlHashTag } from './crypto';

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
   * Bookmarks must point to Pubky content (posts), so we:
   * 1. Create a link post with the HTTP URL
   * 2. Bookmark that post URI (not the HTTP URL)
   */
  async createBookmark(url: string): Promise<{ fullPath: string; bookmarkId: string; postUri: string }> {
    try {
      const session = await this.getAuthenticatedSession();
      logger.info('PubkyAPISDK', 'Creating bookmark for URL', { url });

      await this.ensurePubky();
      const builder = new PubkySpecsBuilder(session.pubky);

      // Step 1: Create a link post with the HTTP URL
      logger.info('PubkyAPISDK', 'Creating link post first');
      const postResult = builder.createPost(
        url,  // content is the URL
        PubkyAppPostKind.Link,
        null,  // parent
        null,  // embed
        []     // attachments
      );

      const post = postResult.post.toJson();
      const postUri = postResult.meta.url;

      try {
        const postResponse = await this.pubky.fetch(postUri, {
          method: 'PUT',
          body: JSON.stringify(post),
          credentials: 'include',
        });

        if (!postResponse.ok) {
          throw new Error(`Failed to create post: HTTP ${postResponse.status}`);
        }

        logger.info('PubkyAPISDK', 'Link post created', { 
          postUri, 
          postId: postResult.meta.id 
        });
      } catch (postError) {
        logger.error('PubkyAPISDK', 'Failed to create link post', postError as Error);
        throw postError;
      }

      // Add URL hash tag to the post for Nexus querying
      const urlHashTag = await generateUrlHashTag(url);
      logger.info('PubkyAPISDK', 'Adding URL hash tag to bookmark post', { urlHashTag });
      
      try {
        await this.createTags(postUri, [urlHashTag]);
      } catch (tagError) {
        logger.warn('PubkyAPISDK', 'Failed to add URL hash tag to post', tagError as Error);
      }

      // Step 2: Create bookmark pointing to the POST URI (not the HTTP URL)
      logger.info('PubkyAPISDK', 'Creating bookmark for post', { postUri });
      const bookmarkResult = builder.createBookmark(postUri);  // Bookmark the POST, not the URL!
      
      const bookmark = bookmarkResult.bookmark.toJson();
      const fullPath = bookmarkResult.meta.url;
      const bookmarkId = bookmarkResult.meta.id;
      
      try {
        const response = await this.pubky.fetch(fullPath, {
          method: 'PUT',
          body: JSON.stringify(bookmark),
          credentials: 'include',
        });
        
        logger.info('PubkyAPISDK', 'Bookmark write response', { 
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          path: fullPath,
          id: bookmarkId,
          data: bookmark 
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        logger.info('PubkyAPISDK', 'Bookmark written to homeserver successfully');
      } catch (writeError) {
        logger.error('PubkyAPISDK', 'Failed to write bookmark to homeserver', writeError as Error);
        throw writeError;
      }
      
      return { fullPath, bookmarkId, postUri };
    } catch (error) {
      logger.error('PubkyAPISDK', 'Failed to create bookmark', error as Error);
      throw error;
    }
  }

  /**
   * Delete a bookmark from the homeserver using SDK
   * @param postUri - The Pubky post URI that was bookmarked (not the HTTP URL)
   */
  async deleteBookmark(postUri: string): Promise<void> {
    try {
      const session = await this.getAuthenticatedSession();
      logger.info('PubkyAPISDK', 'Deleting bookmark', { postUri });

      // Use official pubky-app-specs builder to regenerate the bookmark ID from the post URI
      const builder = new PubkySpecsBuilder(session.pubky);
      const result = builder.createBookmark(postUri);  // Use post URI, not HTTP URL
      
      const fullPath = result.meta.url;
      
      // Delete from homeserver using SDK
      await this.ensurePubky();
      
      try {
        await this.pubky.fetch(fullPath, {
          method: 'DELETE',
          credentials: 'include',
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
          credentials: 'include',
        });
        
        logger.info('PubkyAPISDK', 'Post written to homeserver', { 
          path: fullPath,
          id: result.meta.id,
          data: post 
        });
      } catch (writeError) {
        logger.warn('PubkyAPISDK', `Failed to write post to homeserver: ${(writeError as Error).message}`);
      }

      // Generate URL hash tag for Nexus querying
      const urlHashTag = await generateUrlHashTag(url);
      
      // Combine user tags with the URL hash tag
      const allTags = [...tags, urlHashTag];
      
      logger.info('PubkyAPISDK', 'Adding tags including URL hash', { 
        userTags: tags, 
        urlHashTag,
        totalTags: allTags.length 
      });

      // Create all tags for the post (including URL hash)
      if (allTags.length > 0) {
        await this.createTags(fullPath, allTags);
      }

      logger.info('PubkyAPISDK', 'Link post created with URL hash tag', { 
        postUrl: fullPath,
        urlHashTag 
      });
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
   * Uses URL hash tag to find posts from contacts about this URL
   */
  async searchPostsByUrl(url: string, viewerId?: string): Promise<NexusPost[]> {
    try {
      logger.info('PubkyAPISDK', 'Searching posts by URL via Nexus', { url });
      
      // Generate the URL hash tag to search for
      const urlHashTag = await generateUrlHashTag(url);
      logger.info('PubkyAPISDK', 'Searching by URL hash tag', { urlHashTag });
      
      // First, try getting own posts to verify tag exists
      if (viewerId) {
        logger.debug('PubkyAPISDK', 'Checking own author posts for debugging');
        const authorResponse = await nexusClient.streamPosts({
          source: 'author',
          author_id: viewerId,
          limit: 10
        });
        logger.info('PubkyAPISDK', 'Own recent posts', {
          count: authorResponse.data?.length || 0,
          posts: authorResponse.data?.map(p => ({
            id: p.id,
            content: p.content?.substring(0, 50),
            tags: p.tags
          }))
        });
      }
      
      // Try without source parameter - maybe it conflicts with tags
      logger.debug('PubkyAPISDK', 'Querying streamPosts with tags only (no source)');
      const response = await nexusClient.streamPosts({
        tags: urlHashTag,
        limit: 50
      });
      
      const posts = response.data || [];
      logger.info('PubkyAPISDK', 'Found posts with URL hash tag', { 
        count: posts.length,
        viewerId,
        source: 'all'
      });
      
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

