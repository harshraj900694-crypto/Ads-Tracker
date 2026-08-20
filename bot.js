require('dotenv').config();
const { Telegraf } = require('telegraf');
const db = require('./db');

const BOT_TOKEN = process.env.BOT_TOKEN;
const BASE_URL = process.env.BASE_URL;

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is missing in .env');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
  const referrer = ctx.startPayload; // set when someone opens t.me/YourBot?start=username
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

bot.launch();
console.log('Bot is running...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
