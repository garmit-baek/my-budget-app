require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('./database');
const path = require('path');

const app = express();
const client = new Anthropic();

const ADMIN_ID = process.env.ADMIN_ID || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password1234';

// ① 기본 설정
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ② 세션 설정
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// ③ 로그인 체크 함수
function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) {
    next();
  } else {
    res.redirect('/login.html');
  }
}

// ④ 로그인 페이지 (인증 없이 접근 가능)
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/login.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.css'));
});

// ⑤ 로그인 처리 (requireLogin 보다 반드시 위!)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  console.log('로그인 시도:', username);
  if (username === ADMIN_ID && password === ADMIN_PASSWORD) {
    req.session.loggedIn = true;
    req.session.username = username;
    console.log('로그인 성공!');
    res.json({ success: true });
  } else {
    console.log('로그인 실패');
    res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 틀렸습니다.' });
  }
});

// ⑥ 로그아웃 (requireLogin 보다 위!)
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ⑦ 로그인 상태 확인 (requireLogin 보다 위!)
app.get('/api/check-auth', (req, res) => {
  res.json({ loggedIn: req.session && req.session.loggedIn ? true : false });
});

// ⑧ 정적 파일 (로그인 필요 — 항상 API 라우트 뒤에!)
app.use(requireLogin, express.static(path.join(__dirname, 'public')));

// ⑨ 거래 내역 저장
app.post('/api/transactions', requireLogin, (req, res) => {
  const { type, amount, category, account, description, date } = req.body;
  try {
    const stmt = db.prepare(
      'INSERT INTO transactions (type, amount, category, account, description, date) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(type, amount, category, account || '현금', description, date);
    res.json({ id: result.lastInsertRowid, message: '저장 완료!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ⑩ 거래 내역 조회
app.get('/api/transactions', requireLogin, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM transactions ORDER BY date DESC').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ⑪ 거래 내역 삭제
app.delete('/api/transactions/:id', requireLogin, (req, res) => {
  try {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
    res.json({ message: '삭제 완료!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ⑫ Claude AI 분석
app.post('/api/analyze', requireLogin, async (req, res) => {
  const { question } = req.body;
  try {
    const rows = db.prepare('SELECT * FROM transactions ORDER BY date DESC LIMIT 50').all();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: '당신은 가계부 분석 전문가입니다. 가계부 데이터: ' + JSON.stringify(rows) + ' 질문: ' + question + ' 한국어로 친절하게 답변해주세요.'
      }]
    });
    res.json({ answer: message.content[0].text });
  } catch (err) {
    res.status(500).json({ error: 'AI 오류: ' + err.message });
  }
});

// ⑬ 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('서버 실행 중: http://localhost:' + PORT);
});