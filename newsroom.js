// ==========================================================================
// newsroom.js — 마스터 → 📰 뉴스룸 (다음 주 경제 전망 · 공표 · 해제 · 인쇄용 포스터)
//  흐름: 이번 주까지의 학급 상태로 "다음 주 전망"을 만듦 → 선생님이 공표 → 다음 주 월요일 0시에 저절로 적용
//  뉴스 내용과 변동 %는 서버(Code.gs _newsBuild)의 "AI 뉴스 엔진"이 정합니다. 이 파일은 보여 주기만 합니다.
//  서버: getNewsroom · generateNews · announceNews · cancelAnnouncement · resetNews · getActiveNews
// ==========================================================================
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var E = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var cc = function () { return (typeof _adminCC !== 'undefined' && _adminCC) || (typeof _cc !== 'undefined' && _cc) || ''; };
  var sign = function (n) { return (n > 0 ? '+' : '') + n + '%'; };
  var dir = function (n) { return n > 0 ? 'up' : n < 0 ? 'down' : 'flat'; };
  var arrow = function (n) { return n > 0 ? '▲' : n < 0 ? '▼' : '–'; };
  // 0%는 '그대로' ("– 0%"로 쓰면 ui-colors.js가 빨간 마이너스로 칠함)
  var chg = function (n) { return n ? arrow(n) + ' ' + sign(n) : '그대로'; };
  var day = function (ms) { var d = new Date(ms); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; };
  var monday = function (ms) { return day(ms) + '(월)'; };
  // 서버 _newsRate와 같은 계산
  var rateAfter = function (base, pct) { return pct && base > 0 ? Math.max(0.1, Math.round(base * (100 + pct) / 10) / 10) : base; };
  var room = null;

  // 적용되는 주 (월~일)
  function weekOf(ms) {
    var a = new Date(ms), b = new Date(ms + 6 * 86400000);
    return day(a) + ' ~ ' + day(b);
  }

  window.loadNewsroom = function () { ask('getNewsroom', [cc()], false); };

  function ask(fn, args, busy) {
    if (!cc()) return;
    if (busy && typeof showLoading === 'function') showLoading();
    google.script.run.withSuccessHandler(function (r) {
      if (busy && typeof hideLoading === 'function') hideLoading();
      if (!r || !r.success) {
        if (busy) return alert((r && r.msg) || '하지 못했어요.');
        $('nw-draft').innerHTML = '<div class="empty-msg">불러오지 못했어요: ' + E(r && r.msg) + '</div>'; return;
      }
      room = r; render();
      if (busy && typeof showToast === 'function') showToast('✅ ' + r.msg);
    }).withFailureHandler(function (err) {
      if (busy && typeof hideLoading === 'function') hideLoading();
      if (busy) alert('오류: ' + err.message);
      else $('nw-draft').innerHTML = '<div class="empty-msg">오류: ' + E(err.message) + '</div>';
    })[fn].apply(null, args);
  }

  window.newsGenerate = async function () {
    if (!await uiConfirm('이번 주까지의 학급 상태로 다음 주 전망을 다시 만들까요?\n이미 공표한 전망과 지금 적용 중인 소식은 그대로예요.')) return;
    ask('generateNews', [cc()], true);
  };
  window.newsAnnounce = async function () {
    var n = room.draft, f = n.effects;
    if (!await uiConfirm('[다음 주 경제 전망 공표]\n\n' + n.title + '\n\n예금 이자율 ' + sign(f.rate) + '\n매점 물가 ' + sign(f.price) + '\n자리 매매가 ' + sign(f.estate) + '\n자리 임대료 ' + sign(f.rent) +
      '\n\n지금 바로 학생들에게 알려지고, ' + monday(n.effectiveAt) + ' 0시가 되면 저절로 적용돼요.' + (room.announced ? '\n먼저 공표해 둔 전망은 이 전망으로 바뀌어요.' : '') + '\n이미 든 예금의 이자율은 바뀌지 않아요.')) return;
    ask('announceNews', [cc(), n.id], true);
  };
  window.newsCancel = async function () {
    if (!await uiConfirm('공표한 다음 주 전망을 취소할까요?\n다음 주에도 지금 값 그대로예요.')) return;
    ask('cancelAnnouncement', [cc()], true);
  };
  window.newsReset = async function () {
    if (!await uiConfirm('지금 적용 중인 경제 소식을 해제할까요?\n예금 이자율과 물가가 원래 값으로 돌아가요.\n그동안 이미 사고판 기록과 이미 든 예금은 그대로예요.')) return;
    ask('resetNews', [cc()], true);
  };

  // ---------- 화면 ----------
  function rateRows(n) {
    return [1, 2, 3, 4].map(function (w) {
      var b = n.baseRates['r' + w], a = rateAfter(b, n.effects.rate);
      return '<div class="nw-rate"><span>' + w + '주</span><s>' + b + '%</s><b class="' + dir(n.effects.rate) + '">' + a + '%</b></div>';
    }).join('');
  }
  function fx(icon, name, pct, why, cls, extra) {
    return '<div class="nw-fx ' + cls + '"><div class="nw-fx-name">' + icon + ' ' + name + '</div><div class="nw-fx-num ' + dir(pct) + '">' + chg(pct) + '</div>' + (extra || '') + '<div class="nw-fx-why">' + E(why) + '</div></div>';
  }
  function effects(n) {
    return '<div class="nw-fxs">' +
      fx('🏦', '예금 이자율', n.effects.rate, n.why.rate, 'c-green', '<div class="nw-rates">' + rateRows(n) + '</div>') +
      fx('🛒', '매점 물가', n.effects.price, n.why.price, 'c-blue') +
      fx('🪑', '자리 매매가', n.effects.estate, n.why.estate, 'c-purple') +
      fx('🏠', '자리 임대료', n.effects.rent, n.why.rent, 'c-orange') + '</div>' +
      (n.estates ? '' : '<div class="nw-tip">아직 등록된 부동산이 없어서 자리 매매가와 임대료는 매물을 등록한 뒤에 적용돼요.</div>');
  }
  function newsBody(n) {
    return '<div class="nw-meta"><span class="nw-tag">' + n.emoji + ' ' + E(n.tag) + '</span><span>제' + n.issue + '호 · 📅 다음 주(' + weekOf(n.effectiveAt) + ') 전망</span></div>' +
      '<h3 class="nw-title">' + E(n.title) + '</h3><p class="nw-lead">' + E(n.lead) + '</p><p class="nw-forecast">📅 ' + E(n.forecast) + '</p>';
  }
  function render() {
    var d = room.draft, a = room.active, ann = room.announced, done = ann && d && ann.id === d.id;
    // 1) 지금 적용 중 + 공표해 둔 전망
    var top = '';
    if (ann) top += '<div class="sc nw-on nw-ann"><div class="nw-ribbon">📅 공표됨 · ' + monday(ann.effectiveAt) + '부터 적용</div>' + newsBody(ann) + effects(ann) +
      '<div class="nw-btns"><span class="nw-when">' + day(ann.announcedAt) + ' 공표 · 학생들도 지금 볼 수 있어요</span>' +
      '<button class="btn btn-sm btn-outline" onclick="newsPoster(\'announced\')"><i class="fa-solid fa-print"></i> 포스터 보기·인쇄</button>' +
      '<button class="btn btn-sm btn-outline" onclick="newsCancel()"><i class="fa-solid fa-xmark"></i> 공표 취소</button></div></div>';
    top += a
      ? '<div class="sc nw-on"><div class="nw-ribbon">📢 지금 적용 중인 경제 소식</div>' + newsBody(a) + effects(a) +
        '<div class="nw-btns"><span class="nw-when">' + day(a.effectiveAt) + '부터 적용 중</span>' +
        '<button class="btn btn-sm btn-outline" onclick="newsPoster(\'active\')"><i class="fa-solid fa-print"></i> 포스터 보기·인쇄</button>' +
        '<button class="btn btn-sm btn-red" onclick="newsReset()"><i class="fa-solid fa-rotate-left"></i> 현재 소식 해제 (리셋)</button></div></div>'
      : '<div class="sc nw-off">🌤️ 지금 적용 중인 경제 소식이 없어요. 예금 이자율과 물가는 모두 <b>원래 값</b>이에요.</div>';
    $('nw-active').innerHTML = top;
    // 2) 이번 주에 만든 다음 주 전망
    var h = '<div class="sc"><div class="st">🤖 ' + (done ? '이번 전망은 이렇게 만들어졌어요' : '다음 주 경제 전망 (아직 공표 전)') + '</div>';
    h += '<div class="nw-sigs">' + d.signals.map(function (s) {
      var bar = [-2, -1, 0, 1, 2].map(function (k) { return '<i class="' + (k === s.score ? 's' + (k + 2) : '') + '"></i>'; }).join('');
      return '<div class="nw-sig"><div class="nw-sig-name">' + s.icon + ' ' + E(s.name) + '</div><div class="nw-sig-val">' + E(s.value) + '</div><div class="nw-sig-sub">' + E(s.sub) + '</div>' +
        '<div class="nw-bar" aria-hidden="true">' + bar + '</div><div class="nw-sig-word">' + E(s.word) + '</div></div>';
    }).join('') + '</div>';
    if (!done) h += newsBody(d) + effects(d);
    h += '<div class="nw-arts">' + d.articles.map(function (x) { return '<div class="nw-art"><b>' + x.icon + ' ' + E(x.title) + '</b><p>' + E(x.text) + '</p></div>'; }).join('') + '</div>';
    h += '<div class="nw-world"><b>🌏 실제 사회에서는</b><p>' + E(d.world) + ' ' + E(d.season) + '</p></div>';
    h += '<div class="nw-tips"><b>💡 다음 주 생활 팁</b><ul>' + d.tips.map(function (t) { return '<li>' + E(t) + '</li>'; }).join('') + '</ul></div>';
    if (!done) h += '<div class="nw-btns"><button class="btn btn-sm btn-outline" onclick="newsPoster(\'draft\')"><i class="fa-solid fa-print"></i> 포스터 미리 보기</button>' +
      '<button class="btn btn-green" onclick="newsAnnounce()"><i class="fa-solid fa-bullhorn"></i> 공표하기 (' + monday(d.effectiveAt) + '부터 적용)</button></div>';
    $('nw-draft').innerHTML = h + '</div>';
    // 3) 지난 전망
    $('nw-history').innerHTML = room.history.length
      ? '<div class="sc"><div class="st">🗂️ 지금까지 공표한 전망</div>' + room.history.map(function (n, i) {
        return '<div class="nw-old"><span class="nw-tag">' + n.emoji + ' 제' + n.issue + '호</span><div><b>' + E(n.title) + '</b><small>' + day(n.announcedAt) + ' 공표 · ' + monday(n.effectiveAt) + '부터 · 이자율 ' + sign(n.effects.rate) + ' · 물가 ' + sign(n.effects.price) + '</small></div>' +
          '<button class="btn btn-sm btn-outline" onclick="newsPoster(' + i + ')"><i class="fa-solid fa-print"></i> 포스터</button></div>';
      }).join('') + '</div>' : '';
    if (typeof salMotion === 'function') salMotion(document.querySelectorAll('#md-newsroom .nw-sig, #md-newsroom .nw-fx'), 8);
  }

  // ---------- 인쇄용 뉴스 잡지 포스터 (A4 세로 1장) ----------
  function posterHTML(n, className) {
    var f = n.effects;
    var anchor = window.AvatarKit ? AvatarKit.svg({ bg: 'bg_cream', hair: 'hr_bob', top: 'tp_suit', face: 'face_round' }, 150) : '';
    var max = 0.1;
    [1, 2, 3, 4].forEach(function (w) { var b = n.baseRates['r' + w]; max = Math.max(max, b, rateAfter(b, f.rate)); });
    var bars = [1, 2, 3, 4].map(function (w) {
      var b = n.baseRates['r' + w], a = rateAfter(b, f.rate);
      return '<div class="np-bar"><div class="np-cols"><i class="b" style="height:' + Math.round(b / max * 100) + '%"></i><i class="a" style="height:' + Math.round(a / max * 100) + '%"></i></div><b>' + a + '%</b><small>' + w + '주</small></div>';
    }).join('');
    var num = function (icon, name, pct, why, c) { return '<div class="np-num ' + c + '"><small>' + icon + ' ' + name + '</small><b class="' + dir(pct) + '">' + chg(pct) + '</b><span>' + E(why) + '</span></div>'; };
    var sh = n.share, part = function (v, c, t) { return v > 0 ? '<i class="' + c + '" style="width:' + v + '%">' + (v >= 14 ? t + ' ' + v + '%' : '') + '</i>' : ''; };
    return '<div class="np" id="np-page">' +
      '<div class="np-top"><span>제 ' + n.issue + ' 호</span><span>' + E(document.title) + '</span><span>📅 다음 주 ' + weekOf(n.effectiveAt) + '</span></div>' +
      '<div class="np-mast">' + E(className || '우리 반') + ' <em>경제신문</em></div>' +
      '<div class="np-hero"><div class="np-hero-l"><span class="np-tag">' + n.emoji + ' ' + E(n.tag) + '</span><h1>' + E(n.title) + '</h1><p>' + E(n.lead) + '</p></div>' +
      '<div class="np-anchor">' + anchor + '<small>이번 주 뉴스 앵커</small></div></div>' +
      '<div class="np-when">📅 ' + E(n.forecast) + '</div>' +
      '<div class="np-row"><div class="np-box np-rate"><h2>🏦 예금 이자율 <em class="' + dir(f.rate) + '">' + chg(f.rate) + '</em></h2><div class="np-bars">' + bars + '</div>' +
      '<div class="np-key"><i class="b"></i> 지금 <i class="a"></i> ' + monday(n.effectiveAt) + '부터</div><p>' + E(n.why.rate) + '</p></div>' +
      '<div class="np-nums">' + num('🛒', '매점 물가', f.price, n.why.price, 'c1') + num('🪑', '자리 매매가', f.estate, n.why.estate, 'c2') + num('🏠', '자리 임대료', f.rent, n.why.rent, 'c3') + '</div></div>' +
      '<div class="np-box np-share"><h2>💰 이번 주 우리 반 돈은 어디에?</h2><div class="np-stack">' + part(sh.card, 'k1', '카드') + part(sh.bank, 'k2', '은행') + part(sh.stock, 'k3', '주식') + '</div></div>' +
      '<div class="np-arts">' + n.articles.map(function (x, i) { return '<div class="np-art a' + i + '"><h3>' + x.icon + ' ' + E(x.title) + '</h3><p>' + E(x.text) + '</p></div>'; }).join('') + '</div>' +
      '<div class="np-row np-last"><div class="np-box np-world"><h2>🌏 실제 사회에서는</h2><p>' + E(n.world) + ' ' + E(n.season) + '</p></div>' +
      '<div class="np-box np-tips"><h2>💡 다음 주 생활 팁</h2><ul>' + n.tips.map(function (t) { return '<li>' + E(t) + '</li>'; }).join('') + '</ul></div></div>' +
      '</div>';
  }
  function closePoster() { var b = $('news-poster'); if (b) b.classList.remove('open'); }
  window.newsPoster = function (which) {
    var n = typeof which === 'number' ? room.history[which] : room[which];
    if (n) openPoster(n, room.className);
  };
  function openPoster(n, className) {
    var box = $('news-poster');
    if (!box) {
      box = document.createElement('div'); box.id = 'news-poster';
      box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', '뉴스 포스터');
      box.addEventListener('click', function (e) { if (e.target === box) closePoster(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePoster(); });
      document.body.appendChild(box);
    }
    box.innerHTML = '<div class="np-tools"><span>🖨️ A4 세로 1장 · 인쇄 창에서 <b>배경 그래픽</b>을 켜면 색이 그대로 나와요.</span><button class="btn btn-sm btn-blue" id="np-print">인쇄하기</button><button class="btn btn-sm btn-outline" id="np-close">닫기</button></div>' + posterHTML(n, className);
    $('np-print').onclick = printPoster; $('np-close').onclick = closePoster;
    box.classList.add('open'); box.scrollTop = 0;
    $('np-print').focus();
  }
  function printPoster() {
    // @page는 이 포스터를 인쇄할 때만 (다른 인쇄에 영향 없게)
    var st = document.createElement('style');
    st.textContent = '@page{size:A4 portrait;margin:0}';
    document.head.appendChild(st);
    document.body.classList.add('np-printing');
    window.addEventListener('afterprint', function () { document.body.classList.remove('np-printing'); st.remove(); }, { once: true });
    window.print();
  }

  // ---------- 학생 대시보드 위쪽: 다음 주 예보 + 지금 적용 중인 소식 (app.js renderStudentTiles에서 부름) ----------
  var pub = null;
  function banner(n, kind) {
    var f = n.effects, soon = kind === 'announced';
    var chip = function (icon, name, pct) { return '<span class="nb-chip ' + dir(pct) + '">' + icon + ' ' + name + ' <b>' + chg(pct) + '</b></span>'; };
    return '<div class="nb' + (soon ? ' nb-soon' : '') + '" role="region" aria-label="' + (soon ? '다음 주 경제 예보' : '지금 적용 중인 경제 소식') + '"><div class="nb-head">' +
      '<span class="nb-live">' + (soon ? '📅 다음 주 경제 예보 · ' + monday(n.effectiveAt) + '부터' : '📢 지금 적용 중인 경제 소식') + '</span><span class="nb-tag">' + n.emoji + ' ' + E(n.tag) + '</span></div>' +
      '<div class="nb-title">' + E(n.title) + '</div><div class="nb-lead">' + E(soon ? n.forecast : n.lead) + '</div>' +
      '<div class="nb-chips">' + chip('🏦', '예금 이자율', f.rate) + chip('🛒', '매점 물가', f.price) + (n.estates ? chip('🪑', '자리 매매가', f.estate) + chip('🏠', '자리 임대료', f.rent) : '') + '</div>' +
      '<button class="btn btn-sm btn-outline nb-open" type="button" onclick="newsBannerPoster(\'' + kind + '\')">📰 신문 크게 보기</button></div>';
  }
  window.refreshNewsBanner = function () {
    var box = $('news-banner'), code = (typeof _cc !== 'undefined' && _cc) || cc();
    if (!box) return;
    if (!code) { box.innerHTML = ''; return; }
    google.script.run.withSuccessHandler(function (r) {
      pub = r && r.success ? r : null;
      box.innerHTML = pub ? (pub.announced ? banner(pub.announced, 'announced') : '') + (pub.active ? banner(pub.active, 'active') : '') : '';
    }).withFailureHandler(function () { box.innerHTML = ''; }).getActiveNews(code);
  };
  window.newsBannerPoster = function (kind) { if (pub && pub[kind]) openPoster(pub[kind], pub.className); };
})();
