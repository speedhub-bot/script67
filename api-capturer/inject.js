(function() {
    const originalFetch = window.fetch;
    const originalXHR = window.XMLHttpRequest;

    function sendMessage(data) {
        window.postMessage({ type: 'API_CAPTURER_DATA', data }, '*');
    }

    // Intercept Fetch
    window.fetch = async function(...args) {
        const url = args[0] instanceof Request ? args[0].url : args[0];
        const method = args[1]?.method || (args[0] instanceof Request ? args[0].method : 'GET');
        const headers = args[1]?.headers || (args[0] instanceof Request ? args[0].headers : {});
        const body = args[1]?.body || (args[0] instanceof Request ? args[0].body : null);

        const startTime = Date.now();
        const requestData = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'fetch',
            url,
            method,
            requestHeaders: headers instanceof Headers ? Object.fromEntries(headers.entries()) : headers,
            requestBody: body,
            timestamp: startTime
        };

        try {
            const response = await originalFetch.apply(this, args);
            const clone = response.clone();
            const duration = Date.now() - startTime;

            clone.text().then(responseText => {
                sendMessage({
                    ...requestData,
                    status: response.status,
                    responseHeaders: Object.fromEntries(response.headers.entries()),
                    responseBody: responseText,
                    duration
                });
            });

            return response;
        } catch (error) {
            sendMessage({
                ...requestData,
                status: 'Error',
                error: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    };

    // Intercept XHR
    window.XMLHttpRequest = function() {
        const xhr = new originalXHR();
        const open = xhr.open;
        const send = xhr.send;
        const setRequestHeader = xhr.setRequestHeader;

        let requestData = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'xhr',
            requestHeaders: {},
            timestamp: Date.now()
        };

        xhr.open = function(method, url) {
            requestData.method = method;
            requestData.url = url;
            return open.apply(this, arguments);
        };

        xhr.setRequestHeader = function(header, value) {
            requestData.requestHeaders[header] = value;
            return setRequestHeader.apply(this, arguments);
        };

        xhr.send = function(body) {
            requestData.requestBody = body;
            const startTime = Date.now();

            this.addEventListener('load', function() {
                const duration = Date.now() - startTime;
                let responseBody = '';

                // Avoid DOMException if responseType is not text
                if (!xhr.responseType || xhr.responseType === 'text') {
                    responseBody = xhr.responseText;
                } else if (xhr.responseType === 'json') {
                    responseBody = JSON.stringify(xhr.response);
                } else {
                    responseBody = `[Binary Data: ${xhr.responseType}]`;
                }

                sendMessage({
                    ...requestData,
                    status: xhr.status,
                    responseHeaders: xhr.getAllResponseHeaders().split('\r\n').reduce((acc, line) => {
                        const parts = line.split(': ');
                        const key = parts.shift();
                        const value = parts.join(': ');
                        if (key) acc[key] = value;
                        return acc;
                    }, {}),
                    responseBody: responseBody,
                    duration
                });
            });

            this.addEventListener('error', function() {
                sendMessage({
                    ...requestData,
                    status: 'Error',
                    duration: Date.now() - startTime
                });
            });

            return send.apply(this, arguments);
        };

        return xhr;
    };
})();
