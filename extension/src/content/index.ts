const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? window.location.href;
const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content;
const title = ogTitle || document.title;
const description =
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ??
  document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ??
  '';
const siteName =
  document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')?.content ??
  document.querySelector<HTMLMetaElement>('meta[name="application-name"]')?.content ??
  document.title;
const image = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ?? '';
const icon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.href ?? '';
const lang = document.documentElement.lang || navigator.language;

chrome.storage.session.set(
  {
    'graphiti.page-metadata': {
      url: canonical,
      title,
      description,
      siteName,
      image,
      icon,
      lang,
      collectedAt: new Date().toISOString(),
    },
  },
  () => {}
);
