# Quick Installation Guide

## Prerequisites
- Chrome or Chromium-based browser
- Node.js 18+ and npm
- Pubky Ring mobile app (for authentication)

## Installation Steps

### 1. Build the Extension

```bash
# Install dependencies
npm install

# Build the extension
npm run build
```

### 2. Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" using the toggle in the top right corner
3. Click "Load unpacked"
4. Select the `dist` folder from this project

The extension should now be loaded and visible in your browser!

### 3. (Optional) Generate Better Icons

The extension includes placeholder 1x1 icons. For better visuals:

1. Open `generate-icons.html` in your browser
2. Click "Download All Icons"
3. Replace the PNG files in `dist/icons/` with the downloaded ones
4. Click the reload button on the extension in `chrome://extensions/`

## Development Mode

To develop with auto-rebuild:

```bash
npm run dev
```

Then reload the extension in Chrome after each change.

## First Use

1. Click the extension icon in your Chrome toolbar
2. Click "Sign In with Pubky Ring"
3. Scan the QR code with your Pubky Ring mobile app
4. Approve the authentication on your mobile device
5. Start bookmarking and tagging!

## Debugging

The extension includes comprehensive debug logging:

1. Click the extension icon
2. Click the "🔧 Debug" button in the popup header
3. View real-time logs of all extension activity
4. Export logs for troubleshooting
5. Filter by log level (DEBUG, INFO, WARN, ERROR)

You can also check:
- Chrome's extension console: `chrome://extensions/` → Details → Inspect views: service worker
- Popup DevTools: Right-click popup → Inspect
- Side panel DevTools: Right-click side panel → Inspect

## Troubleshooting

### Extension not loading
- Make sure you ran `npm run build`
- Verify you selected the `dist` folder (not the root folder)
- Check for errors in `chrome://extensions/`

### Build errors
- Delete `node_modules` and run `npm install` again
- Make sure you're using Node.js 18 or higher
- Check the error messages in the terminal

### Authentication not working
- Ensure you have the Pubky Ring mobile app installed
- Check network connectivity
- Open the debug panel to see detailed logs

## Need Help?

Check the debug logs first - they provide detailed information about what's happening. If you encounter issues, export the logs and include them when reporting problems.

