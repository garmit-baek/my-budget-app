const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./budget.db', (err) => {
  if (err) {
    console.error('DB 연결 오류:', err.message);
  } else {
    console.log('DB 연결 성공!');
  }
});

db.serialize(() => {
  db.run(`
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

  db.run('ALTER TABLE transactions ADD COLUMN account TEXT NOT NULL DEFAULT ' + "'현금'", (err) => {
    // 이미 컬럼이 있으면 오류가 나지만 무시해도 됩니다
  });
});

module.exports = db;