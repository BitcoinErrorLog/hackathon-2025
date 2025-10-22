const state = {
  homeserver: '',
  session: null,
  tagHistory: [],
  bookmarks: [],
  pendingQueue: [],
  status: {},
};

const els = {
  homeserver: document.getElementById('homeserver'),
  signIn: document.getElementById('sign-in'),
  sessionInfo: document.getElementById('session-info'),
  tags: document.getElementById('tags'),
  comment: document.getElementById('comment'),
  publish: document.getElementById('publish'),
  bookmark: document.getElementById('bookmark'),
  pendingList: document.getElementById('pending-list'),
  retry: document.getElementById('retry'),
  bookmarkList: document.getElementById('bookmark-list'),
  qrDialog: document.getElementById('qr-dialog'),
  qrImage: document.getElementById('qr-image'),
  closeQr: document.getElementById('close-qr'),
};

const normalizeTagInput = (value) => {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const getActiveTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
};

const getCurrentMetadata = async () => {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) return null;
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'graphiti/request-page-metadata' });
    return response?.payload ?? null;
  } catch (error) {
    console.warn('Graphiti metadata lookup failed', error);
    return null;
  }
};

const sendMessage = (payload) => chrome.runtime.sendMessage(payload);

const renderSession = () => {
  if (state.session?.status === 'authenticated' && state.session.identity) {
    const identity = state.session.identity;
    els.sessionInfo.textContent = `Signed in as ${identity.username ?? identity.pubkey} @ ${identity.homeserver ?? state.homeserver}`;
    els.signIn.textContent = 'Sign out';
  } else if (state.session?.status === 'pending') {
    els.sessionInfo.textContent = 'Awaiting mobile approval…';
    els.signIn.textContent = 'Cancel';
  } else if (state.session?.status === 'expired') {
    els.sessionInfo.textContent = 'Session expired — start again';
    els.signIn.textContent = 'Sign in';
  } else {
    els.sessionInfo.textContent = 'Not signed in';
    els.signIn.textContent = 'Sign in';
  }
};

const renderPending = () => {
  els.pendingList.innerHTML = '';
  if (!state.pendingQueue.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'No queued publishes';
    els.pendingList.appendChild(li);
    els.retry.disabled = true;
    return;
  }
  state.pendingQueue.forEach((entry) => {
    const li = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = entry.payload?.title || entry.payload?.url;
    li.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'pending-meta';
    meta.innerHTML = `<span>${new Date(entry.createdAt).toLocaleString()}</span><span>${entry.lastError ?? ''}</span>`;
    li.appendChild(meta);
    els.pendingList.appendChild(li);
  });
  els.retry.disabled = false;
};

const renderBookmarks = () => {
  els.bookmarkList.innerHTML = '';
  if (!state.bookmarks.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'No bookmarks saved';
    els.bookmarkList.appendChild(li);
    return;
  }
  state.bookmarks
    .slice()
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    .forEach((bookmark) => {
      const li = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = bookmark.title || bookmark.url;
      li.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'pending-meta';
      meta.innerHTML = `<span>${new Date(bookmark.savedAt).toLocaleString()}</span><span>${(bookmark.tags || []).join(', ')}</span>`;
      li.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'bookmark-actions';
      const openBtn = document.createElement('button');
      openBtn.className = 'franky secondary';
      openBtn.textContent = 'Open';
      openBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: bookmark.url });
      });
      const removeBtn = document.createElement('button');
      removeBtn.className = 'franky secondary';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => {
        sendMessage({ type: 'graphiti/bookmark-remove', id: bookmark.id });
      });
      actions.appendChild(openBtn);
      actions.appendChild(removeBtn);
      li.appendChild(actions);
      els.bookmarkList.appendChild(li);
    });
};

const render = () => {
  els.homeserver.value = state.homeserver || '';
  renderSession();
  renderPending();
  renderBookmarks();
};

const updateState = (payload) => {
  Object.assign(state, payload);
  render();
  if (state.session?.qr && state.session.status === 'pending') {
    els.qrImage.src = state.session.qr;
    if (!els.qrDialog.open) {
      els.qrDialog.showModal();
    }
  } else if (els.qrDialog.open) {
    els.qrDialog.close();
  }
};

els.closeQr.addEventListener('click', () => {
  if (els.qrDialog.open) {
    els.qrDialog.close();
  }
});

els.homeserver.addEventListener('change', async (event) => {
  const value = event.target.value.trim();
  state.homeserver = value;
  render();
  await sendMessage({ type: 'graphiti/set-homeserver', value });
});

els.signIn.addEventListener('click', async () => {
  if (state.session?.status === 'pending') {
    await sendMessage({ type: 'graphiti/logout' });
    return;
  }
  if (state.session?.status === 'authenticated') {
    await sendMessage({ type: 'graphiti/logout' });
    return;
  }
  await sendMessage({ type: 'graphiti/start-login' });
});

els.publish.addEventListener('click', async () => {
  els.publish.disabled = true;
  try {
    const metadata = await getCurrentMetadata();
    if (!metadata?.url) {
      throw new Error('Unable to read page metadata');
    }
    const tags = normalizeTagInput(els.tags.value);
    await sendMessage({
      type: 'graphiti/publish',
      url: metadata.url,
      canonicalUrl: metadata.canonicalUrl,
      title: metadata.title,
      description: metadata.description,
      tags,
      comment: els.comment.value,
      metadata,
    });
    els.comment.value = '';
    els.tags.value = '';
  } catch (error) {
    console.warn('Graphiti publish failed', error);
    alert(error.message || 'Unable to publish');
  } finally {
    els.publish.disabled = false;
  }
});

els.bookmark.addEventListener('click', async () => {
  const metadata = await getCurrentMetadata();
  if (!metadata?.url) return;
  const tags = normalizeTagInput(els.tags.value);
  await sendMessage({
    type: 'graphiti/bookmark-add',
    bookmark: {
      url: metadata.url,
      title: metadata.title,
      tags,
      note: els.comment.value,
    },
  });
});

els.retry.addEventListener('click', async () => {
  await sendMessage({ type: 'graphiti/pending-retry' });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'graphiti/state') {
    updateState(message.payload);
  }
});

(async () => {
  const snapshot = await sendMessage({ type: 'graphiti/request-state' });
  updateState(snapshot);
})();
