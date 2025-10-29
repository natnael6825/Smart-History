// Popup JavaScript for Smart History extension

class PopupManager {
    constructor() {
        this.currentSummary = null;
        this.init();
    }

    init() {
        console.log('Popup manager initialized');
        this.setupEventListeners();
        this.loadDailySummary();
        
        // Add loading message rotation
        this.startLoadingMessages();
    }

    startLoadingMessages() {
        const loadingMessages = [
            "🔍 Analyzing your web journey...",
            "📝 Summarizing your discoveries...",
            "📊 Building your daily digest...",
            "🧠 Processing your browsing patterns...",
            "💡 Creating insights from your day...",
            "✨ Preparing your personalized summary...",
            "🚀 Almost ready with your web digest..."
        ];
        
        let messageIndex = 0;
        const loadingElement = document.querySelector('#loading div:last-child');
        
        this.loadingInterval = setInterval(() => {
            if (loadingElement) {
                loadingElement.textContent = loadingMessages[messageIndex];
                loadingElement.className = 'loading-message';
                messageIndex = (messageIndex + 1) % loadingMessages.length;
            }
        }, 2000);
    }

    stopLoadingMessages() {
        if (this.loadingInterval) {
            clearInterval(this.loadingInterval);
        }
    }

    setupEventListeners() {
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadDailySummary();
        });

        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearData();
        });

        // Modal event listeners
        document.querySelector('.close-modal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('pageModal').addEventListener('click', (e) => {
            if (e.target.id === 'pageModal') {
                this.closeModal();
            }
        });
    }

    async loadDailySummary() {
        this.showLoading();
        
        try {
            // First, ensure the background script is running
            await this.ensureBackgroundRunning();
            
            const response = await chrome.runtime.sendMessage({
                action: 'getDailySummary'
            });

            if (response && response.summary) {
                this.currentSummary = response.summary;
                this.renderSummary(this.currentSummary);
                this.showContent();
            } else {
                throw new Error('No summary data received');
            }
        } catch (error) {
            console.error('Error loading daily summary:', error);
            
            // Try to load from storage directly as fallback
            await this.loadFromStorageFallback();
        }
    }

    async ensureBackgroundRunning() {
        return new Promise((resolve) => {
            // Try to ping the background script
            chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
                if (chrome.runtime.lastError) {
                    // Background script might be inactive, try to wake it up
                    console.log('Background script inactive, attempting to wake up...');
                    // The background script should wake up when we send a message
                }
                resolve();
            });
        });
    }

    async loadFromStorageFallback() {
        try {
            // Try to load data directly from storage
            const result = await chrome.storage.local.get(['webJourneyData']);
            const data = result.webJourneyData || { visitedPages: {} };
            
            const today = new Date().toDateString();
            const todayPages = data.visitedPages?.[today] || {};
            const pages = Object.values(todayPages);
            
            if (pages.length === 0) {
                this.renderSummary({
                    date: today,
                    totalPages: 0,
                    summary: "No pages visited today.",
                    pages: []
                });
                this.showContent();
                return;
            }

            // Create a basic summary from stored data
            const summary = {
                date: today,
                totalPages: pages.length,
                summary: this.generateFallbackDailyOverview(pages),
                pages: pages.map(p => ({
                    title: p.title,
                    url: p.url,
                    timestamp: p.timestamp,
                    summary: p.aiSummary || p.fallbackSummary || 'No summary available'
                }))
            };

            this.currentSummary = summary;
            this.renderSummary(this.currentSummary);
            this.showContent();
            
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
            this.showError();
        }
    }

    generateFallbackDailyOverview(pages) {
        const categories = {};
        pages.forEach(page => {
            const domain = page.url;
            let category = 'general';
            
            if (domain.includes('news') || domain.includes('blog')) category = 'news';
            else if (domain.includes('social') || domain.includes('twitter') || domain.includes('facebook')) category = 'social';
            else if (domain.includes('shopping') || domain.includes('amazon') || domain.includes('ebay')) category = 'shopping';
            else if (domain.includes('work') || domain.includes('linkedin') || domain.includes('github')) category = 'work';
            
            categories[category] = (categories[category] || 0) + 1;
        });
        
        const categoryText = Object.entries(categories)
            .map(([cat, count]) => `${count} ${cat} pages`)
            .join(', ');
        
        return `Today you visited ${pages.length} pages. ${categoryText}.`;
    }

    renderSummary(summary) {
        // Update stats
        document.getElementById('pageCount').textContent = summary.totalPages;
        
        const aiCount = summary.pages.filter(page => page.summary && page.summary.length > 0).length;
        document.getElementById('aiCount').textContent = aiCount;

        // Update daily overview
        const dailySummaryElement = document.getElementById('dailySummary');
        dailySummaryElement.textContent = summary.summary;

        // Render pages list
        this.renderPagesList(summary.pages);
    }

    renderPagesList(pages) {
        const pagesListElement = document.getElementById('pagesList');
        
        if (pages.length === 0) {
            pagesListElement.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📄</div>
                    <div class="empty-text">No pages visited today</div>
                    <div class="empty-subtext">Start browsing to see your web journey!</div>
                </div>
            `;
            return;
        }

        pagesListElement.innerHTML = pages
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .map(page => this.createPageItem(page))
            .join('');

        // Add click handlers to page items
        setTimeout(() => {
            const pageItems = pagesListElement.querySelectorAll('.page-item');
            pageItems.forEach((item, index) => {
                item.addEventListener('click', () => {
                    this.showPageModal(pages[index]);
                });
            });
        }, 100);
    }

    showPageModal(page) {
        const modal = document.getElementById('pageModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalUrl = document.getElementById('modalUrl');
        const modalSummary = document.getElementById('modalSummary');

        modalTitle.textContent = page.title || 'Untitled Page';
        
        // Make URL clickable
        modalUrl.innerHTML = `<a href="${this.escapeHtml(page.url)}" target="_blank" style="color: #667eea; text-decoration: none;">${this.escapeHtml(page.url)}</a>`;
        
        // Format the summary with better spacing and structure
        const formattedSummary = this.formatSummaryForDisplay(page.summary || 'No summary available for this page.');
        modalSummary.innerHTML = formattedSummary;

        modal.style.display = 'block';
    }

    formatSummaryForDisplay(summary) {
        if (!summary) return '<p style="color: #999; font-style: italic;">No summary available</p>';
        
        // Convert markdown-style formatting to HTML
        let formatted = summary
            // Convert bullet points
            .replace(/^•\s+/gm, '• ')
            .replace(/^- /gm, '• ')
            .replace(/\n• /g, '<br>• ')
            .replace(/\n- /g, '<br>• ')
            
            // Convert numbered lists
            .replace(/^\d+\.\s+/gm, (match) => `<br>${match}`)
            
            // Convert bold text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            
            // Convert paragraphs
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        
        // Wrap in paragraphs if needed
        if (!formatted.startsWith('<p>')) {
            formatted = `<p>${formatted}</p>`;
        }
        
        // Add section dividers for better readability
        formatted = formatted.replace(/<\/p><p>/g, '</p><div class="section-divider"></div><p>');
        
        return formatted;
    }

    closeModal() {
        const modal = document.getElementById('pageModal');
        modal.style.display = 'none';
    }

    createPageItem(page) {
        const time = this.formatTime(page.timestamp);
        const domain = this.extractDomain(page.url);
        const hasSummary = page.summary && page.summary.length > 0;
        const isMainPage = page.isMainPage;
        const isSubPage = page.isSubPage;
        const subPagesCount = page.subPagesCount || 0;
        
        let badge = '';
        let journeyInfo = '';
        
        if (isMainPage && subPagesCount > 0) {
            badge = `<span class="domain-badge">🏠 Main +${subPagesCount}</span>`;
            journeyInfo = `<div class="journey-list">Visited ${subPagesCount} additional pages on this site</div>`;
        } else if (isMainPage) {
            badge = `<span class="domain-badge">🏠 Main</span>`;
        } else if (isSubPage) {
            badge = `<span class="domain-badge">📄 Sub-page</span>`;
        }
        
        return `
            <div class="page-item ${isSubPage ? 'sub-page' : ''}">
                <div class="page-title">
                    ${this.escapeHtml(page.title || 'Untitled')}
                    ${badge}
                    ${hasSummary ? '<span class="ai-badge">AI</span>' : ''}
                </div>
                <div class="page-url" title="${this.escapeHtml(page.url)}">
                    ${this.escapeHtml(domain)}
                    ${isSubPage ? `<span style="color: #999; font-size: 10px;">${this.extractPath(page.url)}</span>` : ''}
                </div>
                ${journeyInfo}
                ${hasSummary ? `
                    <div class="page-summary" title="${this.escapeHtml(page.summary)}">
                        ${this.escapeHtml(page.summary)}
                    </div>
                ` : `
                    <div class="page-summary" style="color: #999; font-style: italic;">
                        No summary available
                    </div>
                `}
                <div class="page-time">${time}</div>
            </div>
        `;
    }

    extractPath(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.pathname;
        } catch {
            return '';
        }
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);

        if (diffMins < 1) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins}m ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }

    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace('www.', '');
        } catch {
            return url.substring(0, 30) + (url.length > 30 ? '...' : '');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async clearData() {
        if (confirm('Are you sure you want to clear all stored data? This cannot be undone.')) {
            try {
                await chrome.runtime.sendMessage({
                    action: 'clearData'
                });
                
                // Reload the summary to show empty state
                this.loadDailySummary();
                
                // Show success message
                this.showMessage('Data cleared successfully', 'success');
            } catch (error) {
                console.error('Error clearing data:', error);
                this.showMessage('Error clearing data', 'error');
            }
        }
    }

    showMessage(message, type = 'info') {
        // Create temporary message element
        const messageElement = document.createElement('div');
        messageElement.textContent = message;
        messageElement.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            z-index: 1000;
            font-size: 12px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;

        document.body.appendChild(messageElement);

        // Remove after 3 seconds
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 3000);
    }

    showLoading() {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('content').style.display = 'none';
        document.getElementById('error').style.display = 'none';
    }

    showContent() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('content').style.display = 'block';
        document.getElementById('error').style.display = 'none';
    }

    showError() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('content').style.display = 'none';
        document.getElementById('error').style.display = 'block';
    }
}

// Initialize the popup when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});

// Add some utility functions for better UX
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Handle popup window resizing
window.addEventListener('resize', debounce(() => {
    // Adjust content if needed
}, 250));
