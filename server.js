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

app.post('/api/migrate', async (req, res) => {
    console.log('==== MIGRATION START ====');

    try {
        const { scriptText } = req.body;

        if (!scriptText) {
            return res.status(400).json({
                success: false,
                error: 'No script text provided.'
            });
        }

        console.log('Script Length:', scriptText.length);

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

            if (!displayMatch) continue;

            mappings[oldId] = {
                name: displayMatch[1],
                type: typeMatch ? typeMatch[1] : 'DeveloperProduct',
                status: 'Pending',
                newId: null
            };
        }

        console.log('Products Found:', Object.keys(mappings).length);

        if (Object.keys(mappings).length === 0) {
            return res.json({
                success: false,
                error: 'Regex found 0 products.'
            });
        }

        for (const oldId in mappings) {
            const item = mappings[oldId];

            try {
                console.log(`Creating: ${item.name}`);

                const isGamePass =
                    item.type.toLowerCase() === 'gamepass' ||
                    item.type.toLowerCase() === 'gamepassproduct';

                let response;

                if (isGamePass) {
                    response = await axios.post(
                        GAMEPASS_API_URL,
                        {
                            displayName: item.name,
                            description: 'Migrated Game Pass'
                        },
                        {
                            headers: {
                                'x-api-key': API_KEY,
                                'Content-Type': 'application/json'
                            },
                            timeout: 30000
                        }
                    );
                } else {
                    response = await axios.post(
                        DEVPRODUCT_API_URL,
                        {
                            displayName: item.name,
                            description: 'Migrated Developer Product'
                        },
                        {
                            headers: {
                                'x-api-key': API_KEY,
                                'Content-Type': 'application/json'
                            },
                            timeout: 30000
                        }
                    );
                }

                console.log(
                    'SUCCESS:',
                    JSON.stringify(response.data, null, 2)
                );

                item.status = 'Success';

                item.newId =
                    response.data?.id ||
                    response.data?.productId ||
                    response.data?.path ||
                    response.data?.name ||
                    'UNKNOWN';

                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (err) {
                item.status = 'Failed';

                console.error('FAILED:', item.name);
                console.error('Status:', err.response?.status);

                if (err.response?.data) {
                    console.error(
                        JSON.stringify(err.response.data, null, 2)
                    );
                } else {
                    console.error(err.message);
                }
            }
        }

        let updatedScript = scriptText;

        for (const oldId in mappings) {
            const newId = mappings[oldId].newId;

            if (!newId || newId === 'UNKNOWN') continue;

            updatedScript = updatedScript.replaceAll(
                `[${oldId}]`,
                `[${newId}]`
            );
        }

        console.log('==== MIGRATION COMPLETE ====');

        return res.json({
            success: true,
            updatedScript,
            summary: mappings
        });

    } catch (err) {
        console.error('ROUTE CRASH:', err);

        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Migrator active on port ${PORT}`);
});
