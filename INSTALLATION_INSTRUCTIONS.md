# Graphiti Extension - Installation Instructions

## What is Graphiti?

Graphiti is a Chrome browser extension that lets you:
- 🎨 Draw graffiti directly on web pages with a persistent drawing overlay
- 📝 Create text annotations on any webpage
- 🔖 Bookmark and tag URLs
- 🌐 Sync everything to your Pubky homeserver
- 👀 View posts and content from people you follow

## Installation Steps

### Step 1: Download the Extension

You should have received a file called `graphiti-extension.zip` (1.6 MB)

### Step 2: Extract the ZIP File

1. Locate the `graphiti-extension.zip` file on your computer
2. Right-click on it
3. Select "Extract All..." (Windows) or double-click (Mac)
4. Extract it to a location you'll remember (e.g., your Documents folder)
5. You should now have a folder called `dist/` with all the extension files

### Step 3: Open Chrome Extensions Page

1. Open **Google Chrome** or **Microsoft Edge**
2. In the address bar, type: `chrome://extensions`
3. Press Enter

### Step 4: Enable Developer Mode

1. Look for a toggle switch in the top-right corner that says **"Developer mode"**
2. Turn it **ON** (it should turn blue)
3. You'll see new buttons appear: "Load unpacked", "Pack extension", "Update"

### Step 5: Load the Extension

1. Click the **"Load unpacked"** button
2. Navigate to where you extracted the ZIP file
3. Select the **`dist`** folder (not the zip file, but the extracted folder)
4. Click **"Select Folder"** or **"Open"**

### Step 6: Verify Installation

You should now see "Graphiti - Pubky URL Tagger" in your extensions list with:
- ✅ A colorful icon
- ✅ Version 1.0.0
- ✅ Status showing "Enabled"

### Step 7: Pin the Extension (Optional)

1. Click the puzzle piece icon 🧩 in Chrome's toolbar (top-right)
2. Find "Graphiti - Pubky URL Tagger"
3. Click the pin icon 📌 to keep it visible in your toolbar

## Using the Extension

### Quick Start

1. **Navigate to any webpage** (e.g., https://example.com)
2. **Click the Graphiti icon** in your toolbar
3. **Sign in** with your Pubky credentials (if you have them)
   - Or explore features without signing in

### Drawing Mode 🎨 (NEW!)

**Activate Drawing:**
- Press `Alt+D` (Windows) or `Option+D` (Mac)
- OR click the 🎨 Drawing Mode button in the extension popup

**Draw on the Page:**
1. A toolbar appears in the top-right corner
2. Choose a color (8 colors available)
3. Adjust brush thickness (2-20px)
4. Click and drag to draw
5. Click "Save & Exit" when done

**Important Notes:**
- Drawings are saved per URL automatically
- Refresh the page and press Alt+D to see your saved drawing
- If signed in, drawings sync to your Pubky homeserver
- Drawing mode works on regular websites (not on chrome:// pages)

### Other Features

**Text Annotations:**
- Select text on any page
- Click "Add Annotation" button that appears
- Write your comment and save

**Bookmarks:**
- Click the extension icon
- Click "Bookmark Page"
- Syncs to your Pubky homeserver

**View Feed:**
- Click "View Feed" to see content from people you follow
- Browse posts and annotations from your network

### Keyboard Shortcuts

- `Alt+P` - Open extension popup
- `Alt+D` - Toggle drawing mode
- `Alt+S` - Toggle sidebar
- `Alt+A` - Open annotations

## Troubleshooting

### Drawing Mode Not Working?

1. **Reload the extension:**
   - Go to `chrome://extensions`
   - Click the refresh icon 🔄 on Graphiti

2. **Refresh the webpage:**
   - Press `Ctrl+R` or `Cmd+R`
   - Wait for page to fully load

3. **Try again:**
   - Press `Alt+D` or click the 🎨 button

### Extension Not Loading?

- Make sure you selected the `dist` folder, not the parent folder
- Make sure Developer Mode is enabled
- Try restarting Chrome

### Features Not Syncing?

- Sign in with your Pubky credentials
- Check your internet connection
- Open DevTools (F12) and check console for errors

### Page Restrictions

Drawing mode and some features won't work on:
- `chrome://` pages (Chrome settings)
- `about:` pages
- Browser new tab page
- Extension internal pages

**Solution:** Use on regular websites (http/https)

## Uninstallation

If you want to remove the extension:

1. Go to `chrome://extensions`
2. Find "Graphiti - Pubky URL Tagger"
3. Click **"Remove"**
4. Confirm removal

Your data will remain in Chrome's storage. To clear it completely:
1. Right-click the extension icon before removing
2. Select "Clear extension data"

## Privacy & Security

- All data is stored locally in your browser
- If signed in, data syncs to YOUR personal Pubky homeserver
- No third-party servers or tracking
- Drawings and annotations are private to you
- Open source - you can inspect the code

## Support & Issues

If you encounter problems:

1. Check the troubleshooting section above
2. Open DevTools (F12) and check for errors
3. Check the console for [Graphiti] messages
4. Contact the developer with:
   - Chrome version
   - Operating system
   - Error messages from console
   - Steps to reproduce

## Updates

When you receive an updated version:

1. Download the new `graphiti-extension.zip`
2. Extract it to the same location (overwrite old files)
3. Go to `chrome://extensions`
4. Click the refresh icon 🔄 on Graphiti
5. The extension will reload with new features

## What's New in This Version

✨ **New Drawing Feature!**
- Draw graffiti directly on web pages
- 8 color palette
- Adjustable brush thickness
- Persistent drawings per URL
- Auto-sync to Pubky homeserver

🔧 **Improvements:**
- Better error handling
- Improved user feedback
- Enhanced keyboard shortcuts
- Notification support

## Credits

Graphiti - Pubky URL Tagger
Version 1.0.0

Built for the Pubky ecosystem
Enables decentralized web annotations and bookmarking

---

**Enjoy drawing on the web! 🎨**

