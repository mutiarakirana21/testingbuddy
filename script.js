// Global state
let converterMode = 'json'; // 'json' or 'xml'
let base64Mode = 'encode'; // 'encode' or 'decode'
let history = JSON.parse(localStorage.getItem('testingToolsHistory') || '[]');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateCurrentTimestamp();
    setInterval(updateCurrentTimestamp, 1000);

    // Set default datetime
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('date-to-ts-input').value = now.toISOString().slice(0, 16);
    convertDate();

    // Add input listeners for curl generator
    ['curl-url', 'curl-resolve', 'curl-body'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', generateCurl);
    });
    // Select elements fire 'change', not 'input'
    const methodEl = document.getElementById('curl-method');
    if (methodEl) methodEl.addEventListener('change', generateCurl);

    // Add listeners to initial header/query param inputs
    document.querySelectorAll('#curl-headers input, #curl-query-params input').forEach(input => {
        input.addEventListener('input', generateCurl);
    });
});

// Navigation
function switchTool(toolId, btn) {
    // Hide all tools
    document.querySelectorAll('.tool-section').forEach(section => {
        section.classList.remove('active');
    });

    // Remove active from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Show selected tool
    document.getElementById(toolId).classList.add('active');

    // Highlight active nav item
    if (btn) btn.classList.add('active');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Utility: Copy to clipboard
function copyToClipboard(elementId, label) {
    const element = document.getElementById(elementId);
    const text = element.textContent || element.innerText;

    navigator.clipboard.writeText(text).then(() => {
        showToast(`${label} copied to clipboard!`);
    }).catch(err => {
        showToast('Failed to copy', 'error');
    });
}

// Utility: Show toast notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    if (type === 'error') {
        toast.style.background = '#ef4444';
    }
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Utility: Save to history
function saveToHistory(tool, content, output) {
    const entry = {
        id: Date.now(),
        tool,
        content,
        output,
        timestamp: new Date().toISOString()
    };

    history.unshift(entry);

    // Keep only last 100 entries
    if (history.length > 100) {
        history = history.slice(0, 100);
    }

    localStorage.setItem('testingToolsHistory', JSON.stringify(history));
}

// History Modal
function toggleHistory() {
    const modal = document.getElementById('history-modal');
    const isHidden = modal.classList.contains('hidden');

    if (isHidden) {
        modal.classList.remove('hidden');
        renderHistory();
    } else {
        modal.classList.add('hidden');
    }
}

function renderHistory() {
    const list = document.getElementById('history-list');
    const search = document.getElementById('history-search').value.toLowerCase();

    const filtered = history.filter(entry =>
        entry.tool.toLowerCase().includes(search) ||
        entry.content.toLowerCase().includes(search) ||
        entry.output.toLowerCase().includes(search)
    );

    if (filtered.length === 0) {
        list.innerHTML = '<p class="text-gray-500 text-center py-8">No history found</p>';
        return;
    }

    list.innerHTML = filtered.map(entry => `
        <div class="p-4 border border-gray-200 rounded-lg hover:border-primary transition-all">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-primary">${entry.tool}</span>
                <span class="text-xs text-gray-500">${new Date(entry.timestamp).toLocaleString()}</span>
            </div>
            <div class="text-sm text-gray-600 mb-2 truncate">${entry.content.substring(0, 100)}...</div>
            <button onclick="copyToClipboard('history-${entry.id}', 'History item')" 
                class="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">
                Copy Output
            </button>
            <pre id="history-${entry.id}" class="hidden">${entry.output}</pre>
        </div>
    `).join('');
}

function filterHistory() {
    renderHistory();
}

function clearHistory() {
    if (confirm('Are you sure you want to clear all history?')) {
        history = [];
        localStorage.removeItem('testingToolsHistory');
        renderHistory();
        showToast('History cleared');
    }
}

// ===== CURL GENERATOR (ONE LINE) =====
function addHeader() {
    const container = document.getElementById('curl-headers');
    const div = document.createElement('div');
    div.className = 'flex gap-2';
    div.innerHTML = `
        <input type="text" placeholder="Header name" class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent header-name">
        <input type="text" placeholder="Header value" class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent header-value">
        <button onclick="this.parentElement.remove(); generateCurl()" class="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all">✕</button>
    `;
    container.appendChild(div);

    // Add listeners to new inputs
    div.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', generateCurl);
    });
}

function addQueryParam() {
    const container = document.getElementById('curl-query-params');
    const div = document.createElement('div');
    div.className = 'flex gap-2';
    div.innerHTML = `
        <input type="text" placeholder="Parameter name" class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent query-name">
        <input type="text" placeholder="Parameter value" class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent query-value">
        <button onclick="this.parentElement.remove(); generateCurl()" class="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all">✕</button>
    `;
    container.appendChild(div);

    // Add listeners to new inputs
    div.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', generateCurl);
    });
}

function generateCurl() {
    const url = document.getElementById('curl-url').value.trim();

    if (!url) {
        document.getElementById('curl-output').classList.add('hidden');
        return;
    }

    const method = document.getElementById('curl-method').value;
    const resolve = document.getElementById('curl-resolve').value.trim();
    const body = document.getElementById('curl-body').value.trim();
    const flagV = document.getElementById('flag-v').checked;
    const flagI = document.getElementById('flag-i').checked;
    const flagK = document.getElementById('flag-k').checked;

    // Build query params
    const queryParams = [];
    const queryParamElements = document.querySelectorAll('#curl-query-params > div');
    queryParamElements.forEach(param => {
        const name = param.querySelector('.query-name').value.trim();
        const value = param.querySelector('.query-value').value.trim();
        if (name && value) {
            queryParams.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
        }
    });

    // Build final URL with query params
    let finalUrl = url;
    if (queryParams.length > 0) {
        const separator = url.includes('?') ? '&' : '?';
        finalUrl = url + separator + queryParams.join('&');
    }

    let command = 'curl';

    // Add flags
    if (flagV) command += ' -v';
    if (flagI) command += ' -i';
    if (flagK) command += ' -k';

    // Add method
    if (method !== 'GET') {
        command += ` -X ${method}`;
    }

    // Add headers (one line)
    const headers = document.querySelectorAll('#curl-headers > div');
    headers.forEach(header => {
        const name = header.querySelector('.header-name').value.trim();
        const value = header.querySelector('.header-value').value.trim();
        if (name && value) {
            command += ` -H "${name}: ${value}"`;
        }
    });

    // Add request body
    if (body) {
        // Compact JSON body to single line and escape for shell
        let processedBody = body;
        try {
            // If valid JSON, compact it to remove newlines
            processedBody = JSON.stringify(JSON.parse(body));
        } catch (e) {
            // Not valid JSON, just collapse newlines
            processedBody = body.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        }
        const escapedBody = processedBody.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        command += ` -d "${escapedBody}"`;
    }

    // Add resolve
    if (resolve) {
        command += ` --resolve "${resolve}"`;
    }

    // Add URL
    command += ` "${finalUrl}"`;

    document.getElementById('curl-result').textContent = command;
    document.getElementById('curl-output').classList.remove('hidden');

    saveToHistory('Curl Generator', finalUrl, command);
}

// ===== CURL IMPORT =====
function importCurl() {
    const raw = document.getElementById('curl-import-input').value.trim();
    if (!raw) { showToast('Please paste a curl command', 'error'); return; }

    // Normalize: join line continuations (backslash + newline)
    let cmd = raw.replace(/\\\s*\n/g, ' ').replace(/\s+/g, ' ').trim();

    // Remove leading 'curl' keyword
    cmd = cmd.replace(/^curl\s+/, '');

    // Reset all fields
    document.getElementById('curl-url').value = '';
    document.getElementById('curl-method').value = 'GET';
    document.getElementById('curl-resolve').value = '';
    document.getElementById('curl-body').value = '';
    document.getElementById('flag-v').checked = false;
    document.getElementById('flag-i').checked = false;
    document.getElementById('flag-k').checked = false;

    // Clear existing headers and query params, then add one empty row each
    document.getElementById('curl-headers').innerHTML = `
        <div class="flex gap-2">
            <input type="text" placeholder="Header name" class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent header-name">
            <input type="text" placeholder="Header value" class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent header-value">
            <button onclick="this.parentElement.remove(); generateCurl()" class="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all">✕</button>
        </div>`;
    document.getElementById('curl-query-params').innerHTML = `
        <div class="flex gap-2">
            <input type="text" placeholder="Parameter name" class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent query-name">
            <input type="text" placeholder="Parameter value" class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent query-value">
            <button onclick="this.parentElement.remove(); generateCurl()" class="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all">✕</button>
        </div>`;

    // Tokenize the command respecting quotes
    const tokens = [];
    let i = 0;
    while (i < cmd.length) {
        // Skip whitespace
        while (i < cmd.length && cmd[i] === ' ') i++;
        if (i >= cmd.length) break;

        let token = '';
        if (cmd[i] === '"' || cmd[i] === "'") {
            const quote = cmd[i];
            i++;
            while (i < cmd.length && cmd[i] !== quote) {
                if (cmd[i] === '\\' && i + 1 < cmd.length) {
                    // Handle escaped chars inside quotes
                    if (quote === '"') {
                        i++;
                        token += cmd[i];
                    } else {
                        token += cmd[i];
                    }
                } else {
                    token += cmd[i];
                }
                i++;
            }
            i++; // skip closing quote
        } else {
            while (i < cmd.length && cmd[i] !== ' ') {
                token += cmd[i];
                i++;
            }
        }
        tokens.push(token);
    }

    // Parse tokens
    let method = null;
    let url = '';
    const headers = [];
    let body = '';
    let resolve = '';
    const importedFlags = { v: false, i: false, k: false };
    let hasExplicitMethod = false;

    let t = 0;
    while (t < tokens.length) {
        const tok = tokens[t];

        if (tok === '-X' || tok === '--request') {
            t++;
            if (t < tokens.length) { method = tokens[t].toUpperCase(); hasExplicitMethod = true; }
        } else if (tok === '-H' || tok === '--header') {
            t++;
            if (t < tokens.length) {
                const headerStr = tokens[t];
                const colonIdx = headerStr.indexOf(':');
                if (colonIdx !== -1) {
                    headers.push({
                        name: headerStr.substring(0, colonIdx).trim(),
                        value: headerStr.substring(colonIdx + 1).trim()
                    });
                }
            }
        } else if (tok === '-d' || tok === '--data' || tok === '--data-raw' || tok === '--data-binary') {
            t++;
            if (t < tokens.length) {
                body = tokens[t];
                // Try to pretty-print if it's JSON
                try { body = JSON.stringify(JSON.parse(body), null, 2); } catch (e) { /* keep as-is */ }
            }
        } else if (tok === '--resolve') {
            t++;
            if (t < tokens.length) { resolve = tokens[t]; }
        } else if (tok === '-v' || tok === '--verbose') {
            importedFlags.v = true;
        } else if (tok === '-i' || tok === '--include') {
            importedFlags.i = true;
        } else if (tok === '-k' || tok === '--insecure') {
            importedFlags.k = true;
        } else if (tok.startsWith('-') && !tok.startsWith('--') && tok.length > 2) {
            // Combined short flags like -vik
            for (let c = 1; c < tok.length; c++) {
                const flag = tok[c];
                if (flag === 'v') importedFlags.v = true;
                else if (flag === 'i') importedFlags.i = true;
                else if (flag === 'k') importedFlags.k = true;
                else if (flag === 'X') {
                    // -X might be combined: -XPOST
                    const rest = tok.substring(c + 1);
                    if (rest) { method = rest.toUpperCase(); hasExplicitMethod = true; }
                    else { t++; if (t < tokens.length) { method = tokens[t].toUpperCase(); hasExplicitMethod = true; } }
                    break;
                } else if (flag === 'H') {
                    t++;
                    if (t < tokens.length) {
                        const headerStr = tokens[t];
                        const colonIdx = headerStr.indexOf(':');
                        if (colonIdx !== -1) {
                            headers.push({ name: headerStr.substring(0, colonIdx).trim(), value: headerStr.substring(colonIdx + 1).trim() });
                        }
                    }
                    break;
                } else if (flag === 'd') {
                    t++;
                    if (t < tokens.length) {
                        body = tokens[t];
                        try { body = JSON.stringify(JSON.parse(body), null, 2); } catch (e) { }
                    }
                    break;
                }
            }
        } else if (!tok.startsWith('-')) {
            // This is the URL
            url = tok;
        }
        t++;
    }

    // If no explicit method, infer from body
    if (!hasExplicitMethod) {
        method = body ? 'POST' : 'GET';
    }

    // Parse URL: separate query params
    let baseUrl = url;
    const parsedParams = [];
    const qIdx = url.indexOf('?');
    if (qIdx !== -1) {
        baseUrl = url.substring(0, qIdx);
        const queryString = url.substring(qIdx + 1);
        queryString.split('&').forEach(pair => {
            const eqIdx = pair.indexOf('=');
            if (eqIdx !== -1) {
                parsedParams.push({
                    name: decodeURIComponent(pair.substring(0, eqIdx)),
                    value: decodeURIComponent(pair.substring(eqIdx + 1))
                });
            } else {
                parsedParams.push({ name: decodeURIComponent(pair), value: '' });
            }
        });
    }

    // Populate the form
    document.getElementById('curl-url').value = baseUrl;
    document.getElementById('curl-method').value = method || 'GET';
    document.getElementById('curl-resolve').value = resolve;
    document.getElementById('curl-body').value = body;
    document.getElementById('flag-v').checked = importedFlags.v;
    document.getElementById('flag-i').checked = importedFlags.i;
    document.getElementById('flag-k').checked = importedFlags.k;

    // Populate headers
    const headersContainer = document.getElementById('curl-headers');
    headersContainer.innerHTML = '';
    if (headers.length === 0) {
        // Add one empty row
        addHeader();
    } else {
        headers.forEach(h => {
            addHeader();
            const rows = headersContainer.querySelectorAll('.flex.gap-2');
            const lastRow = rows[rows.length - 1];
            lastRow.querySelector('.header-name').value = h.name;
            lastRow.querySelector('.header-value').value = h.value;
        });
    }

    // Populate query params
    const paramsContainer = document.getElementById('curl-query-params');
    paramsContainer.innerHTML = '';
    if (parsedParams.length === 0) {
        addQueryParam();
    } else {
        parsedParams.forEach(p => {
            addQueryParam();
            const rows = paramsContainer.querySelectorAll('.flex.gap-2');
            const lastRow = rows[rows.length - 1];
            lastRow.querySelector('.query-name').value = p.name;
            lastRow.querySelector('.query-value').value = p.value;
        });
    }

    // Re-attach input listeners to new inputs
    document.querySelectorAll('#curl-headers input, #curl-query-params input').forEach(input => {
        input.addEventListener('input', generateCurl);
    });

    generateCurl();
    showToast('Curl command imported successfully!');
}

// ===== JSON FORMATTER (SIDE BY SIDE WITH DETAILED ERRORS) =====
function formatJSON(action) {
    const input = document.getElementById('json-input').value.trim();
    const errorDiv = document.getElementById('json-error');
    const resultPre = document.getElementById('json-result');

    errorDiv.classList.add('hidden');

    if (!input) {
        errorDiv.textContent = 'Please enter JSON to format';
        errorDiv.classList.remove('hidden');
        resultPre.textContent = '';
        return;
    }

    try {
        const parsed = JSON.parse(input);
        let result;

        if (action === 'prettify') {
            const indent = parseInt(document.getElementById('json-indent').value);
            result = JSON.stringify(parsed, null, indent);
        } else {
            result = JSON.stringify(parsed);
        }

        resultPre.textContent = result;

        saveToHistory('JSON Formatter', input.substring(0, 100), result);
    } catch (e) {
        // Detailed error with line and character position
        const errorMsg = e.message;
        const match = errorMsg.match(/position (\d+)/);

        if (match) {
            const position = parseInt(match[1]);
            const lines = input.substring(0, position).split('\n');
            const lineNum = lines.length;
            const charNum = lines[lines.length - 1].length;

            // Get all lines
            const allLines = input.split('\n');

            // Detect what's expected/missing
            let suggestion = '';
            let correctValue = '';
            if (errorMsg.includes('Expected')) {
                const expectedMatch = errorMsg.match(/Expected '(.+?)'/);
                if (expectedMatch) {
                    correctValue = expectedMatch[1];
                    suggestion = `<span class="error-marker">Expected: "${correctValue}"</span>`;
                }
            }

            // Get 3 lines before and 3 lines after
            const startLine = Math.max(0, lineNum - 4); // -4 because lineNum is 1-indexed
            const endLine = Math.min(allLines.length, lineNum + 3);

            let contextHTML = '';
            for (let i = startLine; i < endLine; i++) {
                const currentLineNum = i + 1;
                const lineContent = allLines[i] || '';
                const isErrorLine = currentLineNum === lineNum;

                if (isErrorLine) {
                    // Error line with caret
                    const caretLine = ' '.repeat(charNum) + '↑';
                    contextHTML += `
                        <div class="error-line" style="margin: 4px 0;">
                            <div class="font-mono text-xs" style="display: flex;">
                                <span style="color: #ef4444; font-weight: bold; min-width: 40px;">${currentLineNum}</span>
                                <span>${escapeHTML(lineContent)}</span>
                            </div>
                            <div class="font-mono text-xs error-marker" style="font-size: 14px; display: flex;">
                                <span style="min-width: 40px;"></span>
                                <span>${caretLine} ${suggestion}</span>
                            </div>
                        </div>
                    `;
                } else {
                    // Context line
                    contextHTML += `
                        <div class="font-mono text-xs" style="display: flex; margin: 2px 0; color: #6b7280;">
                            <span style="min-width: 40px;">${currentLineNum}</span>
                            <span>${escapeHTML(lineContent)}</span>
                        </div>
                    `;
                }
            }

            errorDiv.innerHTML = `
                <div class="font-bold mb-2">❌ JSON Syntax Error</div>
                <div class="mb-3"><strong>Error at Line ${lineNum}, Column ${charNum + 1}</strong></div>
                <div class="mb-3" style="background: #f9fafb; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb;">
                    ${contextHTML}
                </div>
                ${correctValue ? `<div class="mb-2"><strong>💡 Suggestion:</strong> Add <code style="background: #fef3c7; padding: 2px 6px; border-radius: 4px; color: #92400e;">"${correctValue}"</code> at the marked position</div>` : ''}
                <div class="text-sm" style="color: #6b7280;">${errorMsg}</div>
            `;
        } else {
            errorDiv.textContent = `Invalid JSON: ${errorMsg}`;
        }

        errorDiv.classList.remove('hidden');
        resultPre.textContent = '';
    }
}

// ===== XML FORMATTER (SIDE BY SIDE WITH DETAILED ERRORS) =====
function formatXML(action) {
    const input = document.getElementById('xml-input').value.trim();
    const errorDiv = document.getElementById('xml-error');
    const resultPre = document.getElementById('xml-result');

    errorDiv.classList.add('hidden');

    if (!input) {
        errorDiv.textContent = 'Please enter XML to format';
        errorDiv.classList.remove('hidden');
        resultPre.textContent = '';
        return;
    }

    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(input, 'text/xml');

        // Check for parsing errors
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            // Extract line number and error details
            const errorText = parserError.textContent;
            const lineMatch = errorText.match(/line (\d+)/i);
            const colMatch = errorText.match(/column (\d+)/i);

            if (lineMatch) {
                const lineNum = parseInt(lineMatch[1]);
                const colNum = colMatch ? parseInt(colMatch[1]) : 1;
                const allLines = input.split('\n');

                // Detect suggestion based on error
                let suggestion = '';
                let correctValue = '';
                if (errorText.toLowerCase().includes('unclosed') || errorText.toLowerCase().includes('expected')) {
                    suggestion = '<span class="error-marker">Check for missing closing tag</span>';
                    // Try to extract tag name
                    const tagMatch = errorText.match(/tag (\w+)/i);
                    if (tagMatch) {
                        correctValue = `</${tagMatch[1]}>`;
                        suggestion = `<span class="error-marker">Missing closing tag: ${correctValue}</span>`;
                    }
                }

                // Get 3 lines before and 3 lines after
                const startLine = Math.max(0, lineNum - 4); // -4 because lineNum is 1-indexed
                const endLine = Math.min(allLines.length, lineNum + 3);

                let contextHTML = '';
                for (let i = startLine; i < endLine; i++) {
                    const currentLineNum = i + 1;
                    const lineContent = allLines[i] || '';
                    const isErrorLine = currentLineNum === lineNum;

                    if (isErrorLine) {
                        // Error line with caret
                        const caretLine = ' '.repeat(Math.max(0, colNum - 1)) + '↑';
                        contextHTML += `
                            <div class="error-line" style="margin: 4px 0;">
                                <div class="font-mono text-xs" style="display: flex;">
                                    <span style="color: #ef4444; font-weight: bold; min-width: 40px;">${currentLineNum}</span>
                                    <span>${escapeHTML(lineContent)}</span>
                                </div>
                                <div class="font-mono text-xs error-marker" style="font-size: 14px; display: flex;">
                                    <span style="min-width: 40px;"></span>
                                    <span>${caretLine} ${suggestion}</span>
                                </div>
                            </div>
                        `;
                    } else {
                        // Context line
                        contextHTML += `
                            <div class="font-mono text-xs" style="display: flex; margin: 2px 0; color: #6b7280;">
                                <span style="min-width: 40px;">${currentLineNum}</span>
                                <span>${escapeHTML(lineContent)}</span>
                            </div>
                        `;
                    }
                }

                errorDiv.innerHTML = `
                    <div class="font-bold mb-2">❌ XML Syntax Error</div>
                    <div class="mb-3"><strong>Error at Line ${lineNum}${colNum ? `, Column ${colNum}` : ''}</strong></div>
                    <div class="mb-3" style="background: #f9fafb; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb;">
                        ${contextHTML}
                    </div>
                    ${correctValue ? `<div class="mb-2"><strong>💡 Suggestion:</strong> Add <code style="background: #fef3c7; padding: 2px 6px; border-radius: 4px; color: #92400e;">${escapeHTML(correctValue)}</code> to close the tag</div>` : ''}
                    <div class="text-sm" style="color: #6b7280;">${errorText}</div>
                `;
            } else {
                errorDiv.textContent = errorText;
            }

            errorDiv.classList.remove('hidden');
            resultPre.textContent = '';
            return;
        }

        let result;
        if (action === 'prettify') {
            result = formatXMLString(xmlDoc);
        } else {
            result = input.replace(/>\s+</g, '><').trim();
        }

        resultPre.textContent = result;

        saveToHistory('XML Formatter', input.substring(0, 100), result);
    } catch (e) {
        errorDiv.textContent = `Invalid XML: ${e.message}`;
        errorDiv.classList.remove('hidden');
        resultPre.textContent = '';
    }
}

function formatXMLString(xml) {
    const serializer = new XMLSerializer();
    const xmlString = serializer.serializeToString(xml);

    let formatted = '';
    let indent = 0;

    xmlString.split(/>\s*</).forEach((node, index) => {
        if (node.match(/^\/\w/)) indent--;

        if (index > 0) formatted += '\n' + '  '.repeat(indent);
        formatted += (index === 0 ? '' : '<') + node + (index === xmlString.split(/>\s*</).length - 1 ? '' : '>');

        if (node.match(/^<?\w[^>]*[^\/]$/)) indent++;
    });

    return formatted;
}

// ===== JSON ↔ XML CONVERTER =====
function setConverterMode(mode) {
    converterMode = mode;

    const jsonBtn = document.getElementById('conv-json-btn');
    const xmlBtn = document.getElementById('conv-xml-btn');

    if (mode === 'json') {
        jsonBtn.className = 'flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium transition-all';
        xmlBtn.className = 'flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium transition-all';
        document.getElementById('converter-input').placeholder = 'Enter JSON...';
    } else {
        xmlBtn.className = 'flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium transition-all';
        jsonBtn.className = 'flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium transition-all';
        document.getElementById('converter-input').placeholder = 'Enter XML...';
    }
}

function convertFormat() {
    const input = document.getElementById('converter-input').value.trim();
    const errorDiv = document.getElementById('converter-error');
    const outputDiv = document.getElementById('converter-output');

    errorDiv.classList.add('hidden');

    if (!input) {
        errorDiv.textContent = 'Please enter data to convert';
        errorDiv.classList.remove('hidden');
        outputDiv.classList.add('hidden');
        return;
    }

    try {
        let result;

        if (converterMode === 'json') {
            // JSON to XML
            const json = JSON.parse(input);
            result = jsonToXML(json);
        } else {
            // XML to JSON
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(input, 'text/xml');

            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                throw new Error(parserError.textContent);
            }

            const json = xmlToJSON(xmlDoc.documentElement);
            result = JSON.stringify(json, null, 2);
        }

        document.getElementById('converter-result').textContent = result;
        outputDiv.classList.remove('hidden');

        saveToHistory('JSON/XML Converter', input.substring(0, 100), result);
    } catch (e) {
        errorDiv.textContent = `Conversion error: ${e.message}`;
        errorDiv.classList.remove('hidden');
        outputDiv.classList.add('hidden');
    }
}

function jsonToXML(obj, rootName = 'root') {
    function convert(obj, name) {
        if (obj === null || obj === undefined) {
            return `<${name}/>`;
        }

        if (typeof obj !== 'object') {
            return `<${name}>${escapeXML(String(obj))}</${name}>`;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => convert(item, 'item')).join('\n');
        }

        let content = '';
        for (const [key, value] of Object.entries(obj)) {
            content += '\n  ' + convert(value, key);
        }

        return `<${name}>${content}\n</${name}>`;
    }

    return '<?xml version="1.0" encoding="UTF-8"?>\n' + convert(obj, rootName);
}

function xmlToJSON(xml) {
    const obj = {};

    if (xml.nodeType === 1) {
        // Attributes
        if (xml.attributes.length > 0) {
            obj['@attributes'] = {};
            for (let i = 0; i < xml.attributes.length; i++) {
                const attr = xml.attributes[i];
                obj['@attributes'][attr.nodeName] = attr.nodeValue;
            }
        }
    } else if (xml.nodeType === 3) {
        return xml.nodeValue.trim();
    }

    // Children
    if (xml.hasChildNodes()) {
        for (let i = 0; i < xml.childNodes.length; i++) {
            const child = xml.childNodes[i];
            const nodeName = child.nodeName;

            if (nodeName === '#text') {
                const text = child.nodeValue.trim();
                if (text) {
                    return text;
                }
            } else {
                if (typeof obj[nodeName] === 'undefined') {
                    obj[nodeName] = xmlToJSON(child);
                } else {
                    if (!Array.isArray(obj[nodeName])) {
                        obj[nodeName] = [obj[nodeName]];
                    }
                    obj[nodeName].push(xmlToJSON(child));
                }
            }
        }
    }

    return obj;
}

function escapeXML(str) {
    return str.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ===== TEXT COMPARE (SUBLIME STYLE) =====
function compareTexts() {
    const text1 = document.getElementById('compare-text1').value;
    const text2 = document.getElementById('compare-text2').value;
    const ignoreWhitespace = document.getElementById('ignore-whitespace').checked;

    let lines1 = text1.split('\n');
    let lines2 = text2.split('\n');

    if (ignoreWhitespace) {
        lines1 = lines1.map(l => l.trim());
        lines2 = lines2.map(l => l.trim());
    }

    const resultDiv = document.getElementById('compare-result');

    // Create side-by-side diff
    const maxLines = Math.max(lines1.length, lines2.length);

    let leftHTML = '';
    let rightHTML = '';

    for (let i = 0; i < maxLines; i++) {
        const line1 = lines1[i] !== undefined ? lines1[i] : '';
        const line2 = lines2[i] !== undefined ? lines2[i] : '';

        let leftClass = '';
        let rightClass = '';
        let leftContent = line1;
        let rightContent = line2;

        if (line1 === line2) {
            // Unchanged
            leftClass = '';
            rightClass = '';
        } else if (line1 && !line2) {
            // Removed
            leftClass = 'diff-removed';
            rightClass = '';
            rightContent = '';
        } else if (!line1 && line2) {
            // Added
            leftClass = '';
            rightClass = 'diff-added';
            leftContent = '';
        } else {
            // Modified - highlight character differences
            leftClass = 'diff-modified';
            rightClass = 'diff-modified';

            const charDiff = getCharacterDiff(line1, line2);
            leftContent = charDiff.left;
            rightContent = charDiff.right;
        }

        leftHTML += `
            <div class="diff-line-wrapper ${leftClass}">
                <div class="diff-line-num">${line1 ? i + 1 : ''}</div>
                <div class="diff-line-content">${leftContent || '&nbsp;'}</div>
            </div>
        `;

        rightHTML += `
            <div class="diff-line-wrapper ${rightClass}">
                <div class="diff-line-num">${line2 ? i + 1 : ''}</div>
                <div class="diff-line-content">${rightContent || '&nbsp;'}</div>
            </div>
        `;
    }

    resultDiv.innerHTML = `
        <div class="diff-container">
            <div class="diff-pane">${leftHTML}</div>
            <div class="diff-pane">${rightHTML}</div>
        </div>
    `;

    document.getElementById('compare-output').classList.remove('hidden');

    saveToHistory('Text Compare', `${text1.substring(0, 50)} vs ${text2.substring(0, 50)}`, resultDiv.textContent);
}

function getCharacterDiff(str1, str2) {
    // Simple character-level diff highlighting
    let left = '';
    let right = '';

    const maxLen = Math.max(str1.length, str2.length);

    for (let i = 0; i < maxLen; i++) {
        const char1 = str1[i] || '';
        const char2 = str2[i] || '';

        if (char1 === char2) {
            left += escapeHTML(char1);
            right += escapeHTML(char2);
        } else {
            if (char1) left += `<span class="char-removed">${escapeHTML(char1)}</span>`;
            if (char2) right += `<span class="char-added">${escapeHTML(char2)}</span>`;
        }
    }

    return { left, right };
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ===== BASE64 TOOL =====
function setBase64Mode(mode) {
    base64Mode = mode;

    const encodeBtn = document.getElementById('base64-encode-btn');
    const decodeBtn = document.getElementById('base64-decode-btn');

    if (mode === 'encode') {
        encodeBtn.className = 'flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium transition-all';
        decodeBtn.className = 'flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium transition-all';
        document.getElementById('base64-input').placeholder = 'Enter text to encode...';
    } else {
        decodeBtn.className = 'flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium transition-all';
        encodeBtn.className = 'flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium transition-all';
        document.getElementById('base64-input').placeholder = 'Enter base64 to decode...';
    }

    processBase64();
}

function processBase64() {
    const input = document.getElementById('base64-input').value;
    const errorDiv = document.getElementById('base64-error');
    const outputDiv = document.getElementById('base64-output');

    errorDiv.classList.add('hidden');

    if (!input) {
        outputDiv.classList.add('hidden');
        return;
    }

    try {
        let result;

        if (base64Mode === 'encode') {
            result = btoa(unescape(encodeURIComponent(input)));
        } else {
            result = decodeURIComponent(escape(atob(input)));
        }

        document.getElementById('base64-result').textContent = result;
        outputDiv.classList.remove('hidden');

        saveToHistory('Base64 Tool', input.substring(0, 100), result);
    } catch (e) {
        errorDiv.textContent = `Error: ${e.message}`;
        errorDiv.classList.remove('hidden');
        outputDiv.classList.add('hidden');
    }
}

// ===== TIMESTAMP CONVERTER =====
function updateCurrentTimestamp() {
    const now = Date.now();
    const seconds = Math.floor(now / 1000);

    document.getElementById('current-timestamp').textContent = seconds;
    document.getElementById('current-datetime').textContent = new Date(now).toLocaleString();
}

function convertTimestamp() {
    const input = document.getElementById('ts-to-date-input').value.trim();
    const outputDiv = document.getElementById('ts-output');

    if (!input) {
        outputDiv.innerHTML = '';
        return;
    }

    try {
        let timestamp = parseInt(input);

        // Auto-detect if milliseconds or seconds
        if (timestamp > 10000000000) {
            timestamp = timestamp;
        } else {
            timestamp = timestamp * 1000;
        }

        const date = new Date(timestamp);
        const timezone = document.getElementById('timezone').value;

        const formats = [
            { label: 'ISO 8601', value: date.toISOString() },
            { label: 'Local String', value: date.toLocaleString('en-US', { timeZone: timezone }) },
            { label: 'UTC String', value: date.toUTCString() },
            { label: 'Date Only', value: date.toLocaleDateString('en-US', { timeZone: timezone }) },
            { label: 'Time Only', value: date.toLocaleTimeString('en-US', { timeZone: timezone }) }
        ];

        outputDiv.innerHTML = formats.map(f => `
            <div class="p-3 bg-gray-50 rounded-lg">
                <div class="text-xs text-gray-500 mb-1">${f.label}</div>
                <div class="font-mono text-sm flex items-center justify-between">
                    <span>${f.value}</span>
                    <button onclick="copyText('${f.value.replace(/'/g, "\\'")}', '${f.label}')" 
                        class="text-xs px-2 py-1 bg-white rounded hover:bg-gray-100">📋</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        outputDiv.innerHTML = `<div class="text-red-600 text-sm">Invalid timestamp</div>`;
    }
}

function convertDate() {
    const input = document.getElementById('date-to-ts-input').value;
    const outputDiv = document.getElementById('date-output');

    if (!input) {
        outputDiv.innerHTML = '';
        return;
    }

    try {
        const date = new Date(input);
        const seconds = Math.floor(date.getTime() / 1000);
        const milliseconds = date.getTime();

        outputDiv.innerHTML = `
            <div class="p-3 bg-gray-50 rounded-lg">
                <div class="text-xs text-gray-500 mb-1">Seconds</div>
                <div class="font-mono text-sm flex items-center justify-between">
                    <span>${seconds}</span>
                    <button onclick="copyText('${seconds}', 'Timestamp')" 
                        class="text-xs px-2 py-1 bg-white rounded hover:bg-gray-100">📋</button>
                </div>
            </div>
            <div class="p-3 bg-gray-50 rounded-lg">
                <div class="text-xs text-gray-500 mb-1">Milliseconds</div>
                <div class="font-mono text-sm flex items-center justify-between">
                    <span>${milliseconds}</span>
                    <button onclick="copyText('${milliseconds}', 'Timestamp')" 
                        class="text-xs px-2 py-1 bg-white rounded hover:bg-gray-100">📋</button>
                </div>
            </div>
        `;
    } catch (e) {
        outputDiv.innerHTML = `<div class="text-red-600 text-sm">Invalid date</div>`;
    }
}

function copyText(text, label) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(`${label} copied!`);
    });
}

// ===== OCP COMMAND GENERATOR (FOLLOWING PROVIDED EXAMPLES) =====
function generateOCPCommand() {
    const searchName = document.getElementById('ocp-search-name').value.trim();
    const searchValue = document.getElementById('ocp-search-value').value.trim();

    if (!searchName && !searchValue) {
        showToast('Please provide at least one search criteria (name or value)', 'error');
        return;
    }

    let command = '';

    if (searchName && searchValue) {
        // Search by both name and value
        command = `oc get dc -o json | jq -r '.items[] | . as $dc | .spec.template.spec.containers[].env[]? | select(.name == "${searchName}" and .value == "${searchValue}") | "\\($dc.metadata.name): \\(.name)=\\(.value)"'`;
    } else if (searchName) {
        // Search by name only (following the example)
        command = `oc get dc -o json | jq -r '.items[] | . as $dc | .spec.template.spec.containers[].env[]? | select(.name == "${searchName}") | "\\($dc.metadata.name): \\(.name)=\\(.value)"'`;
    } else if (searchValue) {
        // Search by value only (following the example)
        command = `oc get dc -o json | jq -r '.items[] | . as $dc | .spec.template.spec.containers[].env[]? | select(.value == "${searchValue}") | "\\($dc.metadata.name): \\(.name)=\\(.value)"'`;
    }

    document.getElementById('ocp-result').textContent = command;
    document.getElementById('ocp-output').classList.remove('hidden');

    saveToHistory('OCP Command Generator', `name: ${searchName || 'any'}, value: ${searchValue || 'any'}`, command);
}

// ===== JSON DIFF TOOL =====
const jdIgnoreRules = [];

function jdParseIgnoreRule(rule) {
    const dot = rule.lastIndexOf('.');
    if (dot === -1) return { scope: null, key: rule };
    return { scope: rule.substring(0, dot), key: rule.substring(dot + 1) };
}

function jdRenderIgnoreTags() {
    const wrap = document.getElementById('jd-ignore-keys-wrap');
    wrap.querySelectorAll('.jd-tag-chip').forEach(el => el.remove());
    const input = document.getElementById('jd-ignore-keys-input');
    for (let i = 0; i < jdIgnoreRules.length; i++) {
        const rule = jdIgnoreRules[i];
        const { scope, key } = jdParseIgnoreRule(rule);
        const isScoped = scope !== null;
        const chip = document.createElement('span');
        chip.className = 'jd-tag-chip ' + (isScoped ? 'jd-tag-scoped' : '');
        const label = isScoped
            ? `<span class="jd-tag-scope">${escapeHTML(scope)}.</span>${escapeHTML(key)}`
            : escapeHTML(key);
        chip.innerHTML = `${label}<span class="jd-tag-remove" data-idx="${i}">&times;</span>`;
        wrap.insertBefore(chip, input);
    }
}

// Initialize ignore keys input
document.addEventListener('DOMContentLoaded', () => {
    const ignoreInput = document.getElementById('jd-ignore-keys-input');
    if (ignoreInput) {
        ignoreInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const val = e.target.value.trim();
                if (val && !jdIgnoreRules.includes(val)) {
                    jdIgnoreRules.push(val);
                    jdRenderIgnoreTags();
                }
                e.target.value = '';
            }
            if (e.key === 'Backspace' && e.target.value === '' && jdIgnoreRules.length > 0) {
                jdIgnoreRules.pop();
                jdRenderIgnoreTags();
            }
        });
    }

    const ignoreWrap = document.getElementById('jd-ignore-keys-wrap');
    if (ignoreWrap) {
        ignoreWrap.addEventListener('click', (e) => {
            if (e.target.classList.contains('jd-tag-remove')) {
                const idx = parseInt(e.target.dataset.idx, 10);
                jdIgnoreRules.splice(idx, 1);
                jdRenderIgnoreTags();
            }
        });
    }
});

function jdDeepRemoveKeys(val, rules, currentPath) {
    if (val === null || typeof val !== 'object') return val;
    if (Array.isArray(val)) {
        return val.map(v => jdDeepRemoveKeys(v, rules, currentPath + '.[]'));
    }
    const out = {};
    for (const [k, v] of Object.entries(val)) {
        const childPath = currentPath ? currentPath + '.' + k : k;
        let shouldIgnore = false;
        for (const rule of rules) {
            const { scope, key } = jdParseIgnoreRule(rule);
            if (key !== k) continue;
            if (scope === null) { shouldIgnore = true; break; }
            const normalizedCurrent = currentPath.replace(/\.\[\]/g, '');
            if (normalizedCurrent === scope || currentPath === scope || normalizedCurrent.endsWith('.' + scope) || currentPath.endsWith('.' + scope)) {
                shouldIgnore = true; break;
            }
            const scopeParts = scope.split('.');
            const pathSegments = currentPath.replace(/\.\[\]/g, '').split('.').filter(Boolean);
            if (scopeParts.length === 1) {
                if (pathSegments.includes(scopeParts[0])) { shouldIgnore = true; break; }
            } else {
                const scopeStr = scopeParts.join('.');
                const pathStr = pathSegments.join('.');
                if (pathStr === scopeStr || pathStr.endsWith('.' + scopeStr)) { shouldIgnore = true; break; }
            }
        }
        if (shouldIgnore) continue;
        out[k] = jdDeepRemoveKeys(v, rules, childPath);
    }
    return out;
}

function jdDeepSortValue(val, sortKey) {
    if (val === null || typeof val !== 'object') return val;
    if (Array.isArray(val)) {
        const sorted = val.map(v => jdDeepSortValue(v, sortKey));
        sorted.sort((a, b) => {
            if (sortKey && typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
                const ka = String(a[sortKey] || '');
                const kb = String(b[sortKey] || '');
                if (ka !== kb) return ka.localeCompare(kb);
            }
            return JSON.stringify(a).localeCompare(JSON.stringify(b));
        });
        return sorted;
    }
    const sortedObj = {};
    for (const k of Object.keys(val).sort()) {
        sortedObj[k] = jdDeepSortValue(val[k], sortKey);
    }
    return sortedObj;
}

function jdLcsLines(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    const result = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
        if (a[i - 1] === b[j - 1]) { result.push({ type: 'equal', left: i - 1, right: j - 1 }); i--; j--; }
        else if (dp[i - 1][j] >= dp[i][j - 1]) { result.push({ type: 'del', left: i - 1 }); i--; }
        else { result.push({ type: 'add', right: j - 1 }); j--; }
    }
    while (i > 0) { result.push({ type: 'del', left: i - 1 }); i--; }
    while (j > 0) { result.push({ type: 'add', right: j - 1 }); j--; }
    return result.reverse();
}

function jdInlineDiff(oldStr, newStr) {
    const oldWords = oldStr.split(/(\s+)/);
    const newWords = newStr.split(/(\s+)/);
    const m = oldWords.length, n = newWords.length;
    const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = oldWords[i - 1] === newWords[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    const ops = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
        if (oldWords[i - 1] === newWords[j - 1]) { ops.push({ t: 'eq', oi: i - 1, ni: j - 1 }); i--; j--; }
        else if (dp[i - 1][j] >= dp[i][j - 1]) { ops.push({ t: 'del', oi: i - 1 }); i--; }
        else { ops.push({ t: 'add', ni: j - 1 }); j--; }
    }
    while (i > 0) { ops.push({ t: 'del', oi: i - 1 }); i--; }
    while (j > 0) { ops.push({ t: 'add', ni: j - 1 }); j--; }
    ops.reverse();
    let leftHtml = '', rightHtml = '';
    for (const op of ops) {
        if (op.t === 'eq') {
            const esc = escapeHTML(oldWords[op.oi]);
            leftHtml += esc; rightHtml += esc;
        } else if (op.t === 'del') {
            leftHtml += `<span class="jd-hl-del">${escapeHTML(oldWords[op.oi])}</span>`;
        } else {
            rightHtml += `<span class="jd-hl-add">${escapeHTML(newWords[op.ni])}</span>`;
        }
    }
    return { leftHtml, rightHtml };
}

function jdBuildDiffRows(linesA, linesB) {
    const ops = jdLcsLines(linesA, linesB);
    const rows = [];
    let i = 0;
    while (i < ops.length) {
        if (ops[i].type === 'equal') {
            rows.push({ type: 'equal', left: linesA[ops[i].left], right: linesB[ops[i].right], ln1: ops[i].left + 1, ln2: ops[i].right + 1 });
            i++;
        } else {
            const dels = [], adds = [];
            while (i < ops.length && ops[i].type !== 'equal') {
                if (ops[i].type === 'del') dels.push(ops[i].left);
                else adds.push(ops[i].right);
                i++;
            }
            const pairs = Math.min(dels.length, adds.length);
            for (let p = 0; p < pairs; p++) {
                rows.push({ type: 'mod', left: linesA[dels[p]], right: linesB[adds[p]], ln1: dels[p] + 1, ln2: adds[p] + 1 });
            }
            for (let p = pairs; p < dels.length; p++) {
                rows.push({ type: 'del', left: linesA[dels[p]], ln1: dels[p] + 1 });
            }
            for (let p = pairs; p < adds.length; p++) {
                rows.push({ type: 'add', right: linesB[adds[p]], ln2: adds[p] + 1 });
            }
        }
    }
    return rows;
}

function jdRenderDiff(rows, collapseEqual) {
    const container = document.getElementById('jd-output');
    let adds = 0, dels = 0, mods = 0;
    rows.forEach(r => { if (r.type === 'add') adds++; else if (r.type === 'del') dels++; else if (r.type === 'mod') mods++; });

    let html = `<div class="flex items-center justify-between mb-3 p-3 bg-gray-50 rounded-lg text-sm">
        <span class="text-gray-500 font-medium">payload1.json ↔ payload2.json</span>
        <div class="flex gap-4 font-semibold">
            <span class="text-green-600">+${adds} added</span>
            <span class="text-red-600">−${dels} removed</span>
            <span class="text-yellow-600">~${mods} modified</span>
        </div>
    </div>`;

    html += '<div class="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto"><table class="jd-diff-table"><tbody>';

    let i = 0;
    while (i < rows.length) {
        const r = rows[i];
        if (r.type === 'equal' && collapseEqual) {
            const eqStart = i;
            while (i < rows.length && rows[i].type === 'equal') i++;
            const eqCount = i - eqStart;
            if (eqCount > 6) {
                for (let e = eqStart; e < eqStart + 3; e++) html += jdEqualRow(rows[e]);
                const hidden = eqCount - 6;
                const collapseId = 'jd_collapse_' + eqStart;
                html += `<tr class="jd-collapse-row" onclick="jdExpandCollapsed('${collapseId}', this)">
                    <td colspan="7">⤵ ${hidden} unchanged lines hidden — click to expand</td>
                </tr>`;
                html += `<tbody id="${collapseId}" style="display:none">`;
                for (let e = eqStart + 3; e < i - 3; e++) html += jdEqualRow(rows[e]);
                html += `</tbody>`;
                for (let e = i - 3; e < i; e++) html += jdEqualRow(rows[e]);
            } else {
                for (let e = eqStart; e < i; e++) html += jdEqualRow(rows[e]);
            }
        } else {
            html += jdDiffRow(r);
            i++;
        }
    }

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function jdEqualRow(r) {
    const esc = escapeHTML(r.left);
    return `<tr class="jd-row-equal">
        <td class="jd-ln">${r.ln1}</td><td class="jd-gutter"></td><td class="jd-content">${esc}</td>
        <td class="jd-sep"></td>
        <td class="jd-ln">${r.ln2}</td><td class="jd-gutter"></td><td class="jd-content">${esc}</td>
    </tr>`;
}

function jdDiffRow(r) {
    if (r.type === 'del') {
        return `<tr class="jd-row-del">
            <td class="jd-ln">${r.ln1}</td><td class="jd-gutter">−</td><td class="jd-content">${escapeHTML(r.left)}</td>
            <td class="jd-sep"></td>
            <td class="jd-ln"></td><td class="jd-gutter"></td><td class="jd-content"></td>
        </tr>`;
    }
    if (r.type === 'add') {
        return `<tr class="jd-row-add">
            <td class="jd-ln"></td><td class="jd-gutter"></td><td class="jd-content"></td>
            <td class="jd-sep"></td>
            <td class="jd-ln">${r.ln2}</td><td class="jd-gutter">+</td><td class="jd-content">${escapeHTML(r.right)}</td>
        </tr>`;
    }
    if (r.type === 'mod') {
        const { leftHtml, rightHtml } = jdInlineDiff(r.left, r.right);
        return `<tr class="jd-row-mod-left">
            <td class="jd-ln">${r.ln1}</td><td class="jd-gutter">−</td><td class="jd-content">${leftHtml}</td>
            <td class="jd-sep"></td>
            <td class="jd-ln">${r.ln2}</td><td class="jd-gutter">+</td><td class="jd-content">${rightHtml}</td>
        </tr>`;
    }
    return '';
}

function jdExpandCollapsed(id, triggerRow) {
    const tbody = document.getElementById(id);
    if (tbody) { tbody.style.display = ''; triggerRow.style.display = 'none'; }
}

function jdCompare() {
    const raw1 = document.getElementById('jd-input1').value.trim();
    const raw2 = document.getElementById('jd-input2').value.trim();
    if (!raw1 || !raw2) { showToast('Please paste JSON in both fields', 'error'); return; }

    let obj1, obj2;
    try { obj1 = JSON.parse(raw1); } catch (e) { showToast('Payload 1: Invalid JSON — ' + e.message, 'error'); return; }
    try { obj2 = JSON.parse(raw2); } catch (e) { showToast('Payload 2: Invalid JSON — ' + e.message, 'error'); return; }

    const ignoreOrder = document.getElementById('jd-opt-sort').checked;
    const sortKey = document.getElementById('jd-opt-sort-key').value.trim();
    const collapseEqual = document.getElementById('jd-opt-collapse').checked;

    if (jdIgnoreRules.length > 0) {
        obj1 = jdDeepRemoveKeys(obj1, jdIgnoreRules, '');
        obj2 = jdDeepRemoveKeys(obj2, jdIgnoreRules, '');
    }

    if (ignoreOrder) {
        obj1 = jdDeepSortValue(obj1, sortKey || null);
        obj2 = jdDeepSortValue(obj2, sortKey || null);
    }

    const json1 = JSON.stringify(obj1, null, 2);
    const json2 = JSON.stringify(obj2, null, 2);
    const rows = jdBuildDiffRows(json1.split('\n'), json2.split('\n'));
    jdRenderDiff(rows, collapseEqual);
}

function jdClear() {
    document.getElementById('jd-input1').value = '';
    document.getElementById('jd-input2').value = '';
    document.getElementById('jd-output').innerHTML = '<div class="text-center text-gray-400 py-12"><p>Paste two JSON payloads above and click <strong>Compare</strong> to see a side-by-side diff.</p></div>';
}

function jdLoadSample() {
    document.getElementById('jd-input1').value = JSON.stringify({
        "meta": { "transaction_id": "C002200813135016554547996", "channel": "A6", "status_code": "RV-0000", "status_desc": "Success" },
        "service_id_a": { "service_id": "666666660216", "service_type": "Indihome" },
        "added_offers": [
            { "rfs_id": "PCRF_00112075_INETFN75M", "action": "ADD", "technician_appointment": "false", "resource_reservation": "false", "source_system": "PCRF", "service_type": "Fiber" },
            { "rfs_id": "nte_00112075_SWONTDUALB", "action": "NONE", "technician_appointment": "false", "resource_reservation": "false", "source_system": "nte", "service_type": "ONT" }
        ],
        "removed_offers": [
            { "bundle_transaction_id": "k41970f971a89ML3", "active_offer_id": "k41970f971a41l", "action": "DEL", "source_system": "nbp", "service_type": "Fiber", "service_id": "666666660216", "allowance_subtype": "Video - Fita", "technician_appointment": "false" },
            { "bundle_transaction_id": "k41970f971a89ML3", "active_offer_id": "k41970f971a41l", "action": "DEL", "source_system": "nbp", "service_type": "Fiber", "service_id": "666666660216", "allowance_subtype": "FBB - Internet Reguler", "technician_appointment": "false" }
        ]
    }, null, 2);

    document.getElementById('jd-input2').value = JSON.stringify({
        "meta": { "transaction_id": "C002200813135016554547996", "channel": "A6", "status_code": "RV-0000", "status_desc": "Success" },
        "service_id_a": { "service_id": "666666660216", "service_type": "Indihome" },
        "added_offers": [
            { "rfs_id": "PCRF_00112075_INETFN75M", "action": "ADD", "technician_appointment": "false", "resource_reservation": "false", "source_system": "PCRF", "service_type": "Fiber" },
            { "rfs_id": "nte_00112075_SWONTDUALB", "action": "NONE", "technician_appointment": "false", "resource_reservation": "false", "source_system": "nte", "service_type": "ONT" }
        ],
        "removed_offers": [
            { "bundle_transaction_id": "k41970f971a89ML3", "active_offer_id": "k41970f971a41l", "action": "DEL", "source_system": "nbp", "service_type": "Fiber", "service_id": "666666660216", "allowance_subtype": "IPTV - Basic Service", "technician_appointment": "false" },
            { "bundle_transaction_id": "k41970f971a89ML3", "active_offer_id": "k41970f971a41l", "action": "DEL", "source_system": "pcrf", "service_type": "Fiber", "service_id": "666666660216", "allowance_subtype": "FBB - Internet Reguler", "technician_appointment": "false" }
        ]
    }, null, 2);

    showToast('Sample payloads loaded');
}

// ===== URL ENCODER/DECODER =====
let urlCodecMode = 'decode';

function setUrlCodecMode(mode) {
    urlCodecMode = mode;
    const encodeBtn = document.getElementById('url-encode-btn');
    const decodeBtn = document.getElementById('url-decode-btn');

    if (mode === 'decode') {
        decodeBtn.className = 'flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium transition-all';
        encodeBtn.className = 'flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium transition-all';
        document.getElementById('url-codec-input').placeholder = 'Paste URL-encoded string here, e.g. hello%20world%2Fpath%3Fkey%3Dvalue';
    } else {
        encodeBtn.className = 'flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium transition-all';
        decodeBtn.className = 'flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium transition-all';
        document.getElementById('url-codec-input').placeholder = 'Enter text to URL-encode, e.g. hello world/path?key=value';
    }

    processUrlCodec();
}

function processUrlCodec() {
    const input = document.getElementById('url-codec-input').value;
    const errorDiv = document.getElementById('url-codec-error');
    const resultPre = document.getElementById('url-codec-result');

    errorDiv.classList.add('hidden');

    if (!input) {
        resultPre.textContent = '';
        return;
    }

    try {
        let result;
        if (urlCodecMode === 'decode') {
            result = decodeURIComponent(input);
        } else {
            result = encodeURIComponent(input);
        }

        resultPre.textContent = result;
        saveToHistory('URL Encoder/Decoder', input.substring(0, 100), result);
    } catch (e) {
        errorDiv.textContent = `Error: ${e.message}`;
        errorDiv.classList.remove('hidden');
        resultPre.textContent = '';
    }
}
