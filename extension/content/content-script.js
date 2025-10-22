const readMeta = (name) => {
  const el = document.querySelector(`meta[name="${name}"]`);
  if (el && el.content) return el.content;
  return undefined;
};

const readPropertyMeta = (property) => {
  const el = document.querySelector(`meta[property="${property}"]`);
  if (el && el.content) return el.content;
  return undefined;
};

const readCanonical = () => {
  const link = document.querySelector('link[rel="canonical"]');
  if (link && link.href) return link.href;
  return undefined;
};

const collectMetadata = () => {
  return {
    url: location.href,
    canonicalUrl: readCanonical(),
    title: document.title,
    description: readMeta('description') ?? readPropertyMeta('og:description'),
    siteName: readPropertyMeta('og:site_name'),
    image: readPropertyMeta('og:image') ?? readPropertyMeta('twitter:image'),
    language: document.documentElement.lang || navigator.language,
  };
};

const pushMetadata = () => {
  const payload = collectMetadata();
  chrome.runtime.sendMessage({ type: 'graphiti/page-metadata', payload }).catch(() => {});
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === 'graphiti/request-page-metadata') {
    sendResponse({ payload: collectMetadata() });
    return true;
  }
  return false;
});

document.addEventListener('DOMContentLoaded', () => {
  pushMetadata();
});

const observer = new MutationObserver(() => {
  pushMetadata();
});

observer.observe(document.documentElement, { childList: true, subtree: true });
