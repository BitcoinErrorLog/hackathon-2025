# Graphiti — Stage 2 Feed & Tagging

Stage 2 builds on the initial Graphiti foundation by wiring the popup into Pubky link publishing, introducing a Franky-styled tagging workflow, and lighting up the side panel feed for the current page. The extension now lets you authenticate with Pubky Ring, publish deterministic link posts, and review what your follows have said about the URL you’re browsing.

## Scripts

- `npm run dev` – Start Vite in development mode with HMR for the popup, side panel, and service worker.
- `npm run build` – Type-check and generate the production-ready extension bundle inside `dist/` for "Load unpacked".
- `npm run preview` – Preview the built extension locally.

## Stage 2 highlights

- **Pubky publishing pipeline** – The popup’s “Publish to Pubky” button now composes deterministic link records via `pubky-app-specs`, pushes them through the background worker, and refreshes the sidebar feed on success.
- **Franky-flavored tagging UI** – Tag chips, history suggestions, and slug validation mirror the Pubky App schema while keeping the neon Franky aesthetic.
- **Local bookmark vault** – Save the current URL (plus tags and notes) into Chrome sync storage. The list auto-refreshes via background events.
- **Sidebar activity feed** – The side panel fetches and renders follows’ link posts for the active URL, complete with author badges, timestamps, and tag chips. Refresh manually or rely on background broadcasts after publishes.
- **Metadata enrichment** – The content script now captures canonical URL, Open Graph data, icons, and language to pre-fill publishing metadata.

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
