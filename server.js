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
    console.log("==== MIGRATION START ====");

    const { scriptText } = req.body;

    if (!scriptText) {
        return res.status(400).json({
            success: false,
            error: "No script text provided."
        });
    }

    console.log("Script length:", scriptText.length);
    console.log("Universe ID:", UNIVERSE_ID);
    console.log("API Key Loaded:", !!API_KEY);

    const mappings = {};

    const blockRegex = /\[(\d+)\]\s*=\s*\{([\s\S]*?)\}/g;

    let match;

    while ((match = blockRegex.exec(scriptText)) !== null) {
        const oldId = match[1];
        const blockContent = match[2];

        const displayMatch =
            /\["Display"\]\s*=\s*"([^"]+)"/.exec(blockContent) ||
            /Display\s*=\s*"([^"]+)"/.exec(blockContent);

        const typeMatch =
            /\["Type"\]\s*=\s*"([^"]+)"/.exec(blockContent) ||
            /Type\s*=\s*"([^"]+)"/.exec(blockContent);

        if (displayMatch) {
            const name = displayMatch[1];
            const type = typeMatch ? typeMatch[1] : "DeveloperProduct";

            mappings[oldId] = {
                name,
                type,
                status: "Pending",
                newId: null
            };
        }
    }

    console.log("Products Found:", Object.keys(mappings).length);

    if (Object.keys(mappings).length === 0) {
        return res.json({
            success: false,
            error: "Regex found 0 products."
        });
    }

    for (const oldId in mappings) {
        const item = mappings[oldId];

        try {
            console.log(`Creating ${item.name}`);

            const isGamePass =
                item.type.toLowerCase() === "gamepass" ||
                item.type.toLowerCase() === "gamepassproduct";

            let response;

            if (isGamePass) {
                response = await axios.post(
                    GAMEPASS_API_URL,
                    {
                        displayName: item.name,
                        description: "Migrated Game Pass"
                    },
                    {
                        headers: {
                            "x-api-key": API_KEY,
                            "Content-Type": "application/json"
                        }
                    }
                );
            } else {
                response = await axios.post(
                    DEVPRODUCT_API_URL,
                    {
                        displayName: item.name,
                        description: "Migrated Developer Product"
                    },
                    {
                        headers: {
                            "x-api-key": API_KEY,
                            "Content-Type": "application/json"
                        }
                    }
                );
            }

            console.log("SUCCESS RESPONSE:");
            console.log(JSON.stringify(response.data, null, 2));

            item.status = "Success";

            item.newId =
                response.data?.id ||
                response.data?.productId ||
                response.data?.path ||
                response.data?.name ||
                "UNKNOWN";

            await new Promise(r => setTimeout(r, 1000));

        } catch (err) {
            item.status = "Failed";

            console.log("FAILED:");
            console.log("Status:", err.response?.status);

            console.log(
                JSON.stringify(
                    err.response?.data || err.message,
                    null,
                    2
                )
            );
        }
    }

    let updatedScript = scriptText;

    for (const oldId in mappings) {
        if (!mappings[oldId].newId) continue;

        updatedScript = updatedScript.replaceAll(
            `[${oldId}]`,
            `[${mappings[oldId].newId}]`
        );
    }

    console.log("==== MIGRATION END ====");

    res.json({
        success: true,
        updatedScript,
        summary: mappings
    });
});
