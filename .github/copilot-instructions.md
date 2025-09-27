# AI Agent Instructions for Lemon25

## Project Overview
Lemon25 is a browser extension for automatically capturing and organizing text copied from AI chat interfaces (ChatGPT, Gemini, Claude, GitHub Copilot). It's built using Chrome Extension Manifest V3.

## Key Architecture Components

### Content Script (`contentScript.js`)
- Intercepts copy events on AI provider domains
- Manages connection with background service worker
- Uses `WeakMap` for tracking copy timestamps to prevent duplicates
- Implements provider detection logic for different AI platforms

### Background Service (`background.js`)
- Service worker handling message passing and storage
- Manages chrome.storage.local for persistent data
- Coordinates between content script and popup

### Popup Interface (`popup.html`, `popup.js`, `popup.css`)
- User interface for viewing and managing copied items
- Displays provider name, timestamp, and text previews
- Handles bulk export and clear operations

## Development Workflows

### Local Testing
1. Load unpacked extension in Chrome from the root directory
2. Extension works on domains specified in `manifest.json`:
   - chat.openai.com
   - gemini.google.com
   - claude.ai
   - copilot.microsoft.com

### Key Patterns

#### Provider Detection
```javascript
const AI_PROVIDERS = {
    'chat.openai.com': 'ChatGPT',
    'gemini.google.com': 'Gemini',
    'claude.ai': 'Claude',
    'copilot.microsoft.com': 'Copilot'
};
```

#### Connection Management
- Uses port-based messaging between content script and background
- Implements reconnection logic with max 5 attempts
- Queue-based message handling for reliability

## Technical Constraints
- Manifest V3 compliance required
- Local storage only - no remote data transmission
- Minimal permissions model: storage, activeTab
- Performance target: <50ms for copy interception

## Integration Points
- Chrome Extension APIs:
  - chrome.storage.local
  - chrome.runtime.connect
  - chrome.scripting
- Copy event listeners on AI provider domains

## Common Operations
- Adding new AI providers: Update `AI_PROVIDERS` object in `contentScript.js`
- Modifying storage schema: Update both background.js storage handlers and popup.js display logic
- UI customization: Modify `popup.css` for styling changes