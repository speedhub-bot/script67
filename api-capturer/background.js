let isCapturing = true;
const MAX_REQUESTS = 1000;

// Initialize state from storage
chrome.storage.local.get(['isCapturing'], (result) => {
    if (result.isCapturing !== undefined) {
        isCapturing = result.isCapturing;
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'API_CAPTURER_DATA') {
        if (!isCapturing) return;

        const request = {
            ...message.data,
            tabId: sender.tab?.id,
            origin: sender.origin
        };

        chrome.storage.local.get(['capturedRequests'], (result) => {
            let capturedRequests = result.capturedRequests || [];
            capturedRequests.unshift(request);
            if (capturedRequests.length > MAX_REQUESTS) {
                capturedRequests.pop();
            }
            chrome.storage.local.set({ capturedRequests });

            // Notify popup if it's open
            chrome.runtime.sendMessage({ type: 'UPDATE_LIST', request });
        });

    } else if (message.type === 'GET_REQUESTS') {
        chrome.storage.local.get(['capturedRequests', 'isCapturing'], (result) => {
            sendResponse({
                requests: result.capturedRequests || [],
                isCapturing: result.isCapturing !== undefined ? result.isCapturing : isCapturing
            });
        });
        return true; // Keep message channel open for async sendResponse

    } else if (message.type === 'CLEAR_REQUESTS') {
        chrome.storage.local.set({ capturedRequests: [] }, () => {
            sendResponse({ status: 'cleared' });
        });
        return true;

    } else if (message.type === 'SET_CAPTURING') {
        isCapturing = message.value;
        chrome.storage.local.set({ isCapturing }, () => {
            sendResponse({ isCapturing });
        });
        return true;
    }
});
