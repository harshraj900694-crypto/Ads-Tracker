# Aurialforge — Telegram Referral Bot + Analytics Dashboard

Tracks two kinds of traffic into your Telegram group:

1. **Per-member referral links** — `https://yourdomain.com/r/username`
2. **Single shared ad-campaign link** — `https://yourdomain.com/ad/click`
   Use this *one* link in both your Facebook and Instagram ads. Every click is
   counted, then the visitor is redirected straight to your Telegram group.

Both link types redirect to the same `GROUP_LINK` you set in your environment
variables — only the *tracking* is separate.

## Files

- `bot.js` — Telegram bot (Telegraf), gives each member their referral link
- `server.js` — Express server: redirect routes + JSON APIs for the dashboard
- `db.js` — SQLite schema (members, referral_clicks, referral_joins, ad_clicks)
- `public/index.html` — Analytics dashboard (Clicks / Joins / CVR / Ad Clicks / Leaderboard)
- `.env.example` — copy to `.env` and fill in your values

## Local setup

```bash
npm install
cp .env.example .env
# edit .env: add BOT_TOKEN, GROUP_LINK, BASE_URL
npm run dev
```

Dashboard: `http://localhost:3000`
Ad link (test locally): `http://localhost:3000/ad/click`

## Deploy on Render (free tier)

1. Push this project to a GitHub repo.
2. On [render.com](https://render.com) → **New → Web Service** → connect the repo.
3. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start` (runs `server.js`)
4. Add Environment Variables (Render dashboard → your service → **Environment**):
   - `BOT_TOKEN` = your bot token from @BotFather
   - `GROUP_LINK` = your Telegram group invite link
   - `BASE_URL` = `https://aurialforge.online`
5. Deploy. Once live, point your `aurialforge.online` domain to Render (Render → **Settings → Custom Domain**).
6. The bot (`bot.js`) needs to run too — either:
   - add a **second** Render Background Worker service running `npm run bot`, or
   - run `bot.js` on any always-on free host (Render's free web service sleeps when idle, which is fine for the dashboard but not ideal for the bot).

## Using the ad link in your ads

Put this exact URL in your Facebook and Instagram ad "Website URL" / "Link" field:

```
https://aurialforge.online/ad/click
```

Every click — from either platform — increases the **Ad Campaign Clicks**
count on the dashboard, then the person lands directly in your Telegram group.
No need for separate FB/Instagram links; it's one link, combined count.

## API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /r/:username` | Referral redirect + click tracking (per member) |
| `GET /ad/click` | Ad redirect + click tracking (FB + Instagram combined) |
| `GET /api/stats?range=today` | Clicks / Joins / CVR summary |
| `GET /api/ad-stats?range=today` | Total ad clicks |
| `GET /api/activity?range=today` | Hourly breakdown for the chart |
| `GET /api/leaderboard?range=today` | Top referrers |

`range` accepts: `today`, `yesterday`, `7days`, `30days`, `all`
