# Graphiti — Pubky URL Tagger

Graphiti is a Manifest V3 Chrome extension that lets you publish tagged link posts to your Pubky homeserver, review what your follows have shared about the current page, and keep Franky-flavoured local bookmarks. The codebase now ships as plain JavaScript/HTML/CSS so you can load the folder straight into Chrome without a build step.

## Loading the extension

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Click **Load unpacked** and choose the `extension/` directory from this repo.
4. Pin Graphiti from the toolbar to access the popup and open the side panel from the extensions menu.

## Feature tour

### QR-only Ring authentication
- Press **Sign in** in the popup to request a Ring session from your configured homeserver.
- Scan the QR code using the Pubky mobile app to approve the session. The popup updates in real time as the session transitions from `pending` to `authenticated`.
- Use **Sign out** (same button) to end the session at any time.

### Franky-styled publishing & tagging
- The popup auto-loads metadata about the active tab (title, canonical URL, Open Graph details).
- Add comma-separated tags; Graphiti normalises them into Pubky App-compatible slugs.
- Publish sends a deterministic record to the homeserver. Failures are queued offline and retried automatically via the background service worker.

### Sidebar feed for follows
- The side panel refreshes whenever the active tab changes or when you press **Refresh**.
- It fetches link posts about the current URL from the people you follow, displaying comments, timestamps, and tags.
- Status badges show the last refresh time, current authentication state, and any homeserver errors.

### Local bookmarks & queue management
- Save the active page as a local bookmark directly from the popup. Bookmarks sync via Chrome Sync storage and can be opened or removed later.
- Pending publishes appear in both the popup and sidebar, with a manual **Retry queue** button.

## Customising homeserver & storage
- The homeserver input in the popup persists to Chrome storage and drives all future API calls.
- All persistent state (session snapshot, tag history, pending queue, status metadata) lives under the `graphiti.*` keys inside Chrome storage. Bookmarks use Chrome sync storage so they roam with your browser profile.

## Development notes
- The extension uses only standard Web APIs, so no bundler or npm install is required.
- If you want to tweak styling, edit `styles/franky.css` and the surface-specific CSS in `popup/` or `sidepanel/`.
- The background worker lives at `background/service-worker.js` and handles Pubky requests, storage, and retry logic.
- API endpoints target the v1 Pubky routes (`/ring/v1`, `/graph/v1`, `/apps/link-posts`). Adjust them if your homeserver exposes different paths.

## Known limitations
- This implementation uses best-effort Pubky endpoints; verify them against your homeserver’s API and adjust if necessary.
- The extension relies on the browser fetching the QR image data directly from the homeserver. Ensure CORS allows the request.
- Feed rendering expects each record to surface `tags`, `comment`, `title`, `createdAt`, and `author` fields. If your homeserver uses different keys, extend the mapping in `sidepanel/sidepanel.js`.

Enjoy tagging the web with Franky flair!
