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

// 거래 내역 저장
app.post('/api/transactions', (req, res) => {
  const { type, amount, category, account, description, date } = req.body;
  db.run(
    'INSERT INTO transactions (type, amount, category, account, description, date) VALUES (?, ?, ?, ?, ?, ?)',
    [type, amount, category, account || '현금', description, date],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: '저장 완료!' });
    }
  );
});

// 거래 내역 조회
app.get('/api/transactions', (req, res) => {
  db.all('SELECT * FROM transactions ORDER BY date DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 거래 내역 삭제
app.delete('/api/transactions/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM transactions WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: '삭제 완료!' });
  });
});

// Claude AI 분석 요청
app.post('/api/analyze', async (req, res) => {
  const { question } = req.body;
  try {
    db.all('SELECT * FROM transactions ORDER BY date DESC LIMIT 50', async (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: '당신은 가계부 분석 전문가입니다. 가계부 데이터: ' + JSON.stringify(rows) + ' 질문: ' + question + ' 한국어로 친절하게 답변해주세요.'
        }]
      });

      res.json({ answer: message.content[0].text });
    });
  } catch (err) {
    console.error('AI 오류:', err.message);
    res.status(500).json({ error: 'AI 분석 중 오류가 발생했습니다.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('서버 실행 중: http://localhost:' + PORT);
});