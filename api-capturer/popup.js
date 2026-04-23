const INTERESTING_KEYWORDS = ['login', 'auth', 'account', 'user', 'profile', 'token', 'signup', 'signin', 'identity', 'session', 'api'];
const TRASH_KEYWORDS = ['analytics', 'telemetry', 'tracker', 'logger', 'pixel', 'collect', 'metrics', '.png', '.jpg', '.css', '.js', 'hotjar', 'google-analytics', 'fb-pixel'];

let allRequests = [];
let selectedRequest = null;
let smartFilterEnabled = false;

const requestList = document.getElementById('requestList');
const requestDetail = document.getElementById('requestDetail');
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter');
const clearBtn = document.getElementById('clearBtn');
const captureToggle = document.getElementById('captureToggle');
const backBtn = document.getElementById('backBtn');
const copyCurlBtn = document.getElementById('copyCurlBtn');

// Add new UI elements for smart filter
const filterBar = document.querySelector('.filters');
const smartFilterBtn = createElement('button', 'smart-filter-btn', 'Smart Filter: OFF');
smartFilterBtn.style.marginLeft = '10px';
filterBar.appendChild(smartFilterBtn);

const exportBtn = createElement('button', 'export-btn', 'Export JSON');
exportBtn.style.marginLeft = '5px';
filterBar.appendChild(exportBtn);

// Replay button in detail view
const replayBtn = createElement('button', 'replay-btn', 'Replay Request');
replayBtn.style.backgroundColor = '#2ecc71';
const detailHeader = document.querySelector('.detail-header');
if (detailHeader) {
    detailHeader.insertBefore(replayBtn, copyCurlBtn);
}

// Load initial data
chrome.runtime.sendMessage({ type: 'GET_REQUESTS' }, (response) => {
    if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        return;
    }
    allRequests = response.requests || [];
    captureToggle.checked = response.isCapturing;
    renderList();
});

// Listen for updates
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'UPDATE_LIST') {
        allRequests.unshift(message.request);
        renderList();
    }
});

function createElement(tag, className, textContent) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
}

function isInteresting(url) {
    const lowerUrl = url.toLowerCase();
    return INTERESTING_KEYWORDS.some(keyword => lowerUrl.includes(keyword));
}

function isTrash(url) {
    const lowerUrl = url.toLowerCase();
    return TRASH_KEYWORDS.some(keyword => lowerUrl.includes(keyword));
}

function renderList() {
    const searchTerm = searchInput.value.toLowerCase();
    const type = typeFilter.value;

    let filtered = allRequests.filter(req => {
        const matchesSearch = req.url.toLowerCase().includes(searchTerm);
        const matchesType = type === 'all' || req.type === type;
        const passesSmartFilter = !smartFilterEnabled || (isInteresting(req.url) && !isTrash(req.url));
        return matchesSearch && matchesType && passesSmartFilter;
    });

    requestList.innerHTML = '';

    if (filtered.length === 0) {
        const msg = createElement('div', 'empty-message', allRequests.length === 0 ? 'No requests captured yet. Try refreshing the page!' : 'No requests match your filters.');
        msg.style.padding = '20px';
        msg.style.textAlign = 'center';
        msg.style.color = '#666';
        requestList.appendChild(msg);
        return;
    }

    filtered.forEach(req => {
        const item = createElement('div', 'request-item');
        if (isInteresting(req.url)) {
            item.classList.add('interesting');
            item.style.borderLeft = '4px solid #f1c40f';
        }

        const statusClass = req.status >= 200 && req.status < 300 ? 'success' : (req.status === 'Error' ? 'error' : '');

        const methodSpan = createElement('span', `method ${req.method}`, req.method);
        const statusSpan = createElement('span', `status ${statusClass}`, req.status);
        const urlSpan = createElement('span', 'url', req.url);
        urlSpan.title = req.url;

        const actionsDiv = createElement('div', 'item-actions');
        actionsDiv.style.marginLeft = 'auto';
        actionsDiv.style.display = 'flex';
        actionsDiv.style.gap = '5px';

        const copyUrlBtn = createElement('button', 'mini-btn', 'URL');
        copyUrlBtn.onclick = (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(req.url);
            const orig = copyUrlBtn.textContent;
            copyUrlBtn.textContent = 'OK';
            setTimeout(() => copyUrlBtn.textContent = orig, 1000);
        };

        const copyBodyBtn = createElement('button', 'mini-btn', 'Body');
        copyBodyBtn.onclick = (e) => {
            e.stopPropagation();
            const body = typeof req.requestBody === 'string' ? req.requestBody : JSON.stringify(req.requestBody);
            navigator.clipboard.writeText(body || '');
            const orig = copyBodyBtn.textContent;
            copyBodyBtn.textContent = 'OK';
            setTimeout(() => copyBodyBtn.textContent = orig, 1000);
        };

        actionsDiv.appendChild(copyUrlBtn);
        if (req.requestBody) actionsDiv.appendChild(copyBodyBtn);

        item.appendChild(methodSpan);
        item.appendChild(statusSpan);
        item.appendChild(urlSpan);
        item.appendChild(actionsDiv);

        item.onclick = () => showDetail(req);
        requestList.appendChild(item);
    });
}

function showDetail(req) {
    selectedRequest = req;
    requestList.classList.add('hidden');
    requestDetail.classList.remove('hidden');

    const generalInfo = document.getElementById('generalInfo');
    generalInfo.innerHTML = ''; // Clear previous

    const infoFields = [
        { label: 'URL', value: req.url },
        { label: 'Method', value: req.method },
        { label: 'Status', value: req.status },
        { label: 'Type', value: req.type },
        { label: 'Duration', value: `${req.duration}ms` },
        { label: 'Time', value: new Date(req.timestamp).toLocaleString() }
    ];

    infoFields.forEach(field => {
        const div = document.createElement('div');
        const span = createElement('span', '', `${field.label}: `);
        div.appendChild(span);
        div.appendChild(document.createTextNode(field.value));
        generalInfo.appendChild(div);
    });

    document.getElementById('requestHeaders').textContent = JSON.stringify(req.requestHeaders, null, 2);
    document.getElementById('requestBody').textContent = formatBody(req.requestBody);
    document.getElementById('responseHeaders').textContent = JSON.stringify(req.responseHeaders, null, 2);
    document.getElementById('responseBody').textContent = formatBody(req.responseBody);
}

function formatBody(body) {
    if (!body) return 'No Body';
    try {
        const parsed = typeof body === 'string' ? JSON.parse(body) : body;
        return JSON.stringify(parsed, null, 2);
    } catch (e) {
        return body;
    }
}

async function replayRequest(req) {
    replayBtn.disabled = true;
    replayBtn.textContent = 'Replaying...';
    try {
        const response = await fetch(req.url, {
            method: req.method,
            headers: req.requestHeaders,
            body: ['GET', 'HEAD'].includes(req.method) ? null : req.requestBody
        });
        const text = await response.text();
        alert(`Replay Status: ${response.status}\n\nResponse snippet: ${text.substring(0, 200)}...`);
    } catch (e) {
        alert(`Replay Failed: ${e.message}`);
    } finally {
        replayBtn.disabled = false;
        replayBtn.textContent = 'Replay Request';
    }
}

function generateCurl(req) {
    let curl = `curl '${req.url.replace(/'/g, "'\\''")}' \\\n  -X '${req.method}'`;

    if (req.requestHeaders) {
        for (const [key, value] of Object.entries(req.requestHeaders)) {
            curl += ` \\\n  -H '${key}: ${value.replace(/'/g, "'\\''")}'`;
        }
    }

    if (req.requestBody) {
        const body = typeof req.requestBody === 'string' ? req.requestBody : JSON.stringify(req.requestBody);
        curl += ` \\\n  --data-raw '${body.replace(/'/g, "'\\''")}'`;
    }

    return curl;
}

// Event Listeners
searchInput.oninput = renderList;
typeFilter.onchange = renderList;

clearBtn.onclick = () => {
    chrome.runtime.sendMessage({ type: 'CLEAR_REQUESTS' }, () => {
        allRequests = [];
        renderList();
    });
};

captureToggle.onchange = () => {
    chrome.runtime.sendMessage({ type: 'SET_CAPTURING', value: captureToggle.checked });
};

smartFilterBtn.onclick = () => {
    smartFilterEnabled = !smartFilterEnabled;
    smartFilterBtn.textContent = `Smart Filter: ${smartFilterEnabled ? 'ON' : 'OFF'}`;
    smartFilterBtn.style.backgroundColor = smartFilterEnabled ? '#2ecc71' : '#3498db';
    renderList();
};

exportBtn.onclick = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allRequests, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "api_captures.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
};

replayBtn.onclick = () => {
    if (selectedRequest) replayRequest(selectedRequest);
};

backBtn.onclick = () => {
    requestDetail.classList.add('hidden');
    requestList.classList.remove('hidden');
};

copyCurlBtn.onclick = () => {
    if (!selectedRequest) return;
    const curl = generateCurl(selectedRequest);
    navigator.clipboard.writeText(curl).then(() => {
        const originalText = copyCurlBtn.textContent;
        copyCurlBtn.textContent = 'Copied!';
        setTimeout(() => copyCurlBtn.textContent = originalText, 2000);
    });
};
