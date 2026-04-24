var API = '/api';
var allTransactions = [];
var allAccounts = [];
var allCategories = [];
var calendarYear, calendarMonth;
var listYear, listMonth;
var isShowAll = false;
var today = new Date();
calendarYear = today.getFullYear();
calendarMonth = today.getMonth() + 1;
listYear = today.getFullYear();
listMonth = today.getMonth() + 1;

// 공통 fetch 함수
function apiFetch(url, options) {
  options = options || {};
  options.credentials = 'same-origin';
  options.headers = options.headers || {};
  return fetch(url, options);
}

// ── 초기화 ────────────────────────────────
function init() {
  loadTransactions();
  loadAccounts();
  loadCategories();
  updateListMonthTitle();
  initDownloadDates();
  document.getElementById('date').value =
    today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');
}

// ── 탭 전환 ──────────────────────────────
function showTab(name) {
  ['home','stats','calendar','settings'].forEach(function(t) {
    document.getElementById('tab-' + t).style.display = 'none';
  });
  document.getElementById('tab-' + name).style.display = 'block';
  var btns = document.querySelectorAll('.tab-btn');
  btns.forEach(function(b) { b.classList.remove('active'); });
  var idx = { home:0, stats:1, calendar:2, settings:3 };
  btns[idx[name]].classList.add('active');
  if (name === 'stats') initStatsSelects();
  if (name === 'calendar') renderCalendar();
  if (name === 'settings') { renderAccountList(); renderCategoryList(); }
}

// ── 계정 로드 ─────────────────────────────
function loadAccounts() {
  apiFetch(API + '/accounts')
  .then(function(r) { return r.json(); })
  .then(function(data) {
    allAccounts = data;
    var sel = document.getElementById('account');
    sel.innerHTML = '<option value="">계정 선택</option>';
    data.forEach(function(a) {
      sel.innerHTML += '<option value="' + a.name + '">' + a.name + '</option>';
    });
  });
}

// ── 카테고리 로드 ─────────────────────────
function loadCategories() {
  apiFetch(API + '/categories')
  .then(function(r) { return r.json(); })
  .then(function(data) {
    allCategories = data;
    filterCategories();
  });
}

function filterCategories() {
  var type = document.getElementById('type').value;
  var sel = document.getElementById('category');
  sel.innerHTML = '<option value="">카테고리 선택</option>';
  allCategories
    .filter(function(c) { return c.type === type; })
    .forEach(function(c) {
      sel.innerHTML += '<option value="' + c.name + '">' + c.name + '</option>';
    });
}

// ── 거래 추가 ─────────────────────────────
function addTransaction() {
  var type     = document.getElementById('type').value;
  var amount   = document.getElementById('amount').value;
  var category = document.getElementById('category').value;
  var account  = document.getElementById('account').value;
  var desc     = document.getElementById('description').value;
  var date     = document.getElementById('date').value;

  if (!amount || !category || !account || !date) {
    alert('금액, 계정, 카테고리, 날짜는 필수 입력입니다.');
    return;
  }

  apiFetch(API + '/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type:type, amount:parseInt(amount), category:category, account:account, description:desc, date:date })
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    alert(d.message);
    document.getElementById('amount').value = '';
    document.getElementById('category').value = '';
    document.getElementById('account').value = '';
    document.getElementById('description').value = '';
    loadTransactions();
  });
}

// ── 거래 목록 ─────────────────────────────
function loadTransactions() {
  apiFetch(API + '/transactions')
  .then(function(r) { return r.json(); })
  .then(function(data) {
    allTransactions = data;
    var totalIn = 0, totalOut = 0;
    data.forEach(function(t) {
      if (t.type === 'income') totalIn += t.amount;
      else totalOut += t.amount;
    });
    document.getElementById('total-income').textContent  = totalIn.toLocaleString() + '원';
    document.getElementById('total-expense').textContent = totalOut.toLocaleString() + '원';
    document.getElementById('balance').textContent       = (totalIn - totalOut).toLocaleString() + '원';
    renderTransactionList();
  });
}

// ── 거래 목록 렌더링 (월별 필터) ─────────
function renderTransactionList() {
  var filtered = isShowAll ? allTransactions : allTransactions.filter(function(t) {
    var d = new Date(t.date);
    return d.getFullYear() === listYear && d.getMonth() + 1 === listMonth;
  });

  var list = document.getElementById('transactions-list');
  var monthIn = 0, monthOut = 0;

  if (filtered.length === 0) {
    list.innerHTML = '<p style="color:#aaa;text-align:center;padding:20px">거래 내역이 없습니다.</p>';
  } else {
    var html = '';
    filtered.forEach(function(t) {
      var sign = t.type === 'income' ? '+' : '-';
      var cls  = t.type === 'income' ? 'income' : 'expense';
      if (t.type === 'income') monthIn += t.amount;
      else monthOut += t.amount;
      html += '<div class="transaction-item">';
      html += '<div class="transaction-left">';
      html += '<span class="transaction-category">' + t.category + '</span>';
      html += '<span class="transaction-meta">' + t.date + ' · ' + (t.account||'현금') + (t.description ? ' · '+t.description : '') + '</span>';
      html += '</div><div class="transaction-right">';
      html += '<span class="transaction-amount ' + cls + '">' + sign + t.amount.toLocaleString() + '원</span>';
      html += '<button class="delete-btn" onclick="deleteTransaction(' + t.id + ')">✕</button>';
      html += '</div></div>';
    });
    list.innerHTML = html;
  }

  document.getElementById('month-in-amount').textContent  = monthIn.toLocaleString() + '원';
  document.getElementById('month-out-amount').textContent = monthOut.toLocaleString() + '원';
  document.getElementById('month-bal-amount').textContent = (monthIn - monthOut).toLocaleString() + '원';
}

// ── 월 변경 ──────────────────────────────
function changeListMonth(dir) {
  isShowAll = false;
  document.querySelector('.month-all-btn').classList.remove('active');
  listMonth += dir;
  if (listMonth > 12) { listMonth = 1; listYear++; }
  if (listMonth < 1)  { listMonth = 12; listYear--; }
  updateListMonthTitle();
  renderTransactionList();
  syncDownloadDatesToListMonth();
}

function showAllTransactions() {
  isShowAll = true;
  document.querySelector('.month-all-btn').classList.add('active');
  updateListMonthTitle();
  renderTransactionList();
  setDownloadPeriod('all');
}

function updateListMonthTitle() {
  var title = isShowAll ? '전체 내역' : listYear + '년 ' + listMonth + '월';
  document.getElementById('list-month-title').textContent = title;
}

// ── 거래 삭제 ─────────────────────────────
function deleteTransaction(id) {
  if (!confirm('삭제할까요?')) return;
  apiFetch(API + '/transactions/' + id, { method: 'DELETE' })
  .then(function(r) { return r.json(); })
  .then(function() { loadTransactions(); });
}

// ── AI 분석 ──────────────────────────────
function askAI() {
  var q = document.getElementById('ai-question').value;
  if (!q) { alert('질문을 입력해주세요.'); return; }
  var box = document.getElementById('ai-answer');
  box.style.display = 'block';
  box.className = 'loading';
  box.textContent = 'AI가 분석 중입니다...';
  apiFetch(API + '/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: q })
  })
  .then(function(r) { return r.json(); })
  .then(function(d) { box.className = ''; box.textContent = d.answer; })
  .catch(function() { box.className = ''; box.textContent = '오류가 발생했습니다.'; });
}

function doLogout() {
  apiFetch('/api/logout', { method: 'POST' })
  .then(function() { location.href = '/login.html'; });
}

// ── 다운로드 날짜 초기화 ─────────────────
function initDownloadDates() {
  syncDownloadDatesToListMonth();
}

// 현재 보이는 월에 맞게 다운로드 날짜 동기화
function syncDownloadDatesToListMonth() {
  if (isShowAll) return;
  var y = listYear;
  var m = listMonth;
  var firstDay = y + '-' + String(m).padStart(2,'0') + '-01';
  var lastDay  = y + '-' + String(m).padStart(2,'0') + '-' + new Date(y, m, 0).getDate();
  document.getElementById('dl-start').value = firstDay;
  document.getElementById('dl-end').value   = lastDay;
  highlightShortcut('thisMonth');
}

// 단축 기간 설정
function setDownloadPeriod(type) {
  var y = today.getFullYear(), m = today.getMonth() + 1;
  var start, end;

  if (type === 'thisMonth') {
    start = y + '-' + String(m).padStart(2,'0') + '-01';
    end   = y + '-' + String(m).padStart(2,'0') + '-' + new Date(y, m, 0).getDate();
  } else if (type === 'lastMonth') {
    var ly = m === 1 ? y - 1 : y;
    var lm = m === 1 ? 12 : m - 1;
    start = ly + '-' + String(lm).padStart(2,'0') + '-01';
    end   = ly + '-' + String(lm).padStart(2,'0') + '-' + new Date(ly, lm, 0).getDate();
  } else if (type === 'thisQuarter') {
    var q = Math.ceil(m / 3);
    var qStartM = (q - 1) * 3 + 1;
    var qEndM   = q * 3;
    start = y + '-' + String(qStartM).padStart(2,'0') + '-01';
    end   = y + '-' + String(qEndM).padStart(2,'0') + '-' + new Date(y, qEndM, 0).getDate();
  } else if (type === 'thisYear') {
    start = y + '-01-01';
    end   = y + '-12-31';
  } else if (type === 'all') {
    if (allTransactions.length > 0) {
      var dates = allTransactions.map(function(t){ return t.date; }).sort();
      start = dates[0];
      end   = dates[dates.length - 1];
    } else {
      start = y + '-01-01';
      end   = y + '-12-31';
    }
  }

  document.getElementById('dl-start').value = start;
  document.getElementById('dl-end').value   = end;
  highlightShortcut(type);
}

function highlightShortcut(active) {
  var types = ['thisMonth','lastMonth','thisQuarter','thisYear','all'];
  var btns = document.querySelectorAll('.shortcut-btn');
  btns.forEach(function(btn, i) {
    if (types[i] === active) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

// ── 다운로드 공통 데이터 준비 ─────────────
function getDownloadData() {
  var start = document.getElementById('dl-start').value;
  var end   = document.getElementById('dl-end').value;

  if (!start || !end) {
    alert('다운로드 기간을 설정해주세요.');
    return null;
  }
  if (start > end) {
    alert('시작일이 종료일보다 늦을 수 없습니다.');
    return null;
  }

  var filtered = allTransactions.filter(function(t) {
    return t.date >= start && t.date <= end;
  });

  if (filtered.length === 0) {
    alert('해당 기간의 거래 내역이 없습니다.\n기간: ' + start + ' ~ ' + end);
    return null;
  }

  var headers = ['날짜', '구분', '계정', '카테고리', '금액(원)', '메모'];
  var rows = filtered.map(function(t) {
    return [
      t.date,
      t.type === 'income' ? '수입' : '지출',
      t.account || '현금',
      t.category,
      t.amount,
      t.description || ''
    ];
  });

  var totalIn  = filtered.filter(function(t){return t.type==='income';}).reduce(function(s,t){return s+t.amount;},0);
  var totalOut = filtered.filter(function(t){return t.type==='expense';}).reduce(function(s,t){return s+t.amount;},0);
  rows.push([]);
  rows.push(['기간', start + ' ~ ' + end, '', '', '', '']);
  rows.push(['', '', '', '총 수입', totalIn, '']);
  rows.push(['', '', '', '총 지출', totalOut, '']);
  rows.push(['', '', '', '잔액',   totalIn - totalOut, '']);

  return { headers:headers, rows:rows, filtered:filtered, start:start, end:end };
}

// ── CSV 다운로드 ──────────────────────────
function downloadCSV() {
  var data = getDownloadData();
  if (!data) return;

  var BOM = '\uFEFF';
  var csvRows = [data.headers.join(',')];

  data.rows.forEach(function(row) {
    var escaped = row.map(function(cell) {
      var str = String(cell === null || cell === undefined ? '' : cell);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        str = '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    });
    csvRows.push(escaped.join(','));
  });

  var blob = new Blob([BOM + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var fileName = '가계부_' + data.start + '_' + data.end + '.csv';
  var link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

// ── 엑셀 다운로드 ─────────────────────────
function downloadExcel() {
  if (typeof XLSX === 'undefined') {
    alert('엑셀 라이브러리 로딩 중입니다. 잠시 후 다시 시도해주세요.');
    return;
  }
  var data = getDownloadData();
  if (!data) return;

  var wb = XLSX.utils.book_new();

  // 시트1: 전체 내역
  var ws = XLSX.utils.aoa_to_sheet([data.headers].concat(data.rows));
  ws['!cols'] = [{ wch:12 },{ wch:6 },{ wch:12 },{ wch:14 },{ wch:14 },{ wch:20 }];
  XLSX.utils.book_append_sheet(wb, ws, '전체내역');

  // 시트2: 카테고리별 요약
  var catMap = {};
  data.filtered.forEach(function(t) {
    if (t.type === 'expense') catMap[t.category] = (catMap[t.category]||0) + t.amount;
  });
  var catRows = [['카테고리','지출금액(원)']];
  Object.keys(catMap).sort(function(a,b){return catMap[b]-catMap[a];}).forEach(function(cat) {
    catRows.push([cat, catMap[cat]]);
  });
  var ws2 = XLSX.utils.aoa_to_sheet(catRows);
  ws2['!cols'] = [{ wch:16 },{ wch:16 }];
  XLSX.utils.book_append_sheet(wb, ws2, '카테고리별요약');

  // 시트3: 계정별 요약
  var accMap = { income:{}, expense:{} };
  data.filtered.forEach(function(t) {
    var k = t.account||'현금';
    accMap[t.type][k] = (accMap[t.type][k]||0) + t.amount;
  });
  var allAcc = {};
  Object.keys(accMap.income).forEach(function(k){allAcc[k]=true;});
  Object.keys(accMap.expense).forEach(function(k){allAcc[k]=true;});
  var accRows = [['계정','수입(원)','지출(원)','잔액(원)']];
  Object.keys(allAcc).forEach(function(acc) {
    var inc = accMap.income[acc]||0, exp = accMap.expense[acc]||0;
    accRows.push([acc, inc, exp, inc-exp]);
  });
  var ws3 = XLSX.utils.aoa_to_sheet(accRows);
  ws3['!cols'] = [{ wch:14 },{ wch:14 },{ wch:14 },{ wch:14 }];
  XLSX.utils.book_append_sheet(wb, ws3, '계정별요약');

  // 시트4: 월별 요약
  var monthMap = {};
  data.filtered.forEach(function(t) {
    var ym = t.date.substring(0,7);
    if (!monthMap[ym]) monthMap[ym] = { income:0, expense:0 };
    if (t.type==='income') monthMap[ym].income += t.amount;
    else monthMap[ym].expense += t.amount;
  });
  var monthRows = [['연월','수입(원)','지출(원)','잔액(원)']];
  Object.keys(monthMap).sort().forEach(function(ym) {
    var inc = monthMap[ym].income, exp = monthMap[ym].expense;
    monthRows.push([ym, inc, exp, inc-exp]);
  });
  var ws4 = XLSX.utils.aoa_to_sheet(monthRows);
  ws4['!cols'] = [{ wch:10 },{ wch:14 },{ wch:14 },{ wch:14 }];
  XLSX.utils.book_append_sheet(wb, ws4, '월별요약');

  XLSX.writeFile(wb, '가계부_' + data.start + '_' + data.end + '.xlsx');
}

// ── 통계 ─────────────────────────────────
function initStatsSelects() {
  var sel = document.getElementById('stats-year');
  if (sel.options.length > 0) return;
  var yr = today.getFullYear();
  for (var y = yr; y >= yr - 3; y--) {
    var o = document.createElement('option');
    o.value = y; o.textContent = y + '년';
    sel.appendChild(o);
  }
  document.getElementById('stats-month').value = today.getMonth() + 1;
}

function filterByPeriod(data, period, year, month) {
  return data.filter(function(t) {
    var d = new Date(t.date), ty = d.getFullYear(), tm = d.getMonth() + 1;
    if (period === 'monthly')   return ty === year && tm === month;
    if (period === 'quarterly') return ty === year && Math.ceil(tm/3) === Math.ceil(month/3);
    if (period === 'yearly')    return ty === year;
    return true;
  });
}

function loadStats() {
  var period = document.getElementById('stats-period').value;
  var year   = parseInt(document.getElementById('stats-year').value);
  var month  = parseInt(document.getElementById('stats-month').value);
  var filtered = filterByPeriod(allTransactions, period, year, month);

  if (filtered.length === 0) { alert('해당 기간의 데이터가 없습니다.'); return; }

  var totalIn = 0, totalOut = 0;
  filtered.forEach(function(t) { if (t.type==='income') totalIn+=t.amount; else totalOut+=t.amount; });

  document.getElementById('stats-income').textContent  = totalIn.toLocaleString() + '원';
  document.getElementById('stats-expense').textContent = totalOut.toLocaleString() + '원';
  document.getElementById('stats-balance').textContent = (totalIn-totalOut).toLocaleString() + '원';
  document.getElementById('stats-summary').style.display = 'grid';

  renderCategoryStats(filtered);
  renderAccountStats(filtered);
  renderTrend(period, year, month);
}

function renderCategoryStats(data) {
  var expenses = data.filter(function(t) { return t.type === 'expense'; });
  var catMap = {}, total = 0;
  expenses.forEach(function(t) { catMap[t.category]=(catMap[t.category]||0)+t.amount; total+=t.amount; });
  var sorted = Object.keys(catMap).sort(function(a,b) { return catMap[b]-catMap[a]; });
  var html = '';
  sorted.forEach(function(cat) {
    var pct = total > 0 ? Math.round(catMap[cat]/total*100) : 0;
    html += '<div class="stat-item"><div class="stat-label"><span>'+cat+'</span><span>'+catMap[cat].toLocaleString()+'원 ('+pct+'%)</span></div>';
    html += '<div class="stat-bar-wrap"><div class="stat-bar expense" style="width:'+pct+'%"></div></div></div>';
  });
  document.getElementById('stats-category').innerHTML = html || '<p style="color:#aaa">지출 내역이 없습니다.</p>';
  document.getElementById('stats-category-box').style.display = 'block';
}

function renderAccountStats(data) {
  var accMap = { income:{}, expense:{} };
  data.forEach(function(t) {
    var k = t.account||'현금';
    accMap[t.type][k] = (accMap[t.type][k]||0) + t.amount;
  });
  var all = {};
  Object.keys(accMap.income).forEach(function(k){all[k]=true;});
  Object.keys(accMap.expense).forEach(function(k){all[k]=true;});
  var html = '';
  Object.keys(all).forEach(function(acc) {
    var inc = accMap.income[acc]||0, exp = accMap.expense[acc]||0;
    html += '<div class="trend-item"><span class="trend-period">'+acc+'</span><div class="trend-amounts">';
    if (inc>0) html += '<span class="trend-in">+'+inc.toLocaleString()+'원</span>';
    if (exp>0) html += '<span class="trend-out">-'+exp.toLocaleString()+'원</span>';
    html += '<span class="trend-bal">'+(inc-exp).toLocaleString()+'원</span></div></div>';
  });
  document.getElementById('stats-account').innerHTML = html || '<p style="color:#aaa">데이터가 없습니다.</p>';
  document.getElementById('stats-account-box').style.display = 'block';
}

function renderTrend(period, year, month) {
  var html = '';
  if (period === 'monthly') {
    for (var i=5;i>=0;i--) {
      var d=new Date(year,month-1-i,1),y=d.getFullYear(),m=d.getMonth()+1;
      var f=allTransactions.filter(function(t){var td=new Date(t.date);return td.getFullYear()===y&&td.getMonth()+1===m;});
      var inc=0,exp=0; f.forEach(function(t){if(t.type==='income')inc+=t.amount;else exp+=t.amount;});
      html+=makeTrendRow(y+'년 '+m+'월',inc,exp);
    }
  } else if (period === 'quarterly') {
    for (var q=1;q<=4;q++) {
      var f=allTransactions.filter(function(t){var td=new Date(t.date);return td.getFullYear()===year&&Math.ceil((td.getMonth()+1)/3)===q;});
      var inc=0,exp=0; f.forEach(function(t){if(t.type==='income')inc+=t.amount;else exp+=t.amount;});
      html+=makeTrendRow(year+'년 '+q+'분기',inc,exp);
    }
  } else {
    for (var y2=year-2;y2<=year;y2++) {
      var f=allTransactions.filter(function(t){return new Date(t.date).getFullYear()===y2;});
      var inc=0,exp=0; f.forEach(function(t){if(t.type==='income')inc+=t.amount;else exp+=t.amount;});
      html+=makeTrendRow(y2+'년',inc,exp);
    }
  }
  document.getElementById('stats-trend').innerHTML=html;
  document.getElementById('stats-trend-box').style.display='block';
}

function makeTrendRow(label,inc,exp) {
  return '<div class="trend-item"><span class="trend-period">'+label+'</span><div class="trend-amounts">'+
    '<span class="trend-in">+'+inc.toLocaleString()+'원</span>'+
    '<span class="trend-out">-'+exp.toLocaleString()+'원</span>'+
    '<span class="trend-bal">'+(inc-exp).toLocaleString()+'원</span></div></div>';
}

// ── 달력 ─────────────────────────────────
function changeCalendarMonth(dir) {
  calendarMonth+=dir;
  if(calendarMonth>12){calendarMonth=1;calendarYear++;}
  if(calendarMonth<1){calendarMonth=12;calendarYear--;}
  renderCalendar();
}

function renderCalendar() {
  document.getElementById('calendar-title').textContent=calendarYear+'년 '+calendarMonth+'월';
  var monthData=allTransactions.filter(function(t){
    var d=new Date(t.date);return d.getFullYear()===calendarYear&&d.getMonth()+1===calendarMonth;
  });
  var calIn=0,calOut=0;
  monthData.forEach(function(t){if(t.type==='income')calIn+=t.amount;else calOut+=t.amount;});
  document.getElementById('cal-income').textContent=calIn.toLocaleString()+'원';
  document.getElementById('cal-expense').textContent=calOut.toLocaleString()+'원';
  document.getElementById('cal-balance').textContent=(calIn-calOut).toLocaleString()+'원';

  var dayMap={};
  monthData.forEach(function(t){
    var day=parseInt(t.date.split('-')[2]);
    if(!dayMap[day])dayMap[day]={income:0,expense:0};
    if(t.type==='income')dayMap[day].income+=t.amount;
    else dayMap[day].expense+=t.amount;
  });

  var firstDay=new Date(calendarYear,calendarMonth-1,1).getDay();
  var lastDate=new Date(calendarYear,calendarMonth,0).getDate();
  var todayStr=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');

  var html='<div class="calendar-weekdays"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>';
  html+='<div class="calendar-days">';
  for(var i=0;i<firstDay;i++)html+='<div class="calendar-day empty"></div>';
  for(var d=1;d<=lastDate;d++){
    var dow=(firstDay+d-1)%7;
    var dowCls=dow===0?'sun':(dow===6?'sat':'');
    var dateStr=calendarYear+'-'+String(calendarMonth).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var isTodayCls=dateStr===todayStr?'today':'';
    var dd=dayMap[d];
    html+='<div class="calendar-day '+dowCls+' '+isTodayCls+'" onclick="showDayDetail(\''+dateStr+'\')">';
    html+='<div class="day-num">'+d+'</div>';
    if(dd){
      if(dd.income>0)html+='<div class="day-income">+'+(dd.income/10000).toFixed(0)+'만</div>';
      if(dd.expense>0)html+='<div class="day-expense">-'+(dd.expense/10000).toFixed(0)+'만</div>';
    }
    html+='</div>';
  }
  html+='</div>';
  document.getElementById('calendar-grid').innerHTML=html;
  document.getElementById('day-detail-box').style.display='none';
}

function showDayDetail(dateStr) {
  var dayData=allTransactions.filter(function(t){return t.date===dateStr;});
  document.getElementById('day-detail-title').textContent=dateStr+' 거래 내역';
  if(dayData.length===0){
    document.getElementById('day-detail-list').innerHTML='<p style="color:#aaa;text-align:center;padding:12px">거래 내역이 없습니다.</p>';
  } else {
    var html='';
    dayData.forEach(function(t){
      var sign=t.type==='income'?'+':'-',cls=t.type==='income'?'income':'expense';
      html+='<div class="transaction-item"><div class="transaction-left">';
      html+='<span class="transaction-category">'+t.category+'</span>';
      html+='<span class="transaction-meta">'+(t.account||'현금')+(t.description?' · '+t.description:'')+'</span>';
      html+='</div><div class="transaction-right">';
      html+='<span class="transaction-amount '+cls+'">'+sign+t.amount.toLocaleString()+'원</span>';
      html+='</div></div>';
    });
    document.getElementById('day-detail-list').innerHTML=html;
  }
  document.getElementById('day-detail-box').style.display='block';
  document.getElementById('day-detail-box').scrollIntoView({behavior:'smooth'});
}

// ── 설정 — 계정 ───────────────────────────
function addAccount() {
  var name=document.getElementById('new-account').value.trim();
  if(!name){alert('계정 이름을 입력하세요.');return;}
  apiFetch(API+'/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name})})
  .then(function(r){return r.json();})
  .then(function(d){
    if(d.error){alert(d.error);return;}
    document.getElementById('new-account').value='';
    loadAccounts(); renderAccountList();
  });
}

function renderAccountList() {
  apiFetch(API+'/accounts')
  .then(function(r){return r.json();})
  .then(function(data){
    allAccounts=data;
    var html='';
    data.forEach(function(a){
      html+='<div class="setting-item" id="acc-'+a.id+'">';
      html+='<span class="setting-item-name">'+a.name+'</span>';
      html+='<input class="setting-item-edit" id="acc-input-'+a.id+'" value="'+a.name+'">';
      html+='<div class="setting-actions">';
      html+='<button class="edit-btn" id="acc-edit-btn-'+a.id+'" onclick="toggleAccountEdit('+a.id+')">수정</button>';
      html+='<button class="save-btn" id="acc-save-btn-'+a.id+'" onclick="saveAccount('+a.id+')">저장</button>';
      html+='<button class="del-btn" onclick="deleteAccount('+a.id+')">삭제</button>';
      html+='</div></div>';
    });
    document.getElementById('account-list').innerHTML=html||'<p style="color:#aaa;font-size:13px">등록된 계정이 없습니다.</p>';
  });
}

function toggleAccountEdit(id) {
  var nameEl=document.querySelector('#acc-'+id+' .setting-item-name');
  var inputEl=document.getElementById('acc-input-'+id);
  var editBtn=document.getElementById('acc-edit-btn-'+id);
  var saveBtn=document.getElementById('acc-save-btn-'+id);
  var editing=inputEl.style.display==='flex';
  if(editing){inputEl.style.display='none';nameEl.style.display='inline';editBtn.style.display='inline-block';saveBtn.style.display='none';}
  else{inputEl.style.display='flex';nameEl.style.display='none';editBtn.style.display='none';saveBtn.style.display='inline-block';}
}

function saveAccount(id) {
  var name=document.getElementById('acc-input-'+id).value.trim();
  if(!name){alert('계정 이름을 입력하세요.');return;}
  apiFetch(API+'/accounts/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name})})
  .then(function(r){return r.json();})
  .then(function(d){if(d.error){alert(d.error);return;}loadAccounts();renderAccountList();});
}

function deleteAccount(id) {
  if(!confirm('이 계정을 삭제할까요?'))return;
  apiFetch(API+'/accounts/'+id,{method:'DELETE'})
  .then(function(r){return r.json();})
  .then(function(){loadAccounts();renderAccountList();});
}

// ── 설정 — 카테고리 ──────────────────────
function addCategory() {
  var type=document.getElementById('new-category-type').value;
  var name=document.getElementById('new-category').value.trim();
  if(!name){alert('카테고리 이름을 입력하세요.');return;}
  apiFetch(API+'/categories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,name:name})})
  .then(function(r){return r.json();})
  .then(function(d){if(d.error){alert(d.error);return;}document.getElementById('new-category').value='';loadCategories();renderCategoryList();});
}

function renderCategoryList() {
  apiFetch(API+'/categories')
  .then(function(r){return r.json();})
  .then(function(data){
    allCategories=data;
    var expHtml='',incHtml='';
    data.forEach(function(c){
      var html='<div class="setting-item" id="cat-'+c.id+'">';
      html+='<span class="setting-item-name">'+c.name+'</span>';
      html+='<input class="setting-item-edit" id="cat-input-'+c.id+'" value="'+c.name+'">';
      html+='<div class="setting-actions">';
      html+='<button class="edit-btn" id="cat-edit-btn-'+c.id+'" onclick="toggleCategoryEdit('+c.id+')">수정</button>';
      html+='<button class="save-btn" id="cat-save-btn-'+c.id+'" onclick="saveCategory('+c.id+')">저장</button>';
      html+='<button class="del-btn" onclick="deleteCategory('+c.id+')">삭제</button>';
      html+='</div></div>';
      if(c.type==='expense')expHtml+=html; else incHtml+=html;
    });
    document.getElementById('expense-category-list').innerHTML=expHtml||'<p style="color:#aaa;font-size:13px">없습니다.</p>';
    document.getElementById('income-category-list').innerHTML=incHtml||'<p style="color:#aaa;font-size:13px">없습니다.</p>';
  });
}

function toggleCategoryEdit(id) {
  var nameEl=document.querySelector('#cat-'+id+' .setting-item-name');
  var inputEl=document.getElementById('cat-input-'+id);
  var editBtn=document.getElementById('cat-edit-btn-'+id);
  var saveBtn=document.getElementById('cat-save-btn-'+id);
  var editing=inputEl.style.display==='flex';
  if(editing){inputEl.style.display='none';nameEl.style.display='inline';editBtn.style.display='inline-block';saveBtn.style.display='none';}
  else{inputEl.style.display='flex';nameEl.style.display='none';editBtn.style.display='none';saveBtn.style.display='inline-block';}
}

function saveCategory(id) {
  var name=document.getElementById('cat-input-'+id).value.trim();
  if(!name){alert('카테고리 이름을 입력하세요.');return;}
  apiFetch(API+'/categories/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name})})
  .then(function(r){return r.json();})
  .then(function(d){if(d.error){alert(d.error);return;}loadCategories();renderCategoryList();});
}

function deleteCategory(id) {
  if(!confirm('이 카테고리를 삭제할까요?'))return;
  apiFetch(API+'/categories/'+id,{method:'DELETE'})
  .then(function(r){return r.json();})
  .then(function(){loadCategories();renderCategoryList();});
}


// ── 거래내역 업로드 (복구) ────────────────
function handleFileSelect(event) {
  var file = event.target.files[0];
  if (file) uploadFile(file);
}

function handleFileDrop(event) {
  event.preventDefault();
  document.getElementById('upload-area').classList.remove('dragover');
  var file = event.dataTransfer.files[0];
  if (file) uploadFile(file);
}

function uploadFile(file) {
  var allowed = ['.csv', '.xlsx', '.xls'];
  var ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (allowed.indexOf(ext) === -1) {
    showUploadStatus('error', 'CSV 또는 엑셀(.xlsx) 파일만 업로드 가능합니다.');
    return;
  }

  // 파일 크기 제한 (10MB)
  if (file.size > 10 * 1024 * 1024) {
    showUploadStatus('error', '파일 크기는 10MB 이하만 가능합니다.');
    return;
  }

  showUploadStatus('loading', '📤 파일 업로드 중... (' + file.name + ')');

  var formData = new FormData();
  formData.append('file', file);

  fetch(API + '/import', {
    method: 'POST',
    credentials: 'same-origin',
    body: formData
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.error) {
      showUploadStatus('error', '❌ ' + d.error);
    } else {
      showUploadStatus('success',
        '✅ ' + d.message + '\n' +
        '성공: ' + d.successCount + '건' +
        (d.skipCount > 0 ? '  /  건너뜀: ' + d.skipCount + '건' : '')
      );
      // 파일 입력 초기화
      document.getElementById('file-input').value = '';
      // 거래내역 새로고침
      loadTransactions();
    }
  })
  .catch(function(err) {
    showUploadStatus('error', '❌ 업로드 오류: ' + err.message);
  });
}

function showUploadStatus(type, message) {
  var el = document.getElementById('upload-status');
  el.style.display = 'block';
  el.className = 'upload-status ' + type;
  el.style.whiteSpace = 'pre-line';
  el.textContent = message;
}

// ── 시작 ─────────────────────────────────
init();