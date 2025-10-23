import { useState, useEffect } from 'react';
import { authManagerSDK } from '../utils/auth-sdk';
import { Session } from '../utils/storage';
import { pubkyAPISDK } from '../utils/pubky-api-sdk';
import { NexusPost } from '../utils/nexus-client';
import { logger } from '../utils/logger';
import PostCard from './components/PostCard';
import EmptyState from './components/EmptyState';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [posts, setPosts] = useState<NexusPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  useEffect(() => {
    initializePanel();
  }, []);

  useEffect(() => {
    if (session && currentUrl) {
      loadPosts();
    }
  }, [session, currentUrl]);

  const initializePanel = async () => {
    try {
      logger.info('SidePanel', 'Initializing side panel');

      // Check authentication
      const existingSession = await authManagerSDK.getSession();
      setSession(existingSession);

      // Get current tab info
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        setCurrentUrl(tab.url);
        logger.debug('SidePanel', 'Current tab URL', { url: tab.url });
      }

      setLoading(false);
    } catch (error) {
      logger.error('SidePanel', 'Failed to initialize', error as Error);
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    try {
      setLoadingPosts(true);
      logger.info('SidePanel', 'Loading posts for URL via Nexus', { url: currentUrl });

      // Search for posts containing this URL using Nexus API
      const foundPosts = await pubkyAPISDK.searchPostsByUrl(currentUrl, session?.pubky);
      setPosts(foundPosts);

      logger.info('SidePanel', 'Posts loaded', { count: foundPosts.length });
    } catch (error) {
      logger.error('SidePanel', 'Failed to load posts', error as Error);
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleRefresh = () => {
    loadPosts();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🔐</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Not Signed In
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Please sign in using the extension popup to view posts from your network.
          </p>
          <button
            onClick={() => chrome.action.openPopup()}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition"
          >
            Open Popup to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-gray-800">Graphiti Feed</h1>
              <p className="text-xs text-gray-500">
                Posts about this page from your network
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loadingPosts}
              className="p-2 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
              title="Refresh"
            >
              <span className={loadingPosts ? 'animate-spin inline-block' : ''}>
                🔄
              </span>
            </button>
          </div>

          {/* Current URL */}
          <div className="bg-gray-50 rounded-lg p-2">
            <p className="text-xs text-gray-500 mb-1">Current page:</p>
            <p className="text-xs text-gray-700 break-all font-mono">
              {currentUrl}
            </p>
          </div>
        </div>
      </header>

      {/* Posts Feed */}
      <div className="p-4">
        {loadingPosts ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <EmptyState currentUrl={currentUrl} />
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <PostCard key={post.details?.id || post.id || Math.random().toString()} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

