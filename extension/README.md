# Graphiti — Stage 1 Foundation

This package contains the Stage 1 foundation for the Graphiti Chrome extension. It wires up tooling, authentication plumbing, and baseline UI scaffolding using the Pubky SDK and Franky-inspired visuals.

## Scripts

- `npm run dev` – Start Vite in development mode with HMR for the popup, side panel, and service worker.
- `npm run build` – Type-check and generate the production-ready extension bundle inside `dist/` for "Load unpacked".
- `npm run preview` – Preview the built extension locally.

## What’s included in Stage 1

- Manifest V3 setup with popup, side panel, background service worker, and metadata content script.
- TailwindCSS with Franky-themed tokens and global styles.
- Pubky Ring session bootstrap in the background worker with Chrome storage persistence.
- Popup UI that can initiate QR-based login, set homeserver, and echo current tab metadata.
- Side panel placeholder that reflects authentication status and current URL, ready for the Stage 2 feed implementation.
- Git-ignored placeholder slots for extension icons — drop your own PNGs inside `extension/public/` before packaging.

Load the built `dist/` folder as an unpacked extension in Chrome to try it out.
