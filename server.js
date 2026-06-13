require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ROBLOX_API_KEY;
const UNIVERSE_ID = process.env.UNIVERSE_ID;

// Roblox Open Cloud Base URLs
const GAMEPASS_API_URL = `https://apis.roblox.com/cloud/v2/universes/${UNIVERSE_ID}/game-passes`;
const DEVPRODUCT_API_URL = `https://apis.roblox.com/developer-products/v2/universes/${UNIVERSE_ID}/developer-products`;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/migrate', async (req, res) => {
    const { scriptText } = req.body;
    if (!scriptText) return res.status(400).json({ success: false, error: "No script text provided." });

    const blockRegex = /\\s*\\[(\\d+)\\]\\s*=\\s*\\{([\\s\\S]*?)\\}/g;
    let match;
    const mappings = {};

    while ((match = blockRegex.exec(scriptText)) !== null) {
        const oldId = match[1];
        const blockContent = match[2];
        
        const displayMatch = /\\["Display"\\]\\s*=\\s*"([^"]+)"/.exec(blockContent) || /Display\\s*=\\s*"([^"]+)"/.exec(blockContent);
        const typeMatch = /\\["Type"\\]\\s*=\\s*"([^"]+)"/.exec(blockContent) || /Type\\s*=\\s*"([^"]+)"/.exec(blockContent);
        
        if (displayMatch && !mappings[oldId]) {
            const assetName = displayMatch[1];
            const assetType = typeMatch ? typeMatch[1] : "DeveloperProduct"; // Fallback default
            
            // Determine if it should be treated as a Game Pass or Developer Product
            const isGamePass = assetType.toLowerCase().includes("gamepass");

            mappings[oldId] = {
                name: assetName,
                isGamePass: isGamePass,
                newId: null,
                status: 'Pending'
            };
        }
    }

    // Process Loop
    for (const oldId in mappings) {
        const item = mappings[oldId];
        try {
            let response;
            
            if (item.isGamePass) {
                // Upload to Game Pass Endpoint
                response = await axios.post(GAMEPASS_API_URL, {
                    displayName: item.name,
                    description: "Migrated Game Pass"
                }, { headers: { 'x-api-key': API_KEY, 'content-type': 'application/json' } });
                
                const resourceName = response.data.name;
                item.newId = resourceName.split('/').pop();
            } else {
                // Upload to Developer Product Endpoint
                response = await axios.post(DEVPRODUCT_API_URL, {
                    displayName: item.name,
                    description: "Migrated Developer Product",
                    price: 10 // Default placeholder price requirement for dev products
                }, { headers: { 'x-api-key': API_KEY, 'content-type': 'application/json' } });
                
                // Dev products return JSON containing a direct numeric id or productId field
                item.newId = response.data.productId || response.data.id;
            }

            item.status = 'Success';
            await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit buffer
        } catch (error) {
            item.status = 'Failed';
            console.error(`Failed asset: ${item.name}`, error.response ? error.response.data : error.message);
        }
    }

    // Replace IDs in string
    let updatedScript = scriptText;
    for (const oldId in mappings) {
        if (mappings[oldId].newId) {
            const regex = new RegExp(`\\\\[${oldId}\\\\]`, 'g');
            updatedScript = updatedScript.replace(regex, `[${mappings[oldId].newId}]`);
        }
    }

    res.json({ success: true, updatedScript, summary: mappings });
});

app.listen(PORT, () => console.log(`🚀 Migrator active on port ${PORT}`));
