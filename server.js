require('dotenv').config();

const express = require('express');
const axios = require('axios');
const path = require('path');

process.on('uncaughtException', err => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', err => {
    console.error('UNHANDLED REJECTION:', err);
});

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ROBLOX_API_KEY;
const UNIVERSE_ID = process.env.UNIVERSE_ID;

console.log('========================');
console.log('SERVER STARTING');
console.log('Universe ID:', UNIVERSE_ID);
console.log('API Key Loaded:', !!API_KEY);
console.log('========================');

const GAMEPASS_API_URL =
    `https://apis.roblox.com/cloud/v2/universes/${UNIVERSE_ID}/game-passes`;

const DEVPRODUCT_API_URL =
    `https://apis.roblox.com/developer-products/v2/universes/${UNIVERSE_ID}/developer-products`;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/export-csv', async (req, res) => {
    const { scriptText } = req.body;

    const regex = /\[(\d+)\]\s*=\s*\{([\s\S]*?)\}/g;

    let match;
    const rows = [];

    while ((match = regex.exec(scriptText)) !== null) {
        const id = match[1];
        const block = match[2];

        const display =
            /\["Display"\]\s*=\s*"([^"]+)"/.exec(block)?.[1] ||
            "Unknown";

        const type =
            /\["Type"\]\s*=\s*"([^"]+)"/.exec(block)?.[1] ||
            "Unknown";

        rows.push({
            oldId: id,
            name: display,
            type
        });
    }

    res.json(rows);
});;
