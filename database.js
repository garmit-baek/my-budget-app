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

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    UNIQUE(type, name)
  )
`);

// 기본 계정 데이터
var defaultAccounts = ['현금','국민은행','신한은행','하나은행','우리은행','카카오뱅크','토스뱅크','국민카드','신한카드','삼성카드','현대카드','롯데카드','네이버페이','카카오페이','토스'];
defaultAccounts.forEach(function(name) {
  try { db.prepare('INSERT INTO accounts (name) VALUES (?)').run(name); } catch(e) {}
});

// 기본 카테고리 데이터
var defaultCategories = [
  { type: 'expense', name: '식비' },
  { type: 'expense', name: '카페/간식' },
  { type: 'expense', name: '교통' },
  { type: 'expense', name: '주거/관리비' },
  { type: 'expense', name: '통신' },
  { type: 'expense', name: '의료/건강' },
  { type: 'expense', name: '쇼핑/의류' },
  { type: 'expense', name: '문화/여가' },
  { type: 'expense', name: '교육' },
  { type: 'expense', name: '여행' },
  { type: 'expense', name: '경조사' },
  { type: 'expense', name: '기타지출' },
  { type: 'income', name: '급여' },
  { type: 'income', name: '용돈' },
  { type: 'income', name: '부수입' },
  { type: 'income', name: '기타수입' }
];
defaultCategories.forEach(function(c) {
  try { db.prepare('INSERT INTO categories (type, name) VALUES (?, ?)').run(c.type, c.name); } catch(e) {}
});

try { db.exec("ALTER TABLE transactions ADD COLUMN account TEXT NOT NULL DEFAULT '현금'"); } catch(e) {}

module.exports = db;