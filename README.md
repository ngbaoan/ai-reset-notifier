# 🤖 AI Reset Notifier

Monitors AI account token reset times → sends Telegram notifications → displays live dashboard on GitHub Pages.

Built with **GitHub Actions + Node.js** (no npm install, uses built-in fetch from Node 18+).

## How it works

```
Every 5 min → GitHub Actions runs index.js
  ↓
Fetch accounts JSON from secret URL
  ↓
Compare resetAt with current VN time (UTC+7)
  ↓
Send Telegram if T-5min (soon) or T+0min (available)
  ↓
Generate docs/index.html → deploy to GitHub Pages
```

## Setup

### 1. Create repo on GitHub
Name it `ai-reset-notifier`, push all these files.

### 2. Add Secrets
**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|---|---|
| `JSON_URL` | Raw URL of your Gist JSON e.g. `https://gist.githubusercontent.com/ngbaoan/ID/raw/ai-tracker.json` |
| `BOT_TOKEN` | Telegram bot token from @BotFather |
| `CHAT_ID` | Your Telegram chat ID |

### 3. Enable Actions
Go to **Actions** tab → enable workflows if prompted.

### 4. Enable GitHub Pages
**Settings → Pages → Source: `gh-pages` branch → Save**

Dashboard live at: `https://ngbaoan.github.io/ai-reset-notifier/`

### 5. Test manually
**Actions → Check AI Token Resets → Run workflow**

## Notifications

| Timing | Message |
|---|---|
| 5 min before reset | `⏳ Sắp reset! Reset lúc HH:MM` |
| 0–10 min after reset | `✅ Đã available! Token reset lúc HH:MM` |

Each account only notified **once per reset cycle** — no spam.

## Files

| File | Purpose |
|---|---|
| `.github/workflows/check-resets.yml` | GitHub Actions (every 5 min) |
| `index.js` | Main script: check resets + send Telegram + generate HTML |
| `notified_state.json` | Tracks sent notifications (auto-committed by Actions) |
| `docs/index.html` | Dashboard (auto-generated, deployed to gh-pages) |
