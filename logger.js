// logger.js
const fs = require('fs');
const path = require('path');

const LOG_FILE_PATH = path.resolve(__dirname, 'run-log.html');

/**
 * Creates or clears the log file and writes the initial HTML structure.
 */
function init() {
    const initialContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="5">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Automation Log</title>
    <style>
        body { font-family: Consolas, "Courier New", monospace; background-color: #1e1e1e; color: #d4d4d4; margin: 0; padding: 20px; font-size: 14px; }
        .log { white-space: pre-wrap; word-wrap: break-word; }
        .log-info { color: #d4d4d4; }
        .log-warn { color: #ffd700; }
        .log-error { color: #f44336; font-weight: bold; }
        .log-success { color: #4caf50; font-weight: bold; }
    </style>
</head>
<body>
    <h1>Automation Run Log</h1>
    <p>This page will auto-refresh every 5 seconds.</p>
    <div id="log-container"></div>
    <script>
        // Scroll to the bottom on load
        window.scrollTo(0, document.body.scrollHeight);
    </script>
</body>
</html>`;
    fs.writeFileSync(LOG_FILE_PATH, initialContent);
    console.log(`📝 UI log created. Open this file in your browser: ${LOG_FILE_PATH}`);
}

/**
 * Appends a message to the log file and prints to console.
 * @param {string} message The message to log.
 * @param {'info' | 'warn' | 'error' | 'success'} level The log level.
 */
function write(message, level = 'info') {
    // Also log to the console
    const consoleMap = {
        info: console.log,
        warn: console.warn,
        error: console.error,
        success: console.log,
    };
    consoleMap[level](message);

    // Append to the HTML log file
    const timestamp = new Date().toISOString();
    const logEntryHtml = `<div class="log log-${level}">[${timestamp}] ${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>\n`;

    try {
        let html = fs.readFileSync(LOG_FILE_PATH, 'utf8');
        const insertionPoint = '</div>';
        const insertionIndex = html.lastIndexOf(insertionPoint);
        html = html.slice(0, insertionIndex) + logEntryHtml + html.slice(insertionIndex);
        fs.writeFileSync(LOG_FILE_PATH, html);
    } catch (e) {
        // If the file doesn't exist, init() should have been called, but this is a safeguard.
        console.error('Could not write to log file. It may not have been initialized.', e);
    }
}

module.exports = {
    init,
    log: (message) => write(message, 'info'),
    warn: (message) => write(message, 'warn'),
    error: (message) => write(message, 'error'),
    success: (message) => write(message, 'success'),
};