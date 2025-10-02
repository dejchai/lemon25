# AI Stacks Collector - Release Notes

## [1.1.1] - 2025-10-02

### Fixed
- Addressed Unchecked runtime.lastError warnings in extension background script
- Improved async message handling with proper return true usage
- Added error checks before port.postMessage to prevent port closed errors
- Enhanced reliability for communication between content scripts and background

### Technical
- Refactored message listeners for Chrome extension best practices
- Minimal code changes for maximum compatibility
- Improved logging for error diagnosis

## [1.1.0] - 2025-09-27

### Added
- Automatic stack clearing after copy operations
- Centralized notification system
  - Centered position on screen
  - Modern animation effects
  - Improved visibility and user feedback
- Verification system for stack operations
- Graceful fallbacks for popup interactions

### Enhanced
- Copy Stack Workflow
  - Sequential operation handling
  - Improved reliability for clipboard operations
  - Better error recovery mechanisms
- Popup Management
  - Robust state handling
  - Improved visibility control
  - Better interaction with chrome.action API
- Error Handling
  - Comprehensive error catching
  - Graceful degradation
  - Detailed logging for debugging

### Fixed
- Popup display issues in various contexts
- Race conditions in stack operations
- Edge cases in clipboard operations
- Popup state synchronization

### Technical
- Improved message passing architecture
- Added operation verification layer
- Enhanced logging system
- Implemented staged operation sequences
- Better state management for popups

## [1.0.0] - 2025-09-27

### Overview
AI Stacks Collector is a Chrome extension designed to enhance productivity when working with multiple AI chat platforms. It automatically captures and organizes copied text from various AI providers, making it easy to collect and manage responses.

### Key Features
- **Multi-Platform Support**
  - ChatGPT (all domains: openai.com, chat.openai.com, chatgpt.com)
  - Google Gemini
  - Anthropic Claude
  - Microsoft Copilot

- **Smart Text Capture**
  - Automatic detection of copy events (Ctrl+C/Cmd+C)
  - Support for platform-specific copy buttons
  - Intelligent message container detection
  - Clean text extraction without UI elements

- **Organized Storage**
  - Automatic provider detection and labeling
  - Timestamp recording for each entry
  - Persistent storage across browser sessions

- **User Interface**
  - Clean, minimalist popup interface
  - Easy-to-read stack display
  - Export functionality for collected content
  - One-click stack clearing

### Recent Improvements
- Implemented advanced duplicate prevention system using WeakMap
- Enhanced content extraction logic for all platforms
- Added special handling for code blocks across all providers
- Improved clipboard operations with modern APIs
- Fixed variable consistency issues
- Added support for all ChatGPT domains with smart domain matching
- Enhanced message extraction logic for better accuracy
- Improved provider detection with partial domain matching

### Technical Details
- Built with Manifest V3
- Uses chrome.storage.local for persistence
- Implements robust connection management
- Features automatic reconnection with exponential backoff

### Requirements
- Google Chrome Browser
- Permissions:
  - Storage (for saving copied text)
  - Active Tab (for content script injection)
  - Host permissions for supported AI platforms

### Usage
1. Install the extension
2. Visit any supported AI chat platform
3. Copy text using keyboard shortcuts or copy buttons
4. Click the extension icon to view your stack
5. Use Export to get all collected text or Clear to reset

### Known Limitations
- Limited to supported AI platforms
- No cloud synchronization
- No user authentication
- No advanced text editing features

### Upcoming Features
- Additional AI platform support
- Enhanced text formatting options
- Stack organization features
- Export format customization

---
For bug reports and feature requests, please create an issue in the repository.