import { logger } from '../utils/logger';

/**
 * Background service worker for the extension
 */

logger.info('Background', 'Service worker initialized');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  logger.info('Background', 'Extension installed/updated', { reason: details.reason });
  
  if (details.reason === 'install') {
    // First time installation
    logger.info('Background', 'First time installation - showing welcome');
  } else if (details.reason === 'update') {
    // Extension updated
    logger.info('Background', 'Extension updated', { 
      previousVersion: details.previousVersion 
    });
  }
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logger.debug('Background', 'Message received', { message, sender: sender.id });

  if (message.type === 'OPEN_SIDE_PANEL') {
    // Open side panel for the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.sidePanel.open({ tabId: tabs[0].id });
        logger.info('Background', 'Side panel opened', { tabId: tabs[0].id });
      }
    });
    sendResponse({ success: true });
  }

  return true; // Keep message channel open for async response
});

// Handle errors
self.addEventListener('error', (event) => {
  logger.error('Background', 'Unhandled error', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  logger.error('Background', 'Unhandled promise rejection', new Error(event.reason));
});

logger.info('Background', 'Service worker ready');

