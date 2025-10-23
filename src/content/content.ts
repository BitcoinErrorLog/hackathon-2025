/**
 * Content script that runs on web pages to enable text highlighting and annotations
 */

// Inline logger to avoid import issues in content script
class ContentLogger {
  private logPrefix = '[Graphiti]';

  info(context: string, message: string, data?: any) {
    console.log(`${this.logPrefix} [INFO] ${context}: ${message}`, data || '');
  }

  warn(context: string, message: string, data?: any) {
    console.warn(`${this.logPrefix} [WARN] ${context}: ${message}`, data || '');
  }

  error(context: string, message: string, error?: Error | any) {
    console.error(`${this.logPrefix} [ERROR] ${context}: ${message}`, error || '');
  }

  debug(context: string, message: string, data?: any) {
    console.debug(`${this.logPrefix} [DEBUG] ${context}: ${message}`, data || '');
  }
}

const logger = new ContentLogger();

// Annotation data structure
interface Annotation {
  id: string;
  url: string;
  selectedText: string;
  comment: string;
  startPath: string;
  endPath: string;
  startOffset: number;
  endOffset: number;
  timestamp: number;
  author: string;
  postUri?: string;
  color: string;
}

class AnnotationManager {
  private annotations: Annotation[] = [];
  private highlightClass = 'pubky-highlight';
  private activeHighlightClass = 'pubky-highlight-active';
  private currentSelection: { range: Range; text: string } | null = null;

  constructor() {
    this.init();
  }

  private init() {
    logger.info('ContentScript', 'Initializing annotation manager');
    
    // Add styles for highlights
    this.injectStyles();
    
    // Listen for text selection
    document.addEventListener('mouseup', this.handleTextSelection.bind(this));
    
    // Listen for messages from background/popup
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    
    // Load existing annotations for this page
    this.loadAnnotations();
    
    // Listen for URL changes (for SPAs and navigation)
    this.observeUrlChanges();
    
    // Listen for DOM changes that might indicate page content loaded
    this.observeContentChanges();
    
    logger.info('ContentScript', 'Annotation manager initialized');
  }
  
  private observeUrlChanges() {
    // Watch for pushState/replaceState (used by SPAs)
    let lastUrl = location.href;
    
    const checkUrlChange = () => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        logger.info('ContentScript', 'URL changed, reloading annotations', { 
          from: lastUrl, 
          to: currentUrl 
        });
        lastUrl = currentUrl;
        
        // Clear existing highlights
        this.clearAllHighlights();
        
        // Reload annotations for new URL
        setTimeout(() => {
          this.loadAnnotations();
        }, 500); // Small delay to let content load
      }
    };
    
    // Check on various navigation events
    window.addEventListener('popstate', checkUrlChange);
    window.addEventListener('pushstate', checkUrlChange);
    window.addEventListener('replacestate', checkUrlChange);
    
    // Override history methods to detect SPA navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      window.dispatchEvent(new Event('pushstate'));
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      window.dispatchEvent(new Event('replacestate'));
    };
  }
  
  private observeContentChanges() {
    // Watch for significant DOM changes that might indicate new content
    let contentChangeTimeout: number | null = null;
    
    const observer = new MutationObserver(() => {
      // Debounce: only reload annotations after content settles
      if (contentChangeTimeout) {
        clearTimeout(contentChangeTimeout);
      }
      
      contentChangeTimeout = window.setTimeout(() => {
        // Only reload if we have annotations but no highlights visible
        if (this.annotations.length > 0) {
          const visibleHighlights = document.querySelectorAll(`.${this.highlightClass}`).length;
          if (visibleHighlights === 0) {
            logger.info('ContentScript', 'Content changed, re-rendering highlights');
            this.annotations.forEach(annotation => {
              this.renderHighlight(annotation);
            });
          }
        }
      }, 1000) as unknown as number;
    });
    
    // Observe the body for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
  
  private clearAllHighlights() {
    // Remove all existing highlight elements
    document.querySelectorAll(`.${this.highlightClass}`).forEach(el => {
      const parent = el.parentNode;
      if (parent) {
        // Unwrap the highlight, keeping the text
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
      }
    });
  }

  private injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .${this.highlightClass} {
        background-color: rgba(163, 230, 53, 0.25);
        cursor: pointer;
        position: relative;
        border-bottom: 2px solid rgba(132, 204, 22, 0.6);
        transition: background-color 0.2s ease;
        box-shadow: 0 0 0 1px rgba(163, 230, 53, 0.15);
      }
      
      .${this.highlightClass}:hover {
        background-color: rgba(163, 230, 53, 0.35);
        box-shadow: 0 0 0 1px rgba(163, 230, 53, 0.25);
      }
      
      .${this.activeHighlightClass} {
        background-color: rgba(163, 230, 53, 0.5);
        box-shadow: 0 0 0 2px rgba(132, 204, 22, 0.8);
      }
      
      .pubky-annotation-button {
        position: absolute;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 10px 16px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: box-shadow 0.2s ease, opacity 0.2s ease;
        pointer-events: auto;
      }
      
      .pubky-annotation-button:hover {
        box-shadow: 0 6px 16px rgba(102, 126, 234, 0.6);
        opacity: 0.95;
      }
      
      .pubky-annotation-button svg {
        width: 16px;
        height: 16px;
      }
      
      .pubky-annotation-modal {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #2B2B2B;
        border: 1px solid #3F3F3F;
        border-radius: 12px;
        padding: 24px;
        width: 90%;
        max-width: 500px;
        z-index: 10001;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      }
      
      .pubky-annotation-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        z-index: 10000;
        backdrop-filter: blur(4px);
      }
      
      .pubky-annotation-modal h3 {
        color: white;
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 8px 0;
      }
      
      .pubky-annotation-modal .selected-text {
        background: #1F1F1F;
        border-left: 3px solid #667eea;
        padding: 12px;
        margin: 12px 0;
        color: #E0E0E0;
        font-style: italic;
        border-radius: 4px;
        max-height: 100px;
        overflow-y: auto;
      }
      
      .pubky-annotation-modal textarea {
        width: 100%;
        min-height: 100px;
        background: #1F1F1F;
        border: 1px solid #3F3F3F;
        border-radius: 8px;
        padding: 12px;
        color: white;
        font-size: 14px;
        font-family: inherit;
        resize: vertical;
        margin-bottom: 16px;
      }
      
      .pubky-annotation-modal textarea:focus {
        outline: none;
        border-color: #667eea;
      }
      
      .pubky-annotation-modal-buttons {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }
      
      .pubky-annotation-modal button {
        padding: 10px 20px;
        border-radius: 8px;
        border: none;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .pubky-annotation-modal .cancel-btn {
        background: #3F3F3F;
        color: white;
      }
      
      .pubky-annotation-modal .cancel-btn:hover {
        background: #4F4F4F;
      }
      
      .pubky-annotation-modal .submit-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      
      .pubky-annotation-modal .submit-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }
      
      .pubky-annotation-modal .submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(style);
  }

  private handleTextSelection(event: MouseEvent) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      this.hideAnnotationButton();
      return;
    }

    const selectedText = selection.toString().trim();
    if (selectedText.length === 0 || selectedText.length > 1000) {
      return;
    }

    const range = selection.getRangeAt(0);
    this.currentSelection = { range, text: selectedText };

    // Show annotation button near selection
    this.showAnnotationButton(event.pageX, event.pageY);
  }

  private showAnnotationButton(x: number, y: number) {
    // Remove existing button
    this.hideAnnotationButton();

    const button = document.createElement('button');
    button.className = 'pubky-annotation-button';
    button.innerHTML = `
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
      Add Annotation
    `;
    // Position the button with some offset and account for button size
    button.style.left = `${x - 80}px`; // Center the button on cursor
    button.style.top = `${y + 10}px`; // Small offset below cursor
    
    // Prevent button from moving when user moves mouse
    button.onmousedown = (e) => {
      e.stopPropagation();
      this.showAnnotationModal();
    };
    
    document.body.appendChild(button);
  }

  private hideAnnotationButton() {
    const existing = document.querySelector('.pubky-annotation-button');
    if (existing) {
      existing.remove();
    }
  }

  private showAnnotationModal() {
    if (!this.currentSelection) return;

    this.hideAnnotationButton();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'pubky-annotation-overlay';
    overlay.onclick = () => this.hideAnnotationModal();

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'pubky-annotation-modal';
    modal.onclick = (e) => e.stopPropagation();

    modal.innerHTML = `
      <h3>Add Annotation</h3>
      <div class="selected-text">"${this.escapeHtml(this.currentSelection.text)}"</div>
      <textarea placeholder="Add your comment..." autofocus></textarea>
      <div class="pubky-annotation-modal-buttons">
        <button class="cancel-btn">Cancel</button>
        <button class="submit-btn">Post Annotation</button>
      </div>
    `;

    const textarea = modal.querySelector('textarea')!;
    const cancelBtn = modal.querySelector('.cancel-btn')!;
    const submitBtn = modal.querySelector('.submit-btn')!;

    cancelBtn.addEventListener('click', () => this.hideAnnotationModal());
    submitBtn.addEventListener('click', () => this.createAnnotation(textarea.value));

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    // Focus textarea
    setTimeout(() => textarea.focus(), 100);
  }

  private hideAnnotationModal() {
    const overlay = document.querySelector('.pubky-annotation-overlay');
    const modal = document.querySelector('.pubky-annotation-modal');
    if (overlay) overlay.remove();
    if (modal) modal.remove();
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private async createAnnotation(comment: string) {
    if (!this.currentSelection || !comment.trim()) {
      this.hideAnnotationModal();
      return;
    }

    const submitBtn = document.querySelector('.submit-btn') as HTMLButtonElement;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';
    }

    try {
      const range = this.currentSelection.range;
      const { startPath, endPath, startOffset, endOffset } = this.getRangePosition(range);

      const annotation: Annotation = {
        id: this.generateId(),
        url: window.location.href,
        selectedText: this.currentSelection.text,
        comment: comment.trim(),
        startPath,
        endPath,
        startOffset,
        endOffset,
        timestamp: Date.now(),
        author: '', // Will be set by background script
        color: 'rgba(163, 230, 53, 0.25)',
      };

      // First save locally, then try to create Pubky post in background
      this.annotations.push(annotation);
      this.renderHighlight(annotation);
      this.hideAnnotationModal();
      
      // Send to background script to create Pubky post (async, don't block UI)
      chrome.runtime.sendMessage(
        {
          type: 'CREATE_ANNOTATION',
          annotation,
        },
        (response) => {
          if (response?.success) {
            annotation.postUri = response.postUri;
            annotation.author = response.author;
            logger.info('ContentScript', 'Annotation synced to Pubky', { id: annotation.id });
          } else {
            logger.warn('ContentScript', 'Failed to sync annotation to Pubky', response?.error);
            // Keep the local annotation but warn user
            console.warn('Annotation created locally but not synced to Pubky network. Make sure you are signed in.');
          }
        }
      );
    } catch (error) {
      logger.error('ContentScript', 'Failed to create annotation', error as Error);
      alert('Failed to create annotation');
      this.hideAnnotationModal();
    }

    this.currentSelection = null;
  }

  private getRangePosition(range: Range): {
    startPath: string;
    endPath: string;
    startOffset: number;
    endOffset: number;
  } {
    return {
      startPath: this.getNodePath(range.startContainer),
      endPath: this.getNodePath(range.endContainer),
      startOffset: range.startOffset,
      endOffset: range.endOffset,
    };
  }

  private getNodePath(node: Node): string {
    const path: number[] = [];
    let current: Node | null = node;

    while (current && current !== document.body) {
      const parent: Node | null = current.parentNode;
      if (parent) {
        const index = Array.from(parent.childNodes).indexOf(current as ChildNode);
        path.unshift(index);
      }
      current = parent;
    }

    return path.join('/');
  }

  private getNodeByPath(path: string): Node | null {
    const indices = path.split('/').map(Number);
    let current: Node = document.body;

    for (const index of indices) {
      if (index >= current.childNodes.length) {
        return null;
      }
      current = current.childNodes[index];
    }

    return current;
  }

  private renderHighlight(annotation: Annotation) {
    try {
      logger.debug('ContentScript', 'Attempting to render highlight', { 
        id: annotation.id,
        text: annotation.selectedText.substring(0, 30)
      });

      // Check if already highlighted
      const existing = document.querySelector(`[data-annotation-id="${annotation.id}"]`);
      if (existing) {
        logger.debug('ContentScript', 'Highlight already exists', { id: annotation.id });
        return;
      }

      const startNode = this.getNodeByPath(annotation.startPath);
      const endNode = this.getNodeByPath(annotation.endPath);

      if (!startNode || !endNode) {
        logger.warn('ContentScript', 'Could not find nodes for annotation', { 
          id: annotation.id,
          hasStartNode: !!startNode,
          hasEndNode: !!endNode
        });
        return;
      }

      // Validate that nodes are still in the document
      if (!document.body.contains(startNode) || !document.body.contains(endNode)) {
        logger.warn('ContentScript', 'Nodes not in document', { id: annotation.id });
        return;
      }

      const range = document.createRange();
      
      try {
        range.setStart(startNode, annotation.startOffset);
        range.setEnd(endNode, annotation.endOffset);
      } catch (rangeError) {
        logger.error('ContentScript', `Invalid range offsets: ${annotation.startPath} (${annotation.startOffset}) to ${annotation.endPath} (${annotation.endOffset})`, rangeError);
        return;
      }

      const span = document.createElement('span');
      span.className = this.highlightClass;
      span.dataset.annotationId = annotation.id;
      span.onclick = () => this.handleHighlightClick(annotation);

      try {
        range.surroundContents(span);
        logger.info('ContentScript', 'Highlight rendered successfully ✓', { id: annotation.id });
      } catch (error) {
        // If surroundContents fails (complex range), try alternative
        logger.warn('ContentScript', 'Primary method failed, trying alternative', {
          error: (error as Error).message,
          errorName: (error as Error).name
        });
        
        try {
          const contents = range.extractContents();
          span.appendChild(contents);
          range.insertNode(span);
          logger.info('ContentScript', 'Highlight rendered with alt method ✓', { id: annotation.id });
        } catch (altError) {
          logger.error('ContentScript', `All render methods failed for annotation ${annotation.id}: ${annotation.selectedText.substring(0, 50)}`, altError);
        }
      }
    } catch (error) {
      logger.error('ContentScript', 'Failed to render highlight', error as Error);
    }
  }

  private handleHighlightClick(annotation: Annotation) {
    logger.info('ContentScript', 'Highlight clicked', { id: annotation.id });
    
    // Remove active class from all highlights
    document.querySelectorAll(`.${this.activeHighlightClass}`).forEach((el) => {
      el.classList.remove(this.activeHighlightClass);
    });

    // Add active class to clicked highlight
    const highlight = document.querySelector(`[data-annotation-id="${annotation.id}"]`);
    if (highlight) {
      highlight.classList.add(this.activeHighlightClass);
    }

    // Send message to open sidebar and show annotation
    chrome.runtime.sendMessage({
      type: 'SHOW_ANNOTATION',
      annotationId: annotation.id,
    });
  }

  private async loadAnnotations() {
    try {
      // Request annotations for this URL from background script
      chrome.runtime.sendMessage(
        {
          type: 'GET_ANNOTATIONS',
          url: window.location.href,
        },
        (response) => {
          if (response?.annotations) {
            this.annotations = response.annotations;
            logger.info('ContentScript', 'Annotations loaded', { count: this.annotations.length });
            
            // Render all highlights
            this.annotations.forEach((annotation) => {
              this.renderHighlight(annotation);
            });
          }
        }
      );
    } catch (error) {
      logger.error('ContentScript', 'Failed to load annotations', error as Error);
    }
  }

  private handleMessage(message: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) {
    if (message.type === 'HIGHLIGHT_ANNOTATION') {
      const annotation = this.annotations.find((a) => a.id === message.annotationId);
      if (annotation) {
        this.handleHighlightClick(annotation);
        
        // Scroll to highlight
        const highlight = document.querySelector(`[data-annotation-id="${annotation.id}"]`);
        if (highlight) {
          highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      sendResponse({ success: true });
    }
    return true;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new AnnotationManager();
  });
} else {
  new AnnotationManager();
}

