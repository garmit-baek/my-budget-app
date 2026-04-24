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

// 관리자 계정 설정 (.env에서 읽어옴)
const ADMIN_ID = process.env.ADMIN_ID || 'admin';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'password1234', 10);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 세션 설정
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }  // 24시간 유지
}));

// 로그인 여부 확인 미들웨어
function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) {
    next();
  } else {
    res.redirect('/login.html');
  }
}

// 로그인 페이지는 누구나 접근 가능
app.use('/login.html', express.static(path.join(__dirname, 'public')));
app.use('/login.css', express.static(path.join(__dirname, 'public')));

// 나머지 파일은 로그인 필요
app.use('/', requireLogin, express.static(path.join(__dirname, 'public')));

// 로그인 처리
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_ID && bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    req.session.loggedIn = true;
    req.session.username = username;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 틀렸습니다.' });
  }
});

// 로그아웃
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// 로그인 상태 확인
app.get('/api/check-auth', (req, res) => {
  res.json({ loggedIn: req.session && req.session.loggedIn ? true : false });
});

// 거래 내역 저장
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

// 거래 내역 조회
app.get('/api/transactions', requireLogin, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM transactions ORDER BY date DESC').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 거래 내역 삭제
app.delete('/api/transactions/:id', requireLogin, (req, res) => {
  try {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
    res.json({ message: '삭제 완료!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Claude AI 분석
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('서버 실행 중: http://localhost:' + PORT);
});