const https = require('https');

const GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycby2ky5rtx_zS21UfaM8P6hSCiDoB4naLFhOemtaLDp9sm-2UDX4-RRMAqXspgHIaDwmqA/exec';

// Send result to Google Sheets
function sendToGoogleSheets(data) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(data);
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
            resolve();
        });

        req.write(payload);
        req.end();
    });
}

// Vercel serverless function - receives results and saves to Google Sheets
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
        name,
        speedMbps,
        downloadedMB,
        duration,
        connectionType,
        rtt,
        downlinkEstimate,
        dataSaver,
        platform,
        userAgent
    } = req.body || {};

    if (!name || !speedMbps) {
        return res.status(400).json({ error: 'Name and speed data are required' });
    }

    const speed = parseFloat(speedMbps);
    let quality = 'Excellent';
    if (speed < 25) quality = 'Fair';
    if (speed < 5) quality = 'Poor';

    const timestamp = new Date().toLocaleString();

    try {
        await sendToGoogleSheets({
            name,
            timestamp,
            speedMbps,
            quality,
            downloadedMB,
            duration,
            connectionType: connectionType || 'Unknown',
            rtt: rtt || 'N/A',
            downlinkEstimate: downlinkEstimate || 'N/A',
            dataSaver: dataSaver || 'No',
            platform: platform || 'Unknown',
            userAgent: userAgent || 'Unknown'
        });

        return res.status(200).json({ status: 'ok', quality });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
