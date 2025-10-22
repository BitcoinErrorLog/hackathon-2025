# Graphiti - Pubky URL Tagger

A Chrome Manifest V3 extension that lets you publish deterministic link posts with tags to your Pubky homeserver, browse what your follows have shared about the current page, and keep quick local bookmarks.

## Features

### 🔐 QR-only Pubky Ring Authentication
- Initiate the Ring flow from the Sign-in button
- Scan the QR code on mobile to sign in
- Create a session with your homeserver

### 📱 Sidebar Feed
- Display a chronological sidebar feed
- See all Pubky App posts containing the current URL
- From users you follow

### ⭐ Bookmarks
- Bookmark the current URL
- Uses Pubky App schema
- Stored on your homeserver

### 🏷️ Tagging Support
- Pubky App specs-compatible tagging
- Tag any URL with custom labels
- Discoverable by your network

### 🔧 Debug Features
- Comprehensive error logging
- Export logs for troubleshooting
- Real-time log viewer in popup

## Installation

### Prerequisites
- Node.js 18+ and npm
- Chrome/Chromium browser
- Pubky Ring mobile app (for authentication)

### Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Build the extension:**
```bash
npm run build
```

3. **Load in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder from this project

### Development

To build and watch for changes:
```bash
npm run dev
```

Then reload the extension in Chrome after changes.

## Usage

### First Time Setup

1. **Click the extension icon** in your Chrome toolbar
2. **Click "Sign In with Pubky Ring"**
3. **Scan the QR code** with your Pubky Ring mobile app
4. **Approve the authentication** on your mobile device
5. **Wait for the session** to be established

### Bookmarking

1. Navigate to any webpage
2. Click the extension icon
3. Click "Bookmark This Page"
4. The bookmark will be saved to your homeserver

### Tagging

1. Navigate to any webpage
2. Click the extension icon
3. Enter tags in the input field (comma or space separated)
4. Click "Add Tags"
5. Tags will be published to your homeserver

### Viewing Feed

1. Navigate to any webpage
2. Click the extension icon
3. Click "View Feed for This URL"
4. The side panel will open showing posts from your network about this page

### Debugging

1. Click the "🔧 Debug" button in the popup header
2. View real-time logs of all extension activity
3. Filter logs by level (DEBUG, INFO, WARN, ERROR)
4. Export logs to JSON for troubleshooting
5. Clear logs when needed

## Architecture

### File Structure
```
pubky-extension-test/
├── manifest.json           # Chrome extension manifest
├── package.json           # Node dependencies
├── vite.config.ts         # Vite build configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── src/
│   ├── background/        # Background service worker
│   │   └── background.ts
│   ├── popup/            # Extension popup
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── components/
│   │       ├── AuthView.tsx      # QR code authentication
│   │       ├── MainView.tsx      # Main popup interface
│   │       └── DebugPanel.tsx    # Debug log viewer
│   ├── sidepanel/        # Side panel feed
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── components/
│   │       ├── PostCard.tsx      # Post display component
│   │       └── EmptyState.tsx    # Empty state UI
│   ├── utils/            # Utility modules
│   │   ├── auth.ts       # Authentication logic
│   │   ├── crypto.ts     # Cryptographic utilities
│   │   ├── logger.ts     # Debug logging system
│   │   ├── storage.ts    # Chrome storage wrapper
│   │   └── pubky-api.ts  # Pubky API client
│   └── styles/
│       └── globals.css   # Global styles with Tailwind
├── icons/                # Extension icons
└── dist/                 # Build output (generated)
```

### Key Technologies
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **Chrome Extension APIs** - Browser integration
- **Pubky Protocol** - Decentralized authentication and storage

## Pubky Integration

### Authentication Flow
1. Generate client secret (32 random bytes)
2. Calculate channel ID by hashing the secret
3. Create `pubkyauth://` URL with relay and capabilities
4. Display QR code for scanning
5. Poll HTTP relay for encrypted auth token
6. Decrypt token with client secret
7. Parse token to extract pubky and capabilities
8. Create session with homeserver

### Data Models

#### Bookmark
```typescript
{
  uri: string,        // URL being bookmarked
  created_at: number  // Unix timestamp
}
```

#### Tag
```typescript
{
  uri: string,        // URL being tagged
  label: string,      // Tag label (lowercase, max 20 chars)
  created_at: number  // Unix timestamp
}
```

#### Post (Link)
```typescript
{
  content: string,           // Post content
  kind: 'link',             // Post type
  parent: null,             // For replies
  embed: null,              // For reposts
  attachments: [string]     // URLs
}
```

## Troubleshooting

### Extension Not Loading
- Make sure you ran `npm run build`
- Check that you selected the `dist` folder in Chrome
- Look for errors in `chrome://extensions/` page

### Authentication Not Working
- Ensure you have the Pubky Ring mobile app installed
- Check network connectivity
- Open debug panel to see detailed logs
- Try generating a new QR code

### Posts Not Showing in Feed
- Verify you're signed in
- Check that you're following users who have posted about the URL
- Note: Demo implementation may not connect to real Nexus API

### Debug Logs
All extension activity is logged. To view:
1. Open the extension popup
2. Click "🔧 Debug" button
3. Filter and export logs as needed

Common log contexts:
- `Auth` - Authentication flow
- `Storage` - Data persistence
- `PubkyAPI` - API interactions
- `Crypto` - Cryptographic operations
- `App` - UI component lifecycle

## Development Notes

### Build Process
- Vite compiles TypeScript and React
- Tailwind processes CSS
- Output goes to `dist/` folder
- Manifest and icons are copied automatically

### Testing Changes
1. Make code changes
2. Run `npm run dev` (auto-rebuilds on changes)
3. Go to `chrome://extensions/`
4. Click reload icon on the extension
5. Test your changes

### Adding Features
- New UI components: `src/popup/components/` or `src/sidepanel/components/`
- New utilities: `src/utils/`
- API changes: `src/utils/pubky-api.ts`
- Authentication changes: `src/utils/auth.ts`

## Known Limitations

1. **Demo Homeserver**: Currently uses placeholder homeserver URLs
2. **Nexus API**: Not fully integrated with production Nexus API
3. **DHT Lookup**: Homeserver resolution uses placeholder logic
4. **Session Management**: Sessions don't persist across browser restarts (by design for security)

## Future Enhancements

- [ ] Real Nexus API integration
- [ ] DHT-based homeserver resolution
- [ ] Post creation with link posts
- [ ] Rich post preview
- [ ] Notification system
- [ ] Export/import bookmarks and tags
- [ ] Search and filter capabilities
- [ ] Multiple account support

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Support

For issues or questions:
1. Check the debug logs first
2. Export logs and include them in bug reports
3. Open an issue with detailed reproduction steps

