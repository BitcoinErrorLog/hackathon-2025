# Graphiti — Stage 3 Polish & Resilience

Stage 3 adds Franky-flavoured finesse and real-world resiliency to Graphiti. The extension now adapts to the user’s system theme, highlights state with playful neon micro-interactions, and gracefully handles flaky connectivity by queueing publishes for later. Feed views react to homeserver hiccups, letting you keep browsing cached context while Graphiti retries uploads in the background.

## Scripts

- `npm run dev` – Start Vite in development mode with HMR for the popup, side panel, and service worker.
- `npm run build` – Type-check and generate the production-ready extension bundle inside `dist/` for "Load unpacked".
- `npm run preview` – Preview the built extension locally.

## Stage 3 highlights

- **Adaptive Franky theming** – Popup and side panel automatically match the user’s light/dark preference, applying blurred Franky panels, animated neon hover states, and new typography polish.
- **Offline-first publishing** – Link posts that fail to reach the homeserver land in a pending queue with retry/dismiss controls. Graphiti retries automatically via background alarms when connectivity returns.
- **Status-aware feed** – Sidebar surfaces connection state, pending publish counts, and cached-feed messaging so users understand what they’re seeing even when offline or signed out.
- **Homeserver resilience** – Background worker now retries Pubky API calls with exponential backoff, broadcasts status snapshots, and falls back to cached data when the homeserver is slow or unreachable.
- **Queued telemetry** – Publish retries, feed refreshes, and tag history updates update a shared status snapshot so both surfaces stay in sync without reloading.

## Quick start

1. Install dependencies locally (`npm install` from `extension/`).
2. During development run `npm run dev` for live reload across popup, side panel, and service worker.
3. For packaging run `npm run build`; load the resulting `dist/` folder as an unpacked Chrome extension.
4. Drop your own PNG icons inside `extension/public/` before zipping for distribution (the repo keeps only text placeholders to avoid binary diffs).

## Usage notes

- Start the Pubky Ring flow from the popup. Once authenticated the side panel automatically requests and displays the feed for the current tab.
- Tags must be lowercase slugs; the editor normalises input and surfaces recent history from previous posts or bookmarks.
- Bookmarks live entirely in Chrome sync storage and never hit the Pubky homeserver. Use them as a quick local queue alongside published posts.
- Homeserver changes propagate immediately to the Pubky client and future API calls; you can switch environments without reloading the extension.
- If you go offline, publishes are saved in the pending queue and will auto-sync (or can be manually retried) once you’re back online.
