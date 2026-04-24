const Database = require('better-sqlite3');

const db = new Database('./budget.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    category TEXT NOT NULL,
    account TEXT NOT NULL DEFAULT '현금',
    description TEXT,
    date TEXT NOT NULL
  )
`);

try {
  db.exec("ALTER TABLE transactions ADD COLUMN account TEXT NOT NULL DEFAULT '현금'");
} catch (e) {}

module.exports = db;