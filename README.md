# Daily Web Digest - Chrome Extension

An AI-powered Chrome extension that automatically tracks your web browsing and creates daily summaries using Chrome's built-in Prompt API with Gemini Nano.

## 🚀 Features

- **Automatic Tracking**: Monitors visited pages in the background
- **AI Summarization**: Uses Chrome's Prompt API to create intelligent page summaries
- **Daily Overview**: Generates a comprehensive daily summary of your web journey
- **Privacy-First**: All processing happens locally on your device
- **Beautiful Dashboard**: Clean, modern interface to view your summaries

## 🛠️ Technology Stack

- **Chrome Extension Manifest V3**
- **Prompt API** (Chrome's built-in AI with Gemini Nano)
- **Vanilla JavaScript** for extension logic
- **Modern CSS** with gradient backgrounds and responsive design
- **Chrome Storage API** for data persistence

## 📋 Requirements

To use the AI features, your system must meet Chrome's Prompt API requirements:

- **Chrome Version**: 138+ (with Prompt API origin trial enabled)
- **Operating System**: Windows 10/11, macOS 13+, Linux, or ChromeOS (Chromebook Plus)
- **Storage**: 22+ GB free space
- **Memory**: 16+ GB RAM
- **CPU**: 4+ cores
- **Network**: Unmetered connection

## 🎯 Hackathon Innovation

This project demonstrates:
- **Cutting-edge AI Integration**: Uses Chrome's new Prompt API
- **Practical Utility**: Solves real user problem of information overload
- **Privacy by Design**: On-device AI processing
- **Modern Web Standards**: Manifest V3 and modern JavaScript

## 📁 Project Structure

```
daily-web-digest/
├── manifest.json      # Extension configuration
├── background.js      # Background service worker
├── content.js         # Content script for page extraction
├── popup.html         # Dashboard interface
├── popup.js           # Popup JavaScript logic
├── icons/             # Extension icons
└── README.md          # This file
```

## 🔧 Installation

1. **Enable Prompt API** (if needed):
   - Go to `chrome://flags/#prompt-api`
   - Enable the Prompt API flag
   - Restart Chrome

2. **Load Extension**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select this project folder
   - The extension will be installed and ready to use

## 🎮 Usage

1. **Browse Normally**: The extension automatically tracks pages you visit
2. **View Summary**: Click the extension icon to see your daily digest
3. **AI Processing**: Pages are summarized using Chrome's built-in AI
4. **Daily Overview**: Get insights about your browsing patterns

## 🔒 Privacy

- All AI processing happens locally on your device
- No data is sent to external servers
- You control all stored data
- Clear data option available in the popup

## 🎨 Demo Features

For hackathon demonstration:
- **Real-time Tracking**: Show extension working on live websites
- **AI Summarization**: Demonstrate intelligent content understanding
- **Daily Insights**: Show how patterns emerge from browsing data
- **Privacy Showcase**: Highlight on-device processing benefits

## 🚀 Future Enhancements

- Export summaries to PDF/email
- Customizable summary length
- Topic-based categorization
- Cross-device synchronization (with user consent)
- Advanced analytics and insights

## 📝 License

MIT License - Feel free to use and modify for your projects!

---

**Built for Hackathon Innovation** 🏆
