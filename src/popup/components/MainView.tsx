import { useState, useEffect } from 'react';
import { Session, storage } from '../../utils/storage';
import { logger } from '../../utils/logger';

interface MainViewProps {
  session: Session;
  currentUrl: string;
  currentTitle: string;
  onSignOut: () => void;
  onBookmark: () => void;
  onTag: (tags: string[]) => void;
  onOpenSidePanel: () => void;
}

function MainView({
  session,
  currentUrl,
  currentTitle,
  onSignOut,
  onBookmark,
  onTag,
  onOpenSidePanel,
}: MainViewProps) {
  const [tagInput, setTagInput] = useState('');
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    loadExistingData();
  }, [currentUrl]);

  const loadExistingData = async () => {
    try {
      // Check if bookmarked
      const bookmarked = await storage.isBookmarked(currentUrl);
      setIsBookmarked(bookmarked);

      // Load existing tags
      const tags = await storage.getTagsForUrl(currentUrl);
      setExistingTags(tags);
      
      logger.debug('MainView', 'Loaded existing data', { bookmarked, tags });
    } catch (error) {
      logger.error('MainView', 'Failed to load existing data', error as Error);
    }
  };

  const handleTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tagInput.trim()) return;

    // Parse tags (comma or space separated)
    const tags = tagInput
      .split(/[,\s]+/)
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0 && t.length <= 20);

    if (tags.length === 0) {
      alert('Please enter valid tags (max 20 characters each)');
      return;
    }

    onTag(tags);
    setTagInput('');
    
    // Update existing tags
    setExistingTags(prev => [...new Set([...prev, ...tags])]);
  };

  const handleBookmarkClick = async () => {
    await onBookmark();
    setIsBookmarked(!isBookmarked);
  };

  const truncate = (str: string, maxLen: number) => {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + '...';
  };

  // Format pubky for display
  const formatPubky = (pubky: string) => {
    if (pubky.length <= 16) return pubky;
    return `${pubky.substring(0, 8)}...${pubky.substring(pubky.length - 8)}`;
  };

  return (
    <div className="space-y-4">
      {/* User Info */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-gray-500">Signed in as</p>
            <p className="font-mono text-sm text-gray-800" title={session.pubky}>
              {formatPubky(session.pubky)}
            </p>
          </div>
          <button
            onClick={onSignOut}
            className="px-3 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded transition"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Current Page */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Current Page</h3>
        <p className="text-sm font-medium text-gray-800 mb-1">
          {truncate(currentTitle, 50)}
        </p>
        <p className="text-xs text-gray-500 break-all">
          {truncate(currentUrl, 60)}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h3>
        
        <div className="space-y-2">
          {/* Bookmark */}
          <button
            onClick={handleBookmarkClick}
            className={`w-full px-4 py-2 rounded-lg font-medium transition flex items-center justify-center ${
              isBookmarked
                ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            <span className="mr-2">{isBookmarked ? '⭐' : '☆'}</span>
            {isBookmarked ? 'Remove Bookmark' : 'Bookmark This Page'}
          </button>

          {/* View Feed */}
          <button
            onClick={onOpenSidePanel}
            className="w-full px-4 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg font-medium transition flex items-center justify-center"
          >
            <span className="mr-2">📱</span>
            View Feed for This URL
          </button>
        </div>
      </div>

      {/* Post & Tag */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Share & Tag This Page</h3>
        
        {existingTags.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-2">Existing tags:</p>
            <div className="flex flex-wrap gap-2">
              {existingTags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleTagSubmit} className="space-y-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Enter tags (comma or space separated)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={100}
          />
          <button
            type="submit"
            disabled={!tagInput.trim()}
            className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Post with Tags
          </button>
        </form>

        <p className="text-xs text-gray-500 mt-2">
          Creates a link post with tags on your homeserver. Tags help organize and discover content. Max 20 characters per tag.
        </p>
      </div>
    </div>
  );
}

export default MainView;

