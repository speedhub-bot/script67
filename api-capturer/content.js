// Inject the injection script into the main world
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Listen for messages from the injection script
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data.type === 'API_CAPTURER_DATA') {
        // Forward the data to the background service worker
        chrome.runtime.sendMessage(event.data);
    }
});
