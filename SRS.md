# AI Stacks Collector - Minimal SRS

## Core Functionality
1. **Copy Detection**: Intercept copy events from AI chat websites
2. **Data Storage**: Save text with provider name and timestamp
3. **Stack Management**: View, clear, and export stored items

## Technical Requirements

### Essential Features
- Listen for copy events on AI domains
- Store data in chrome.storage.local
- Show items in popup UI with provider, timestamp, preview
- Allow clearing all items
- Enable bulk export of stack
- Support individual item copy

### Technical Constraints
- Manifest V3 compliant
- Local storage only
- No remote code execution
- Standard copy event capture only

### Performance & Security
- Fast copy interception (<50ms)
- Minimal memory usage
- Basic permissions: storage, activeTab
- No external data transmission