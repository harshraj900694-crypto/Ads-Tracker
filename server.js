require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const GROUP_LINK = process.env.GROUP_LINK; // your Telegram group invite link
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ---------------------------------------------------------------
// Per-member referral link: https://yourdomain.com/r/username
// ---------------------------------------------------------------
app.get('/r/:username', (req, res) => {
  const { username } = req.params;

  if (!GROUP_LINK) {
    return res.status(500).send('GROUP_LINK is not configured.');
  }

  db.run(
    'INSERT INTO referral_clicks (referrer_username) VALUES (?)',
    [username],
    (err) => {
      if (err) console.error('referral click error:', err);
      res.redirect(302, GROUP_LINK);
    }
  );
});

// ---------------------------------------------------------------
// Single ad-campaign link: https://yourdomain.com/ad/click
// Use this exact URL in both Facebook and Instagram ads.
// ---------------------------------------------------------------
app.get('/ad/click', (req, res) => {
  if (!GROUP_LINK) {
    return res.status(500).send('GROUP_LINK is not configured.');
  }

  db.run('INSERT INTO ad_clicks DEFAULT VALUES', (err) => {
    if (err) console.error('ad click error:', err);
    res.redirect(302, GROUP_LINK);
  });
});

// ---------------------------------------------------------------
// Stats APIs (used by the dashboard)
// ---------------------------------------------------------------
function getRangeClause(range, col = 'clicked_at') {
  switch (range) {
    case 'today':
      return `date(${col}) = date('now', 'localtime')`;
    case 'yesterday':
      return `date(${col}) = date('now', '-1 day', 'localtime')`;
    case '7days':
      return `${col} >= datetime('now', '-7 days')`;
    case '30days':
      return `${col} >= datetime('now', '-30 days')`;
    case 'all':
    default:
      return '1=1';
  }
}

app.get('/api/stats', (req, res) => {
  const range = req.query.range || 'today';
  const clicksClause = getRangeClause(range, 'clicked_at');
  const joinsClause = getRangeClause(range, 'joined_at');

  db.get(
    `SELECT COUNT(*) as total, COUNT(DISTINCT referrer_username) as unique_referrers
     FROM referral_clicks WHERE ${clicksClause}`,
    [],
    (err, clicksRow) => {
      if (err) return res.status(500).json({ error: err.message });

      db.get(
        `SELECT COUNT(*) as total, COUNT(DISTINCT new_member_id) as unique_joins
         FROM referral_joins WHERE ${joinsClause}`,
        [],
        (err2, joinsRow) => {
          if (err2) return res.status(500).json({ error: err2.message });

          const clicks = clicksRow?.total || 0;
          const joins = joinsRow?.total || 0;
          const cvr = clicks > 0 ? ((joins / clicks) * 100).toFixed(1) : '0.0';

          res.json({
            clicks,
            clicksUnique: clicksRow?.unique_referrers || 0,
            joins,
            joinsUnique: joinsRow?.unique_joins || 0,
            cvr
          });
        }
      );
    }
  );
});

// Ad campaign stats — combined FB + Instagram clicks
app.get('/api/ad-stats', (req, res) => {
  const range = req.query.range || 'today';
  const clause = getRangeClause(range, 'clicked_at');

  db.get(
    `SELECT COUNT(*) as total_clicks FROM ad_clicks WHERE ${clause}`,
    [],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ total_clicks: row?.total_clicks || 0 });
    }
  );
});

// Activity breakdown for the chart (referral clicks + joins, hourly)
app.get('/api/activity', (req, res) => {
  const range = req.query.range || 'today';
  const clicksClause = getRangeClause(range, 'clicked_at');
  const joinsClause = getRangeClause(range, 'joined_at');

  db.all(
    `SELECT strftime('%H', clicked_at) as hour, COUNT(*) as count
     FROM referral_clicks WHERE ${clicksClause} GROUP BY hour ORDER BY hour`,
    [],
    (err, clickRows) => {
      if (err) return res.status(500).json({ error: err.message });

      db.all(
        `SELECT strftime('%H', joined_at) as hour, COUNT(*) as count
         FROM referral_joins WHERE ${joinsClause} GROUP BY hour ORDER BY hour`,
        [],
        (err2, joinRows) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ clicks: clickRows, joins: joinRows });
        }
      );
    }
  );
});

// Members leaderboard
app.get('/api/leaderboard', (req, res) => {
  const range = req.query.range || 'today';
  const clause = getRangeClause(range, 'clicked_at');

  db.all(
    `SELECT referrer_username, COUNT(*) as clicks
     FROM referral_clicks
     WHERE ${clause}
     GROUP BY referrer_username
     ORDER BY clicks DESC
     LIMIT 20`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Ad click link (use in FB + Instagram ads): ${BASE_URL}/ad/click`);
});

// ---------------------------------------------------------------
// Telegram bot — runs in the same process so a single free Render
// Web Service handles both the dashboard and the bot.
// ---------------------------------------------------------------
const { Telegraf } = require('telegraf');
const BOT_TOKEN = process.env.BOT_TOKEN;

if (BOT_TOKEN) {
  const bot = new Telegraf(BOT_TOKEN);

  bot.start((ctx) => {
    const referrer = ctx.startPayload;
    const userId = String(ctx.from.id);
    const username = ctx.from.username || ctx.from.first_name || userId;

    db.run(
      'INSERT OR IGNORE INTO members (telegram_id, username) VALUES (?, ?)',
      [userId, username]
    );

    const referralLink = `${BASE_URL}/r/${username}`;

    ctx.reply(
      `Welcome ${username}! 🎉\n\nYour personal referral link:\n${referralLink}\n\nShare it — every join through this link is tracked and shown on the leaderboard.`
    );

    if (referrer && referrer !== username) {
      db.run(
        'INSERT INTO referral_joins (referrer_username, new_member_id) VALUES (?, ?)',
        [referrer, userId]
      );
    }
  });

  bot.launch()
    .then(() => console.log('Telegram bot is running...'))
    .catch((err) => console.error('Bot failed to start:', err));

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
} else {
  console.warn('BOT_TOKEN not set — bot will not start.');
}
