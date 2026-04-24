require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const db = require('./database');

const app = express();
const client = new Anthropic();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/api/transactions', (req, res) => {
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

app.get('/api/transactions', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM transactions ORDER BY date DESC').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/transactions/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
    res.json({ message: '삭제 완료!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/analyze', async (req, res) => {
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