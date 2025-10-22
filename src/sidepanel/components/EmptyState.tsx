interface EmptyStateProps {
  currentUrl: string;
}

function EmptyState({ }: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-6">
      <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-5xl">🔍</span>
      </div>
      
      <h2 className="text-xl font-bold text-gray-800 mb-3">
        No Posts Yet
      </h2>
      
      <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
        Nobody in your network has shared anything about this page yet.
        Be the first to tag and share it!
      </p>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left max-w-md mx-auto">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          💡 How it works
        </h3>
        <ul className="text-xs text-blue-800 space-y-2">
          <li>• When you or people you follow tag/bookmark a URL, it appears here</li>
          <li>• Posts are fetched from the Pubky network in real-time</li>
          <li>• Tag this page to share it with your network</li>
        </ul>
      </div>

      <div className="mt-6">
        <button
          onClick={() => {
            // Open the popup
            chrome.action.openPopup();
          }}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition shadow-lg"
        >
          Tag This Page
        </button>
      </div>
    </div>
  );
}

export default EmptyState;

