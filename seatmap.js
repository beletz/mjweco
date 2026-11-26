// ==========================================================================
// seatmap.js — 부동산 중개소 → ➕ 매물 등록 → 🏫 우리 반 자리 배치도
//  - 종류가 '자리'인 매물이 교실 그림 속 책상으로 보여요. 누르면 혜택·가격·소유자가 나와요.
//  - 선생님만: ✏️ 자리 옮기기(끌어서 옮기고 💾 저장), 칠판·교탁·문 같은 가구 넣기/빼기, 자리 혜택 쓰기
//  서버(Code.gs): getSeatMap · saveSeatLayout · setSeatPerk
// ==========================================================================
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var E = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var cc = function () { return (typeof _cc !== 'undefined' && _cc) || (typeof _adminCC !== 'undefined' && _adminCC) || ''; };
  var isT = function () { return typeof _isTeacher !== 'undefined' && _isTeacher === true; };
  var won = function (n) { return Number(n || 0).toLocaleString() + ' 머니'; };
  var KIND = {
    board: { label: '칠판' }, tdesk: { label: '교탁' }, door: { label: '🚪 문' }, window: { label: '창문' },
    locker: { label: '사물함' }, plant: { label: '🪴 화분' }, tv: { label: '📺 TV' }
  };
  var map = null, edit = false, dirty = false;

  window.loadSeatMap = function () { call('getSeatMap', [cc()], false); };

  function call(fn, args, busy, done) {
    var box = $('sm-box'); if (!box || !cc()) return;
    if (busy && typeof showLoading === 'function') showLoading();
    google.script.run.withSuccessHandler(function (r) {
      if (busy && typeof hideLoading === 'function') hideLoading();
      if (!r || !r.success) {
        if (busy) return alert((r && r.msg) || '하지 못했어요.');
        box.innerHTML = '<div class="empty-msg">자리 배치도를 불러오지 못했어요: ' + E(r && r.msg) + '</div>'; return;
      }
      map = r; dirty = false; place(); render();
      if (done) done(r);
    }).withFailureHandler(function (err) {
      if (busy && typeof hideLoading === 'function') hideLoading();
      if (busy) alert('오류: ' + err.message);
      else box.innerHTML = '<div class="empty-msg">오류: ' + E(err.message) + '</div>';
    })[fn].apply(null, args);
  }

  // 위치가 없는 자리는 칠판 아래 빈 곳에 줄 맞춰 놓음 (6자리씩 5줄 = 30자리)
  function grid(i) { return { x: 12 + (i % 6) * 15.2, y: 31 + Math.floor(i / 6) * 15 }; }
  function place(all) {
    var used = [], n = 0;
    map.seats.forEach(function (s) { if (!all && s.x != null) used.push(s); });
    map.seats.forEach(function (s) {
      if (!all && s.x != null) return;
      var p;
      do { p = grid(n++); } while (n < 300 && used.some(function (u) { return Math.abs(u.x - p.x) < 7 && Math.abs(u.y - p.y) < 8; }));
      if (p.y > 92) p = { x: 20 + (n % 20) * 3, y: 94 };
      s.x = p.x; s.y = p.y; used.push(s);
      if (!all) s.auto = true;
    });
  }

  function render() {
    var box = $('sm-box'); if (!box || !map) return;
    var t = isT(), h = '';
    h += '<div class="sm-bar">';
    if (!t) h += '<span class="sm-hint">책상을 누르면 그 자리의 혜택을 볼 수 있어요.</span>';
    else if (!edit) h += '<span class="sm-hint">책상을 누르면 혜택을 쓸 수 있어요.</span><button class="btn btn-sm btn-outline" onclick="seatEdit(true)"><i class="fa-solid fa-up-down-left-right"></i> 자리 옮기기</button>';
    else {
      h += '<span class="sm-hint sm-hint-edit">책상과 가구를 끌어서 옮겨요. 다 옮겼으면 <b>저장</b>을 눌러 주세요.</span>';
      h += '<div class="sm-add">넣기: ' + Object.keys(KIND).map(function (k) { return '<button class="sm-chip" onclick="seatAddItem(\'' + k + '\')">+ ' + KIND[k].label + '</button>'; }).join('') + '</div>';
      h += '<button class="btn btn-sm btn-outline" onclick="seatAutoLine()"><i class="fa-solid fa-table-cells"></i> 줄 맞추기</button>';
      h += '<button class="btn btn-sm btn-outline" onclick="seatEdit(false)">취소</button>';
      h += '<button class="btn btn-sm btn-green" onclick="seatSave()"><i class="fa-solid fa-floppy-disk"></i> 저장</button>';
    }
    h += '</div>';
    h += '<div class="sm-scroll"><div class="sm-room' + (edit ? ' editing' : '') + '" id="sm-room">';
    map.items.forEach(function (it, i) {
      h += '<div class="sm-item sm-k-' + it.kind + '" data-type="item" data-i="' + i + '" style="left:' + it.x + '%;top:' + it.y + '%">' +
        '<span>' + KIND[it.kind].label + '</span>' + (edit ? '<b class="sm-x" data-del="' + i + '" title="빼기">✕</b>' : '') + '</div>';
    });
    map.seats.forEach(function (s, i) {
      var sale = s.status === '매물';
      h += '<div class="sm-seat ' + (sale ? 'sale' : 'owned') + '" data-type="seat" data-i="' + i + '" style="left:' + s.x + '%;top:' + s.y + '%">' +
        '<div class="sm-desk">' + (s.perk ? '<i class="sm-star">⭐</i>' : '') + '<b>' + E(s.assetNo) + '</b><span>' + E(s.name) + '</span></div>' +
        '<div class="sm-chair"></div>' +
        '<div class="sm-tag">' + (sale ? '매물 · ' + won(s.price) : '소유자 ' + E(s.ownerName || '국가')) + '</div></div>';
    });
    h += '</div></div>';
    if (!map.seats.length) h += '<div class="sm-empty">아직 "자리" 매물이 없어요. 아래에서 종류를 <b>자리</b>로 골라 등록하면 교실에 책상이 생겨요.</div>';
    h += '<div class="sm-legend"><span><i class="lg sale"></i> 살 수 있는 자리</span><span><i class="lg owned"></i> 주인이 있는 자리</span><span>⭐ 혜택이 있는 자리</span></div>';
    box.innerHTML = h;
    bind();
  }

  // 끌어서 옮기기 (편집 중) / 누르기 (자리 정보)
  function bind() {
    var room = $('sm-room'); if (!room) return;
    room.querySelectorAll('[data-type]').forEach(function (el) {
      el.addEventListener('pointerdown', function (ev) {
        if (ev.target.getAttribute('data-del') != null) return;
        var type = el.getAttribute('data-type'), i = +el.getAttribute('data-i');
        var obj = type === 'seat' ? map.seats[i] : map.items[i];
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
          if (type === 'seat' && !edit) openSeat(i);
        }
        el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      });
    });
    room.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () { map.items.splice(+b.getAttribute('data-del'), 1); dirty = true; render(); });
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
  window.seatAutoLine = async function () {
    if (!await uiConfirm('모든 책상을 6자리씩 줄 맞춰 다시 놓을까요?\n(저장을 눌러야 정말 바뀌어요)')) return;
    place(true); dirty = true; render();
  };
  window.seatSave = function () {
    var L = { seats: {}, items: map.items };
    map.seats.forEach(function (s) { L.seats[s.assetNo] = { x: s.x, y: s.y }; });
    call('saveSeatLayout', [cc(), L, isT()], true, function () { edit = false; render(); });
  };

  // 자리 정보 창
  function openSeat(i) {
    var s = map.seats[i], t = isT(), sale = s.status === '매물';
    var h = '<div class="sm-pop-card"><button class="sm-pop-x" onclick="seatClose()">✕</button>' +
      '<div class="sm-pop-head"><span class="sm-pop-no">' + E(s.assetNo) + '</span><h3>🪑 ' + E(s.name) + '</h3>' +
      '<span class="sm-pop-st ' + (sale ? 'sale' : 'owned') + '">' + (sale ? '살 수 있어요' : '주인이 있어요') + '</span></div>' +
      '<div class="sm-pop-rows"><div><span>매매 가격</span><b>' + won(s.price) + '</b></div>' +
      '<div><span>임대료/주</span><b>' + (s.rent ? won(s.rent) : '임대 안 함') + '</b></div>' +
      '<div><span>소유자</span><b>' + (sale ? '없음 (매물)' : E(s.ownerName || '국가')) + '</b></div></div>' +
      '<div class="sm-pop-perk"><div class="sm-pop-lb">⭐ 이 자리의 혜택</div>';
    if (t) h += '<textarea id="sm-perk" maxlength="120" placeholder="예: 급식 먼저 먹기, 창가라 햇빛이 잘 들어요">' + E(s.perk) + '</textarea>' +
      '<div class="sm-pop-btns"><span class="sm-pop-cnt">120자까지</span><button class="btn btn-green" onclick="seatPerkSave(' + i + ')"><i class="fa-solid fa-floppy-disk"></i> 혜택 저장</button></div>';
    else h += '<p>' + (s.perk ? E(s.perk).replace(/\n/g, '<br>') : '아직 정해진 혜택이 없어요.') + '</p>';
    h += '</div></div>';
    var pop = $('sm-pop');
    if (!pop) { pop = document.createElement('div'); pop.id = 'sm-pop'; pop.className = 'sm-pop'; document.body.appendChild(pop);
      pop.addEventListener('click', function (e) { if (e.target === pop) seatClose(); }); }
    pop.innerHTML = h; pop.classList.add('show');
    if (typeof anime === 'function') anime({ targets: pop.firstChild, scale: [0.92, 1], opacity: [0, 1], duration: 260, easing: 'easeOutQuad' });
  }
  window.seatClose = function () { var p = $('sm-pop'); if (p) p.classList.remove('show'); };
  window.seatPerkSave = function (i) {
    var s = map.seats[i], v = $('sm-perk').value;
    call('setSeatPerk', [cc(), s.assetNo, v, isT()], true, function () { seatClose(); });
  };
})();
