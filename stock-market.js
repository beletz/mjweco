// ==========================================================================
// 증권회사 — AI 모의 투자 화면
// 가격·뉴스는 서버(Code.gs getStockMarket)의 "AI 시장 엔진"이 정합니다. 이 파일은 보여 주기와 사고팔기만 합니다.
// 증권회사 직원(또는 선생님)이 고객을 골라 대신 사고팝니다. 한국 주식 화면처럼 오르면 빨강, 내리면 파랑.
// ==========================================================================
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var won = function (n) { return (Number(n) || 0).toLocaleString() + ' 머니'; };
  var market = null;       // 마지막으로 받은 시장 정보
  var timer = null;
  var nextAt = 0;          // 다음 가격 변동 시각 (내 컴퓨터 시계 기준)
  var cc = function () { return (typeof _cc !== 'undefined' && _cc) || (typeof _adminCC !== 'undefined' && _adminCC) || ''; };

  window.stockTab = function (panelId, el) {
    document.querySelectorAll('#stk-tabs .panel-tab').forEach(function (t) { t.classList.remove('act'); });
    document.querySelectorAll('#stk-panels > .panel-content').forEach(function (c) { c.classList.remove('act'); });
    el.classList.add('act');
    $(panelId).classList.add('act');
    if (panelId === 'stk-market') stkRefresh(true);
  };

  // 증권회사 화면을 열 때 (app.js openStudentPanel 에서 부름)
  window.initStockMarket = function () {
    stkFillCustomers();
    stkRefresh(true);
    if (timer) clearInterval(timer);
    timer = setInterval(stkTickClock, 1000);
  };

  function stkFillCustomers() {
    var sel = $('stk-customer'); if (!sel) return;
    var keep = sel.value || (typeof _sno !== 'undefined' && _sno ? String(_sno) : '');
    google.script.run.withSuccessHandler(function (r) {
      if (!r || !r.success) return;
      if (typeof _stuList !== 'undefined') _stuList = r.list;
      var h = '<option value="">-- 고객 선택 --</option>';
      r.list.forEach(function (s) {
        h += '<option value="' + esc(s.studentNo) + '">' + esc(typeof stuOptLabel === 'function' ? stuOptLabel(s) : s.studentNo + '번 ' + (s.name || '')) + '</option>';
      });
      sel.innerHTML = h;
      if (keep && r.list.some(function (s) { return String(s.studentNo) === keep; })) sel.value = keep;
      stkLoadHoldings();
    }).getStudentList(cc());
  }

  // 시장 정보 다시 받기
  window.stkRefresh = function (showLoadingText) {
    if (!cc()) return;
    if (showLoadingText && !market && $('stk-cards')) $('stk-cards').innerHTML = '<div class="empty-msg">시장 불러오는 중...</div>';
    var who = ($('stk-customer') || {}).value || '';
    google.script.run.withSuccessHandler(function (r) {
      if (!r || !r.success) { if ($('stk-cards')) $('stk-cards').innerHTML = '<div class="empty-msg">시장 정보를 불러오지 못했어요.</div>'; return; }
      var first = !market;
      market = r;
      nextAt = Date.now() + (r.nextMs || 0);
      renderCards(first);
      renderNews();
      renderStockSelect();
      renderHoldings(r.holdings);
      stkCalc();
    }).withFailureHandler(function (err) {
      if ($('stk-cards')) $('stk-cards').innerHTML = '<div class="empty-msg">오류: ' + esc(err.message) + '</div>';
    }).getStockMarket(cc(), who);
  };

  function stkTickClock() {
    var view = $('view-stock');
    if (!view || !view.classList.contains('active')) return; // 다른 화면에 있으면 쉬기
    var left = Math.max(0, nextAt - Date.now());
    var m = Math.floor(left / 60000), s = Math.floor(left % 60000 / 1000);
    if ($('stk-next')) $('stk-next').textContent = m + '분 ' + (s < 10 ? '0' : '') + s + '초';
    if (nextAt && left === 0) { nextAt = Date.now() + 5000; stkRefresh(false); } // 시간이 되면 새 가격 받기
  }

  function sparkline(arr, up) {
    if (!arr || arr.length < 2) return '';
    var w = 220, h = 54, min = Math.min.apply(null, arr), max = Math.max.apply(null, arr), span = (max - min) || 1;
    var pts = arr.map(function (v, i) { return (i / (arr.length - 1) * w).toFixed(1) + ',' + (h - 4 - (v - min) / span * (h - 8)).toFixed(1); });
    var color = up ? '#E11D48' : '#2563EB';
    return '<svg class="stk-spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<polyline points="0,' + h + ' ' + pts.join(' ') + ' ' + w + ',' + h + '" fill="' + color + '" fill-opacity=".10" stroke="none"/>' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }

  function renderCards(animate) {
    var box = $('stk-cards'); if (!box || !market) return;
    var cur = ($('stk-stock') || {}).value;
    var h = '';
    market.stocks.forEach(function (s) {
      var up = s.change24 >= 0;
      h += '<div class="stk-card' + (cur === s.id ? ' on' : '') + '" onclick="stkPick(\'' + s.id + '\')">';
      h += '<div class="stk-card-top"><span class="stk-emoji">' + s.emoji + '</span><div><div class="stk-name">' + esc(s.name) + '</div><div class="stk-sector">' + esc(s.sector) + '</div></div></div>';
      h += '<div class="stk-price">' + won(s.price) + '</div>';
      h += '<div class="stk-chg ' + (up ? 'up' : 'down') + '">' + (up ? '▲ ' : '▼ ') + Math.abs(s.change24) + '% <span>최근 24시간</span></div>';
      h += sparkline(s.history, up);
      h += '<div class="stk-ai">🤖 ' + esc(s.comment) + '</div>';
      h += '</div>';
    });
    box.innerHTML = h;
    if (animate && window.anime && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      anime({ targets: box.querySelectorAll('.stk-card'), opacity: [0, 1], translateY: [14, 0], delay: anime.stagger(70), duration: 480, easing: 'cubicBezier(.2,.7,.2,1)',
        complete: function () { box.querySelectorAll('.stk-card').forEach(function (c) { c.style.opacity = ''; c.style.transform = ''; }); } });
    }
  }

  function renderNews() {
    var box = $('stk-news'); if (!box || !market) return;
    if (!market.news.length) { box.innerHTML = '<div class="empty-msg">아직 큰 뉴스가 없어요.</div>'; return; }
    var h = '';
    market.news.forEach(function (n) {
      h += '<div class="stk-news ' + (n.up ? 'up' : 'down') + '">';
      h += '<div class="stk-news-top"><span>' + n.emoji + ' ' + esc(n.name) + '</span><span class="stk-news-pct">' + (n.up ? '▲ +' : '▼ ') + n.pct + '%</span></div>';
      h += '<div class="stk-news-text">' + esc(n.text) + '</div>';
      h += '<div class="stk-news-when">' + esc(n.when) + '</div>';
      h += '</div>';
    });
    box.innerHTML = h;
  }

  function renderStockSelect() {
    var sel = $('stk-stock'); if (!sel || !market) return;
    var keep = sel.value || market.stocks[0].id;
    sel.innerHTML = market.stocks.map(function (s) { return '<option value="' + s.id + '">' + s.emoji + ' ' + esc(s.name) + ' — 1주 ' + won(s.price) + '</option>'; }).join('');
    sel.value = keep;
  }

  window.stkPick = function (id) {
    var sel = $('stk-stock'); if (!sel) return;
    sel.value = id; stkCalc(); renderCards(false);
    var q = $('stk-qty'); if (q) q.focus();
  };

  function priceOf(id) { var p = 0; (market ? market.stocks : []).forEach(function (s) { if (s.id === id) p = s.price; }); return p; }

  window.stkCalc = function () {
    var est = $('stk-est'); if (!est || !market) return;
    var id = ($('stk-stock') || {}).value, qty = parseInt(($('stk-qty') || {}).value) || 0;
    var p = priceOf(id);
    est.innerHTML = qty > 0 ? '예상 금액 <b>' + won(p * qty) + '</b> <span>(1주 ' + won(p) + ' × ' + qty + '주)</span>' : '수량을 적어 주세요.';
    if (market) renderCards(false);
  };

  window.stkLoadHoldings = function () {
    var who = ($('stk-customer') || {}).value;
    if (!who) { renderHoldings(null); return; }
    google.script.run.withSuccessHandler(function (r) { if (r && r.success) { market = r; nextAt = Date.now() + (r.nextMs || 0); renderHoldings(r.holdings); } })
      .getStockMarket(cc(), who);
  };

  function renderHoldings(hd) {
    var box = $('stk-holdings'); if (!box) return;
    var who = ($('stk-customer') || {}).value;
    if (!who || !hd) { box.innerHTML = '<div class="empty-msg" style="padding:14px;">고객을 고르면 가진 주식이 보여요.</div>'; return; }
    if (!hd.list.length) { box.innerHTML = '<div class="empty-msg" style="padding:14px;">아직 가진 주식이 없어요.</div>'; return; }
    var h = '<div class="stk-hd-title">📂 가진 주식</div>';
    hd.list.forEach(function (x) {
      var up = x.profit >= 0;
      h += '<div class="stk-hd-row"><span class="stk-hd-name">' + x.emoji + ' ' + esc(x.name) + ' <small>' + x.qty + '주 · 산 값 평균 ' + x.avg.toLocaleString() + '</small></span>' +
        '<span class="stk-hd-val">' + won(x.value) + '<small class="' + (up ? 'up' : 'down') + '">' + (up ? '+' : '') + x.profit.toLocaleString() + ' (' + (up ? '+' : '') + x.pct + '%)</small></span></div>';
    });
    var up = hd.profit >= 0;
    h += '<div class="stk-hd-total">합계 ' + won(hd.totalValue) + ' <span class="' + (up ? 'up' : 'down') + '">' + (up ? '+' : '') + hd.profit.toLocaleString() + '</span></div>';
    box.innerHTML = h;
  }

  window.stkTrade = function (side) {
    var who = ($('stk-customer') || {}).value;
    var id = ($('stk-stock') || {}).value, qty = parseInt(($('stk-qty') || {}).value) || 0;
    if (!who) return alert('고객을 선택해 주세요.');
    if (qty <= 0) return alert('수량을 1주 이상 적어 주세요.');
    var s = null; market.stocks.forEach(function (x) { if (x.id === id) s = x; });
    if (!s) return alert('종목을 골라 주세요.');
    var label = ($('stk-customer').selectedOptions[0] || {}).textContent || who + '번';
    if (!confirm('[' + (side === 'buy' ? '사기 (매수)' : '팔기 (매도)') + ']\n\n고객: ' + label.split('·')[0].trim() + '\n종목: ' + s.emoji + ' ' + s.name +
      '\n수량: ' + qty + '주\n지금 가격: 1주 ' + won(s.price) + '\n금액: ' + won(s.price * qty) + '\n\n가격이 바뀌는 순간이면 거래 시점 가격으로 처리돼요. 진행할까요?')) return;
    if (typeof showLoading === 'function') showLoading();
    var operator = (typeof _sno !== 'undefined' && _sno) || '교사';
    google.script.run.withSuccessHandler(function (r) {
      if (typeof hideLoading === 'function') hideLoading();
      if (typeof showToast === 'function') showToast(r && r.success ? '✅ ' + r.msg : '⚠️ ' + ((r && r.msg) || '거래하지 못했어요.'));
      if (r && r.success) { $('stk-qty').value = 1; stkFillCustomers(); stkRefresh(false); }
    }).withFailureHandler(function (err) {
      if (typeof hideLoading === 'function') hideLoading();
      alert('오류: ' + err.message);
    }).tradeStock(cc(), operator, who, id, side, qty);
  };
})();
