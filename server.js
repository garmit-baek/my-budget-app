require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('./database');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const client = new Anthropic();

const ADMIN_ID = process.env.ADMIN_ID || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password1234';

// 업로드 임시 저장 설정
const upload = multer({ dest: 'uploads/' });

// ── 기본 설정 ──────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── 세션 설정 ──────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// ── 로그인 체크 함수 ───────────────────────
function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  res.redirect('/login.html');
}

// ── 로그인 페이지 (인증 없이 접근 가능) ────
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/login.css',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.css')));

// ── 로그인/로그아웃 ────────────────────────
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

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/check-auth', (req, res) => {
  res.json({ loggedIn: !!(req.session && req.session.loggedIn) });
});

// ── 정적 파일 (로그인 필요) ────────────────
app.use(requireLogin, express.static(path.join(__dirname, 'public')));

// ── 거래 내역 ──────────────────────────────
app.get('/api/transactions', requireLogin, (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM transactions ORDER BY date DESC').all());
  } catch(err) { res.status(500).json({ error: err.message }); }
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
});

// ── Claude AI 분석 ─────────────────────────
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
  } catch(err) {
    console.error('AI 오류:', err.message);
    res.status(500).json({ error: 'AI 오류: ' + err.message });
  }
});

// ── 거래내역 업로드 (CSV/엑셀 복구) ────────
app.post('/api/import', requireLogin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' });

  const filePath = req.file.path;
  const originalName = req.file.originalname.toLowerCase();

  try {
    let rows = [];

    if (originalName.endsWith('.csv')) {
      // CSV 파싱
      const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
      const lines = content.split('\n').filter(function(l) { return l.trim(); });

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < 5) continue;
        const row = {
          date:        (cols[0] || '').trim(),
          type:        (cols[1] || '').trim() === '수입' ? 'income' : 'expense',
          account:     (cols[2] || '현금').trim(),
          category:    (cols[3] || '기타').trim(),
          amount:      parseInt((cols[4] || '0').replace(/,/g, '')),
          description: (cols[5] || '').trim()
        };
        if (row.date && row.amount > 0) rows.push(row);
      }

    } else if (originalName.endsWith('.xlsx') || originalName.endsWith('.xls')) {
      // 엑셀 파싱
      const XLSX = require('xlsx');
      const wb = XLSX.readFile(filePath);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      for (let i = 1; i < data.length; i++) {
        const cols = data[i];
        if (!cols || cols.length < 5) continue;
        const date   = String(cols[0] || '').trim();
        const amount = parseInt(String(cols[4] || '0').replace(/,/g, ''));
        if (!date || !amount || amount <= 0) continue;
        rows.push({
          date:        date,
          type:        String(cols[1] || '').trim() === '수입' ? 'income' : 'expense',
          account:     String(cols[2] || '현금').trim(),
          category:    String(cols[3] || '기타').trim(),
          amount:      amount,
          description: String(cols[5] || '').trim()
        });
      }

    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'CSV 또는 엑셀(.xlsx) 파일만 지원합니다.' });
    }

    // DB 저장
    const stmt = db.prepare(
      'INSERT INTO transactions (type, amount, category, account, description, date) VALUES (?, ?, ?, ?, ?, ?)'
    );
    let successCount = 0, skipCount = 0;

    rows.forEach(function(row) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) { skipCount++; return; }
      try {
        stmt.run(row.type, row.amount, row.category, row.account, row.description, row.date);
        successCount++;
      } catch(e) { skipCount++; }
    });

    fs.unlinkSync(filePath);

    res.json({
      message: successCount + '건 복구 완료!' + (skipCount > 0 ? ' (' + skipCount + '건 건너뜀)' : ''),
      successCount: successCount,
      skipCount: skipCount
    });

  } catch(err) {
    try { fs.unlinkSync(filePath); } catch(e) {}
    res.status(500).json({ error: '파일 처리 오류: ' + err.message });
  }
});

// CSV 한 줄 파싱 함수
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── 서버 시작 ──────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('서버 실행 중: http://localhost:' + PORT);
});