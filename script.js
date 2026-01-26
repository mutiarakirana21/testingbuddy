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
    ['curl-url', 'curl-method', 'curl-resolve', 'curl-body'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', generateCurl);
    });
});

// Navigation
function switchTool(toolId) {
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
    event.target.classList.add('active');

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
        // Escape quotes in body
        const escapedBody = body.replace(/"/g, '\\"');
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
