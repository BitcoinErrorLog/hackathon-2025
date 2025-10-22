const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? window.location.href;
const title = document.title;
const description =
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ??
  document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ??
  '';

chrome.storage.session.set(
  {
    'graphiti.page-metadata': {
      url: canonical,
      title,
      description,
      collectedAt: new Date().toISOString(),
    },
  },
  () => {}
);
