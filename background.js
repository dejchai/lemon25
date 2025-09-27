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
                title: 'Copy Stack',
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

        // Check for duplicates within the last 5 seconds
        const isDuplicate = stack.some(existingItem => {
            const timeDiff = Math.abs(new Date(existingItem.timestamp) - new Date(item.timestamp));
            return existingItem.text === item.text && 
                   existingItem.provider === item.provider && 
                   timeDiff < 5000; // 5 seconds threshold
        });

        if (isDuplicate) {
            log('Duplicate item detected, skipping...');
            return true; // Return true to avoid error messages
        }

        // Add new item and maintain size limit
        stack.unshift(item);
        if (stack.length > MAX_STACK_SIZE) {
            stack.length = MAX_STACK_SIZE;
        }

        // Save updated stack
        await chrome.storage.local.set({ stack });
        
        // Try to show and update popup
        try {
            // Notify popup about the update first
            await chrome.runtime.sendMessage({ 
                action: 'stackUpdated', 
                stack: stack 
            }).catch(() => {
                // Popup might not be open yet
                log('Initial popup update skipped - popup not open');
            });

            // Then try to show popup if needed
            try {
                await chrome.action.openPopup();
                log('Popup shown successfully');
            } catch (popupError) {
                log('Could not show popup automatically:', popupError.message);
                // This is expected in some contexts and shouldn't affect functionality
            }
        } catch (e) {
            // Log but don't throw - popup issues shouldn't fail the operation
            log('Popup interaction had some issues:', e.message);
        }
        
        log('Item added successfully. New stack size:', stack.length);
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
            
            // Use executeScript to copy in the context of the active tab
            if (tab.id) {
                // Execute copy operation and get the result
                const copyResult = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (textToCopy) => {
                        const textarea = document.createElement('textarea');
                        textarea.value = textToCopy;
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        textarea.select();
                        try {
                            const success = document.execCommand('copy');
                            return success;
                        } catch (err) {
                            console.error('Failed to copy:', err);
                            return false;
                        } finally {
                            document.body.removeChild(textarea);
                        }
                    },
                    args: [text]
                });

                // Check if copy was successful
                if (copyResult && copyResult[0] && copyResult[0].result === true) {
                    log('Stack successfully copied to clipboard');
                    
                    // First ensure the copy operation is complete
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Clear the stack
                    log('Clearing stack...');
                    await chrome.storage.local.set({ stack: [] });
                    
                    // Show notification about copy and clear
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: () => {
                            const div = document.createElement('div');
                            div.style.cssText = `
                                position: fixed;
                                top: 20px;
                                right: 20px;
                                background: #4CAF50;
                                color: white;
                                padding: 12px 20px;
                                border-radius: 4px;
                                z-index: 999999;
                                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                                transition: opacity 0.3s ease-in-out;
                            `;
                            div.textContent = 'Stack copied and cleared!';
                            document.body.appendChild(div);
                            setTimeout(() => {
                                div.style.opacity = '0';
                                setTimeout(() => div.remove(), 300);
                            }, 1500);
                        }
                    });

                    // Update popup with cleared state
                    try {
                        // First try to update existing popup
                        await chrome.runtime.sendMessage({ action: 'stackUpdated', stack: [] })
                            .catch(() => log('Initial popup update skipped - popup not open'));
                        
                        // Then try to show popup if it wasn't open
                        try {
                            await chrome.action.openPopup();
                            log('Popup shown with cleared state');
                        } catch (popupError) {
                            log('Could not show popup automatically:', popupError.message);
                            // This is expected in some contexts and shouldn't affect functionality
                        }
                    } catch (e) {
                        // Log but don't throw - popup issues shouldn't fail the operation
                        log('Popup interaction had some issues:', e.message);
                    }
                    
                    log('Copy to clipboard, clear, and update completed successfully');
                    try {
                        await chrome.runtime.sendMessage({ action: 'stackUpdated', stack: [] });
                        log('Popup updated with cleared stack');
                    } catch (e) {
                        log('Could not update popup:', e.message);
                        // Try to show popup again if update failed
                        try {
                            await chrome.action.openPopup();
                            log('Reopened popup after update failure');
                        } catch (popupError) {
                            log('Could not reopen popup:', popupError.message);
                        }
                    }
                    log('Stack copied to clipboard and cleared');
                } else {
                    throw new Error('Failed to copy stack to clipboard');
                }
            } else {
                throw new Error('No active tab found');
            }
        } else if (info.menuItemId === 'clearStack') {
            log('Clearing stack from context menu...');
            try {
                await chrome.storage.local.set({ stack: [] });
                // Verify the clear operation
                const verifyResult = await chrome.storage.local.get('stack');
                log('Stack status after context menu clear:', verifyResult.stack?.length === 0 ? 'Empty' : 'Not empty');
                
                // Try to notify popup, but don't throw if it fails
                try {
                    await chrome.runtime.sendMessage({ action: 'stackUpdated', stack: [] });
                    log('Popup notified of stack clear');
                } catch (e) {
                    log('Popup not open, notification skipped');
                }
                log('Stack cleared successfully from context menu');
            } catch (error) {
                console.error('[AI Stacks BG] Error clearing stack from context menu:', error);
                throw error; // Propagate error for UI notification
            }
        }
    } catch (error) {
        console.error('[AI Stacks BG] Error handling context menu click:', error);
        // Show error notification if available
        if (tab?.id) {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (errorMsg) => {
                    // Create a temporary notification
                    const div = document.createElement('div');
                    div.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: #ff5e2c;
                        color: white;
                        padding: 12px 20px;
                        border-radius: 4px;
                        z-index: 999999;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                    `;
                    div.textContent = errorMsg;
                    document.body.appendChild(div);
                    setTimeout(() => div.remove(), 3000);
                },
                args: ['Failed to copy stack to clipboard']
            }).catch(console.error);
        }
    }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'clearStack') {
        log('Handling clearStack message from popup...');
        // Handle clear stack request
        chrome.storage.local.set({ stack: [] })
            .then(async () => {
                // Verify the clear operation
                const verifyResult = await chrome.storage.local.get('stack');
                log('Stack status after message clear:', verifyResult.stack?.length === 0 ? 'Empty' : 'Not empty');
                
                sendResponse({ success: true });
                log('Stack cleared successfully from popup request');
            })
            .catch(error => {
                console.error('[AI Stacks BG] Error clearing stack from popup:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Will respond asynchronously
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