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

    // Listen for tab updates to refresh when URL changes
    const handleTabUpdate = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      // Only care about URL changes for the active tab
      if (changeInfo.url && tab.active) {
        logger.info('SidePanel', 'Tab URL changed, updating feed', { 
          oldUrl: currentUrl, 
          newUrl: changeInfo.url 
        });
        setCurrentUrl(changeInfo.url);
      }
    };

    // Listen for tab activation (switching between tabs)
    const handleTabActivated = async (activeInfo: chrome.tabs.TabActiveInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url && tab.url !== currentUrl) {
          logger.info('SidePanel', 'Active tab changed, updating feed', { 
            oldUrl: currentUrl, 
            newUrl: tab.url 
          });
          setCurrentUrl(tab.url);
        }
      } catch (error) {
        logger.error('SidePanel', 'Failed to get tab info', error as Error);
      }
    };

    chrome.tabs.onUpdated.addListener(handleTabUpdate);
    chrome.tabs.onActivated.addListener(handleTabActivated);

    // Cleanup listeners
    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdate);
      chrome.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, []);

  useEffect(() => {
    // Load posts if we have a URL (session is optional now since we show ALL posts)
    if (currentUrl) {
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
      logger.info('SidePanel', 'Loading posts for URL via Nexus', { 
        url: currentUrl, 
        signedIn: !!session,
        searchScope: 'ALL posts across network'
      });

      // Search for ALL posts containing this URL using Nexus API
      // Session is optional - we show all posts regardless of login status
      const foundPosts = await pubkyAPISDK.searchPostsByUrl(currentUrl, session?.pubky);
      setPosts(foundPosts || []);

      logger.info('SidePanel', 'Posts loaded', { count: foundPosts?.length || 0 });
    } catch (error) {
      logger.error('SidePanel', 'Failed to load posts', error as Error);
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleRefresh = () => {
    loadPosts();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2B2B2B]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show sign-in banner if not authenticated (but still show posts below)
  const SignInBanner = !session ? (
    <div className="bg-[#1A1A1A] border-b border-[#3F3F3F] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Not Signed In</h3>
            <p className="text-xs text-gray-400">Sign in to create posts and bookmarks</p>
          </div>
        </div>
        <button
          onClick={() => chrome.action.openPopup()}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm font-semibold rounded-lg transition flex-shrink-0"
        >
          Sign In
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-[#2B2B2B]">
      {/* Sign In Banner (if not authenticated) */}
      {SignInBanner}
      
      {/* Header */}
      <header className="bg-[#1F1F1F] border-b border-[#3F3F3F] sticky top-0 z-10">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-white">Graphiti Feed</h1>
              <p className="text-xs text-gray-400">
                All posts about this page across the network
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loadingPosts}
              className="p-2 hover:bg-[#2A2A2A] rounded-lg transition disabled:opacity-50 text-gray-400 hover:text-white"
              title="Refresh"
            >
              <svg 
                className={`w-5 h-5 ${loadingPosts ? 'animate-spin' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
            </button>
          </div>

          {/* Current URL */}
          <div className="bg-[#2A2A2A] border border-[#3F3F3F] rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Current page:</p>
            <p className="text-xs text-gray-300 break-all font-mono">
              {currentUrl}
            </p>
          </div>
        </div>
      </header>

      {/* Posts Feed */}
      <div className="p-4">
        {loadingPosts ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading posts...</p>
          </div>
        ) : !posts || posts.length === 0 ? (
          <EmptyState currentUrl={currentUrl} />
        ) : (
          <div className="space-y-3">
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

