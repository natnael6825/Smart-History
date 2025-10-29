// Background service worker for Smart History extension

class WebJourneyManager {
  constructor() {
    this.currentSession = null;
    this.isProcessing = false;
    this.init();
  }

  async init() {
    console.log('Smart History extension initialized');
    
    // Check if Prompt API is available
    await this.checkAIAvailability();
    
    // Set up listeners
    this.setupListeners();
    
    // Load existing data
    await this.loadStoredData();
  }

  async checkAIAvailability() {
    try {
      if (typeof LanguageModel !== 'undefined') {
        const availability = await LanguageModel.availability();
        console.log('AI Availability:', availability);
        
        if (availability === 'available' || availability === 'downloadable') {
          await this.createAISession();
        }
      }
    } catch (error) {
      console.warn('Prompt API not available:', error);
    }
  }

  async createAISession() {
    try {
      this.currentSession = await LanguageModel.create({
        initialPrompts: [
          { 
            role: 'system', 
            content: 'You are a helpful web content summarizer. Create concise 2-3 sentence summaries that capture the main points of web pages. Focus on key information and insights.' 
          }
        ]
      });
      console.log('AI session created successfully');
    } catch (error) {
      console.error('Failed to create AI session:', error);
    }
  }

  setupListeners() {
    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Track tab updates to detect page visits
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.handlePageVisit(tabId, tab);
      }
    });

    // Check for daily reset at 6 AM
    this.setupDailyReset();
  }

  setupDailyReset() {
    // Check if we need to reset data (runs every time the extension starts)
    this.checkForDailyReset();
    
    // Set up alarm for daily reset at 6 AM
    chrome.alarms.create('dailyReset', {
      when: this.getNext6AM(),
      periodInMinutes: 24 * 60 // Once per day
    });

    // Listen for the alarm
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'dailyReset') {
        this.performDailyReset();
      }
    });
  }

  getNext6AM() {
    const now = new Date();
    const next6AM = new Date();
    
    // Set to 6 AM today or tomorrow
    next6AM.setHours(6, 0, 0, 0);
    
    // If it's already past 6 AM today, set for tomorrow
    if (now >= next6AM) {
      next6AM.setDate(next6AM.getDate() + 1);
    }
    
    return next6AM.getTime();
  }

  checkForDailyReset() {
    const now = new Date();
    const currentHour = now.getHours();
    
    // If it's after 6 AM and we haven't reset today, perform reset
    if (currentHour >= 6) {
      this.performDailyReset();
    }
  }

  async performDailyReset() {
    console.log('Performing daily reset at 6 AM...');
    
    // Archive yesterday's data before clearing
    await this.archiveYesterdayData();
    
    // Clear current day's data
    await this.clearStoredData();
    
    console.log('Daily reset completed. Ready for new day!');
  }

  async archiveYesterdayData() {
    const data = await this.getStoredData();
    const today = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    
    // If we have data from yesterday, archive it
    if (data.visitedPages?.[yesterdayStr]) {
      if (!data.archivedDays) {
        data.archivedDays = {};
      }
      
      // Move yesterday's data to archive
      data.archivedDays[yesterdayStr] = data.visitedPages[yesterdayStr];
      delete data.visitedPages[yesterdayStr];
      
      // Keep only last 7 days of archives
      const archiveDates = Object.keys(data.archivedDays).sort();
      if (archiveDates.length > 7) {
        const datesToRemove = archiveDates.slice(0, archiveDates.length - 7);
        datesToRemove.forEach(date => {
          delete data.archivedDays[date];
        });
      }
      
      await chrome.storage.local.set({ webJourneyData: data });
      console.log(`Archived data from ${yesterdayStr}`);
    }
  }

  async handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'pageContentExtracted':
        await this.processPageContent(request.data, sender.tab);
        break;
      
      case 'getDailySummary':
        const summary = await this.generateDailySummary();
        sendResponse({ summary });
        break;
      
      case 'clearData':
        await this.clearStoredData();
        sendResponse({ success: true });
        break;
      
      case 'ping':
        // Keep the service worker alive
        sendResponse({ status: 'alive' });
        break;
    }
  }

  async handlePageVisit(tabId, tab) {
    // Only process valid URLs (not chrome://, about:, etc.)
    if (!tab.url.startsWith('http')) return;

    // Check if we should process this page (avoid processing too frequently)
    const today = new Date().toDateString();
    const storedData = await this.getStoredData();
    
    if (storedData.visitedPages?.[today]?.[tab.url]) {
      return; // Already processed this page today
    }

    // Send message to content script to extract page content
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'extractPageContent' });
    } catch (error) {
      // Content script might not be ready yet or extension context invalidated
      console.log('Content script not ready or extension context invalidated:', error);
      
      // Try to inject content script if it's not available
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        });
        console.log('Content script injected successfully');
      } catch (injectError) {
        console.log('Failed to inject content script:', injectError);
      }
    }
  }

  async processPageContent(contentData, tab) {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      const today = new Date().toDateString();
      
      // Store basic page info
      const pageInfo = {
        url: tab.url,
        title: tab.title,
        timestamp: new Date().toISOString(),
        contentLength: contentData.content?.length || 0
      };

      // Generate AI summary if available
      if (this.currentSession && contentData.content) {
        try {
          const summary = await this.generateAISummary(contentData.content, tab.url);
          pageInfo.aiSummary = summary;
          console.log('Generated AI summary for:', tab.title);
        } catch (error) {
          console.warn('AI summary failed, using fallback:', error);
          pageInfo.fallbackSummary = this.generateFallbackSummary(contentData.content);
        }
      } else if (contentData.content) {
        pageInfo.fallbackSummary = this.generateFallbackSummary(contentData.content);
      }

      // Store the page data
      await this.storePageData(today, pageInfo);
      
      console.log('Processed page:', tab.title);
      
    } catch (error) {
      console.error('Error processing page content:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async generateAISummary(content, url) {
    if (!this.currentSession) {
      throw new Error('AI session not available');
    }

    // Limit content length to avoid token limits
    const limitedContent = content.substring(0, 8000);
    
    const prompt = `Create a concise, factual summary of ONLY this specific web page content. Focus on:

• Main topics and key information presented on this page only
• Type of content (article, video, product page, etc.)
• Specific sections or features mentioned on this page
• Key facts, data, or insights from this page only

IMPORTANT: Only summarize the content provided below. Do not include information from other pages or domains.

Format the summary with:
- Clear paragraphs with spacing
- Bullet points for lists and key points
- **Bold** emphasis on important concepts
- Professional, factual tone (avoid narrative like "you started your day")

Content to summarize:
${limitedContent}

Summary:`;

    const summary = await this.currentSession.prompt(prompt);
    return summary.trim();
  }

  generateFallbackSummary(content) {
    // Simple fallback: extract first few meaningful sentences
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const firstSentences = sentences.slice(0, 3).join('. ');
    return firstSentences + (sentences.length > 3 ? '...' : '');
  }

  async storePageData(date, pageInfo) {
    const data = await this.getStoredData();
    
    if (!data.visitedPages) {
      data.visitedPages = {};
    }
    
    if (!data.visitedPages[date]) {
      data.visitedPages[date] = {};
    }
    
    data.visitedPages[date][pageInfo.url] = pageInfo;
    
    await chrome.storage.local.set({ webJourneyData: data });
  }

  async getStoredData() {
    const result = await chrome.storage.local.get(['webJourneyData']);
    return result.webJourneyData || { visitedPages: {} };
  }

  async loadStoredData() {
    return await this.getStoredData();
  }

  async generateDailySummary() {
    const today = new Date().toDateString();
    const data = await this.getStoredData();
    const todayPages = data.visitedPages?.[today] || {};
    
    const pages = Object.values(todayPages);
    
    if (pages.length === 0) {
      return {
        date: today,
        totalPages: 0,
        summary: "No pages visited today.",
        pages: []
      };
    }

    // Group pages by domain
    const groupedPages = this.groupPagesByDomain(pages);
    
    // Generate AI daily overview if available
    let dailyOverview = '';
    if (this.currentSession && pages.length > 0) {
      try {
        const pageSummaries = pages.map(p => p.aiSummary || p.fallbackSummary || '').join('\n\n');
        dailyOverview = await this.generateAIDailyOverview(pageSummaries, pages.length);
      } catch (error) {
        console.warn('AI daily overview failed:', error);
        dailyOverview = this.generateFallbackDailyOverview(pages);
      }
    } else {
      dailyOverview = this.generateFallbackDailyOverview(pages);
    }

    return {
      date: today,
      totalPages: pages.length,
      summary: dailyOverview,
      pages: this.flattenGroupedPages(groupedPages)
    };
  }

  groupPagesByDomain(pages) {
    const grouped = {};
    
    pages.forEach(page => {
      try {
        const url = new URL(page.url);
        const domain = url.hostname.replace('www.', '');
        const path = url.pathname;
        
        if (!grouped[domain]) {
          grouped[domain] = {
            domain: domain,
            mainPage: null,
            subPages: []
          };
        }
        
        // Check if this is the main page (root path or minimal path)
        if (path === '/' || path === '' || path.split('/').length <= 2) {
          if (!grouped[domain].mainPage || new Date(page.timestamp) > new Date(grouped[domain].mainPage.timestamp)) {
            grouped[domain].mainPage = page;
          }
        } else {
          // This is a sub-page
          grouped[domain].subPages.push({
            ...page,
            path: path
          });
        }
        
      } catch (error) {
        // If URL parsing fails, treat as individual page
        const domain = page.url;
        if (!grouped[domain]) {
          grouped[domain] = {
            domain: domain,
            mainPage: page,
            subPages: []
          };
        }
      }
    });
    
    return grouped;
  }

  flattenGroupedPages(groupedPages) {
    const flattened = [];
    
    Object.values(groupedPages).forEach(group => {
      // Add main page first
      if (group.mainPage) {
        flattened.push({
          ...group.mainPage,
          isMainPage: true,
          subPagesCount: group.subPages.length,
          summary: group.mainPage.aiSummary || group.mainPage.fallbackSummary || 'No summary available'
        });
      }
      
      // Add sub-pages with their individual timestamps
      group.subPages.forEach(subPage => {
        flattened.push({
          ...subPage,
          isSubPage: true,
          parentDomain: group.domain,
          summary: subPage.aiSummary || subPage.fallbackSummary || 'No summary available'
        });
      });
    });
    
    // Sort by timestamp (most recent first)
    return flattened.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  async generateAIDailyOverview(pageSummaries, pageCount) {
    const prompt = `Based on these ${pageCount} web page summaries from today, create a factual daily overview. Focus on:

• Main domains visited and key activities
• Types of content explored (news, videos, shopping, etc.)
• Key topics or themes across the browsing session
• Any notable patterns or insights

Keep it factual and concise (3-4 sentences maximum). Avoid narrative style like "you started your day".

${pageSummaries}

Daily Overview:`;

    return await this.currentSession.prompt(prompt);
  }

  generateFallbackDailyOverview(pages) {
    const categories = this.categorizePages(pages);
    const categoryText = Object.entries(categories)
      .map(([cat, count]) => `${count} ${cat} pages`)
      .join(', ');
    
    return `Today you visited ${pages.length} pages. ${categoryText}.`;
  }

  categorizePages(pages) {
    const categories = {};
    pages.forEach(page => {
      const domain = new URL(page.url).hostname;
      let category = 'general';
      
      if (domain.includes('news') || domain.includes('blog')) category = 'news';
      else if (domain.includes('social') || domain.includes('twitter') || domain.includes('facebook')) category = 'social';
      else if (domain.includes('shopping') || domain.includes('amazon') || domain.includes('ebay')) category = 'shopping';
      else if (domain.includes('work') || domain.includes('linkedin') || domain.includes('github')) category = 'work';
      
      categories[category] = (categories[category] || 0) + 1;
    });
    
    return categories;
  }

  async clearStoredData() {
    await chrome.storage.local.remove(['webJourneyData']);
    console.log('All stored data cleared');
  }
}

// Initialize the extension
const webJourneyManager = new WebJourneyManager();
