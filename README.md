# Roblox Configuration Asset Migrator

A standalone Node.js utility web service designed to run on deployment platforms like **Railway**. It processes raw configuration files or decompiled Luau tables, extracts old gamepass mappings, interacts with Roblox's Open Cloud v2 API to register a completely new inventory inside your current universe, and performs direct replacement updates.

## Railway Environment Variable Setup

When deploying to Railway, add these configurations inside your Service **Variables** dashboard:

1. `ROBLOX_API_KEY`: Your Open Cloud API Key token (Requires `game-pass:write` access configured for your Universe).
2. `UNIVERSE_ID`: The unique target game numeric identifier (`game.GameId`).
3. `PORT`: Defaults to `3000` (automatically managed by Railway).

## How to Deploy via GitHub

1. Extract the contents of this ZIP file into a new repository on your GitHub account.
2. Log into your **Railway Dashboard** and click **New Project** -> **Deploy from GitHub repository**.
3. Choose the repository you just initialized.
4. Go to **Variables** tab on Railway, click **New Variable**, and insert your `ROBLOX_API_KEY` and `UNIVERSE_ID`.
5. Railway will automatically detect the `package.json` file, build the environment container, and allocate a live accessible domain for your tool wrapper.
