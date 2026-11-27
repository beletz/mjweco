// ==========================================================================
// wallet-tabs.js — 국민(용돈기입장) 화면의 탭
//  💳 용돈기입장(체크카드) | 📚 내 과제 현황 | 🍪 간식 신청 | 🏪 매점 시세표 | 📜 벌금 법전 | 📈 나의 주식
//  학생은 자기 것만, 선생님은 위쪽 "학생 선택"에서 고른 학생 것을 봅니다.
//  서버: Code.gs getHomeworkList · getSnackMenu/setSnackMenu · getSnackRequests · requestSnack ·
//        cancelSnackRequest · approveSnackRequest · rejectSnackRequest · getStorePriceBoard · getFineLaw · getStockMarket
// ==========================================================================
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var E = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var won = function (n) { return (Number(n) || 0).toLocaleString() + ' 머니'; };
  var cc = function () { return (typeof _cc !== 'undefined' && _cc) || (typeof _adminCC !== 'undefined' && _adminCC) || ''; };
  var teacher = function () { return typeof _isTeacher !== 'undefined' && _isTeacher === true; };
  // 지금 보고 있는 학생 번호 (선생님은 고른 학생)
  var target = function () { return teacher() ? (($('w-stu-sel') || {}).value || '') : String((typeof _sno !== 'undefined' && _sno) || ''); };
  var empty = function (icon, msg) { return '<div class="wt-empty"><div>' + icon + '</div>' + msg + '</div>'; };
  var fail = function (err) { return '<div class="empty-msg">불러오지 못했어요: ' + E((err && err.message) || err) + '</div>'; };
  var current = 'wt-book';
  var stockTimer = null;

  function motion(nodes) { if (typeof salMotion === 'function' && nodes && nodes.length) salMotion(nodes, 10); }

  // ── 탭 바꾸기 ──
  window.walletTab = function (id, el) {
    current = id;
    document.querySelectorAll('#w-tabs .dt').forEach(function (t) { t.classList.remove('act'); });
    var tab = el || document.querySelector('#w-tabs .dt[onclick*="' + id + '"]');
    if (tab) tab.classList.add('act');
    document.querySelectorAll('#view-citizen-wallet .rp > .tc').forEach(function (c) { c.classList.toggle('act', c.id === id); });
    // 용돈기입장 탭이 아니면 왼쪽 "기록하기"를 숨기고 넓게 보여 줌
    var body = $('w-body'); if (body) body.classList.toggle('wt-wide', id !== 'wt-book');
    stopStockTimer();
    loadTab(id);
  };

  // 선생님이 다른 학생을 고르면 지금 탭을 새로 불러옴 (app.js walletTeacherPick에서 부름)
  window.walletTabRefresh = function () { couponBadge(); if (current !== 'wt-book') loadTab(current); else refreshSnackBadge(); };
  // 용돈기입장을 열 때 (app.js initWalletPanel에서 부름)
  window.walletTabsReset = function () { walletTab('wt-book'); refreshSnackBadge(); couponBadge(); };

  function loadTab(id) {
    if (id === 'wt-hw') loadHomework();
    else if (id === 'wt-snack') loadSnack();
    else if (id === 'wt-store') loadStore();
    else if (id === 'wt-law') loadLaw();
    else if (id === 'wt-stock') { loadStock(true); startStockTimer(); }
    else if (id === 'wt-seat') { if (typeof loadSeatMap === 'function') loadSeatMap('wt-seat-box'); }
    else if (id === 'wt-donate') loadDonate();
    else if (id === 'wt-hof') loadHof();
  }

  // ======================================================================
  // 📚 내 과제 현황
  // ======================================================================
  var HW_ST = {
    'O': { t: '제출', c: 'ok', i: '✅' },
    '△': { t: '지각', c: 'late', i: '⏰' },
    'X': { t: '미제출', c: 'miss', i: '❌' }
  };
  function loadHomework() {
    var box = $('wt-hw-box'), sno = target();
    if (!sno) { box.innerHTML = empty('🙋', '위에서 학생을 선택하세요.'); return; }
    box.innerHTML = '<div class="empty-msg">불러오는 중...</div>';
    google.script.run.withSuccessHandler(function (r) {
      if (!r || !r.success) { box.innerHTML = fail(r && r.msg); return; }
      google.script.run.withSuccessHandler(function (cs) { renderHomework(r.list, sno, cs || {}); })
        .withFailureHandler(function () { renderHomework(r.list, sno, {}); })
        .getHomeworkCreditSettings(cc());
    }).withFailureHandler(function (e) { box.innerHTML = fail(e); }).getHomeworkList(cc());
  }
  function renderHomework(list, sno, cs) {
    var box = $('wt-hw-box');
    if (!list.length) { box.innerHTML = empty('📚', '아직 등록된 과제가 없어요.'); return; }
    var cnt = { O: 0, '△': 0, X: 0, none: 0 };
    var rows = list.map(function (h) {
      var s = (h.statuses || {})[sno] || '';
      if (HW_ST[s]) cnt[s]++; else cnt.none++;
      return { h: h, s: s };
    });
    var total = list.length, done = cnt.O + cnt['△'];
    var rate = total ? Math.round(cnt.O / total * 100) : 0;
    var score = function (v) { v = Number(v) || 0; return (v > 0 ? '+' : '') + v + '점'; };
    var h = '<div class="wt-hw-sum">';
    h += '<div class="wt-hw-rate"><div class="wt-ring" style="--p:' + rate + '"><span>' + rate + '%</span></div><div><b>제때 제출률</b><small>전체 ' + total + '개 중 ' + cnt.O + '개 제때 냈어요' + (cnt['△'] ? ' (늦게 낸 것 ' + cnt['△'] + '개)' : '') + '</small></div></div>';
    h += '<div class="wt-hw-chip ok"><span>✅ 제출</span><b>' + cnt.O + '</b>' + (cs.oScore != null ? '<small>신용 ' + score(cs.oScore) + '</small>' : '') + '</div>';
    h += '<div class="wt-hw-chip late"><span>⏰ 지각</span><b>' + cnt['△'] + '</b>' + (cs.dScore != null ? '<small>신용 ' + score(cs.dScore) + '</small>' : '') + '</div>';
    h += '<div class="wt-hw-chip miss"><span>❌ 미제출</span><b>' + cnt.X + '</b>' + (cs.xScore != null ? '<small>신용 ' + score(cs.xScore) + '</small>' : '') + '</div>';
    h += '<div class="wt-hw-chip none"><span>⌛ 확인 전</span><b>' + cnt.none + '</b><small>통계청이 아직 체크 안 함</small></div>';
    h += '</div>';
    h += '<div class="wt-list">';
    rows.forEach(function (x) {
      var st = HW_ST[x.s] || { t: '확인 전', c: 'none', i: '⌛' };
      var rep = x.h.reportStatus === '승인' ? '<span class="wt-tag green">결재 완료 · 신용 반영</span>'
        : x.h.reportStatus === '보고' ? '<span class="wt-tag blue">대통령 결재 중</span>' : '';
      h += '<div class="wt-row wt-hw-' + st.c + '"><div class="wt-row-main"><div class="wt-row-title">' + E(x.h.title) + '</div>' +
        '<div class="wt-row-sub">📅 ' + E(x.h.date) + ' ' + rep + '</div></div>' +
        '<span class="wt-st ' + st.c + '">' + st.i + ' ' + st.t + '</span></div>';
    });
    h += '</div>';
    box.innerHTML = h;
    motion(box.querySelectorAll('.wt-row'));
  }

  // ======================================================================
  // 🍪 간식 신청
  // ======================================================================
  var snackMenu = [], snackRows = [];
  var ST_CLASS = { '대기': 'wait', '승인': 'ok', '반려': 'miss', '취소': 'none' };

  function refreshSnackBadge() {
    var b = $('wt-snack-badge'); if (!b || !cc()) return;
    var who = teacher() ? '' : target();
    if (!teacher() && !who) { b.style.display = 'none'; return; }
    google.script.run.withSuccessHandler(function (r) {
      var n = (r && r.success) ? r.pending : 0;
      b.textContent = n; b.style.display = n > 0 ? 'inline-block' : 'none';
    }).withFailureHandler(function () {}).getSnackRequests(cc(), who);
  }

  function loadSnack() {
    $('wt-snack-teacher').style.display = teacher() ? 'block' : 'none';
    $('wt-snack-menu').innerHTML = '<div class="empty-msg">불러오는 중...</div>';
    google.script.run.withSuccessHandler(function (r) {
      snackMenu = (r && r.success && r.list) || [];
      if (teacher()) {
        snackRows = snackMenu.map(function (m) { return { name: m.name, price: m.price, desc: m.desc || '' }; });
        if (!snackRows.length) snackRows.push({ name: '', price: '', desc: '' });
        renderSnackEditor();
        loadSnackAll();
      }
      renderSnackMenu();
      loadSnackMine();
    }).withFailureHandler(function (e) { $('wt-snack-menu').innerHTML = fail(e); }).getSnackMenu(cc());
    refreshSnackBadge();
  }

  function renderSnackMenu() {
    var box = $('wt-snack-menu');
    if (!snackMenu.length) {
      box.innerHTML = empty('🍪', '아직 간식 메뉴가 없어요.<br>' + (teacher() ? '위의 "간식 메뉴 적기"에서 메뉴를 적어 주세요.' : '아래에 먹고 싶은 간식을 직접 적어 신청할 수 있어요.'));
      return;
    }
    var can = !!target();
    var h = '';
    snackMenu.forEach(function (m, i) {
      h += '<div class="wt-snack">';
      h += '<div class="wt-snack-name">' + E(m.name) + '</div>';
      h += '<div class="wt-snack-price">' + won(m.price) + '</div>';
      if (m.desc) h += '<div class="wt-snack-desc">' + E(m.desc) + '</div>';
      h += '<div class="wt-snack-act"><input type="number" id="wt-sq-' + i + '" min="1" max="20" value="1" aria-label="수량"><span>개</span>' +
        '<button onclick="snackRequest(' + i + ')"' + (can ? '' : ' disabled') + '>신청</button></div>';
      h += '</div>';
    });
    box.innerHTML = h;
    motion(box.querySelectorAll('.wt-snack'));
  }

  function reqRow(x, mode) {
    var c = ST_CLASS[x.status] || 'none';
    var h = '<div class="wt-row"><div class="wt-row-main">';
    var priceTxt = (x.custom && !x.total && x.status === '대기') ? '가격은 선생님이 정해요' : won(x.total);
    h += '<div class="wt-row-title">' + (mode === 'all' ? '<span class="no-bdg">' + E(x.studentNo) + '번</span> ' + E(x.name) + ' · ' : '') + E(x.item) + ' ' + x.qty + '개' +
      (x.custom ? ' <span class="wt-tag orange">✏️ 직접 신청</span>' : '') + '</div>';
    h += '<div class="wt-row-sub">📅 ' + E(x.date) + ' · ' + priceTxt + (x.memo ? ' · 💬 ' + E(x.memo) : '') + (x.note ? ' · 반려 이유: ' + E(x.note) : '') + '</div></div>';
    if (mode === 'all' && x.status === '대기') {
      h += '<div class="wt-btns"><button class="wt-ok" onclick="snackApprove(\'' + E(x.id) + '\',' + (x.custom ? 1 : 0) + ',' + x.qty + ',' + x.price + ')">승인</button><button class="wt-no" onclick="snackReject(\'' + E(x.id) + '\')">반려</button></div>';
    } else if (mode === 'mine' && x.status === '대기') {
      h += '<span class="wt-st wait">⏳ 대기</span><button class="wt-no" onclick="snackCancel(\'' + E(x.id) + '\')">취소</button>';
    } else {
      h += '<span class="wt-st ' + c + '">' + ({ '승인': '✅ ', '반려': '❌ ', '취소': '↩️ ', '대기': '⏳ ' }[x.status] || '') + E(x.status) + '</span>';
    }
    return h + '</div>';
  }

  function loadSnackMine() {
    var box = $('wt-snack-mine'), sno = target();
    if (!sno) { box.innerHTML = empty('🙋', '위에서 학생을 선택하면 그 학생의 신청 내역이 보여요.'); return; }
    box.innerHTML = '<div class="empty-msg">불러오는 중...</div>';
    google.script.run.withSuccessHandler(function (r) {
      if (!r || !r.success) { box.innerHTML = fail(r && r.msg); return; }
      if (!r.list.length) { box.innerHTML = empty('🧾', '아직 신청한 간식이 없어요.'); return; }
      box.innerHTML = '<div class="wt-list">' + r.list.slice(0, 30).map(function (x) { return reqRow(x, 'mine'); }).join('') + '</div>';
    }).withFailureHandler(function (e) { box.innerHTML = fail(e); }).getSnackRequests(cc(), sno);
  }

  function loadSnackAll() {
    var box = $('wt-snack-all');
    box.innerHTML = '<div class="empty-msg">불러오는 중...</div>';
    google.script.run.withSuccessHandler(function (r) {
      if (!r || !r.success) { box.innerHTML = fail(r && r.msg); return; }
      var wait = r.list.filter(function (x) { return x.status === '대기'; });
      var done = r.list.filter(function (x) { return x.status !== '대기'; }).slice(0, 20);
      var h = wait.length ? '<div class="wt-list">' + wait.map(function (x) { return reqRow(x, 'all'); }).join('') + '</div>'
        : empty('📭', '기다리는 간식 신청이 없어요.');
      if (done.length) h += '<details class="wt-more"><summary>처리한 신청 ' + done.length + '개 보기</summary><div class="wt-list">' + done.map(function (x) { return reqRow(x, 'all'); }).join('') + '</div></details>';
      box.innerHTML = h;
    }).withFailureHandler(function (e) { box.innerHTML = fail(e); }).getSnackRequests(cc(), '');
  }

  window.snackRequest = async function (i) {
    var m = snackMenu[i], sno = target(); if (!m) return;
    if (!sno) return alert('학생을 선택해 주세요.');
    var qty = parseInt(($('wt-sq-' + i) || {}).value) || 0;
    if (qty < 1 || qty > 20) return alert('수량은 1개에서 20개 사이로 적어 주세요.');
    var memo = await uiPrompt('[간식 신청]\n\n' + m.name + ' ' + qty + '개 = ' + won(m.price * qty) + '\n선생님이 승인하면 카드에서 빠져요.\n\n선생님께 남길 말 (없으면 그냥 확인)', '');
    if (memo === null) return;
    if (typeof showLoading === 'function') showLoading();
    google.script.run.withSuccessHandler(function (r) {
      if (typeof hideLoading === 'function') hideLoading();
      if (!r || !r.success) return alert((r && r.msg) || '신청하지 못했어요.');
      if (typeof showToast === 'function') showToast('🍪 ' + r.msg);
      loadSnackMine(); if (teacher()) loadSnackAll(); refreshSnackBadge();
    }).withFailureHandler(function (e) {
      if (typeof hideLoading === 'function') hideLoading();
      alert('오류: ' + e.message);
    }).requestSnack(cc(), sno, m.name, qty, memo);
  };

  window.snackCancel = async function (id) {
    if (!await uiConfirm('이 간식 신청을 취소할까요?')) return;
    google.script.run.withSuccessHandler(function (r) {
      if (!r || !r.success) return alert((r && r.msg) || '취소하지 못했어요.');
      if (typeof showToast === 'function') showToast('↩️ ' + r.msg);
      loadSnackMine(); if (teacher()) loadSnackAll(); refreshSnackBadge();
    }).withFailureHandler(function (e) { alert('오류: ' + e.message); }).cancelSnackRequest(cc(), target(), id);
  };

  function afterTeacherAction() {
    loadSnackAll(); loadSnackMine(); refreshSnackBadge();
    // 잔액이 바뀌었으니 학생 명단과 위쪽 금액 카드를 새로
    google.script.run.withSuccessHandler(function (r) {
      if (r && r.success) { _stuList = r.list; if (typeof fillWalletStudentSelect === 'function') fillWalletStudentSelect(); }
    }).withFailureHandler(function () {}).getStudentList(cc());
  }

  window.snackApprove = async function (id, custom, qty, price) {
    var unit = null;
    if (custom) {
      // 직접 적어 신청한 간식은 선생님이 1개 가격을 정함 (학생이 적은 가격이 있으면 미리 채워 둠)
      var v = await uiPrompt('[직접 신청한 간식 승인]\n\n1개 가격을 정해 주세요. (' + qty + '개를 신청했어요)\n0을 적으면 무료로 줘요.', price ? String(price) : '');
      if (v === null) return;
      v = String(v).trim();
      if (v === '' || isNaN(parseInt(v)) || parseInt(v) < 0) return alert('가격은 0 이상의 숫자로 적어 주세요.');
      unit = parseInt(v);
      if (!await uiConfirm('1개 ' + won(unit) + ' × ' + qty + '개 = ' + won(unit * qty) + '\n학생 카드에서 빠지고 용돈기입장에 기록돼요. 승인할까요?')) return;
    } else if (!await uiConfirm('이 간식 신청을 승인할까요?\n학생 카드에서 돈이 빠지고 용돈기입장에 기록돼요.')) return;
    if (typeof showLoading === 'function') showLoading();
    google.script.run.withSuccessHandler(function (r) {
      if (typeof hideLoading === 'function') hideLoading();
      if (!r || !r.success) return alert((r && r.msg) || '승인하지 못했어요.');
      if (typeof showToast === 'function') showToast('✅ ' + r.msg);
      afterTeacherAction();
    }).withFailureHandler(function (e) {
      if (typeof hideLoading === 'function') hideLoading();
      alert('오류: ' + e.message);
    }).approveSnackRequest(cc(), id, unit);
  };

  // 메뉴에 없는 간식 직접 적어서 신청
  window.snackCustomRequest = async function () {
    var sno = target();
    if (!sno) return alert('학생을 선택해 주세요.');
    var name = ($('wt-cs-name').value || '').trim();
    var qty = parseInt($('wt-cs-qty').value) || 0;
    var ps = ($('wt-cs-price').value || '').trim();
    var memo = ($('wt-cs-memo').value || '').trim();
    if (!name) { $('wt-cs-name').focus(); return alert('신청할 간식 이름을 적어 주세요.'); }
    if (qty < 1 || qty > 20) return alert('수량은 1개에서 20개 사이로 적어 주세요.');
    if (ps !== '' && (isNaN(parseInt(ps)) || parseInt(ps) < 0)) return alert('가격은 0 이상의 숫자로 적어 주세요. 모르면 비워 두세요.');
    var price = ps === '' ? 0 : parseInt(ps);
    if (!await uiConfirm('[간식 직접 신청]\n\n' + name + ' ' + qty + '개\n' + (price ? '예상 금액: ' + won(price * qty) : '가격: 선생님이 정해요') +
      (memo ? '\n남길 말: ' + memo : '') + '\n\n선생님이 승인하면 카드에서 돈이 빠져요. 신청할까요?')) return;
    if (typeof showLoading === 'function') showLoading();
    google.script.run.withSuccessHandler(function (r) {
      if (typeof hideLoading === 'function') hideLoading();
      if (!r || !r.success) return alert((r && r.msg) || '신청하지 못했어요.');
      if (typeof showToast === 'function') showToast('🍪 ' + r.msg);
      $('wt-cs-name').value = ''; $('wt-cs-qty').value = 1; $('wt-cs-price').value = ''; $('wt-cs-memo').value = '';
      loadSnackMine(); if (teacher()) loadSnackAll(); refreshSnackBadge();
    }).withFailureHandler(function (e) {
      if (typeof hideLoading === 'function') hideLoading();
      alert('오류: ' + e.message);
    }).requestSnack(cc(), sno, name, qty, memo, price, true);
  };

  window.snackReject = async function (id) {
    var why = await uiPrompt('반려 이유를 적어 주세요. (없으면 그냥 확인)', '');
    if (why === null) return;
    google.script.run.withSuccessHandler(function (r) {
      if (!r || !r.success) return alert((r && r.msg) || '반려하지 못했어요.');
      if (typeof showToast === 'function') showToast('❌ ' + r.msg);
      loadSnackAll(); loadSnackMine(); refreshSnackBadge();
    }).withFailureHandler(function (e) { alert('오류: ' + e.message); }).rejectSnackRequest(cc(), id, why);
  };

  // 선생님: 간식 메뉴 적기
  function collectSnackRows() {
    snackRows = snackRows.map(function (_, i) {
      return { name: (($('sm-name-' + i) || {}).value || '').trim(), price: (($('sm-price-' + i) || {}).value || ''), desc: (($('sm-desc-' + i) || {}).value || '').trim() };
    });
  }
  function renderSnackEditor() {
    var box = $('wt-snack-editor'); if (!box) return;
    var inp = 'padding:9px 11px;border:2px solid #E2E8F0;border-radius:10px;font-size:15px;font-family:inherit;outline:none;box-sizing:border-box;';
    var h = '<div class="tm-row tm-head"><div>간식 이름</div><div>가격 (머니)</div><div>설명</div><div></div></div>';
    snackRows.forEach(function (m, i) {
      h += '<div class="tm-row">';
      h += '<input id="sm-name-' + i + '" maxlength="30" placeholder="예: 초코파이" value="' + E(m.name) + '" style="' + inp + '">';
      h += '<input id="sm-price-' + i + '" type="number" min="0" placeholder="가격" value="' + E(m.price) + '" style="' + inp + '">';
      h += '<input id="sm-desc-' + i + '" class="tm-desc" maxlength="60" placeholder="설명 (예: 금요일에 나눠 줘요)" value="' + E(m.desc) + '" style="' + inp + '">';
      h += '<button onclick="snackMenuRemoveRow(' + i + ')" title="이 줄 지우기" style="background:#FFF5F5;color:#EF4444;border:1.5px solid #FECACA;border-radius:10px;cursor:pointer;font-size:14px;">✕</button>';
      h += '</div>';
    });
    box.innerHTML = h;
  }
  window.snackMenuAddRow = function () { collectSnackRows(); snackRows.push({ name: '', price: '', desc: '' }); renderSnackEditor(); };
  window.snackMenuRemoveRow = function (i) { collectSnackRows(); snackRows.splice(i, 1); if (!snackRows.length) snackRows.push({ name: '', price: '', desc: '' }); renderSnackEditor(); };
  window.snackMenuSave = function () {
    collectSnackRows();
    var list = snackRows.filter(function (m) { return m.name; });
    for (var i = 0; i < list.length; i++) {
      if (list[i].price === '' || isNaN(parseInt(list[i].price)) || parseInt(list[i].price) < 0) return alert(list[i].name + ': 가격을 0 이상의 숫자로 적어 주세요.');
    }
    if (typeof showLoading === 'function') showLoading();
    google.script.run.withSuccessHandler(function (r) {
      if (typeof hideLoading === 'function') hideLoading();
      if (!r || !r.success) return alert((r && r.msg) || '저장하지 못했어요.');
      if (typeof showToast === 'function') showToast('✅ ' + r.msg);
      loadSnack();
    }).withFailureHandler(function (e) {
      if (typeof hideLoading === 'function') hideLoading();
      alert('오류: ' + e.message);
    }).setSnackMenu(cc(), JSON.stringify(list));
  };

  // ======================================================================
  // 🏪 매점 시세표
  // ======================================================================
  // ── 🎟️ 신용 구제 쿠폰 (매점 상품, 도매상인이 팔아요) — 서버 getCouponInfo ──
  //  쿠폰 사용 여부는 본인(과 선생님)만 봄: 내 정보만 받아 옴
  var coupon = null;
  function couponBadge(r) {
    var b = $('s-coupon-badge'); if (!b) return;
    var show = function (x) {
      if (x && x.success && x.active) { b.style.display = ''; b.innerHTML = '🎟️ 점수 ' + x.active.mult + '배 적용 중 · ' + x.active.daysLeft + '일 남음'; }
      else { b.style.display = 'none'; b.innerHTML = ''; }
    };
    if (r) return show(r);
    var sno = target(); if (!sno || !cc()) return show(null);
    google.script.run.withSuccessHandler(show).getCouponInfo(cc(), sno);
  }
  function loadCoupon() {
    var box = $('wt-coupon'), sno = target(); if (!box) return;
    if (!sno) { box.innerHTML = ''; return; }
    google.script.run.withSuccessHandler(function (r) {
      coupon = r; couponBadge(r);
      if (!r || !r.success || (!r.cfg.on && !r.active)) { box.innerHTML = ''; return; }
      var c = r.cfg, a = r.active, h = '<div class="cp-card' + (a ? ' on' : '') + '"><div class="cp-ic">🎟️</div><div class="cp-body">' +
        '<div class="cp-t">신용 구제 쿠폰 <span class="cp-price">' + won(c.price) + '</span></div>' +
        (a ? '<div class="cp-d">내 쿠폰: 신용 점수가 <b>오를 때마다 ' + a.mult + '배</b>로 받고 있어요. (예: 과제 +2점 → +' + (2 * a.mult) + '점) 깎이는 점수는 그대로예요. ' + E(a.boughtAt) + '에 샀어요.</div>'
           : '<div class="cp-d">산 때부터 <b>' + c.days + '일 동안</b> 신용 점수가 <b>오를 때마다 ' + c.mult + '배</b>로 받아요. (예: 과제 +2점 → +' + (2 * c.mult) + '점) 깎이는 점수는 그대로예요.</div>');
      if (a) h += '<div class="cp-st on">✨ 점수 ' + a.mult + '배 적용 중! · <b>' + a.daysLeft + '일 남음</b> (' + E(a.expiresAt) + '까지)</div>';
      else if (r.canBuy) h += '<div class="cp-st ok">🛒 살 수 있어요! <b>도매상인</b>에게 "신용 구제 쿠폰"을 사고 싶다고 말해요. (신용 점수 ' + r.credit + '점 · ' + c.threshold + '점 미만만 구매 가능)</div>';
      else h += '<div class="cp-st no">🔒 ' + E(r.reason) + '</div>';
      h += '</div></div>';
      box.innerHTML = h;
    }).withFailureHandler(function () { box.innerHTML = ''; }).getCouponInfo(cc(), sno);
  }
  function loadStore() {
    $('wt-store-box').innerHTML = '<div id="wt-coupon"></div><div id="wt-store-list"></div>';
    loadCoupon();
    var box = $('wt-store-list');
    box.innerHTML = '<div class="empty-msg">불러오는 중...</div>';
    google.script.run.withSuccessHandler(function (r) {
      if (!r || !r.success) { box.innerHTML = fail(r && r.msg); return; }
      if (!r.list.length) { box.innerHTML = empty('🏪', '아직 매점에 등록된 상품이 없어요.<br>도매상인이 상품을 등록하면 여기에 보여요.'); return; }
      var h = '';
      if (r.newsPct) h += '<div class="wt-alert ' + (r.newsPct > 0 ? 'red' : 'green') + '">📰 <b>경제 뉴스 속보!</b> 매점 물가가 ' + (r.newsPct > 0 ? r.newsPct + '% 올랐어요.' : Math.abs(r.newsPct) + '% 내렸어요.') + ' 아래 값에 이미 들어 있어요.</div>';
      if (target()) {
        h += r.inflated
          ? '<div class="wt-alert red">📈 <b>인플레이션 적용 중!</b> 지금 카드 잔액이 ' + won(r.card) + '라서 (' + won(r.line) + ' 이상) 물건을 <b>정가의 ' + r.rate + '배</b>로 사요.</div>'
          : '<div class="wt-alert green">👍 지금 카드 잔액(' + won(r.card) + ')으로는 <b>정가</b>로 살 수 있어요. 카드가 ' + won(r.line) + ' 이상이 되면 ' + r.rate + '배로 비싸져요.</div>';
      }
      h += '<div class="stw"><table class="stb wt-store"><thead><tr><th>상품</th><th>파는 사람</th><th style="text-align:right">정가</th>' +
        (target() ? '<th style="text-align:right">내가 사면</th>' : '') + '<th style="text-align:right">재고</th><th style="text-align:right">팔린 수</th></tr></thead><tbody>';
      r.list.forEach(function (x) {
        var out = x.stock <= 0;
        h += '<tr' + (out ? ' class="wt-out"' : '') + '><td><b>' + E(x.name) + '</b>' + (out ? ' <span class="wt-tag red">품절</span>' : '') + '</td>' +
          '<td>' + E(x.seller) + '번 ' + E(x.sellerName) + '</td>' +
          '<td style="text-align:right">' + won(x.price) + '</td>' +
          (target() ? '<td style="text-align:right;' + (x.myPrice > x.price ? 'color:#E5384B;' : '') + '"><b>' + won(x.myPrice) + '</b></td>' : '') +
          '<td style="text-align:right">' + x.stock + '개</td><td style="text-align:right">' + x.sold + '개</td></tr>';
      });
      h += '</tbody></table></div>';
      h += '<div style="font-size:13px;color:var(--gray);margin-top:10px;">💡 물건은 <b>도매상인</b>에게 사요. 여러 개를 살 때는 한 개씩 계산해서, 사는 중에 카드가 ' + won(r.line) + ' 아래로 내려가면 그다음부터는 정가예요.</div>';
      box.innerHTML = h;
    }).withFailureHandler(function (e) { box.innerHTML = fail(e); }).getStorePriceBoard(cc(), target());
  }

  // ======================================================================
  // 📜 벌금 법전
  // ======================================================================
  function loadLaw() {
    var box = $('wt-law-box');
    box.innerHTML = '<div class="empty-msg">불러오는 중...</div>';
    google.script.run.withSuccessHandler(function (r) {
      var list = (r && r.success && r.list) || [];
      if (!list.length) { box.innerHTML = empty('📜', '아직 벌칙 법전이 없어요.<br>선생님이 경찰서 화면에서 법전을 적으면 여기에 보여요.'); return; }
      var h = '<div class="info-box">🚓 우리 반의 약속이에요. 어기면 경찰서장이 아래 벌금을 부과할 수 있어요.</div><div class="flaw-list">';
      list.forEach(function (m, i) {
        h += '<div class="flaw-item"><div class="flaw-no">제' + (i + 1) + '조</div>' +
          '<div class="flaw-body"><div class="flaw-name">' + E(m.name) + '</div>' + (m.desc ? '<div class="flaw-desc">' + E(m.desc) + '</div>' : '') + '</div>' +
          '<div class="flaw-amt">' + (Number(m.price) > 0 ? '벌금 ' + won(m.price) : '벌금 금액 직접 정함') + '</div></div>';
      });
      box.innerHTML = h + '</div>';
      motion(box.querySelectorAll('.flaw-item'));
    }).withFailureHandler(function (e) { box.innerHTML = fail(e); }).getFineLaw(cc());
  }

  // ======================================================================
  // 🏆 명예의 전당 — 달마다 분야별 1~3위 (서버 getHallOfFame). 내 순위도 보여 줌
  // ======================================================================
  var hofMonth = '';
  function ymShift(ym, d) { var p = ym.split('-'), t = new Date(+p[0], +p[1] - 1 + d, 1); return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2); }
  function loadHof() {
    var box = $('wt-hof-box');
    box.innerHTML = '<div class="empty-msg">불러오는 중...</div>';
    google.script.run.withSuccessHandler(function (r) {
      if (!r || !r.success) { box.innerHTML = fail(r && r.msg); return; }
      hofMonth = r.month; renderHof(r);
    }).withFailureHandler(function (e) { box.innerHTML = fail(e); }).getHallOfFame(cc(), hofMonth);
  }
  window.hofGo = function (d) { hofMonth = ymShift(hofMonth, d); loadHof(); };
  function renderHof(r) {
    var box = $('wt-hof-box'), me = target(), p = r.month.split('-'), isNow = r.month === r.thisMonth;
    var medal = ['🥇', '🥈', '🥉'];
    var h = '<div class="hof-head"><div class="hof-title">🏆 명예의 전당</div>' +
      '<div class="hof-month"><button class="hof-nav" onclick="hofGo(-1)" aria-label="지난달">◀</button><b>' + (+p[0]) + '년 ' + (+p[1]) + '월</b>' +
      (isNow ? '<span class="hof-now">이번 달</span>' : '<button class="hof-nav" onclick="hofGo(1)" aria-label="다음 달">▶</button>') + '</div></div>';
    h += '<div class="hof-grid">';
    r.cats.forEach(function (c) {
      var top = c.list.filter(function (x) { return x.rank <= 3; }).slice(0, 5), mine = null;
      c.list.forEach(function (x) { if (x.no === me) mine = x; });
      h += '<div class="hof-card hof-' + c.id + '"><div class="hof-ch"><span class="hof-ic">' + c.icon + '</span><div><div class="hof-ct">' + E(c.title) + (c.now ? ' <span class="hof-tag">지금</span>' : '') + '</div><div class="hof-how">' + E(c.how) + '</div></div></div>';
      if (!top.length) h += '<div class="hof-empty">' + (isNow || c.now ? '아직 주인공이 없어요. 첫 번째 주인공이 되어 보세요!' : '이 달에는 기록이 없어요.') + '</div>';
      else h += '<ol class="hof-rank">' + top.map(function (x) {
        return '<li class="r' + x.rank + (x.no === me ? ' me' : '') + '"><span class="hof-md">' + (medal[x.rank - 1] || x.rank + '위') + '</span><span class="hof-nm">' + E(x.name || x.no + '번') +
          (x.no === me ? ' <i>나</i>' : '') + '</span><span class="hof-val">' + Number(x.value).toLocaleString() + ' ' + c.unit + (c.subUnit && x.sub ? '<small>' + x.sub + c.subUnit + '</small>' : '') + '</span></li>';
      }).join('') + '</ol>';
      if (me && me !== '0') h += '<div class="hof-mine">' + (mine ? (mine.rank <= 3 ? '🎉 내가 ' + mine.rank + '위예요!' : '나는 ' + mine.rank + '위 · ' + Number(mine.value).toLocaleString() + ' ' + c.unit) : '나는 아직 기록이 없어요') + '</div>';
      h += '</div>';
    });
    h += '</div><div class="hof-note">💡 "이달의" 순위는 그 달의 기록으로, 자산왕·신용왕은 지금 상태로 정해요. 선생님(0번)은 순위에서 빠져요.</div>';
    box.innerHTML = h;
    var cards = box.querySelectorAll('.hof-card');
    if (typeof anime === 'function' && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches))
      anime({ targets: cards, translateY: [14, 0], opacity: [0, 1], delay: anime.stagger(60), duration: 420, easing: 'easeOutQuad' });
    else motion(cards);
  }

  // ======================================================================
  // 💝 국고 기부 — 내 카드에서 우리 반 국고로 (승인 없이 바로, 1주 한도는 선생님이 정함)
  //  서버: getDonationInfo · donateToTreasury
  // ======================================================================
  var donInfo = null;
  function loadDonate() {
    var box = $('wt-donate-box'), sno = target();
    if (!sno) { box.innerHTML = empty('💝', '위에서 학생을 먼저 골라 주세요.'); return; }
    box.innerHTML = '<div class="empty-msg">불러오는 중...</div>';
    google.script.run.withSuccessHandler(function (r) {
      if (!r || !r.success) { box.innerHTML = fail(r && r.msg); return; }
      donInfo = r; renderDonate();
    }).withFailureHandler(function (e) { box.innerHTML = fail(e); }).getDonationInfo(cc(), sno);
  }
  function renderDonate() {
    var r = donInfo, box = $('wt-donate-box'), h = '';
    var pct = r.limit > 0 ? Math.min(100, Math.round(r.used / r.limit * 100)) : 0, canGive = r.limit > 0 && r.left > 0 && r.card > 0;
    h += '<div class="don-hero"><div class="don-hero-ic">💝</div><div><div class="don-hero-t">우리 반 국고에 기부하기</div>' +
      '<div class="don-hero-s">내 카드의 돈을 우리 반 국고에 보탤 수 있어요. 국고는 학급 파티처럼 <b>모두를 위해</b> 쓰여요.<br>기부하면 <b>선생님 승인 없이 바로</b> 국고에 들어가요.</div></div></div>';
    if (r.limit <= 0) h += '<div class="don-off">🙏 지금은 선생님이 기부를 받지 않아요.</div>';
    else {
      h += '<div class="don-grid"><div class="don-card"><div class="don-lb">💳 내 카드</div><div class="don-v">' + won(r.card) + '</div></div>' +
        '<div class="don-card"><div class="don-lb">📅 이번 주 기부 / 1주 한도</div><div class="don-v">' + won(r.used) + ' <small>/ ' + won(r.limit) + '</small></div><div class="don-bar"><i style="width:' + pct + '%"></i></div></div>' +
        '<div class="don-card"><div class="don-lb">✨ 이번 주 남은 한도</div><div class="don-v green">' + won(r.left) + '</div></div></div>';
      var max = Math.min(r.left, r.card);
      h += '<div class="don-form"><label>기부할 금액<div class="don-amt"><input type="number" id="don-amt" min="1" max="' + max + '" placeholder="예: 50"' + (canGive ? '' : ' disabled') + '><span>머니</span></div></label>' +
        '<div class="don-quick">' + [10, 50, 100].filter(function (v) { return v <= max; }).map(function (v) { return '<button class="sm-chip" onclick="donPick(' + v + ')">' + v + '</button>'; }).join('') +
        (max > 0 ? '<button class="sm-chip" onclick="donPick(' + max + ')">할 수 있는 만큼 (' + max.toLocaleString() + ')</button>' : '') + '</div>' +
        '<label>응원 한마디 (선택)<input type="text" id="don-memo" maxlength="30" placeholder="예: 학급 파티에 써 주세요!"' + (canGive ? '' : ' disabled') + '></label>' +
        '<button class="sb sb-green don-btn" onclick="donGive()"' + (canGive ? '' : ' disabled') + '>💝 기부하기</button>' +
        (!canGive ? '<div class="don-why">' + (r.left <= 0 ? '이번 주 기부 한도를 다 썼어요. 다음 주 월요일에 다시 기부할 수 있어요.' : '카드에 돈이 없어요.') + '</div>' : '') + '</div>';
    }
    h += '<div class="don-class">🏫 이번 주 우리 반은 <b>' + r.weekCount + '명</b>이 <b>' + won(r.weekTotal) + '</b>을 기부했어요.</div>';
    h += '<div class="don-sec">📒 나의 기부 기록</div>';
    h += r.mine.length ? '<div class="don-list">' + r.mine.map(function (x) {
      return '<div class="don-row"><span class="don-d">' + E(x.date) + (x.thisWeek ? ' <i>이번 주</i>' : '') + '</span><span class="don-m">' + E(x.memo.replace(/^\S+번 \S+\s*·?\s*/, '') || '기부') + '</span><b>' + won(x.amount) + '</b></div>';
    }).join('') + '</div>' : empty('🌱', '아직 기부한 기록이 없어요.');
    box.innerHTML = h;
    motion(box.querySelectorAll('.don-card, .don-row'));
  }
  window.donPick = function (v) { var el = $('don-amt'); if (el) el.value = v; };
  window.donGive = async function () {
    var r = donInfo, amt = parseInt(($('don-amt') || {}).value, 10), memo = (($('don-memo') || {}).value || '').trim(), sno = target();
    if (!amt || amt <= 0) return alert('기부할 금액을 적어 주세요.');
    if (amt > r.left) return alert('이번 주 남은 기부 한도는 ' + won(r.left) + '이에요.');
    if (amt > r.card) return alert('카드 잔액(' + won(r.card) + ')보다 많이 기부할 수 없어요.');
    if (!await uiConfirm('💝 ' + won(amt) + '을 우리 반 국고에 기부할까요?\n\n기부한 돈은 돌려받을 수 없고, 승인 없이 바로 국고에 들어가요.' + (memo ? '\n응원 한마디: ' + memo : ''))) return;
    if (typeof showLoading === 'function') showLoading();
    google.script.run.withSuccessHandler(function (res) {
      if (typeof hideLoading === 'function') hideLoading();
      if (!res || !res.success) return alert((res && res.msg) || '기부하지 못했어요.');
      if ($('s-card')) { $('s-card').textContent = Number(res.newCard).toLocaleString() + ' 머니'; if (typeof walletRecalcTotal === 'function') walletRecalcTotal('s'); }
      if (typeof loadTx === 'function') loadTx(cc(), sno, 's-tx-tbody', 's-tx-cnt');
      loadDonate();
    }).withFailureHandler(function (e) { if (typeof hideLoading === 'function') hideLoading(); alert('오류: ' + e.message); }).donateToTreasury(cc(), sno, amt, memo);
  };

  // ======================================================================
  // 📈 나의 주식 (증권회사와 같은 시세판 + 보유 주식 + 정보함)
  // ======================================================================
  var market = null;
  function startStockTimer() {
    stopStockTimer();
    stockTimer = setInterval(function () {
      var view = $('view-citizen-wallet');
      if (current !== 'wt-stock' || !view || !view.classList.contains('active')) { stopStockTimer(); return; }
      if (document.hidden) return;
      loadStock(false);
    }, 30000);   // 30초마다 새 시세
  }
  function stopStockTimer() { if (stockTimer) { clearInterval(stockTimer); stockTimer = null; } }

  window.wtShowChart = function (id) {
    var s = null; ((market && market.stocks) || []).forEach(function (x) { if (x.id === id) s = x; });
    if (s && typeof window.stkOpenChart === 'function') window.stkOpenChart(s);
  };

  function spark(arr, up) {
    if (typeof window.stkSparkline === 'function') return window.stkSparkline(arr, up);
    return '';
  }

  function loadStock(first) {
    if (first) $('wt-stk-cards').innerHTML = '<div class="empty-msg">시장 불러오는 중...</div>';
    google.script.run.withSuccessHandler(function (r) {
      if (!r || !r.success) { $('wt-stk-cards').innerHTML = fail(r && r.msg); return; }
      var before = market; market = r;
      renderStockBoard(first, before);
      renderHoldings(r.holdings);
      renderInfo();
    }).withFailureHandler(function (e) { if (first) $('wt-stk-cards').innerHTML = fail(e); }).getStockMarket(cc(), target());
  }

  function renderStockBoard(animate, before) {
    var now = new Date(), t = (now.getHours() < 12 ? '오전 ' : '오후 ') + ((now.getHours() % 12) || 12) + ':' + ('0' + now.getMinutes()).slice(-2);
    $('wt-stk-next').innerHTML = (market.auto ? '⏰ 다음 변동 <b>' + E(market.nextAutoLabel) + '</b>' : '✋ 선생님이 직접 돌려요') +
      ' <span class="wt-live">● ' + t + ' 기준</span>';
    var prev = {}; ((before && before.stocks) || []).forEach(function (s) { prev[s.id] = s.price; });
    var h = '';
    market.stocks.forEach(function (s) {
      var up = s.change >= 0, moved = prev[s.id] != null && prev[s.id] !== s.price;
      h += '<div class="stk-card' + (moved ? ' wt-flash' : '') + '" title="누르면 전체 그래프가 보여요" onclick="wtShowChart(\'' + s.id + '\')">';
      h += '<div class="stk-card-top"><span class="stk-emoji">' + s.emoji + '</span><div><div class="stk-name">' + E(s.name) + '</div><div class="stk-sector">' + E(s.sector) + '</div></div></div>';
      h += '<div class="stk-price">' + won(s.price) + '</div>';
      h += '<div class="stk-chg ' + (s.change > 0 ? 'up' : s.change < 0 ? 'down' : 'flat') + '">' + (s.change > 0 ? '▲ ' : s.change < 0 ? '▼ ' : '– ') + Math.abs(s.change) + '% <span>지난 변동</span></div>';
      h += '<div class="stk-graph"><div class="stk-graph-top"><span>최근 7일</span><span class="stk-graph-more">🔍 전체 그래프</span></div>' +
        (typeof window.stkChart === 'function' ? window.stkChart(s.history, s.historyAt) : spark(s.history, up)) + '</div>';
      h += '<div class="stk-ai">🤖 ' + E(s.comment) + '</div>';
      h += '</div>';
    });
    var box = $('wt-stk-cards');
    box.innerHTML = h;
    if (typeof window.stkFitLabels === 'function') window.stkFitLabels(box);
    if (animate && window.anime && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      anime({ targets: box.querySelectorAll('.stk-card'), opacity: [0, 1], translateY: [14, 0], delay: anime.stagger(70), duration: 480, easing: 'cubicBezier(.2,.7,.2,1)',
        complete: function () { box.querySelectorAll('.stk-card').forEach(function (c) { c.style.opacity = ''; c.style.transform = ''; }); } });
    }
  }

  function renderHoldings(hd) {
    var box = $('wt-stk-hold');
    if (!target()) { box.innerHTML = empty('🙋', '위에서 학생을 선택하세요.'); return; }
    if (!hd || !hd.list.length) { box.innerHTML = empty('📂', '아직 가진 주식이 없어요.'); return; }
    var up = hd.profit >= 0;
    var h = '<div class="wt-hold-sum"><div><small>주식 평가액</small><b>' + won(hd.totalValue) + '</b></div>' +
      '<div><small>지금까지 이익/손해</small><b class="' + (up ? 'wt-up' : 'wt-down') + '">' + (up ? '+' : '') + hd.profit.toLocaleString() + '</b></div></div>';
    hd.list.forEach(function (x) {
      var u = x.profit >= 0;
      h += '<div class="stk-hd-row"><span class="stk-hd-name">' + x.emoji + ' ' + E(x.name) + ' <small>' + x.qty + '주 · 산 값 평균 ' + x.avg.toLocaleString() + ' · 지금 ' + x.price.toLocaleString() + '</small></span>' +
        '<span class="stk-hd-val">' + won(x.value) + '<small class="' + (u ? 'up' : 'down') + '">' + (u ? '+' : '') + x.profit.toLocaleString() + ' (' + (u ? '+' : '') + x.pct + '%)</small></span></div>';
    });
    box.innerHTML = h;
  }

  // 지나간 가격 기록(그래프에 보이는 것)만 보고 동향과 조언을 만듦. 정해 둔 변동 폭은 알려 주지 않음.
  function adviseStock(s, held) {
    var h = s.history || [s.price], n = h.length, now = h[n - 1];
    if (n < 3) {
      return { trend: ['➖ 지켜보는 중', 'blue'], swing: ['기록 부족', 'blue'],
        trendText: '아직 가격이 ' + (n - 1) + '번밖에 바뀌지 않아서 흐름을 알기 어려워요.',
        advice: '흐름을 알 수 없을 때는 한꺼번에 사지 말고 조금만 사서 지켜보는 게 안전해요.' + holdText(held) };
    }
    var back = h[Math.max(0, n - 6)], cnt = Math.min(5, n - 1);
    var pct = Math.round((now - back) / back * 1000) / 10;
    var moves = [];
    for (var i = 1; i < n; i++) moves.push(Math.abs((h[i] - h[i - 1]) / h[i - 1] * 100));
    var avgMove = moves.reduce(function (a, b) { return a + b; }, 0) / moves.length;
    var ups = 0, downs = 0;
    for (var j = n - 1; j > 0 && h[j] > h[j - 1]; j--) ups++;
    for (var k = n - 1; k > 0 && h[k] < h[k - 1]; k--) downs++;
    var hi = Math.max.apply(null, h), lo = Math.min.apply(null, h);

    var trend = pct >= 3 ? ['📈 오르는 중', 'red'] : pct <= -3 ? ['📉 내리는 중', 'blue'] : ['➡️ 비슷함', 'green'];
    var swing = avgMove >= 5 ? ['출렁임 큼', 'orange'] : avgMove >= 2 ? ['출렁임 보통', 'blue'] : ['출렁임 작음', 'green'];
    var t = '최근 ' + cnt + '번 동안 ' + (pct > 0 ? pct + '% 올랐어요' : pct < 0 ? Math.abs(pct) + '% 내렸어요' : '가격이 그대로예요') + '.';
    if (ups >= 3) t += ' ' + ups + '번 연속으로 올랐어요.';
    else if (downs >= 3) t += ' ' + downs + '번 연속으로 내렸어요.';
    if (now === hi && n >= 5) t += ' 지금이 기록 중 가장 비싼 값이에요.';
    else if (now === lo && n >= 5) t += ' 지금이 기록 중 가장 싼 값이에요.';

    var a;
    if (pct >= 3) a = '꾸준히 오르고 있지만, 많이 오른 뒤에는 다시 내려가기도 해요. 지금 산다면 한꺼번에 말고 조금씩 나눠서 사 봐요.';
    else if (pct <= -3) a = '계속 내리고 있어요. 싸졌다고 한 번에 많이 사면 더 내릴 수도 있어요. 뉴스를 살펴보고 내림이 멈추는지 확인한 뒤 조금씩 사 봐요.';
    else a = '가격이 비교적 안정적이에요. 처음 투자해 보는 친구가 연습하기에 알맞아요.';
    if (avgMove >= 5) a += ' 오르내림이 커서 이익도 손해도 크게 날 수 있으니, 잃어도 괜찮은 만큼만 투자해요.';
    return { trend: trend, swing: swing, trendText: t, advice: a + holdText(held) };
  }
  function holdText(held) {
    if (!held) return '';
    if (held.pct >= 10) return ' 나는 지금 ' + held.pct + '% 이익이에요. 일부를 팔아 이익을 챙겨 두는 것도 좋은 방법이에요.';
    if (held.pct <= -10) return ' 나는 지금 ' + Math.abs(held.pct) + '% 손해예요. 겁먹고 급하게 팔기보다 흐름과 뉴스를 보고 차분히 정해요.';
    return ' 나는 ' + held.qty + '주를 가지고 있어요.';
  }

  function renderInfo() {
    var box = $('wt-stk-info');
    var mine = {};
    ((market.holdings && market.holdings.list) || []).forEach(function (x) { mine[x.stockId] = x; });
    var h = '<div class="wt-info-title">🧭 최근 동향과 투자 조언</div>';
    market.stocks.forEach(function (s) {
      var a = adviseStock(s, mine[s.id]);
      h += '<div class="wt-info-stock"><div class="wt-info-head">' + s.emoji + ' <b>' + E(s.name) + '</b> ' +
        '<span class="wt-tag ' + a.trend[1] + '">' + a.trend[0] + '</span> <span class="wt-tag ' + a.swing[1] + '">' + a.swing[0] + '</span></div>' +
        '<div class="wt-info-meta">' + E(a.trendText) + '</div>' +
        '<div class="wt-advice">💡 ' + E(a.advice) + '</div></div>';
    });
    h += '<div class="wt-info-title" style="margin-top:14px;">📰 AI 뉴스</div>';
    if (!market.news.length) h += '<div class="empty-msg" style="padding:16px 0;">아직 큰 뉴스가 없어요.</div>';
    market.news.slice(0, 8).forEach(function (n) {
      h += '<div class="stk-news ' + (n.up ? 'up' : 'down') + '"><div class="stk-news-top"><span>' + n.emoji + ' ' + E(n.name) + '</span><span class="stk-news-pct">' + (n.up ? '▲ +' : '▼ ') + n.pct + '%</span></div>' +
        '<div class="stk-news-text">' + E(n.text) + '</div><div class="stk-news-when">' + E(n.when) + '</div></div>';
    });
    h += '<div class="wt-tip">💡 주식은 오를 수도, 내릴 수도 있어요. 한 종목에 모두 넣지 말고 나눠서 투자하면 위험이 줄어요.</div>';
    box.innerHTML = h;
  }
})();
