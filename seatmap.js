// ==========================================================================
// seatmap.js — 🏫 우리 반 자리 배치도
//  보이는 곳: 부동산 중개소 → ➕ 매물 등록 (#sm-box) · 용돈기입장 → 🏫 우리 반 자리 (#wt-seat-box)
//  - 소유 자리(종류 '자리' 매물) · 공용 자리(무료) · 교사배정 자리(학습 지원, 랜덤·거래 제외)
//  - 책상 아래: 지금 앉은 사람 (세입자/랜덤으로 앉은 학생이면 작게 소유자(○○○))
//  - 선생님: 🎲 랜덤 자리 배치, 자리 옮기기(끌어서 + 저장), 공용·교사배정 자리 넣기, 혜택(사용자형/주인형) 쓰기
//  - 주인(학생): 자기 자리를 🏛️ 공공임대에 등록/해제
//  서버(Code.gs): getSeatMap · saveSeatLayout · setSeatPerks · randomSeats · setTeacherDesk · setPublicLease
// ==========================================================================
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var E = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var cc = function () { return (typeof _cc !== 'undefined' && _cc) || (typeof _adminCC !== 'undefined' && _adminCC) || ''; };
  var isT = function () { return typeof _isTeacher !== 'undefined' && _isTeacher === true; };
  var me = function () { return (typeof _sno !== 'undefined' && _sno) ? String(_sno) : ''; };
  var won = function (n) { return Number(n || 0).toLocaleString() + ' 머니'; };
  var KIND = {
    board: { label: '칠판' }, tdesk: { label: '교탁' }, door: { label: '🚪 문' }, window: { label: '창문' },
    locker: { label: '사물함' }, plant: { label: '🪴 화분' }, tv: { label: '📺 TV' }
  };
  var DESK = { public: '공용 자리', teacher: '교사배정 자리' };
  var map = null, edit = false, dirty = false, boxId = 'sm-box', perkDraft = null;
  var box = function () { return $(boxId); };

  window.loadSeatMap = function (id) {
    if (typeof id === 'string') { if (id !== boxId) edit = false; boxId = id; }
    call('getSeatMap', [cc()], false);
  };

  function call(fn, args, busy, done) {
    var b = box(); if (!b || !cc()) return;
    if (busy && typeof showLoading === 'function') showLoading();
    google.script.run.withSuccessHandler(function (r) {
      if (busy && typeof hideLoading === 'function') hideLoading();
      if (!r || !r.success) {
        if (busy) return alert((r && r.msg) || '하지 못했어요.');
        b.innerHTML = '<div class="empty-msg">자리 배치도를 불러오지 못했어요: ' + E(r && r.msg) + '</div>'; return;
      }
      map = r; dirty = false; place(); render();
      if (done) done(r);
    }).withFailureHandler(function (err) {
      if (busy && typeof hideLoading === 'function') hideLoading();
      if (busy) alert('오류: ' + err.message);
      else b.innerHTML = '<div class="empty-msg">오류: ' + E(err.message) + '</div>';
    })[fn].apply(null, args);
  }

  // 위치가 없는 자리는 칠판 아래 빈 곳에 줄 맞춰 놓음 (6자리씩 5줄 = 30자리)
  function grid(i) { return { x: 12 + (i % 6) * 15.2, y: 31 + Math.floor(i / 6) * 15 }; }
  function place(all) {
    var list = map.seats.concat(map.desks || []), used = [], n = 0;
    list.forEach(function (s) { if (!all && s.x != null) used.push(s); });
    list.forEach(function (s) {
      if (!all && s.x != null) return;
      var p;
      do { p = grid(n++); } while (n < 300 && used.some(function (u) { return Math.abs(u.x - p.x) < 7 && Math.abs(u.y - p.y) < 8; }));
      if (p.y > 92) p = { x: 20 + (n % 20) * 3, y: 94 };
      s.x = p.x; s.y = p.y; used.push(s);
    });
  }

  // 책상 아래 이름표: 지금 앉은 사람 + (주인이 아니면) 작게 소유자
  function seatTag(s) {
    if (s.status === '매물') return { cls: 'sale', tag: '매물 · ' + won(s.price) };
    if (s.tenantNo) return { cls: 'owned leased' + (s.leaseState === '연체' ? ' late' : ''), tag: (s.leaseState === '연체' ? '⏰ ' + E(s.tenantName) + ' · 연체' : '🪑 ' + E(s.tenantName) + ' · ' + E(s.leaseType)), owner: s.ownerName };
    if (s.isPublic) return { cls: 'owned public', tag: s.sitter ? '🪑 ' + E(s.sitterName) + ' · 공공임대' : '🏛️ 공공임대 · 빈 자리', owner: s.ownerName };
    return { cls: 'owned', tag: '소유자 ' + E(s.ownerName || '국가') };
  }

  function render() {
    var b = box(); if (!b || !map) return;
    var t = isT(), h = '', my = me();
    h += '<div class="sm-bar">';
    if (!t) h += '<span class="sm-hint">책상을 누르면 그 자리의 혜택을 볼 수 있어요.</span>';
    else if (!edit) h += '<span class="sm-hint">책상을 누르면 혜택을 쓸 수 있어요.</span>' +
      '<button class="btn btn-sm btn-green" onclick="seatRandom()">🎲 랜덤 자리 배치</button>' +
      '<button class="btn btn-sm btn-outline" onclick="seatEdit(true)"><i class="fa-solid fa-up-down-left-right"></i> 자리 옮기기</button>';
    else {
      h += '<span class="sm-hint sm-hint-edit">책상과 가구를 끌어서 옮겨요. 다 옮겼으면 <b>저장</b>을 눌러 주세요.</span>';
      h += '<div class="sm-add">넣기: <button class="sm-chip desk" onclick="seatAddDesk(\'public\')">+ 공용 자리</button><button class="sm-chip desk" onclick="seatAddDesk(\'teacher\')">+ 교사배정 자리</button>' +
        Object.keys(KIND).map(function (k) { return '<button class="sm-chip" onclick="seatAddItem(\'' + k + '\')">+ ' + KIND[k].label + '</button>'; }).join('') + '</div>';
      h += '<button class="btn btn-sm btn-outline" onclick="seatAutoLine()"><i class="fa-solid fa-table-cells"></i> 줄 맞추기</button>';
      h += '<button class="btn btn-sm btn-outline" onclick="seatEdit(false)">취소</button>';
      h += '<button class="btn btn-sm btn-green" onclick="seatSave()"><i class="fa-solid fa-floppy-disk"></i> 저장</button>';
    }
    h += '</div>';
    if (map.assignAt) h += '<div class="sm-info">🎲 마지막 랜덤 자리 배치: <b>' + E(map.assignAt) + '</b> · 랜덤 자리(공용·공공임대)는 <b>항상 무료</b>예요.</div>';
    if (map.unseated && map.unseated.length) h += '<div class="sm-warn">⚠️ 자리를 못 받은 학생: ' + map.unseated.map(function (u) { return E(u.no + '번 ' + u.name); }).join(', ') +
      (t ? ' — <b>자리 옮기기 → + 공용 자리</b>로 책상을 더 넣고 다시 돌려 주세요.' : '') + '</div>';
    h += '<div class="sm-scroll"><div class="sm-room' + (edit ? ' editing' : '') + '">';
    map.items.forEach(function (it, i) {
      h += '<div class="sm-item sm-k-' + it.kind + '" data-type="item" data-i="' + i + '" style="left:' + it.x + '%;top:' + it.y + '%">' +
        '<span>' + KIND[it.kind].label + '</span>' + (edit ? '<b class="sm-x" data-del="item" data-i="' + i + '" title="빼기">✕</b>' : '') + '</div>';
    });
    (map.desks || []).forEach(function (d, i) {
      var mine = my && d.sitter === my;
      h += '<div class="sm-seat dk dk-' + d.kind + (mine ? ' me' : '') + '" data-type="desk" data-i="' + i + '" style="left:' + d.x + '%;top:' + d.y + '%">' +
        '<div class="sm-desk">' + (mine ? '<i class="sm-me">나</i>' : '') + '<b>' + (d.kind === 'public' ? '공용' : '교사배정') + '</b><span>' + (d.kind === 'public' ? '무료 자리' : '학습 지원') + '</span>' +
        (edit ? '<b class="sm-x" data-del="desk" data-i="' + i + '" title="빼기">✕</b>' : '') + '</div>' +
        '<div class="sm-chair"></div>' +
        '<div class="sm-tag">' + (d.sitter ? '🪑 ' + E(d.sitterName) : '빈 자리') + '</div></div>';
    });
    map.seats.forEach(function (s, i) {
      var g = seatTag(s), mine = my && s.sitter === my;
      h += '<div class="sm-seat ' + g.cls + (mine ? ' me' : '') + '" data-type="seat" data-i="' + i + '" style="left:' + s.x + '%;top:' + s.y + '%">' +
        '<div class="sm-desk">' + (s.perks && s.perks.length ? '<i class="sm-star">⭐</i>' : '') + (mine ? '<i class="sm-me">나</i>' : '') +
        '<b>' + E(s.assetNo) + '</b><span>' + E(s.name) + '</span></div>' +
        '<div class="sm-chair"></div>' +
        '<div class="sm-tag">' + g.tag + '</div>' +
        (g.owner ? '<div class="sm-tag-owner">소유자(' + E(g.owner) + ')</div>' : '') + '</div>';
    });
    h += '</div></div>';
    if (!map.seats.length && !(map.desks || []).length) h += '<div class="sm-empty">아직 자리가 없어요. ' + (t ? '<b>자리 옮기기 → + 공용 자리</b>로 무료 자리를 넣거나, ' : '') + '종류를 <b>자리</b>로 골라 매물을 등록하면 책상이 생겨요.</div>';
    h += '<div class="sm-legend"><span><i class="lg sale"></i> 살 수 있는 자리</span><span><i class="lg owned"></i> 주인이 앉은 자리</span><span><i class="lg leased"></i> 월세·전세로 앉은 자리</span>' +
      '<span><i class="lg public"></i> 공공임대 (무료)</span><span><i class="lg dk-public"></i> 공용 자리 (무료)</span><span><i class="lg dk-teacher"></i> 교사배정 자리</span><span>⭐ 혜택이 있는 자리</span></div>';
    b.innerHTML = h;
    bind();
  }

  // 끌어서 옮기기 (편집 중) / 누르기 (자리 정보)
  function bind() {
    var room = box() && box().querySelector('.sm-room'); if (!room) return;
    room.querySelectorAll('[data-type]').forEach(function (el) {
      el.addEventListener('pointerdown', function (ev) {
        if (ev.target.getAttribute('data-del') != null) return;
        var type = el.getAttribute('data-type'), i = +el.getAttribute('data-i');
        var obj = type === 'seat' ? map.seats[i] : type === 'desk' ? map.desks[i] : map.items[i];
        var sx = ev.clientX, sy = ev.clientY, moved = false;
        if (edit) { try { el.setPointerCapture(ev.pointerId); } catch (e) {} ev.preventDefault(); }
        function move(e) {
          if (!edit) return;
          if (!moved && Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) < 5) return;
          moved = true; el.classList.add('dragging');
          var r = room.getBoundingClientRect();
          obj.x = Math.max(2, Math.min(98, Math.round((e.clientX - r.left) / r.width * 1000) / 10));
          obj.y = Math.max(2, Math.min(98, Math.round((e.clientY - r.top) / r.height * 1000) / 10));
          el.style.left = obj.x + '%'; el.style.top = obj.y + '%';
        }
        function up() {
          el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
          el.classList.remove('dragging');
          if (moved) { dirty = true; return; }
          if (edit) return;
          if (type === 'seat') openSeat(i);
          else if (type === 'desk') openDesk(i);
        }
        el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      });
    });
    room.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        var list = b.getAttribute('data-del') === 'desk' ? map.desks : map.items;
        list.splice(+b.getAttribute('data-i'), 1); dirty = true; render();
      });
    });
  }

  window.seatEdit = async function (on) {
    if (!on && dirty && !await uiConfirm('옮긴 자리를 저장하지 않고 그만둘까요?')) return;
    edit = on;
    if (!on) return loadSeatMap();
    render();
  };
  window.seatAddItem = function (kind) {
    map.items.push({ id: kind + Date.now().toString(36), kind: kind, x: 50, y: 50 }); dirty = true; render();
  };
  window.seatAddDesk = function (kind) {
    map.desks = map.desks || [];
    map.desks.push({ id: 'dk' + Date.now().toString(36), kind: kind, x: 50, y: 55, sitter: '', sitterName: '', assignNo: '' }); dirty = true; render();
  };
  window.seatAutoLine = async function () {
    if (!await uiConfirm('모든 책상을 6자리씩 줄 맞춰 다시 놓을까요?\n(저장을 눌러야 정말 바뀌어요)')) return;
    place(true); dirty = true; render();
  };
  window.seatSave = function () {
    var L = { seats: {}, items: map.items, desks: (map.desks || []).map(function (d) { return { id: d.id, kind: d.kind, x: d.x, y: d.y }; }) };
    map.seats.forEach(function (s) { L.seats[s.assetNo] = { x: s.x, y: s.y }; });
    call('saveSeatLayout', [cc(), L, isT()], true, function () { edit = false; render(); });
  };
  window.seatRandom = async function () {
    if (!await uiConfirm('🎲 랜덤 자리 배치를 할까요?\n\n· 주인은 자기 자리, 세입자는 계약한 자리, 교사배정 학생은 그 자리에 그대로 앉아요.\n· 나머지 학생은 빈 공용 자리와 공공임대 자리에 무작위로 앉아요. (무료)')) return;
    call('randomSeats', [cc(), isT()], true);
  };

  function popShow(h) {
    var pop = $('sm-pop');
    if (!pop) { pop = document.createElement('div'); pop.id = 'sm-pop'; pop.className = 'sm-pop'; document.body.appendChild(pop);
      pop.addEventListener('click', function (e) { if (e.target === pop) seatClose(); }); }
    pop.innerHTML = h; pop.classList.add('show');
    if (typeof anime === 'function') anime({ targets: pop.firstChild, scale: [0.92, 1], opacity: [0, 1], duration: 260, easing: 'easeOutQuad' });
  }
  window.seatClose = function () { var p = $('sm-pop'); if (p) p.classList.remove('show'); };

  // 혜택 목록 (사용자형 = 앉은 사람, 주인형 = 주인)
  function perksView(s) {
    if (!s.perks || !s.perks.length) return '<p>아직 정해진 혜택이 없어요.</p>';
    return '<ul class="sm-perks">' + s.perks.map(function (p) {
      var who = p.k === 'owner' ? '👑 주인형 · ' + E(s.ownerName || '주인') : '🪑 사용자형 · ' + (s.sitterName ? E(s.sitterName) : '앉은 사람');
      return '<li><span class="pk-k ' + (p.k === 'owner' ? 'own' : 'use') + '">' + who + '</span>' + E(p.t) + '</li>';
    }).join('') + '</ul>';
  }
  function perksEditor() {
    return '<div class="sm-pe">' + perkDraft.map(function (p, j) {
      return '<div class="sm-pe-row"><select onchange="seatPerkSet(' + j + ',\'k\',this.value)"><option value="user"' + (p.k !== 'owner' ? ' selected' : '') + '>🪑 사용자형</option><option value="owner"' + (p.k === 'owner' ? ' selected' : '') + '>👑 주인형</option></select>' +
        '<input maxlength="120" value="' + E(p.t) + '" placeholder="예: 급식 먼저 먹기" oninput="seatPerkSet(' + j + ',\'t\',this.value)"><button class="sm-pe-x" onclick="seatPerkDel(' + j + ')">✕</button></div>';
    }).join('') + '<button class="btn btn-sm btn-outline" onclick="seatPerkAdd()">+ 혜택 추가</button>' +
      '<div class="sm-pe-help">🪑 사용자형: 줄 먼저 서기·선곡권·창문 조절처럼 <b>실제로 앉은 사람</b>이 받아요.<br>👑 주인형: 배당 보너스·상권 보너스처럼 <b>돈으로 받는 혜택</b>은 주인이 받아요.</div></div>';
  }
  window.seatPerkSet = function (j, k, v) { perkDraft[j][k] = v; };
  window.seatPerkDel = function (j) { perkDraft.splice(j, 1); $('sm-pe-box').innerHTML = perksEditor(); };
  window.seatPerkAdd = function () { if (perkDraft.length >= 8) return alert('혜택은 8개까지 적을 수 있어요.'); perkDraft.push({ t: '', k: 'user' }); $('sm-pe-box').innerHTML = perksEditor(); };

  // 소유 자리 정보 창
  function openSeat(i) {
    var s = map.seats[i], t = isT(), sale = s.status === '매물', my = me();
    var canPub = !sale && !s.tenantNo && (t || (my && my === s.ownerNo));
    var h = '<div class="sm-pop-card"><button class="sm-pop-x" onclick="seatClose()">✕</button>' +
      '<div class="sm-pop-head"><span class="sm-pop-no">' + E(s.assetNo) + '</span><h3>🪑 ' + E(s.name) + '</h3>' +
      '<span class="sm-pop-st ' + (sale ? 'sale' : 'owned') + '">' + (sale ? '살 수 있어요' : s.isPublic ? '공공임대' : '주인이 있어요') + '</span></div>' +
      '<div class="sm-pop-rows"><div><span>매매 가격</span><b>' + won(s.price) + '</b></div>' +
      '<div><span>임대료/주</span><b>' + (s.rent ? won(s.rent) : '임대 안 함') + '</b></div>' +
      '<div><span>소유자</span><b>' + (sale ? '없음 (매물)' : E(s.ownerName || '국가')) + '</b></div>' +
      (s.sitter ? '<div><span>지금 앉은 사람</span><b>🪑 ' + E(s.sitterName) + (s.isPublic ? ' (공공임대 · 무료)' : '') + '</b></div>' : '') +
      (!sale && s.tenantNo ? '<div><span>계약 (' + E(s.leaseType) + ')</span><b>' + (s.leaseAmt ? (s.leaseType === '전세' ? '전세금 ' : '보증금 ') + won(s.leaseAmt) : '보증금 없음') + '</b></div>' +
        (s.leaseType === '월세' ? '<div><span>월세 상태</span><b>' + (s.leaseState === '연체' ? '⏰ 연체 중' : s.leaseState === '분할' ? '📅 연체금 분할 상환 중' : s.rentPaid ? '✅ 이번 주 정산 끝' : '⏳ 이번 주 정산 전') + '</b></div>' : '') : '') +
      '</div>' +
      (canPub ? '<button class="btn btn-sm ' + (s.isPublic ? 'btn-outline' : 'btn-green') + ' sm-pop-edit" onclick="seatPublic(' + i + ',' + (!s.isPublic) + ')">🏛️ ' + (s.isPublic ? '공공임대 해제' : '공공임대에 등록 (국고가 매주 월세의 일부를 줘요)') + '</button>' : '') +
      (typeof reCanEdit === 'function' && reCanEdit() ? '<button class="btn btn-sm btn-outline sm-pop-edit" onclick="seatClose();reEditOpen(\'' + E(s.assetNo) + '\')"><i class="fa-solid fa-pen"></i> 이름·가격·소유자·세입자 수정</button>' : '') +
      '<div class="sm-pop-perk"><div class="sm-pop-lb">⭐ 이 자리의 혜택</div>';
    if (t) { perkDraft = (s.perks || []).map(function (p) { return { t: p.t, k: p.k }; }); if (!perkDraft.length) perkDraft.push({ t: '', k: 'user' });
      h += '<div id="sm-pe-box">' + perksEditor() + '</div><div class="sm-pop-btns"><span class="sm-pop-cnt">혜택마다 120자까지</span><button class="btn btn-green" onclick="seatPerkSave(' + i + ')"><i class="fa-solid fa-floppy-disk"></i> 혜택 저장</button></div>'; }
    else h += perksView(s);
    h += '</div></div>';
    popShow(h);
  }
  window.seatPerkSave = function (i) {
    var s = map.seats[i], list = perkDraft.filter(function (p) { return String(p.t || '').trim(); });
    call('setSeatPerks', [cc(), s.assetNo, list, isT()], true, function () { seatClose(); });
  };
  window.seatPublic = async function (i, on) {
    var s = map.seats[i], pct = map.cfg ? map.cfg.pubPct : 50;
    if (!await uiConfirm(on ? '🏛️ ' + s.assetNo + ' ' + s.name + '을(를) 공공임대에 등록할까요?\n\n· 다음 랜덤 자리부터 다른 학생이 이 자리에 무료로 앉아요.\n· 주인은 매주 월세 정산 때 국고에서 월세의 ' + pct + '%를 받아요.\n· 주인은 공용 자리나 다른 랜덤 자리에 앉아요.'
      : s.assetNo + ' ' + s.name + '을(를) 공공임대에서 뺄까요?\n지금 랜덤으로 앉은 학생은 다음 랜덤 자리 때 다른 자리로 가요.')) return;
    call('setPublicLease', [cc(), s.assetNo, on, me(), isT()], true, function () { seatClose(); });
  };

  // 공용 / 교사배정 자리 창
  function openDesk(i) {
    var d = map.desks[i], t = isT();
    var h = '<div class="sm-pop-card"><button class="sm-pop-x" onclick="seatClose()">✕</button>' +
      '<div class="sm-pop-head"><h3>🪑 ' + DESK[d.kind] + '</h3><span class="sm-pop-st owned">무료</span></div>' +
      '<div class="sm-pop-rows"><div><span>지금 앉은 사람</span><b>' + (d.sitter ? E(d.sitterName) : '빈 자리') + '</b></div></div>' +
      '<div class="sm-pop-perk"><p>' + (d.kind === 'public' ? '누구나 무료로 앉는 자리예요. 🎲 랜덤 자리 배치 때 자리가 없는 학생이 앉아요.' : '학습 지원이 필요한 학생을 위해 선생님이 정한 자리예요. 랜덤 배치와 사고팔기에서 빠져요.') + '</p>';
    if (t && d.kind === 'teacher') h += '<div class="sm-pe-row" style="margin-top:10px;"><select id="sm-dk-stu"><option value="">불러오는 중...</option></select>' +
      '<button class="btn btn-green" onclick="seatDeskSave(' + i + ')"><i class="fa-solid fa-floppy-disk"></i> 저장</button></div>';
    h += '</div></div>';
    popShow(h);
    if (t && d.kind === 'teacher') google.script.run.withSuccessHandler(function (r) {
      var sel = $('sm-dk-stu'); if (!sel) return;
      sel.innerHTML = '<option value="">비워 두기</option>' + ((r && r.list) || []).filter(function (s) { return String(s.studentNo) !== '0'; }).map(function (s) {
        return '<option value="' + E(s.studentNo) + '"' + (String(s.studentNo) === String(d.assignNo) ? ' selected' : '') + '>' + E(s.studentNo + '번 ' + (s.name || '')) + '</option>'; }).join('');
    }).getStudentList(cc());
  }
  window.seatDeskSave = function (i) {
    var d = map.desks[i];
    call('setTeacherDesk', [cc(), d.id, ($('sm-dk-stu') || {}).value || '', isT()], true, function () { seatClose(); });
  };
})();
