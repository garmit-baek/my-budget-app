require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('./database');
const path = require('path');

const app = express();
const client = new Anthropic();

const ADMIN_ID = process.env.ADMIN_ID || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password1234';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  res.redirect('/login.html');
}

// 로그인 페이지
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/login.css',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.css')));

// 로그인/로그아웃
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_ID && password === ADMIN_PASSWORD) {
    req.session.loggedIn = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 틀렸습니다.' });
  }
});
app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });
app.get('/api/check-auth', (req, res) => res.json({ loggedIn: !!(req.session && req.session.loggedIn) }));

// 정적 파일
app.use(requireLogin, express.static(path.join(__dirname, 'public')));

// ── 거래 내역 ──────────────────────────────
app.get('/api/transactions', requireLogin, (req, res) => {
  try { res.json(db.prepare('SELECT * FROM transactions ORDER BY date DESC').all()); }
  catch(err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/transactions', requireLogin, (req, res) => {
  const { type, amount, category, account, description, date } = req.body;
  try {
    const result = db.prepare(
      'INSERT INTO transactions (type, amount, category, account, description, date) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(type, amount, category, account || '현금', description, date);
    res.json({ id: result.lastInsertRowid, message: '저장 완료!' });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/transactions/:id', requireLogin, (req, res) => {
  try {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
    res.json({ message: '삭제 완료!' });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ── 계정과목 CRUD ──────────────────────────
app.get('/api/accounts', requireLogin, (req, res) => {
  try { res.json(db.prepare('SELECT * FROM accounts ORDER BY id').all()); }
  catch(err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/accounts', requireLogin, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '계정명을 입력하세요.' });
  try {
    const result = db.prepare('INSERT INTO accounts (name) VALUES (?)').run(name.trim());
    res.json({ id: result.lastInsertRowid, name: name.trim(), message: '추가 완료!' });
  } catch(err) { res.status(400).json({ error: '이미 존재하는 계정입니다.' }); }
});

app.put('/api/accounts/:id', requireLogin, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '계정명을 입력하세요.' });
  try {
    db.prepare('UPDATE accounts SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
    res.json({ message: '수정 완료!' });
  } catch(err) { res.status(400).json({ error: '이미 존재하는 계정입니다.' }); }
});

app.delete('/api/accounts/:id', requireLogin, (req, res) => {
  try {
    db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
    res.json({ message: '삭제 완료!' });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ── 카테고리 CRUD ──────────────────────────
app.get('/api/categories', requireLogin, (req, res) => {
  try { res.json(db.prepare('SELECT * FROM categories ORDER BY type, id').all()); }
  catch(err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/categories', requireLogin, (req, res) => {
  const { type, name } = req.body;
  if (!type || !name || !name.trim()) return res.status(400).json({ error: '구분과 카테고리명을 입력하세요.' });
  try {
    const result = db.prepare('INSERT INTO categories (type, name) VALUES (?, ?)').run(type, name.trim());
    res.json({ id: result.lastInsertRowid, type, name: name.trim(), message: '추가 완료!' });
  } catch(err) { res.status(400).json({ error: '이미 존재하는 카테고리입니다.' }); }
});

app.put('/api/categories/:id', requireLogin, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '카테고리명을 입력하세요.' });
  try {
    db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
    res.json({ message: '수정 완료!' });
  } catch(err) { res.status(400).json({ error: '이미 존재하는 카테고리입니다.' }); }
});

app.delete('/api/categories/:id', requireLogin, (req, res) => {
  try {
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ message: '삭제 완료!' });
  } catch(err) { res.status(500).json({ error: err.message }); }
});gg

// ── AI 분석 ───────────────────────────────
app.post('/api/analyze', requireLogin, async (req, res) => {
  const { question } = req.body;
  try {
    const rows = db.prepare('SELECT * FROM transactions ORDER BY date DESC LIMIT 50').all();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: '당신은 가계부 분석 전문가입니다. 가계부 데이터: ' + JSON.stringify(rows) + ' 질문: ' + question + ' 한국어로 친절하게 답변해주세요.' }]
    });
    res.json({ answer: message.content[0].text });
  } catch(err) { res.status(500).json({ error: 'AI 오류: ' + err.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() { console.log('서버 실행 중: http://localhost:' + PORT); });

// DB 상태 확인 (임시)
app.get('/api/db-check', requireLogin, (req, res) => {
  try {
    const fs = require('fs');
    const dbExists = fs.existsSync('./budget.db');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const transCount = db.prepare('SELECT COUNT(*) as cnt FROM transactions').get();
    const accCount = db.prepare('SELECT COUNT(*) as cnt FROM accounts').get();
    const catCount = db.prepare('SELECT COUNT(*) as cnt FROM categories').get();
    res.json({
      dbFileExists: dbExists,
      tables: tables.map(function(t) { return t.name; }),
      transactionCount: transCount.cnt,
      accountCount: accCount.cnt,
      categoryCount: catCount.cnt
    });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});