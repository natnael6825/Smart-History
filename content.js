// Content script for extracting page content

class PageContentExtractor {
  constructor() {
    this.init();
  }

  init() {
    console.log('Page content extractor initialized');
    this.setupMessageListener();
    
    // Extract content after page load with a small delay
    setTimeout(() => {
      this.extractAndSendContent();
    }, 2000);
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'extractPageContent') {
        this.extractAndSendContent();
        sendResponse({ success: true });
      }
      return true;
    });
  }

  async extractAndSendContent() {
    try {
      const contentData = await this.extractPageContent();
      
      // Send content even if minimal - let background decide what to process
      // This ensures we capture all page visits
      if (contentData.content !== undefined) {
        try {
          chrome.runtime.sendMessage({
            action: 'pageContentExtracted',
            data: contentData
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('Extension context invalidated, content not sent:', chrome.runtime.lastError);
            }
          });
        } catch (sendError) {
          console.log('Failed to send content to background script:', sendError);
        }
      }
    } catch (error) {
      console.error('Error extracting page content:', error);
    }
  }

  async extractPageContent() {
    // Wait for page to be fully loaded
    await this.waitForPageReady();
    
    const contentData = {
      title: this.extractTitle(),
      content: this.extractMainContent(),
      metadata: this.extractMetadata(),
      timestamp: new Date().toISOString()
    };

    return contentData;
  }

  waitForPageReady() {
    return new Promise((resolve) => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', resolve, { once: true });
      }
    });
  }

  extractTitle() {
    return document.title || '';
  }

  extractMainContent() {
    // Strategy 1: Try to find main content areas
    const mainContentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.content',
      '.main-content',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.story-content',
      '.news-content',
      '.blog-content',
      '#content',
      '#main',
      '#article',
      '.video-content',
      '.watch-content',
      '.player-container',
      '.ytd-watch-flexy',
      '.ytd-rich-grid-renderer',
      '.feed',
      '.timeline',
      '.stream'
    ];

    for (const selector of mainContentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const content = this.cleanTextContent(element);
        if (content && content.length > 50) { // Lower threshold to capture more pages
          return content;
        }
      }
    }

    // Strategy 2: Look for video-specific content (YouTube, etc.)
    const videoContent = this.extractVideoContent();
    if (videoContent) {
      return videoContent;
    }

    // Strategy 3: Try common text containers
    const textContainers = [
      'p', 'div', 'section', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
    ];
    
    let allText = '';
    for (const tag of textContainers) {
      const elements = document.querySelectorAll(tag);
      for (const element of elements) {
        const text = element.textContent?.trim() || '';
        if (text.length > 50) { // Capture paragraphs and headings with meaningful content
          allText += text + '\n\n';
        }
      }
    }
    
    if (allText.length > 100) {
      return allText.substring(0, 15000);
    }

    // Strategy 4: Fallback to body content, excluding navigation and ads
    const body = document.body;
    if (body) {
      // Clone body to avoid modifying the original
      const clone = body.cloneNode(true);
      
      // Remove unwanted elements
      this.removeUnwantedElements(clone);
      
      const content = this.cleanTextContent(clone);
      if (content && content.length > 50) {
        return content;
      }
    }

    // Strategy 5: Return at least the title and meta description
    const metaDescription = this.getMetaContent('description');
    const ogDescription = this.getMetaContent('og:description', 'property');
    
    const basicInfo = [
      `Title: ${document.title}`,
      metaDescription ? `Description: ${metaDescription}` : '',
      ogDescription ? `OpenGraph: ${ogDescription}` : ''
    ].filter(Boolean).join('\n\n');
    
    return basicInfo || 'Page content not available';
  }

  extractVideoContent() {
    // Extract video-specific information
    const videoElements = document.querySelectorAll('video, .video-player, .ytd-player, .html5-video-player');
    if (videoElements.length > 0) {
      const videoInfo = [];
      
      // Get video title
      const videoTitle = document.querySelector('h1, .title, .ytd-video-primary-info-renderer h1')?.textContent || '';
      if (videoTitle) {
        videoInfo.push(`Video Title: ${videoTitle}`);
      }
      
      // Get channel name
      const channelName = document.querySelector('.ytd-channel-name a, .ytd-video-owner-renderer a, .uploader')?.textContent || '';
      if (channelName) {
        videoInfo.push(`Channel: ${channelName}`);
      }
      
      // Get video description
      const description = document.querySelector('#description, .ytd-video-secondary-info-renderer, .video-description')?.textContent || '';
      if (description) {
        videoInfo.push(`Description: ${description.substring(0, 200)}...`);
      }
      
      // Get current page path to understand sub-domain navigation
      const path = window.location.pathname;
      const searchParams = new URLSearchParams(window.location.search);
      
      if (path.includes('/watch')) {
        videoInfo.push(`Content Type: YouTube Video`);
      } else if (path.includes('/channel')) {
        videoInfo.push(`Content Type: YouTube Channel`);
      } else if (path.includes('/results')) {
        videoInfo.push(`Content Type: YouTube Search Results`);
      } else if (path.includes('/playlist')) {
        videoInfo.push(`Content Type: YouTube Playlist`);
      }
      
      if (videoInfo.length > 0) {
        return videoInfo.join('\n\n');
      }
    }
    
    return null;
  }

  removeUnwantedElements(element) {
    const unwantedSelectors = [
      'nav', 'header', 'footer', 'aside',
      '.nav', '.navbar', '.header', '.footer', '.sidebar',
      '.ad', '.advertisement', '.ads', '.banner',
      '.menu', '.navigation', '.social',
      'script', 'style', 'noscript', 'iframe'
    ];

    unwantedSelectors.forEach(selector => {
      const elements = element.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });
  }

  isMeaningfulContent(element) {
    const text = element.textContent || '';
    const cleanText = text.replace(/\s+/g, ' ').trim();
    return cleanText.length > 200; // At least 200 characters of meaningful content
  }

  cleanTextContent(element) {
    if (!element) return '';
    
    let text = element.textContent || '';
    
    // Clean up the text
    text = text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n+/g, '\n') // Normalize newlines
      .trim();
    
    // Remove very short lines (likely navigation items)
    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 20); // Keep lines with at least 20 chars
    
    return lines.join('\n').substring(0, 15000); // Limit to 15k chars
  }

  extractMetadata() {
    const metadata = {
      description: this.getMetaContent('description'),
      keywords: this.getMetaContent('keywords'),
      author: this.getMetaContent('author'),
      ogTitle: this.getMetaContent('og:title', 'property'),
      ogDescription: this.getMetaContent('og:description', 'property'),
      url: window.location.href,
      domain: window.location.hostname
    };

    return metadata;
  }

  getMetaContent(name, attribute = 'name') {
    const meta = document.querySelector(`meta[${attribute}="${name}"]`);
    return meta ? meta.getAttribute('content') || '' : '';
  }
}

// Initialize the content extractor when the script loads
const pageExtractor = new PageContentExtractor();

// Also listen for dynamic content changes (for SPAs)
let observer;
try {
  observer = new MutationObserver(() => {
    // Debounce content extraction
    clearTimeout(window.contentExtractionTimeout);
    window.contentExtractionTimeout = setTimeout(() => {
      pageExtractor.extractAndSendContent();
    }, 3000);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
} catch (error) {
  console.log('MutationObserver not supported or failed:', error);
}
