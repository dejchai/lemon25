// background.js

// Configuration
const MAX_STACK_SIZE = 100;

// Debug logging
function log(...args) {
    console.log('[AI Stacks BG]', ...args);
}

// --- Context Menu Setup ---
function createContextMenu() {
    try {
        // Remove existing items to prevent duplicates
        chrome.contextMenus.removeAll(() => {
            // Create parent menu item
            chrome.contextMenus.create({
                id: 'aiStacksMenu',
                title: 'AI Stacks',
                contexts: ['all']
            });

            // Create sub-menu items
            chrome.contextMenus.create({
                id: 'copyStack',
                parentId: 'aiStacksMenu',
                title: 'Copy Stack to Clipboard',
                contexts: ['all']
            });

            chrome.contextMenus.create({
                id: 'clearStack',
                parentId: 'aiStacksMenu',
                title: 'Clear Stack',
                contexts: ['all']
            });
        });
    } catch (error) {
        console.error('[AI Stacks BG] Error creating context menu:', error);
    }
}

// --- Stack Management ---
async function addToStack(item) {
    try {
        // Validate item structure
        if (!item || !item.text || !item.provider || !item.timestamp) {
            throw new Error('Invalid item structure');
        }

        // Get current stack with fallback
        const result = await chrome.storage.local.get('stack');
        const stack = result.stack || [];

        // Add new item and maintain size limit
        stack.unshift(item);
        if (stack.length > MAX_STACK_SIZE) {
            stack.length = MAX_STACK_SIZE;
        }

        // Save updated stack
        await chrome.storage.local.set({ stack });
        log('Item added. New stack size:', stack.length);
        return true;
    } catch (error) {
        console.error('[AI Stacks BG] Error adding item to stack:', error);
        return false;
    }
}

// --- Event Listeners ---

// Handle extension installation/update
chrome.runtime.onInstalled.addListener(() => {
    try {
        // Create initial empty stack if not exists
        chrome.storage.local.get('stack', result => {
            if (!result.stack) {
                chrome.storage.local.set({ stack: [] });
                log('Initial stack created');
            }
        });

        // Initialize context menu
        createContextMenu();
        log('Extension initialized successfully');
    } catch (error) {
        console.error('[AI Stacks BG] Initialization error:', error);
    }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    try {
        if (info.menuItemId === 'copyStack') {
            const { stack = [] } = await chrome.storage.local.get('stack');
            const text = stack.map(item => 
                `--- [${item.provider}] at ${new Date(item.timestamp).toLocaleTimeString()} ---\n${item.text}\n\n`
            ).join('');
            await navigator.clipboard.writeText(text);
            log('Stack copied to clipboard');
        } else if (info.menuItemId === 'clearStack') {
            await chrome.storage.local.set({ stack: [] });
            log('Stack cleared');
        }
    } catch (error) {
        console.error('[AI Stacks BG] Error handling context menu click:', error);
    }
});

// Handle connection from content scripts
chrome.runtime.onConnect.addListener((port) => {
    log('New connection from:', port.name);
    
    port.onMessage.addListener(async (message) => {
        try {
            if (message.action === 'addToStack') {
                const success = await addToStack(message.item);
                port.postMessage({ success, error: success ? null : 'Failed to add item to stack' });
            }
        } catch (error) {
            console.error('[AI Stacks BG] Message handling error:', error);
            port.postMessage({ success: false, error: error.message });
        }
    });
});

log('Background service worker started.');