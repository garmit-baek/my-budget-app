var API = 'http://localhost:3000/api';

// 거래 추가
function addTransaction() {
  var type = document.getElementById('type').value;
  var amount = document.getElementById('amount').value;
  var category = document.getElementById('category').value;
  var account = document.getElementById('account').value;
  var description = document.getElementById('description').value;
  var date = document.getElementById('date').value;

  if (!amount || !category || category === '' || !account || account === '' || !date) {
    alert('금액, 계정, 카테고리, 날짜는 필수 입력입니다.');
    return;
  }

  fetch(API + '/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: type,
      amount: parseInt(amount),
      category: category,
      account: account,
      description: description,
      date: date
    })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    alert(data.message);
    document.getElementById('amount').value = '';
    document.getElementById('category').value = '';
    document.getElementById('account').value = '';
    document.getElementById('description').value = '';
    loadTransactions();
  })
  .catch(function(err) {
    alert('오류 발생: ' + err.message);
  });
}

// 거래 목록 불러오기
function loadTransactions() {
  fetch(API + '/transactions')
  .then(function(res) { return res.json(); })
  .then(function(data) {
    var list = document.getElementById('transactions-list');
    var totalIncome = 0;
    var totalExpense = 0;

    if (data.length === 0) {
      list.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px">거래 내역이 없습니다.</p>';
    } else {
      var html = '';
      for (var i = 0; i < data.length; i++) {
        var t = data[i];
        var sign = t.type === 'income' ? '+' : '-';
        var amountClass = t.type === 'income' ? 'income' : 'expense';

        if (t.type === 'income') {
          totalIncome += t.amount;
        } else {
          totalExpense += t.amount;
        }

        html += '<div class="transaction-item">';
        html += '  <div class="transaction-left">';
        html += '    <span class="transaction-category">' + t.category + '</span>';
        html += '    <span class="transaction-meta">' + t.date + ' · ' + (t.account || '현금') + (t.description ? ' · ' + t.description : '') + '</span>';
        html += '  </div>';
        html += '  <div class="transaction-right">';
        html += '    <span class="transaction-amount ' + amountClass + '">' + sign + t.amount.toLocaleString() + '원</span>';
        html += '    <button class="delete-btn" onclick="deleteTransaction(' + t.id + ')">✕</button>';
        html += '  </div>';
        html += '</div>';
      }
      list.innerHTML = html;
    }

    var balance = totalIncome - totalExpense;
    document.getElementById('total-income').textContent = totalIncome.toLocaleString() + '원';
    document.getElementById('total-expense').textContent = totalExpense.toLocaleString() + '원';
    document.getElementById('balance').textContent = balance.toLocaleString() + '원';
  });
}

// 거래 삭제
function deleteTransaction(id) {
  if (!confirm('이 항목을 삭제할까요?')) return;

  fetch(API + '/transactions/' + id, { method: 'DELETE' })
  .then(function(res) { return res.json(); })
  .then(function() {
    loadTransactions();
  });
}

// AI에게 질문
function askAI() {
  var question = document.getElementById('ai-question').value;
  if (!question) {
    alert('질문을 입력해주세요.');
    return;
  }

  var answerBox = document.getElementById('ai-answer');
  answerBox.style.display = 'block';
  answerBox.className = 'loading';
  answerBox.textContent = 'AI가 분석 중입니다...';

  fetch(API + '/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: question })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    answerBox.className = '';
    answerBox.textContent = data.answer;
  })
  .catch(function(err) {
    answerBox.className = '';
    answerBox.textContent = '오류가 발생했습니다: ' + err.message;
  });
}

// 오늘 날짜 자동 입력
var today = new Date();
var yyyy = today.getFullYear();
var mm = String(today.getMonth() + 1).padStart(2, '0');
var dd = String(today.getDate()).padStart(2, '0');
document.getElementById('date').value = yyyy + '-' + mm + '-' + dd;

// 페이지 로드 시 목록 불러오기
loadTransactions();

// 로그아웃
function doLogout() {
  fetch('/api/logout', { method: 'POST' })
  .then(function() {
    location.href = '/login.html';
  });
}