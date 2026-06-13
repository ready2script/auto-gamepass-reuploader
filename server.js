require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ROBLOX_API_KEY;
const UNIVERSE_ID = process.env.UNIVERSE_ID;

const ROBLOX_API_URL = `https://apis.roblox.com/cloud/v2/universes/${UNIVERSE_ID}/game-passes`;

// Migration API Endpoint
app.post('/api/migrate', async (req, res) => {
    const { scriptText } = req.body;

    if (!API_KEY || !UNIVERSE_ID) {
        return res.status(500).json({ 
            success: false, 
            error: "Server configuration missing. Please ensure ROBLOX_API_KEY and UNIVERSE_ID are set in your environment variables." 
        });
    }

    if (!scriptText) {
        return res.status(400).json({ success: false, error: "No script text provided." });
    }

    // Regex to match dictionary blocks like [3479991058] = { ... }
    const blockRegex = /\[(\d+)\]\s*=\s*\{([\s\S]*?)\}/g;
    let match;
    const mappings = {};

    // Phase 1: Parse the script to extract old IDs and their associated display names
    while ((match = blockRegex.exec(scriptText)) !== null) {
        const oldId = match[1];
        const blockContent = match[2];
        
        // Find the value assigned to "Display"
        const displayMatch = /\["Display"\]\s*=\s*"([^"]+)"/.exec(blockContent) || /Display\s*=\s*"([^"]+)"/.exec(blockContent);
        
        if (displayMatch && !mappings[oldId]) {
            mappings[oldId] = {
                name: displayMatch[1],
                newId: null,
                status: 'Pending'
            };
        }
    }

    const totalAssets = Object.keys(mappings).length;
    if (totalAssets === 0) {
        return res.status(400).json({ success: false, error: "No valid configuration items or 'Display' fields detected in the provided script text." });
    }

    console.log(`[Migration] Found ${totalAssets} unique assets to re-upload.`);

    // Phase 2: Sequential execution loop to hit the Roblox Open Cloud API
    for (const oldId in mappings) {
        const assetName = mappings[oldId].name;
        console.log(`[Roblox API] Creating gamepass: "${assetName}"...`);

        try {
            const response = await axios.post(ROBLOX_API_URL, {
                displayName: assetName,
                description: "Auto-migrated configuration asset."
            }, {
                headers: {
                    'x-api-key': API_KEY,
                    'content-type': 'application/json'
                }
            });

            // Open Cloud returns resource path format: "universes/X/game-passes/Y"
            const resourceName = response.data.name;
            const newId = resourceName.split('/').pop();

            mappings[oldId].newId = newId;
            mappings[oldId].status = 'Success';
            console.log(`[Success] Mapped Old ID ${oldId} -> New ID ${newId}`);

            // 1-second cooldown per loop to respect Roblox Open Cloud rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            mappings[oldId].status = 'Failed';
            console.error(`[Error] Failed to migrate asset "${assetName}" (${oldId}):`, error.response ? error.response.data : error.message);
        }
    }

    // Phase 3: Token replacement inside the original string layout
    let updatedScript = scriptText;
    for (const oldId in mappings) {
        if (mappings[oldId].newId) {
            // Replaces bracketed instances safely like [3385875609] -> [NewID]
            const regex = new RegExp(`\\[${oldId}\\]`, 'g');
            updatedScript = updatedScript.replace(regex, `[${mappings[oldId].newId}]`);
        }
    }

    res.json({
        success: true,
        updatedScript: updatedScript,
        summary: mappings
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Automated Migration Backend listening on port ${PORT}`);
});
