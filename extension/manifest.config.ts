import { defineManifest } from '@crxjs/vite-plugin';

const manifest = defineManifest(() => ({
  manifest_version: 3,
  name: 'Graphiti — Pubky URL Tagger',
  description: 'Tag and publish deterministic Pubky link posts from Chrome with Franky flair.',
  version: '0.1.0',
  action: {
    default_title: 'Graphiti',
    default_popup: 'popup.html'
  },
  side_panel: {
    default_path: 'sidepanel.html'
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module'
  },
  permissions: [
    'storage',
    'tabs',
    'activeTab',
    'scripting',
    'notifications',
    'sidePanel'
  ],
  host_permissions: ['<all_urls>'],
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle'
    }
  ]
}));

export default manifest;
