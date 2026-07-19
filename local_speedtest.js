const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycby2ky5rtx_zS21UfaM8P6hSCiDoB4naLFhOemtaLDp9sm-2UDX4-RRMAqXspgHIaDwmqA/exec';

// Send result to Google Sheets via Apps Script
function sendToGoogleSheets(name, result) {
    const timestamp = new Date().toLocaleString();

    const speed = parseFloat(result.speedMbps);
    let quality = 'Excellent';
    if (speed < 25) quality = 'Fair';
    if (speed < 5) quality = 'Poor';

    const payload = JSON.stringify({
        name: name,
        timestamp: timestamp,
        speedMbps: result.speedMbps,
        downloadedMB: result.downloadedMB,
        duration: result.duration,
        quality: quality
    });

    const url = new URL(GOOGLE_SHEET_URL);

    const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = https.request(options, (res) => {
        // Google Apps Script redirects (302) on success
        if (res.statusCode === 302 || res.statusCode === 200) {
            console.log(`Result for "${name}" sent to Google Sheets`);
        } else {
            console.log(`Google Sheets responded with status: ${res.statusCode}`);
        }
        res.resume(); // Consume response to free up memory
    });

    req.on('error', (err) => {
        console.error('Error sending to Google Sheets:', err.message);
    });

    req.write(payload);
    req.end();
}

// The speed test logic
function checkDownloadSpeed(callback) {
    const startTime = Date.now();
    const downloadUrl = 'https://speed.cloudflare.com/__down?bytes=25000000';

    https.get(downloadUrl, (res) => {
        let downloadedBytes = 0;

        res.on('data', (chunk) => {
            downloadedBytes += chunk.length;
        });

        res.on('end', () => {
            const endTime = Date.now();
            const durationInSeconds = (endTime - startTime) / 1000;
            const bitsLoaded = downloadedBytes * 8;
            const speedMbps = (bitsLoaded / durationInSeconds / 1000000).toFixed(2);

            const result = {
                speedMbps: speedMbps,
                duration: durationInSeconds.toFixed(2),
                downloadedMB: (downloadedBytes / 1024 / 1024).toFixed(2)
            };

            console.log(`Speed: ${speedMbps} Mbps | Data: ${result.downloadedMB} MB | Time: ${result.duration}s`);
            callback(null, result);
        });
    }).on('error', (err) => {
        callback(err, null);
    });
}

// Parse JSON body from a POST request
function parseBody(req, callback) {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
        try {
            callback(null, JSON.parse(body));
        } catch (e) {
            callback(e, null);
        }
    });
}

// Web server
const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'network_test.html'), (err, content) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading HTML');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(content);
            }
        });
    }
    else if (req.url === '/api/speedtest' && req.method === 'POST') {
        parseBody(req, (err, body) => {
            if (err || !body.name) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Name is required' }));
                return;
            }

            const userName = body.name;

            checkDownloadSpeed((err, result) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: err.message }));
                } else {
                    // Send to Google Sheets
                    sendToGoogleSheets(userName, result);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                }
            });
        });
    }
    else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});