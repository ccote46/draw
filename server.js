const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

const HISTORY_FILE = path.join(__dirname, 'drawing-history.json');

// Load history from file
let drawingHistory = [];
let saveTimeout = null;

function loadDrawingHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            drawingHistory = JSON.parse(data);
            console.log(`Loaded ${drawingHistory.length} drawing actions`);
        }
    } catch (err) {
        console.error("Error loading history:", err);
    }
}

function saveDrawingHistory() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(drawingHistory), 'utf8');
    } catch (err) {
        console.error("Error saving history:", err);
    }
}

function debouncedSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveDrawingHistory, 1000);
}

// Load on startup
loadDrawingHistory();

// WebSocket connections
wss.on('connection', (ws) => {
    console.log("Client connected");

    // Send drawing history to new client
    ws.send(JSON.stringify({ type: 'init', history: drawingHistory }));

    ws.on('message', (message) => {
        console.log("SERVER RECEIVED:", message);

        const data = JSON.parse(message);

        if (data.type === 'draw') {
            drawingHistory.push(data);
            debouncedSave();
        }

        if (data.type === 'clear') {
            drawingHistory = [];
            saveDrawingHistory();
        }

        // BROADCAST TO ALL CLIENTS (including sender)
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                console.log("SERVER BROADCASTING:", message);
                client.send(message);
            }
        });
    });

    ws.on('close', () => console.log("Client disconnected"));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log("Server running on http://localhost:" + PORT);
});
