const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'referral.db'));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE NOT NULL,
      username TEXT,
      first_seen DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Per-member referral link clicks (e.g. /r/username)
  db.run(`
    CREATE TABLE IF NOT EXISTS referral_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_username TEXT NOT NULL,
      clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Per-member referral joins (someone joined via /start referrer)
  db.run(`
    CREATE TABLE IF NOT EXISTS referral_joins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_username TEXT NOT NULL,
      new_member_id TEXT NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Single shared ad-campaign link clicks (used for FB + Instagram ads)
  db.run(`
    CREATE TABLE IF NOT EXISTS ad_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

module.exports = db;
