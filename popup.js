// Debug flag
const DEBUG = true;

function log(...args) {
    if (DEBUG) {
        console.log('[AI Stacks Popup]', ...args);
    }
}

// Log immediately to confirm popup script is loading
console.log('[AI Stacks Popup] Script started loading');

document.addEventListener('DOMContentLoaded', () => {
    log('Popup loaded - DOMContentLoaded fired');

    try {
        // UI Elements
        const stackContainer = document.getElementById('stackContainer');
        const exportBtn = document.getElementById('exportBtn');
        const clearBtn = document.getElementById('clearBtn');

        if (!stackContainer || !exportBtn || !clearBtn) {
            console.error('Required DOM elements not found:', {
                stackContainer: !!stackContainer,
                exportBtn: !!exportBtn,
                clearBtn: !!clearBtn
            });
            return;
        }

        // Stack management
        let stack = [];

    function formatDate(date) {
        return new Date(date).toLocaleString();
    }

    function getProviderClass(provider) {
        return provider.toLowerCase().replace(/\s+/g, '');
    }

    function getProviderLogo(provider) {
        const providerName = provider.toLowerCase().replace(/\s+/g, '');
        const logoMap = {
            'chatgpt': 'icons/chatgpt.svg',
            'gemini': 'icons/gemini.svg',
            'claude': 'icons/claude.svg',
            'copilot': 'icons/copilot.svg'
        };
        return logoMap[providerName] || null;
    }

    /**
     * Creates a DOM element for a stack item with preview and metadata
     * @param {Object} item - The stack item to display
     * @param {string} item.text - The full text content
     * @param {string} item.provider - The AI provider name
     * @param {string} item.timestamp - ISO timestamp
     * @returns {HTMLElement} The created stack item element
     */
    function createStackItem(item) {
        log('Creating stack item:', item);
        const div = document.createElement('div');
        const providerClass = getProviderClass(item.provider);
        const providerLogo = getProviderLogo(item.provider);
        
        div.className = `stack-item ${providerClass} entering`;
        
        // Create preview (FR6.0)
        const preview = item.text.length > 50 ? 
            item.text.substring(0, 50) + '...' : 
            item.text;
        
        // Create logo HTML if available
        const logoHtml = providerLogo ? 
            `<img src="${providerLogo}" alt="${item.provider}" class="provider-logo">` : 
            '';
            
        div.innerHTML = `
            <p class="item-content">${preview}</p>
            <div class="item-meta">
                <span class="provider-tag ${providerClass}">
                    ${logoHtml}
                    ${item.provider}
                </span>
                <span class="timestamp">${formatDate(item.timestamp)}</span>
            </div>
        `;

        // Remove entering class after animation
        setTimeout(() => {
            div.classList.remove('entering');
        }, 500);

        // Click-to-copy functionality (FR9.0)
        div.addEventListener('click', async () => {
            // Visual feedback on click (NFR-U4)
            div.classList.add('clicking');
            setTimeout(() => div.classList.remove('clicking'), 200);
            try {
                await navigator.clipboard.writeText(item.text);
                const originalBackground = div.style.backgroundColor;
                div.style.backgroundColor = '#e6ffe6';
                setTimeout(() => {
                    div.style.backgroundColor = originalBackground;
                }, 500);
            } catch (error) {
                console.error('Error copying text:', error);
                div.style.backgroundColor = '#ffe6e6';
                setTimeout(() => {
                    div.style.backgroundColor = '';
                }, 500);
            }
        });

        return div;
    }

    function updateStackDisplay() {
        log('Updating stack display. Stack size:', stack.length);
        stackContainer.innerHTML = '';
        
        if (stack.length === 0) {
            stackContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <p class="empty-text">No AI responses collected yet.<br>Copy text from AI chats to start collecting.</p>
                </div>
            `;
            return;
        }

        stack.forEach(item => {
            stackContainer.appendChild(createStackItem(item));
        });
    }

    async function loadStack() {
        const startTime = performance.now();
        try {
            // Get stack from local storage
            const result = await chrome.storage.local.get('stack');
            stack = result.stack || [];
            
            // Sort by timestamp, newest first (FR5.0)
            stack.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Update the display
            updateStackDisplay();
            
            // Performance monitoring (NFR-P3)
            const loadTime = performance.now() - startTime;
            log(`Stack loaded and displayed in ${loadTime}ms`);
            if (loadTime > 500) {
                console.warn('[AI Stacks] Popup load time exceeded 500ms threshold');
            }
        } catch (error) {
            console.error('Error loading stack:', error);
            stackContainer.innerHTML = '<div class="error-state">Error loading stack. Please try again.</div>';
            
            // Still update display to show empty state
            updateStackDisplay();
        }
    }

    async function exportStack() {
        log('Exporting stack');
        try {
            // FR8.0: Specific export format requirement
            const content = stack.map(item => {
                const time = new Date(item.timestamp).toLocaleTimeString();
                return `--- [${item.provider}] at ${time} ---\n${item.text}\n\n`;
            }).join('');

            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `ai-responses-${new Date().toISOString().split('T')[0]}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            log('Stack exported successfully');
        } catch (error) {
            console.error('Error exporting stack:', error);
        }
    }

    async function clearStack() {
        const clearBtn = document.getElementById('clearBtn');
        if (!clearBtn) return;

        log('Clearing stack');
        const originalText = clearBtn.textContent;
        clearBtn.textContent = 'Clearing...';
        clearBtn.disabled = true;

        try {
            const response = await chrome.runtime.sendMessage({ action: 'clearStack' });
            if (response.success) {
                stack = [];
                updateStackDisplay();
                clearBtn.textContent = 'Cleared!';
                clearBtn.style.backgroundColor = '#4CAF50';
                setTimeout(() => {
                    clearBtn.textContent = originalText;
                    clearBtn.style.backgroundColor = '';
                    clearBtn.disabled = false;
                }, 1500);
                log('Stack cleared successfully');
            } else {
                throw new Error(response.error || 'Failed to clear stack');
            }
        } catch (error) {
            console.error('Error clearing stack:', error);
            clearBtn.textContent = 'Error';
            clearBtn.style.backgroundColor = '#ff5e2c';
            setTimeout(() => {
                clearBtn.textContent = originalText;
                clearBtn.style.backgroundColor = '';
                clearBtn.disabled = false;
            }, 1500);
        }
    }

    // Add button animation helper
    function addButtonClickAnimation(btn, callback) {
        btn.addEventListener('click', (e) => {
            // Add clicked class for ripple effect
            btn.classList.add('clicked');
            setTimeout(() => {
                btn.classList.remove('clicked');
            }, 600);
            
            // Call the original callback
            callback();
        });
    }

    // Event listeners with animations
    addButtonClickAnimation(exportBtn, exportStack);
    addButtonClickAnimation(clearBtn, clearStack);

    // Listen for stack updates
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        log('Received message:', message);
        if (message.action === 'stackUpdated') {
            if (message.stack) {
                stack = message.stack;
                updateStackDisplay();
            } else {
                loadStack();
            }
        }
    });

    // Initial load
    loadStack();
    
    } catch (error) {
        console.error('Error initializing popup:', error);
        // Show error message in the popup if possible
        document.body.innerHTML = '<div style="padding: 20px; color: red;">Error initializing popup. Check console for details.</div>';
    }
});
