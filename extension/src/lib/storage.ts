export const setLocal = (items: Record<string, unknown>) =>
  new Promise<void>((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

export const getLocal = <T>(key: string) =>
  new Promise<T | undefined>((resolve, reject) => {
    chrome.storage.local.get(key, (items) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(error);
      } else {
        resolve(items?.[key] as T | undefined);
      }
    });
  });

export const removeLocal = (keys: string | string[]) =>
  new Promise<void>((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

export const setSync = (items: Record<string, unknown>) =>
  new Promise<void>((resolve, reject) => {
    chrome.storage.sync.set(items, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

export const getSync = <T>(key: string) =>
  new Promise<T | undefined>((resolve, reject) => {
    chrome.storage.sync.get(key, (items) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(error);
      } else {
        resolve(items?.[key] as T | undefined);
      }
    });
  });

export const removeSync = (keys: string | string[]) =>
  new Promise<void>((resolve, reject) => {
    chrome.storage.sync.remove(keys, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

export const setSession = (items: Record<string, unknown>) =>
  new Promise<void>((resolve, reject) => {
    chrome.storage.session.set(items, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

export const getSession = <T>(key: string) =>
  new Promise<T | undefined>((resolve, reject) => {
    chrome.storage.session.get(key, (items) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(error);
      } else {
        resolve(items?.[key] as T | undefined);
      }
    });
  });

export const removeSession = (keys: string | string[]) =>
  new Promise<void>((resolve, reject) => {
    chrome.storage.session.remove(keys, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
