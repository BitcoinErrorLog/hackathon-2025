const state = {
  homeserver: '',
  session: null,
  tagHistory: [],
  bookmarks: [],
  pendingQueue: [],
  status: {},
};

let currentMetadata = null;
let currentFeed = [];

const els = {
  statusLine: document.getElementById('status-line'),
  pageTitle: document.getElementById('page-title'),
  pageUrl: document.getElementById('page-url'),
  feedList: document.getElementById('feed-list'),
  tagHistory: document.getElementById('tag-history'),
  pending: document.getElementById('pending'),
  refresh: document.getElementById('refresh'),
};

const sendMessage = (payload) => chrome.runtime.sendMessage(payload);

const getActiveMetadata = async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'graphiti/request-page-metadata' });
    return response?.payload ?? null;
  } catch (error) {
    console.warn('Graphiti sidepanel metadata error', error);
    return null;
  }
};

const renderStatus = () => {
  const parts = [];
  if (state.session?.status === 'authenticated') {
    parts.push('Signed in');
  } else {
    parts.push('Not signed in');
  }
  if (state.status?.lastFeedRefreshAt) {
    parts.push(`Feed updated ${new Date(state.status.lastFeedRefreshAt).toLocaleTimeString()}`);
  }
  if (state.pendingQueue.length) {
    parts.push(`${state.pendingQueue.length} pending`);
  }
  if (state.status?.lastHomeserverError) {
    parts.push(`Error: ${state.status.lastHomeserverError}`);
  }
  els.statusLine.textContent = parts.join(' • ');
};

const renderTagHistory = () => {
  els.tagHistory.innerHTML = '';
  if (!state.tagHistory.length) {
    const span = document.createElement('span');
    span.className = 'muted';
    span.textContent = 'No tags yet';
    els.tagHistory.appendChild(span);
    return;
  }
  state.tagHistory.slice(0, 30).forEach((tag) => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.textContent = tag;
    els.tagHistory.appendChild(chip);
  });
};

const renderFeed = () => {
  els.feedList.innerHTML = '';
  if (!currentFeed.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'No posts yet for this page';
    els.feedList.appendChild(li);
    return;
  }
  currentFeed
    .slice()
    .sort((a, b) => new Date(b.createdAt ?? b.timestamp ?? 0) - new Date(a.createdAt ?? a.timestamp ?? 0))
    .forEach((item) => {
      const li = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = item.title || item.comment || item.url;
      li.appendChild(title);

      if (item.comment) {
        const comment = document.createElement('p');
        comment.textContent = item.comment;
        li.appendChild(comment);
      }

      if (Array.isArray(item.tags) && item.tags.length) {
        const tags = document.createElement('div');
        tags.className = 'feed-tags';
        item.tags.forEach((tag) => {
          const chip = document.createElement('span');
          chip.className = 'tag-chip';
          chip.textContent = tag;
          tags.appendChild(chip);
        });
        li.appendChild(tags);
      }

      const meta = document.createElement('div');
      meta.className = 'feed-meta';
      meta.innerHTML = `<span>${item.author ?? item.pubkey ?? 'Unknown'}</span><span>${new Date(item.createdAt ?? item.timestamp ?? Date.now()).toLocaleString()}</span>`;
      li.appendChild(meta);

      els.feedList.appendChild(li);
    });
};

const renderPending = () => {
  els.pending.innerHTML = '';
  if (!state.pendingQueue.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'No pending items';
    els.pending.appendChild(li);
    return;
  }
  state.pendingQueue.forEach((entry) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${entry.payload?.title || entry.payload?.url}</strong><br/><span>${entry.lastError ?? 'Waiting…'}</span>`;
    els.pending.appendChild(li);
  });
};

const renderPage = () => {
  if (!currentMetadata) {
    els.pageTitle.textContent = '';
    els.pageUrl.textContent = '';
    return;
  }
  els.pageTitle.textContent = currentMetadata.title || 'Untitled';
  els.pageUrl.textContent = currentMetadata.canonicalUrl || currentMetadata.url;
};

const updateState = (payload) => {
  Object.assign(state, payload);
  renderStatus();
  renderTagHistory();
  renderPending();
};

els.refresh.addEventListener('click', async () => {
  const metadata = await getActiveMetadata();
  if (metadata?.url) {
    await sendMessage({ type: 'graphiti/request-feed', url: metadata.url });
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'graphiti/state') {
    updateState(message.payload);
  }
  if (message?.type === 'graphiti/feed') {
    currentFeed = message.items || [];
    if (currentMetadata && message.url && currentMetadata.url === message.url) {
      renderFeed();
    }
  }
});

(async () => {
  const snapshot = await sendMessage({ type: 'graphiti/request-state' });
  updateState(snapshot);
  currentMetadata = await getActiveMetadata();
  renderPage();
  if (currentMetadata?.url) {
    const feed = await sendMessage({ type: 'graphiti/request-feed', url: currentMetadata.url });
    if (Array.isArray(feed?.items)) {
      currentFeed = feed.items;
    }
  }
  renderFeed();
})();
