# Graphiti Features Overview

## 🔐 Authentication

### Pubky Ring QR-Code Authentication
- **Click-to-Scan Flow**: Click "Sign In with Pubky Ring" to generate a unique QR code
- **Secure**: Uses cryptographic client secrets and channel-based relay
- **Real-time**: Polls for authentication token and establishes session instantly
- **Mobile-First**: Designed for Pubky Ring mobile app scanning

**Technical Details:**
- Generates 32-byte client secret
- Creates channel ID via SHA-256 hash
- Builds `pubkyauth://` URL with relay and capabilities
- Polls HTTP relay at 2-second intervals
- Decrypts and parses auth token
- Establishes session with homeserver

## ⭐ Bookmarking

### One-Click Bookmarks
- **Simple**: Click bookmark button to save current page
- **Persistent**: Stored both locally and on your homeserver
- **Visual Feedback**: Shows bookmark status with star icon
- **Toggle**: Click again to remove bookmark

**Pubky App Schema:**
```json
{
  "uri": "https://example.com",
  "created_at": 1234567890
}
```

**Storage Location:** `/pub/pubky.app/bookmarks/{bookmark_id}`
- ID is deterministic hash of URI

## 🏷️ Tagging

### Flexible Tag Management
- **Multi-Tag Support**: Add multiple tags at once
- **Input Formats**: Comma or space separated
- **Auto-Normalize**: Lowercase, trimmed, max 20 chars
- **Visual Display**: Shows existing tags for current page
- **Persistent**: Stored on homeserver with Pubky App schema

**Pubky App Schema:**
```json
{
  "uri": "https://example.com",
  "label": "webdev",
  "created_at": 1234567890
}
```

**Storage Location:** `/pub/pubky.app/tags/{tag_id}`
- ID is deterministic hash of `uri:label`

## 📱 Sidebar Feed

### Network Activity View
- **Context-Aware**: Shows posts about the current URL
- **Social**: Displays posts from users you follow
- **Real-time**: Refreshable on-demand
- **Rich Display**: Shows author info, content, attachments

**Features:**
- Empty state with helpful tips
- Post cards with author avatars
- Timestamp formatting (just now, 5m ago, etc.)
- Post type icons (link, image, video, etc.)
- Repost/embed previews
- Attachment displays

## 🔧 Debug Panel

### Comprehensive Logging System
- **Real-time Logs**: See all extension activity as it happens
- **Filterable**: By log level (DEBUG, INFO, WARN, ERROR)
- **Context-Based**: Logs organized by component
- **Exportable**: Download logs as JSON
- **Persistent**: Logs saved to Chrome storage

**Log Levels:**
- **DEBUG**: Detailed internal operations
- **INFO**: Important state changes and actions
- **WARN**: Non-critical issues
- **ERROR**: Failures with stack traces

**Log Contexts:**
- `Auth` - Authentication flow
- `Storage` - Data persistence
- `PubkyAPI` - API interactions
- `Crypto` - Cryptographic operations
- `App` - UI component lifecycle
- `SidePanel` - Feed operations
- `Background` - Service worker events

**Features:**
- Color-coded by severity
- Timestamps for each entry
- Data inspection (JSON objects)
- Error stack traces
- Export to file
- Clear all logs
- Last 50 logs displayed (1000 total buffer)

## 🎨 User Interface

### Modern Design
- **Gradient Theme**: Blue to purple gradient accents
- **Tailwind CSS**: Utility-first styling
- **Responsive**: Adapts to popup and sidepanel
- **Clear Hierarchy**: Organized sections
- **Visual Feedback**: Loading states, hover effects

### Popup (400x500px)
- **Header**: App name, debug toggle
- **User Info**: Signed-in pubky, sign out
- **Current Page**: Title and URL display
- **Quick Actions**: Bookmark, view feed buttons
- **Tagging Section**: Input, existing tags, add button

### Side Panel
- **Header**: Title, refresh button, current URL
- **Feed**: Scrollable post list
- **Post Cards**: Rich post display
- **Empty State**: Helpful when no posts found

## 🔒 Security & Privacy

### Secure by Design
- **Client-Side Encryption**: Auth tokens encrypted with client secret
- **No Server Storage**: Minimal data stored, most on your homeserver
- **Session-Based**: Sessions expire (configurable)
- **Capabilities**: Fine-grained permissions

### Data Storage
**Local (Chrome Storage):**
- Session info (pubky, sessionId, capabilities)
- Bookmarks (with homeserver URLs)
- Tags (with homeserver URLs)
- Debug logs (max 1000 entries)

**Homeserver:**
- Bookmarks (via Pubky App schema)
- Tags (via Pubky App schema)
- Posts (when implemented)

## 🛠️ Technical Architecture

### Tech Stack
- **React 18**: UI framework
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **Vite**: Build tool
- **Chrome Extension Manifest V3**: Latest Chrome APIs

### Module Structure
```
src/
├── popup/          # Main extension popup
├── sidepanel/      # Side panel feed
├── background/     # Service worker
└── utils/          # Shared utilities
    ├── auth.ts     # Authentication
    ├── crypto.ts   # Cryptography
    ├── logger.ts   # Debug logging
    ├── storage.ts  # Data persistence
    └── pubky-api.ts # API client
```

### Build Output
```
dist/
├── manifest.json           # Extension manifest
├── popup.html             # Popup entry point
├── sidepanel.html         # Side panel entry point
├── background.js          # Service worker
├── assets/                # Bundled JS/CSS
└── icons/                 # Extension icons
```

## 🚀 Performance

### Optimized
- **Code Splitting**: Separate bundles for popup and sidepanel
- **Lazy Loading**: Components loaded on demand
- **Minimal Bundle**: ~350KB total (58KB gzipped)
- **Fast Polling**: 2-second auth polling interval
- **Efficient Storage**: Indexed by URL for fast lookups

### Bundle Sizes
- `background.js`: 1.43 KB
- `popup`: ~21 KB + shared chunks
- `sidepanel`: ~12 KB + shared chunks
- `react/react-dom`: ~233 KB (shared)

## 🔮 Future Enhancements

### Planned Features
- [ ] Real Nexus API integration
- [ ] DHT-based homeserver resolution
- [ ] Link post creation (not just bookmarks)
- [ ] Post comments and interactions
- [ ] Notification system
- [ ] Search and filter
- [ ] Multiple account support
- [ ] Export/import data
- [ ] Rich media preview
- [ ] Offline support

### API Integration
Currently uses placeholder implementations for:
- Homeserver PUT operations (bookmarks, tags, posts)
- Nexus API queries (posts search, feed)
- DHT homeserver resolution

These will be replaced with actual implementations once connected to:
- Real Pubky homeservers
- Production Nexus API
- Pkarr DHT network

## 📊 Debug Information

### What Gets Logged
- All authentication steps
- Storage operations (save, get, delete)
- API calls (with parameters)
- Errors with stack traces
- User actions (clicks, inputs)
- Component lifecycle events

### How to Use Debug Logs
1. Reproduce the issue
2. Open debug panel
3. Filter to ERROR level
4. Export logs
5. Review or share for troubleshooting

### Log Retention
- 1000 logs in memory
- Persisted to Chrome storage
- Survives extension reload
- Cleared manually or on uninstall

