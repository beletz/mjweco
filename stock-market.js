// ==========================================================================
// 증권회사 — AI 모의 투자 화면
// 가격·뉴스는 서버(Code.gs getStockMarket)의 "AI 시장 엔진"이 정합니다. 이 파일은 보여 주기와 사고팔기만 합니다.
// 가격은 선생님이 "직접 돌리기"를 누르거나, "자동으로 돌리기"를 켜 두면 평일 오전 8:45에 바뀝니다.
// 증권회사 직원(또는 선생님)이 고객을 골라 대신 사고팝니다. 한국 주식 화면처럼 오르면 빨강, 내리면 파랑.
// ==========================================================================
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var won = function (n) { return (Number(n) || 0).toLocaleString() + ' 머니'; };
  var market = null;       // 마지막으로 받은 시장 정보
  var timer = null;
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
    timer = setInterval(stkTickClock, 30000);
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
      renderStatus();
      renderCards(first);
      renderNews();
      renderStockSelect();
      renderHoldings(r.holdings);
      stkCalc();
    }).withFailureHandler(function (err) {
      if ($('stk-cards')) $('stk-cards').innerHTML = '<div class="empty-msg">오류: ' + esc(err.message) + '</div>';
    }).getStockMarket(cc(), who);
  };

  // 화면을 켜 둔 채 자동 변동 시각(평일 8:45)이 지나면 새 가격 받기
  function stkTickClock() {
    var view = $('view-stock');
    if (!view || !view.classList.contains('active') || !market) return; // 다른 화면에 있으면 쉬기
    if (market.auto && market.nextAutoAt && Date.now() >= market.nextAutoAt) stkRefresh(false);
  }

  // 위쪽 안내(다음 변동 시각)와 선생님용 버튼
  function renderStatus() {
    if (!market) return;
    var box = $('stk-next');
    if (box) box.innerHTML = market.auto
      ? '⏰ 다음 자동 변동 <b>' + esc(market.nextAutoLabel) + '</b>'
      : '✋ 자동 변동 꺼짐 <span style="color:#94A3B8;">· 선생님이 직접 돌려요</span>';
    var ctrl = $('stk-ctrl');
    if (ctrl) ctrl.style.display = (typeof _isTeacher !== 'undefined' && _isTeacher) ? 'flex' : 'none';
    var chk = $('stk-auto'); if (chk) chk.checked = !!market.auto;
  }

  // 직접 돌리기 (선생님)
  window.stkRunStep = async function () {
    if (!await uiConfirm('주식 가격을 지금 한 번 바꿀까요?\n종목마다 정해 둔 변동 폭 안에서 무작위로 오르거나 내려요.\n(% 고정을 켠 종목은 고정한 값만큼 바뀌어요.)')) return;
    if (typeof showLoading === 'function') showLoading();
    google.script.run.withSuccessHandler(function (r) {
      if (typeof hideLoading === 'function') hideLoading();
      if (typeof showToast === 'function') showToast(r && r.success ? '🎲 ' + r.msg : '⚠️ ' + ((r && r.msg) || '돌리지 못했어요.'));
      if (r && r.success) { stkRefresh(false); stkFillCustomers(); }
    }).withFailureHandler(function (err) {
      if (typeof hideLoading === 'function') hideLoading();
      alert('오류: ' + err.message);
    }).runStockStep(cc());
  };

  // 자동으로 돌리기 켜기/끄기 (선생님)
  window.stkSetAuto = function (on) {
    google.script.run.withSuccessHandler(function (r) {
      if (typeof showToast === 'function') showToast(r && r.success ? '✅ ' + r.msg : '⚠️ ' + ((r && r.msg) || '바꾸지 못했어요.'));
      stkRefresh(false);
    }).withFailureHandler(function (err) { alert('오류: ' + err.message); stkRefresh(false); })
      .setStockAuto(cc(), on === true);
  };

  // ======================================================================
  // 주식 그래프 — 오른쪽이 가장 최근. 꺾이는 점마다 아래에 날짜.
  //  stkChart(가격들, 날짜들, { full: true면 전체 / 아니면 최근 7일 })
  //  선은 SVG로, 점·날짜·가격 글자는 HTML로 올려서 늘어나도 글자가 찌그러지지 않게 함
  // ======================================================================
  var DAY = 24 * 60 * 60 * 1000;
  function md(t) { var d = new Date(t); return (d.getMonth() + 1) + '/' + d.getDate(); }
  function whenFull(t) {
    var d = new Date(t), h = d.getHours(), m = d.getMinutes();
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + (h < 12 ? '오전 ' : '오후 ') + ((h % 12) || 12) + ':' + (m < 10 ? '0' : '') + m;
  }
  function chartPoints(prices, times, full) {
    var pts = (prices || []).map(function (p, i) { return { p: Number(p) || 0, t: (times && times[i]) || null }; });
    if (full || pts.length <= 2) return pts;
    var from = Date.now() - 7 * DAY;
    var recent = pts.filter(function (x) { return x.t && x.t >= from; });
    if (recent.length >= 2) return recent;
    // 최근 7일 안에 변동이 1번 이하라면: 그 직전 가격부터 이어서 보여 줌
    var start = recent.length ? pts.indexOf(recent[0]) - 1 : pts.length - 2;
    return pts.slice(Math.max(0, Math.min(start, pts.length - 2)));
  }
  function stkChart(prices, times, opt) {
    opt = opt || {};
    var pts = chartPoints(prices, times, !!opt.full);
    if (pts.length < 2) return '<div class="stkc-empty">아직 가격이 한 번도 바뀌지 않았어요.</div>';
    var n = pts.length, vals = pts.map(function (x) { return x.p; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals), span = (max - min) || 1;
    var PADX = opt.full ? 4 : 7, PADT = 10, PADB = 10;         // % (양 끝 날짜 글자가 잘리지 않게 여유)
    var X = function (i) { return PADX + i / (n - 1) * (100 - PADX * 2); };
    var Y = function (v) { return PADT + (1 - (v - min) / span) * (100 - PADT - PADB); };
    var up = vals[n - 1] >= vals[0];
    var color = up ? '#E11D48' : '#2563EB';
    var line = pts.map(function (x, i) { return (X(i) * 10).toFixed(1) + ',' + (Y(x.p) * 10).toFixed(1); });
    var area = (X(0) * 10).toFixed(1) + ',1000 ' + line.join(' ') + ' ' + (X(n - 1) * 10).toFixed(1) + ',1000';
    var h = '<div class="stkc ' + (opt.full ? 'stkc-full' : 'stkc-card') + '">';
    h += '<div class="stkc-plot">';
    h += '<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">' +
      '<polygon points="' + area + '" fill="' + color + '" fill-opacity=".10"/>' +
      '<polyline points="' + line.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="' + (opt.full ? 3 : 2.5) + '" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>';
    // 점 (마우스를 올리면 날짜·가격)
    var showDots = opt.full ? n <= 60 : true;
    pts.forEach(function (x, i) {
      var last = i === n - 1;
      if (!showDots && !last) return;
      h += '<span class="stkc-dot' + (last ? ' last' : '') + '" style="left:' + X(i).toFixed(2) + '%;top:' + Y(x.p).toFixed(2) + '%;border-color:' + color + '" title="' +
        (x.t ? whenFull(x.t) + ' · ' : '') + x.p.toLocaleString() + '"></span>';
    });
    if (opt.full) {
      h += '<span class="stkc-y top">' + max.toLocaleString() + '</span><span class="stkc-y bot">' + min.toLocaleString() + '</span>';
    }
    h += '</div>';
    // 날짜 (꺾이는 점 아래). 같은 날짜가 이어지면 그 날의 첫 점에만.
    // 화면에 그린 뒤 stkFitLabels가 실제로 겹치는 글자만 숨김 (가장 최근 날짜는 항상 보임)
    var cand = [], prevLbl = '';
    pts.forEach(function (x, i) {
      var lbl = x.t ? md(x.t) : '';
      if (!lbl || lbl === prevLbl) return;
      prevLbl = lbl; cand.push({ x: X(i), lbl: lbl });
    });
    h += '<div class="stkc-x">';
    cand.forEach(function (c, k) {
      h += '<span class="stkc-d' + (k === cand.length - 1 ? ' lastx' : '') + '" style="left:' + c.x.toFixed(2) + '%">' + c.lbl + '</span>';
    });
    h += '</div></div>';
    return h;
  }
  window.stkChart = stkChart;

  // 날짜 글자가 겹치면 겹치는 것만 숨김 (화면 너비에 맞춰 자동). root 안의 그래프 모두 처리
  function fitLabels(root) {
    (root || document).querySelectorAll('.stkc-x').forEach(function (row) {
      var spans = Array.prototype.slice.call(row.querySelectorAll('.stkc-d'));
      if (!spans.length || !row.offsetWidth) return;
      spans.forEach(function (s) { s.style.visibility = ''; });
      var GAP = 6, rects = spans.map(function (s) { return s.getBoundingClientRect(); });
      var keep = [], last = spans.length - 1;
      for (var i = 0; i < spans.length; i++) {
        var prev = keep[keep.length - 1];
        if (prev === undefined || rects[i].left >= rects[prev].right + GAP) keep.push(i);
        else if (i === last) {                      // 가장 최근 날짜는 꼭 보이게: 앞에서 겹치는 것을 뺌
          while (keep.length && rects[last].left < rects[keep[keep.length - 1]].right + GAP) keep.pop();
          keep.push(i);
        }
      }
      spans.forEach(function (s, k) { if (keep.indexOf(k) < 0) s.style.visibility = 'hidden'; });
    });
  }
  window.stkFitLabels = function (root) { requestAnimationFrame(function () { fitLabels(root); }); };
  var fitTimer = 0;
  window.addEventListener('resize', function () { clearTimeout(fitTimer); fitTimer = setTimeout(function () { fitLabels(document); }, 120); });

  // 전체 그래프 창 (s: 종목 정보 — getStockMarket의 stocks 한 개)
  window.stkOpenChart = function (s) {
    if (!s) return;
    var box = document.getElementById('stk-chart-modal');
    if (!box) {
      box = document.createElement('div');
      box.id = 'stk-chart-modal';
      box.className = 'stkm-wrap';
      box.innerHTML = '<div class="stkm" role="dialog" aria-modal="true"><button class="stkm-x" type="button" aria-label="닫기">✕</button><div class="stkm-body"></div></div>';
      box.addEventListener('click', function (e) { if (e.target === box || e.target.classList.contains('stkm-x')) box.classList.remove('open'); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') box.classList.remove('open'); });
      document.body.appendChild(box);
    }
    var hist = s.history || [s.price], times = s.historyAt || [];
    var first = hist[0], last = hist[hist.length - 1];
    var pct = first ? Math.round((last - first) / first * 1000) / 10 : 0;
    var hi = Math.max.apply(null, hist), lo = Math.min.apply(null, hist);
    var since = '';
    for (var i = 0; i < times.length; i++) if (times[i]) { since = whenFull(times[i]); break; }
    var cls = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
    var h = '<div class="stkm-head"><span class="stk-emoji">' + s.emoji + '</span><div><div class="stkm-name">' + esc(s.name) + ' <small>' + esc(s.sector || '') + '</small></div>' +
      '<div class="stkm-sub">📈 전체 그래프 동향 · 지금까지 ' + (hist.length - 1) + '번 바뀜' + (since ? ' · ' + esc(since) + '부터' : '') + '</div></div></div>';
    h += '<div class="stkm-stats">' +
      '<div><small>지금 가격</small><b>' + won(last) + '</b></div>' +
      '<div><small>처음보다</small><b class="' + cls + '">' + (pct > 0 ? '▲ +' : pct < 0 ? '▼ ' : '') + pct + '%</b></div>' +
      '<div><small>가장 비쌀 때</small><b class="up">' + won(hi) + '</b></div>' +
      '<div><small>가장 쌀 때</small><b class="down">' + won(lo) + '</b></div></div>';
    h += stkChart(hist, times, { full: true });
    h += '<div class="stkm-tip">💡 점에 마우스를 올리면 그날 가격이 보여요. 오른쪽 끝이 가장 최근이에요.' +
      (times.some(function (t) { return !t; }) ? ' 날짜 기록을 시작하기 전의 가격은 날짜 없이 보여요.' : '') + '</div>';
    box.querySelector('.stkm-body').innerHTML = h;
    box.classList.add('open');
    window.stkFitLabels(box);
    if (window.anime && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      anime({ targets: box.querySelector('.stkm'), opacity: [0, 1], translateY: [16, 0], scale: [0.98, 1], duration: 380, easing: 'cubicBezier(.2,.7,.2,1)' });
    }
  };
  window.stkShowChart = function (id) {
    var s = null; ((market && market.stocks) || []).forEach(function (x) { if (x.id === id) s = x; });
    window.stkOpenChart(s);
  };

  window.stkSparkline = function (a, u) { return sparkline(a, u); };
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
      var up = s.change >= 0;
      h += '<div class="stk-card' + (cur === s.id ? ' on' : '') + '" onclick="stkPick(\'' + s.id + '\')">';
      h += '<div class="stk-card-top"><span class="stk-emoji">' + s.emoji + '</span><div><div class="stk-name">' + esc(s.name) + '</div><div class="stk-sector">' + esc(s.sector) + '</div></div></div>';
      h += '<div class="stk-price">' + won(s.price) + '</div>';
      h += '<div class="stk-chg ' + (s.change > 0 ? 'up' : s.change < 0 ? 'down' : 'flat') + '">' + (s.change > 0 ? '▲ ' : s.change < 0 ? '▼ ' : '– ') + Math.abs(s.change) + '% <span>지난 변동</span></div>';
      h += '<div class="stk-graph" title="누르면 전체 그래프가 보여요" onclick="event.stopPropagation();stkShowChart(\'' + s.id + '\')">' +
        '<div class="stk-graph-top"><span>최근 7일</span><span class="stk-graph-more">🔍 전체 그래프</span></div>' +
        stkChart(s.history, s.historyAt) + '</div>';
      h += '<div class="stk-ai">🤖 ' + esc(s.comment) + '</div>';
      h += '</div>';
    });
    box.innerHTML = h;
    window.stkFitLabels(box);
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
    google.script.run.withSuccessHandler(function (r) { if (r && r.success) { market = r; renderStatus(); renderHoldings(r.holdings); } })
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

  window.stkTrade = async function (side) {
    var who = ($('stk-customer') || {}).value;
    var id = ($('stk-stock') || {}).value, qty = parseInt(($('stk-qty') || {}).value) || 0;
    if (!who) return alert('고객을 선택해 주세요.');
    if (qty <= 0) return alert('수량을 1주 이상 적어 주세요.');
    var s = null; market.stocks.forEach(function (x) { if (x.id === id) s = x; });
    if (!s) return alert('종목을 골라 주세요.');
    var label = ($('stk-customer').selectedOptions[0] || {}).textContent || who + '번';
    if (!await uiConfirm('[' + (side === 'buy' ? '사기 (매수)' : '팔기 (매도)') + ']\n\n고객: ' + label.split('·')[0].trim() + '\n종목: ' + s.emoji + ' ' + s.name +
      '\n수량: ' + qty + '주\n지금 가격: 1주 ' + won(s.price) + '\n금액: ' + won(s.price * qty) + '\n\n진행할까요?')) return;
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

  // ======================================================================
  // 마스터 → 📈 증권회사 : 가격 돌리기 + 종목 이름·변동 폭 설정 (선생님)
  // ======================================================================
  var adminCC = function () { return (typeof _adminCC !== 'undefined' && _adminCC) || cc(); };

  window.loadStockAdmin = function () {
    var box = $('sa-stocks'); if (!box) return;
    google.script.run.withSuccessHandler(function (r) {
      if (!r || !r.success) { box.innerHTML = '<div class="empty-msg">불러오지 못했어요.</div>'; return; }
      if ($('sa-auto')) $('sa-auto').checked = !!r.auto;
      if ($('sa-status')) $('sa-status').innerHTML =
        (r.auto ? '⏰ 다음 자동 변동: <b>' + esc(r.nextAutoLabel) + '</b>' : '✋ 자동 변동 꺼짐') +
        '<br><span>지금까지 ' + (r.round || 0) + '번 바뀜' + (r.lastRunLabel ? ' · 마지막: ' + esc(r.lastRunLabel) + (r.lastRunBy ? ' (' + esc(r.lastRunBy) + ')' : '') : '') + '</span>';
      var inp = 'padding:9px 10px;border:2px solid #E2E8F0;border-radius:10px;font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;width:100%;min-width:0;';
      var h = '<div class="sa-row sa-head"><div>그림</div><div>종목 이름</div><div>업종</div><div>최소 %</div><div>최대 %</div><div>% 고정</div><div>지금 가격</div></div>';
      r.stocks.forEach(function (s, i) {
        var fixed = s.fixedPct !== null && s.fixedPct !== undefined;
        h += '<div class="sa-row' + (fixed ? ' sa-fixed' : '') + '" data-id="' + esc(s.id) + '">';
        h += '<input class="sa-emoji" maxlength="4" value="' + esc(s.emoji) + '" style="' + inp + 'text-align:center;font-size:20px;">';
        h += '<input class="sa-name" maxlength="20" placeholder="종목 이름" value="' + esc(s.name) + '" style="' + inp + '">';
        h += '<input class="sa-sector" maxlength="20" placeholder="예: 과자·식품" value="' + esc(s.sector) + '" style="' + inp + '">';
        h += '<input class="sa-min" type="number" step="0.5" min="-30" max="30" value="' + s.minPct + '" title="' + (fixed ? '% 고정 중에는 쓰지 않아요' : '') + '" style="' + inp + 'color:#2563EB;">';
        h += '<input class="sa-max" type="number" step="0.5" min="-30" max="30" value="' + s.maxPct + '" title="' + (fixed ? '% 고정 중에는 쓰지 않아요' : '') + '" style="' + inp + 'color:#E11D48;">';
        h += '<div class="sa-fix">';
        h += '<input class="sa-fixed-pct" type="number" step="0.5" min="-30" max="30" placeholder="예: 5" value="' + (fixed ? s.fixedPct : '') + '" style="' + inp + '">';
        h += fixed
          ? '<button type="button" class="sa-fix-btn off" onclick="stockAdminUnfix(' + i + ')">🔓 해제</button>'
          : '<button type="button" class="sa-fix-btn on" onclick="stockAdminFix(' + i + ')">🔒 고정</button>';
        h += '<div class="sa-fix-state">' + (fixed ? '🔒 매번 ' + (s.fixedPct > 0 ? '+' : '') + s.fixedPct + '%로 고정' : '🎲 최소~최대 사이 랜덤') + '</div>';
        h += '</div>';
        h += '<div class="sa-price">' + won(s.price) + '</div>';
        h += '</div>';
      });
      box.innerHTML = h;
    }).getStockMarket(adminCC());
  };

  window.stockAdminSave = function () {
    var rows = document.querySelectorAll('#sa-stocks .sa-row[data-id]'), list = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], q = function (c) { return (r.querySelector(c) || {}).value || ''; };
      var lo = parseFloat(q('.sa-min')), hi = parseFloat(q('.sa-max'));
      if (!q('.sa-name').trim()) return alert((i + 1) + '번째 종목 이름을 적어 주세요.');
      if (isNaN(lo) || isNaN(hi)) return alert(q('.sa-name') + ': 변동 폭을 숫자로 적어 주세요.');
      if (lo > hi) return alert(q('.sa-name') + ': 최소 %가 최대 %보다 클 수 없어요.');
      if (lo < -30 || hi > 30) return alert(q('.sa-name') + ': 변동 폭은 -30 ~ 30 사이로 적어 주세요.');
      var fx = q('.sa-fixed-pct').trim();
      if (fx !== '' && (isNaN(parseFloat(fx)) || parseFloat(fx) < -30 || parseFloat(fx) > 30)) return alert(q('.sa-name') + ': 고정 %는 -30 ~ 30 사이 숫자로 적어 주세요.');
      list.push({ id: r.getAttribute('data-id'), emoji: q('.sa-emoji'), name: q('.sa-name'), sector: q('.sa-sector'), minPct: lo, maxPct: hi,
                  fixedPct: fx === '' ? null : parseFloat(fx) });
    }
    if (typeof showLoading === 'function') showLoading();
    google.script.run.withSuccessHandler(function (r) {
      if (typeof hideLoading === 'function') hideLoading();
      if (typeof showToast === 'function') showToast(r && r.success ? '✅ ' + r.msg : '⚠️ ' + ((r && r.msg) || '저장하지 못했어요.'));
      if (r && r.success) loadStockAdmin();
    }).withFailureHandler(function (err) {
      if (typeof hideLoading === 'function') hideLoading();
      alert('오류: ' + err.message);
    }).setStockSettings(adminCC(), JSON.stringify(list));
  };

  // % 고정 / 고정 해제 (누르면 바로 저장)
  function saRow(i) { return document.querySelectorAll('#sa-stocks .sa-row[data-id]')[i]; }
  window.stockAdminFix = async function (i) {
    var row = saRow(i); if (!row) return;
    var inp = row.querySelector('.sa-fixed-pct'), name = (row.querySelector('.sa-name') || {}).value || '이 종목';
    var v = (inp.value || '').trim();
    if (v === '') { inp.focus(); return alert(name + ': 고정할 %를 먼저 적어 주세요. (예: 5 → 매번 +5%, -3 → 매번 -3%)'); }
    var n = parseFloat(v);
    if (isNaN(n) || n < -30 || n > 30) return alert(name + ': 고정 %는 -30 ~ 30 사이 숫자로 적어 주세요.');
    if (!await uiConfirm(name + '을(를) 매번 ' + (n > 0 ? '+' : '') + n + '%로 고정할까요?\n고정을 해제할 때까지 직접 돌리기·자동 돌리기 모두 이 값으로 바뀌어요.')) return;
    stockAdminSave();
  };
  window.stockAdminUnfix = async function (i) {
    var row = saRow(i); if (!row) return;
    var name = (row.querySelector('.sa-name') || {}).value || '이 종목';
    if (!await uiConfirm(name + '의 % 고정을 해제할까요?\n다음부터는 최소~최대 사이에서 랜덤으로 바뀌어요.')) return;
    row.querySelector('.sa-fixed-pct').value = '';
    stockAdminSave();
  };

  window.stockAdminRun = async function () {
    if (!await uiConfirm('주식 가격을 지금 한 번 바꿀까요?\n종목마다 정해 둔 변동 폭 안에서 무작위로 오르거나 내려요.\n(% 고정을 켠 종목은 고정한 값만큼 바뀌어요.)')) return;
    if (typeof showLoading === 'function') showLoading();
    google.script.run.withSuccessHandler(function (r) {
      if (typeof hideLoading === 'function') hideLoading();
      if (typeof showToast === 'function') showToast(r && r.success ? '🎲 ' + r.msg : '⚠️ ' + ((r && r.msg) || '돌리지 못했어요.'));
      if (r && r.success) loadStockAdmin();
    }).withFailureHandler(function (err) {
      if (typeof hideLoading === 'function') hideLoading();
      alert('오류: ' + err.message);
    }).runStockStep(adminCC());
  };

  window.stockAdminAuto = function (on) {
    google.script.run.withSuccessHandler(function (r) {
      if (typeof showToast === 'function') showToast(r && r.success ? '✅ ' + r.msg : '⚠️ ' + ((r && r.msg) || '바꾸지 못했어요.'));
      loadStockAdmin();
    }).withFailureHandler(function (err) { alert('오류: ' + err.message); loadStockAdmin(); })
      .setStockAuto(adminCC(), on === true);
  };
})();
