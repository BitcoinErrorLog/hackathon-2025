# Quick Start - Testing Annotations

## ✅ The Fix is Complete!

The content script is now properly built. Follow these exact steps:

### 1. Reload the Extension (IMPORTANT!)

1. Open `chrome://extensions/` in your browser
2. Find **"Graphiti - Pubky URL Tagger"**
3. Click the **circular reload button** (⟳) on the extension card
4. The extension should reload without errors

### 2. Test on Any Webpage

1. Navigate to any website, for example:
   - https://news.ycombinator.com
   - https://wikipedia.org
   - Or use the local test page: `file:///Users/johncarvalho/Downloads/hackathon-2025-main/test.html`

2. **Refresh the page** (Cmd+Shift+R on Mac or Ctrl+Shift+R on Windows)

3. **Select some text** with your mouse

4. **You should see a purple gradient button** that says "Add Annotation" appear below your selection!

### 3. Create Your First Annotation

1. Click the "Add Annotation" button
2. A modal will appear showing your selected text
3. Type your comment (e.g., "This is interesting!")
4. Click "Post Annotation"
5. The text will be highlighted in yellow with an orange underline
6. Success! 🎉

### 4. View in the Sidebar

1. Click the Graphiti extension icon
2. Click "Open Side Panel"
3. Click the **"Annotations"** tab (the orange/yellow button)
4. You'll see your annotation listed with:
   - Your selected text in a quote box
   - Your comment
   - Timestamp
5. Click any annotation to highlight it on the page!

## What You Should See

### ✅ Expected Behavior:
- Purple gradient button appears when you select text
- Button says "Add Annotation" with a chat icon
- Modal has dark theme matching the extension
- Yellow highlights appear on annotated text
- Sidebar shows annotations in a clean card layout
- Clicking annotations scrolls to them on the page

### ❌ If Something's Wrong:

1. **No button appears:**
   - Check browser console (F12) for errors
   - Look for messages starting with `[Graphiti]`
   - Make sure you're signed in to the extension

2. **"Service worker failed" error:**
   - This should be fixed now! Try reloading the extension

3. **Can't create annotations:**
   - Make sure you're signed in (click extension icon → sign in)
   - Check that you're on an `http://` or `https://` page

## Console Messages

When working correctly, you should see in the console:
```
[Graphiti] [INFO] ContentScript: Initializing annotation manager
[Graphiti] [INFO] ContentScript: Annotation manager initialized
[Graphiti] [INFO] ContentScript: Annotations loaded { count: 0 }
```

## Notes

- **You must be signed in** to create annotations (viewing works without sign-in)
- Annotations are **public** and visible to all extension users
- Highlights persist across page visits
- Other users' annotations will appear when they create them
- The system syncs via Pubky's Nexus API

## Having Issues?

The most common fix is to:
1. Reload the extension at `chrome://extensions/`
2. Hard refresh the webpage (Cmd+Shift+R)
3. Try selecting text again

Enjoy annotating the web! 📝✨

