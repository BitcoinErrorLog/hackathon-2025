import { useState, useEffect } from 'react';
import { authManagerSDK } from '../utils/auth-sdk';
import { storage, Session, StoredBookmark } from '../utils/storage';
import { pubkyAPISDK } from '../utils/pubky-api-sdk';
import { logger } from '../utils/logger';
import AuthView from './components/AuthView';
import MainView from './components/MainView';
import DebugPanel from './components/DebugPanel';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [currentTitle, setCurrentTitle] = useState<string>('');
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      logger.info('App', 'Initializing popup');

      // Check authentication
      const existingSession = await authManagerSDK.getSession();
      setSession(existingSession);

      // Get current tab info
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        setCurrentUrl(tab.url);
        setCurrentTitle(tab.title || '');
        logger.debug('App', 'Current tab info', { url: tab.url, title: tab.title });
      }

      setLoading(false);
    } catch (error) {
      logger.error('App', 'Failed to initialize', error as Error);
      setLoading(false);
    }
  };

  const handleAuthSuccess = (newSession: Session) => {
    setSession(newSession);
    logger.info('App', 'Authentication successful');
  };

  const handleSignOut = async () => {
    try {
      await authManagerSDK.signOut();
      setSession(null);
      logger.info('App', 'Signed out successfully');
    } catch (error) {
      logger.error('App', 'Failed to sign out', error as Error);
    }
  };

  const handleBookmark = async () => {
    try {
      if (!session) return;

      logger.info('App', 'Handling bookmark', { url: currentUrl });

      // Check if already bookmarked
      const existingBookmark = await storage.getBookmark(currentUrl);
      if (existingBookmark) {
        // Delete bookmark from homeserver first using the post URI
        if (existingBookmark.postUri) {
          await pubkyAPISDK.deleteBookmark(existingBookmark.postUri);
        }
        
        // Then remove from local storage
        await storage.removeBookmark(currentUrl);
        logger.info('App', 'Bookmark removed from homeserver and local storage');
        alert('Bookmark removed!');
      } else {
        // Create bookmark on homeserver using SDK
        // This creates a post first, then bookmarks it
        const { fullPath, bookmarkId, postUri } = await pubkyAPISDK.createBookmark(currentUrl);

        // Save locally with bookmark ID and post URI
        const bookmark: StoredBookmark = {
          url: currentUrl,
          title: currentTitle,
          timestamp: Date.now(),
          pubkyUrl: fullPath,
          bookmarkId,
          postUri,
        };
        await storage.saveBookmark(bookmark);

        logger.info('App', 'Bookmark created successfully', { fullPath, bookmarkId, postUri });
        alert('Bookmarked!');
      }
    } catch (error) {
      logger.error('App', 'Failed to handle bookmark', error as Error);
      alert('Failed to bookmark. Check debug logs for details.');
    }
  };

  const handleTag = async (tags: string[]) => {
    try {
      if (!session) return;

      logger.info('App', 'Creating link post with tags', { url: currentUrl, tags });

      // Create a link post with the URL and tags
      // This creates a proper Pubky App post with kind='link'
      const postUrl = await pubkyAPISDK.createLinkPost(currentUrl, currentUrl, tags);

      // Save locally
      await storage.saveTags(currentUrl, tags);

      logger.info('App', 'Link post created successfully with tags', { postUrl, tags });
      alert(`Posted and tagged with: ${tags.join(', ')}`);
    } catch (error) {
      logger.error('App', 'Failed to create post with tags', error as Error);
      alert('Failed to create post. Check debug logs for details.');
    }
  };

  const handleOpenSidePanel = () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    logger.info('App', 'Opening side panel');
  };

  if (loading) {
    return (
      <div className="w-[400px] h-[500px] flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[400px] min-h-[500px] bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Graphiti</h1>
            <p className="text-xs text-blue-100">Pubky URL Tagger</p>
          </div>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="px-3 py-1 text-xs bg-white/20 hover:bg-white/30 rounded transition"
            title="Toggle debug panel"
          >
            {showDebug ? '🔧 Hide Debug' : '🔧 Debug'}
          </button>
        </div>
      </header>

      {/* Debug Panel */}
      {showDebug && <DebugPanel />}

      {/* Main Content */}
      <div className="p-4">
        {!session ? (
          <AuthView onAuthSuccess={handleAuthSuccess} />
        ) : (
          <MainView
            session={session}
            currentUrl={currentUrl}
            currentTitle={currentTitle}
            onSignOut={handleSignOut}
            onBookmark={handleBookmark}
            onTag={handleTag}
            onOpenSidePanel={handleOpenSidePanel}
          />
        )}
      </div>
    </div>
  );
}

export default App;

