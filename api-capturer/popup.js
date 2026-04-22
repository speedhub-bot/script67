let allRequests = [];
let selectedRequest = null;

const requestList = document.getElementById('requestList');
const requestDetail = document.getElementById('requestDetail');
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter');
const clearBtn = document.getElementById('clearBtn');
const captureToggle = document.getElementById('captureToggle');
const backBtn = document.getElementById('backBtn');
const copyCurlBtn = document.getElementById('copyCurlBtn');

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

function renderList() {
    const searchTerm = searchInput.value.toLowerCase();
    const type = typeFilter.value;

    const filtered = allRequests.filter(req => {
        const matchesSearch = req.url.toLowerCase().includes(searchTerm);
        const matchesType = type === 'all' || req.type === type;
        return matchesSearch && matchesType;
    });

    requestList.innerHTML = '';
    filtered.forEach(req => {
        const item = createElement('div', 'request-item');

        const statusClass = req.status >= 200 && req.status < 300 ? 'success' : (req.status === 'Error' ? 'error' : '');

        const methodSpan = createElement('span', `method ${req.method}`, req.method);
        const statusSpan = createElement('span', `status ${statusClass}`, req.status);
        const urlSpan = createElement('span', 'url', req.url);
        urlSpan.title = req.url;

        item.appendChild(methodSpan);
        item.appendChild(statusSpan);
        item.appendChild(urlSpan);

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
