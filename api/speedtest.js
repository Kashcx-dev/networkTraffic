const https = require('https');

const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycby2ky5rtx_zS21UfaM8P6hSCiDoB4naLFhOemtaLDp9sm-2UDX4-RRMAqXspgHIaDwmqA/exec';

// Send result to Google Sheets
function sendToGoogleSheets(name, result) {
    return new Promise((resolve, reject) => {
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
            res.resume();
            resolve();
        });

        req.on('error', (err) => {
            console.error('Error sending to Google Sheets:', err.message);
            resolve(); // Don't fail the request even if Sheets fails
        });

        req.write(payload);
        req.end();
    });
}

// Speed test logic
function checkDownloadSpeed() {
    return new Promise((resolve, reject) => {
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

                resolve({
                    speedMbps: speedMbps,
                    duration: durationInSeconds.toFixed(2),
                    downloadedMB: (downloadedBytes / 1024 / 1024).toFixed(2)
                });
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

// Vercel serverless function handler
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name } = req.body || {};

    if (!name) {
        return res.status(400).json({ error: 'Name is required' });
    }

    try {
        const result = await checkDownloadSpeed();
        await sendToGoogleSheets(name, result);
        return res.status(200).json(result);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
