// contentScript.js

function log(...args) {
    console.log('[AI Stacks CS]', ...args);
}

// --- Configuration ---
const AI_PROVIDERS = {
    'chat.openai.com': 'ChatGPT',
    'chatgpt.com': 'ChatGPT',
    'openai.com': 'ChatGPT',
    'gemini.google.com': 'Gemini',
    'claude.ai': 'Claude',
    'copilot.microsoft.com': 'Copilot'
};

function getCurrentProvider() {
    const hostname = window.location.hostname;
    // For partial matches (subdomains)
    for (const domain in AI_PROVIDERS) {
        if (hostname.includes(domain) || domain.includes(hostname)) {
            return AI_PROVIDERS[domain];
        }
    }
    return 'Web Source';
}

// --- Connection Management ---
let port;
let messageQueue = [];
let isReconnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

function connect() {
    try {
        // Check if extension is still valid before connecting
        if (!chrome.runtime) {
            log('Chrome runtime is not available. Extension may have been reloaded.');
            return;
        }
        
        port = chrome.runtime.connect({ name: 'content-script' });
        log('Successfully connected to background script.');
        isReconnecting = false;
        reconnectAttempts = 0; // Reset attempts counter on successful connection

        // Send any queued messages
        while (messageQueue.length > 0) {
            const item = messageQueue.shift();
            port.postMessage({ action: 'addToStack', item });
            log('Sent queued item.');
        }

        // Listen for disconnection
        port.onDisconnect.addListener(() => {
            const error = chrome.runtime.lastError;
            if (error) {
                log('Port disconnected with error:', error.message);
            } else {
                log('Port disconnected. Will attempt to reconnect.');
            }
            
            port = null;
            if (!isReconnecting) {
                reconnect();
            }
        });

    } catch (error) {
        log('Failed to connect. Will retry.', error);
        if (!isReconnecting) {
            reconnect();
        }
    }
}

function reconnect() {
    isReconnecting = true;
    reconnectAttempts++;
    
    if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
        log(`Maximum reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Will try again when activity resumes.`);
        isReconnecting = false;
        return;
    }
    
    // Exponential backoff with a cap
    const delay = Math.min(2000 * Math.pow(1.5, reconnectAttempts - 1), 10000);
    
    setTimeout(() => {
        log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        try {
            connect();
        } catch (e) {
            log('Reconnection attempt failed:', e);
            // Allow another reconnection attempt if this one fails
            isReconnecting = false;
        }
    }, delay);
}

// --- Message Sending ---
function sendMessage(item) {
    if (!port) {
        log('Port not connected. Queuing item.');
        messageQueue.push(item);
        if (!isReconnecting) {
            connect();
        }
        return;
    }

    try {
        port.postMessage({ action: 'addToStack', item });
        log('Item sent via port.');
    } catch (error) {
        log('Failed to send message via port. Queuing item.', error);
        messageQueue.push(item);
        port = null;
        if (!isReconnecting) {
            // Check if this is an extension context invalidated error
            if (error.message && error.message.includes('Extension context invalidated')) {
                log('Extension context invalidated. Reconnecting...');
                // Force a full reconnection after a brief timeout
                setTimeout(() => {
                    isReconnecting = false;
                    connect();
                }, 500);
            } else {
                reconnect();
            }
        }
    }
}

// --- Event Handling ---
function handleCopy() {
    try {
        const selection = window.getSelection().toString().trim();
        if (selection) {
            log('Text copied:', selection.substring(0, 50) + '...');
            const item = {
                text: selection,
                provider: getCurrentProvider(),
                timestamp: new Date().toISOString()
            };
            sendMessage(item);
        }
    } catch (error) {
        log('Error handling copy event:', error);
        // If extension context is invalidated, try reconnecting
        if (error.message && error.message.includes('Extension context invalidated')) {
            port = null;
            if (!isReconnecting) {
                log('Extension context invalidated. Reconnecting...');
                isReconnecting = false;
                connect();
            }
        }
    }
}

function handleCustomCopyClick(event) {
    try {
        // Platform-specific copy button detection
        let button = event.target.closest('button[aria-label*="copy" i], button[title*="copy" i], button[data-copy], .copy-button, button.copy-code-button, button[aria-label="Copy response"], button[aria-label="Copy code"], button.cursor-pointer, [class*="copy-button"], [data-testid="action-bar-copy"]');
        if (!button) {
            log('[AI Stacks CS] No copy button detected. Event target:', event.target.outerHTML);
            return;
        }
        log('[AI Stacks CS] Copy button detected:', button.outerHTML);
        log('[AI Stacks CS] Button classList:', button.classList ? Array.from(button.classList) : 'no classes');
        log('[AI Stacks CS] Button attributes:', Array.from(button.attributes || []).map(attr => `${attr.name}="${attr.value}"`));

        // Get the provider based on hostname
        const provider = getCurrentProvider();
        log('[AI Stacks CS] Detected provider:', provider);

        let text = '';
        let message = '';

        // ChatGPT
        if (window.location.hostname === 'chat.openai.com' || window.location.hostname === 'chatgpt.com') {
            platform = 'ChatGPT';
            // First try to find the immediate message container
            let container = button.closest('[data-message-author-role="assistant"]');
            
            // If not found, try broader container search
            if (!container) {
                let current = button.parentElement;
                while (current && current !== document.body) {
                    if (current.hasAttribute('data-message-author-role')) {
                        container = current;
                        break;
                    }
                    // Also look for main message content markers
                    if (current.classList.contains('markdown') || 
                        current.classList.contains('prose') || 
                        (current.getAttribute('role') === 'presentation' && current.querySelector('.markdown'))) {
                        container = current;
                        break;
                    }
                    current = current.parentElement;
                }
            }

            if (container) {
                log('[AI Stacks CS] ChatGPT message container detected:', container.outerHTML);
                
                // First try to find the markdown content
                const markdownDiv = container.querySelector('.markdown, .prose');
                if (markdownDiv) {
                    message = markdownDiv.textContent.trim();
                }
                
                // If no markdown div or empty content, try structured elements
                if (!message) {
                    const contentElements = container.querySelectorAll('p, pre, code, ol, ul, li, table, blockquote, h1, h2, h3, h4, h5, h6');
                    message = Array.from(contentElements)
                        .map(el => el.textContent)
                        .filter(t => {
                            const cleaned = t.trim();
                            return cleaned && 
                                   cleaned.length > 2 && 
                                   !/^(copy|export|clear|web source)$/i.test(cleaned);
                        })
                        .join('\n')
                        .trim();
                }
                
                // Final fallback for direct content
                if (!message) {
                    const rawText = container.textContent.trim();
                    if (rawText.length > 20 && !/^(copy|export|clear|web source)$/i.test(rawText)) {
                        message = rawText;
                    }
                }
                
                log('[AI Stacks CS] Extracted ChatGPT text length:', message ? message.length : 0);
                log('[AI Stacks CS] First 100 chars:', message ? message.substring(0, 100) : 'No message');
            } else {
                log('[AI Stacks CS] No substantial message container found for button:', button.outerHTML);
            }
        }
        // Gemini
        else if (window.location.hostname.includes('gemini.google.com')) {
            platform = 'Gemini';
            // ...existing Gemini extraction logic...
            // Assume message is extracted to 'message'
        }
        // Claude
        else if (window.location.hostname.includes('claude.ai')) {
            platform = 'Claude';
            // ...existing Claude extraction logic...
            // Assume message is extracted to 'message'
        }
        // Copilot
        else if (window.location.hostname.includes('copilot.microsoft.com')) {
            platform = 'Copilot';
            // ...existing Copilot extraction logic...
            // Assume message is extracted to 'message'
        }
        // Fallback for other sources
        else {
            platform = window.location.hostname;
            // ...existing fallback extraction logic...
            // Assume message is extracted to 'message'
        }

        if (message) {
            // Create the item to send to background
            const item = {
                text: message,
                provider: provider,
                timestamp: new Date().toISOString()
            };
            log('[AI Stacks CS] Sending item to background:', item);
            sendMessage(item);
            return; // Exit after sending
        } else {
            log('[AI Stacks CS] No message content extracted to send');
        }

        // Gemini
        if (window.location.hostname === 'gemini.google.com') {
            const responseContainer = button.closest('[role="region"], .response-container');
            if (responseContainer) {
                const contentElements = responseContainer.querySelectorAll('p, pre, code, ol, ul, table, [role="presentation"] > div');
                text = Array.from(contentElements).map(el => el.textContent).join('\n').trim();
            }
        }
        // Claude
        else if (window.location.hostname === 'claude.ai') {
            let container = button;
            while (container && container !== document.body) {
                if (container.classList && Array.from(container.classList).some(cls => cls.includes('group') || cls.includes('message') || cls.includes('content'))) {
                    break;
                }
                container = container.parentElement;
            }
            if (container && container !== document.body) {
                const clone = container.cloneNode(true);
                const buttonsToRemove = clone.querySelectorAll('button, [role="button"]');
                buttonsToRemove.forEach(btn => btn.remove());
                text = clone.textContent.trim();
            }
        }
        // Copilot
        else if (window.location.hostname === 'copilot.microsoft.com') {
            let container = button;
            while (container && container !== document.body) {
                if (container.classList && Array.from(container.classList).some(cls => cls.includes('group/ai-message-item') || cls.includes('break-words'))) {
                    break;
                }
                container = container.parentElement;
            }
            if (container && container !== document.body) {
                const clone = container.cloneNode(true);
                const buttonsToRemove = clone.querySelectorAll('button, [role="button"]');
                buttonsToRemove.forEach(btn => btn.remove());
                text = clone.textContent.trim();
            }
        }

        // Fallback: code block or parent
        if (!text) {
            const codeBlock = button.closest('pre') || button.parentElement;
            if (codeBlock) {
                text = codeBlock.textContent.trim();
            }
        }

        if (text) {
            log('Custom copy button clicked.');
            const item = {
                text: text,
                provider: getCurrentProvider(),
                timestamp: new Date().toISOString()
            };
            sendMessage(item);
        }
    } catch (error) {
        log('Error handling custom copy click:', error);
        if (error.message && error.message.includes('Extension context invalidated')) {
            port = null;
            if (!isReconnecting) {
                log('Extension context invalidated. Reconnecting...');
                isReconnecting = false;
                connect();
            }
        }
    }
}

// --- Initialization ---
function initialize() {
    // Initial connection attempt
    connect();

    // Add event listeners
    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('click', handleCustomCopyClick, true);
    
    // Set up a periodic reconnect check for long-lived pages
    setInterval(() => {
        if (!port && !isReconnecting) {
            log('Periodic reconnection check: reconnecting...');
            reconnectAttempts = 0; // Reset attempts for periodic checks
            connect();
        }
    }, 30000); // Check every 30 seconds
    
    // Add visibility change listener to reconnect when tab becomes active again
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !port && !isReconnecting) {
            log('Page became visible. Attempting to reconnect...');
            reconnectAttempts = 0; // Reset attempts when user returns to page
            connect();
        }
    });

    log('Content script initialized and event listeners added.');
}

initialize();
