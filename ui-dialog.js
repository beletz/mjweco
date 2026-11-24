// ==========================================================================
// ui-dialog.js — 브라우저 기본 알림창(alert · confirm · prompt) 대신 예쁜 창
//
//  uiConfirm('메시지')          → Promise<true|false>      (확인 / 취소)
//  uiPrompt('메시지', '기본값')  → Promise<문자열|null>     (확인 / 취소)
//  alert('메시지')               → 예쁜 알림창 (기다리지 않음)
//
//  쓰는 법: 함수 앞에 async를 붙이고  if(!await uiConfirm('정말 지울까요?')) return;
//  메시지 첫 줄이 [제목] 이면 그 글자가 창 제목이 됩니다. 예: '[벌금 취소 확인]\n\n학생: …'
//  여러 개가 한꺼번에 뜨면 차례대로 하나씩 보여 줍니다.
//  화면에 그리는 글자라서 currency.js가 '머니'를 학급 화폐 이름으로 바꿔 줍니다.
// ==========================================================================
(function () {
  var nativeAlert = window.alert ? window.alert.bind(window) : null;
  var queue = [], showing = null, box = null;

  var DANGER = /삭제|지우|지울|취소|해지|초기화|반려|되돌릴 수 없|벌금|팔기|매도/;
  var WARN = /오류|실패|부족|⚠️|❌|❗|없습니다|없어요|못했|못 했|잘못|안 돼|권한|입력해 주세요|적어 주세요|골라 주세요|선택해 주세요|확인해 주세요/;
  var GOOD = /✅|🎉|완료|성공|저장했|되었습니다|됐어요|했어요/;

  function ensureBox() {
    if (box) return box;
    var st = document.createElement('style');
    st.textContent =
      '#ui-dialog{position:fixed;inset:0;z-index:100001;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.45);padding:16px}' +
      '#ui-dialog.open{display:flex}' +
      '#ui-dialog .ud-card{background:#fff;border-radius:22px;padding:26px 24px 20px;width:100%;max-width:420px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.22);border-top:6px solid #2F6BFF}' +
      '#ui-dialog.t-danger .ud-card{border-top-color:#EF4444}' +
      '#ui-dialog.t-warn .ud-card{border-top-color:#F59E0B}' +
      '#ui-dialog.t-good .ud-card{border-top-color:#10B981}' +
      '#ui-dialog .ud-icon{width:62px;height:62px;border-radius:50%;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-size:32px;background:#EAF1FF}' +
      '#ui-dialog.t-danger .ud-icon{background:#FEE2E2}#ui-dialog.t-warn .ud-icon{background:#FEF3C7}#ui-dialog.t-good .ud-icon{background:#D1FAE5}' +
      '#ui-dialog .ud-title{font-family:Jua,sans-serif;font-size:21px;color:#1E293B;margin-bottom:8px;word-break:keep-all}' +
      '#ui-dialog .ud-msg{font-size:15.5px;color:#334155;line-height:1.6;white-space:pre-line;word-break:keep-all;text-align:left;background:#F8FAFC;border:1px solid #EEF1F5;border-radius:14px;padding:12px 14px;max-height:46vh;overflow:auto;margin-bottom:16px}' +
      '#ui-dialog .ud-msg:empty{display:none}' +
      '#ui-dialog .ud-input{width:100%;box-sizing:border-box;padding:12px 14px;border:1.5px solid #CBD5E1;border-radius:12px;font-size:16px;font-family:inherit;outline:none;margin:-4px 0 16px}' +
      '#ui-dialog .ud-input:focus{border-color:#2F6BFF;box-shadow:0 0 0 3px rgba(47,107,255,.18)}' +
      '#ui-dialog .ud-btns{display:flex;gap:10px}' +
      '#ui-dialog .ud-btns button{flex:1;border:none;border-radius:14px;padding:13px;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit;transition:filter .15s,transform .1s}' +
      '#ui-dialog .ud-btns button:active{transform:scale(.97)}' +
      '#ui-dialog .ud-ok{color:#fff;background:#2F6BFF}#ui-dialog .ud-ok:hover{filter:brightness(.93)}' +
      '#ui-dialog.t-danger .ud-ok{background:#EF4444}#ui-dialog.t-warn .ud-ok{background:#F59E0B}#ui-dialog.t-good .ud-ok{background:#10B981}' +
      '#ui-dialog .ud-cancel{background:#F1F5F9;color:#475569}#ui-dialog .ud-cancel:hover{background:#E2E8F0}' +
      '#ui-dialog .ud-cancel[hidden]{display:none}';
    document.head.appendChild(st);
    box = document.createElement('div');
    box.id = 'ui-dialog';
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<div class="ud-card"><div class="ud-icon"></div><div class="ud-title"></div><div class="ud-msg"></div>' +
      '<input class="ud-input" type="text"><div class="ud-btns"><button type="button" class="ud-cancel">취소</button><button type="button" class="ud-ok">확인</button></div></div>';
    box.querySelector('.ud-ok').addEventListener('click', function () { finish(true); });
    box.querySelector('.ud-cancel').addEventListener('click', function () { finish(false); });
    box.addEventListener('click', function (e) { if (e.target === box && showing && showing.kind === 'alert') finish(true); });
    document.addEventListener('keydown', function (e) {
      if (!showing) return;
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(showing.kind === 'alert'); }
    }, true);
    document.body.appendChild(box);
    return box;
  }

  // 메시지 → 제목, 본문, 분위기(색)
  function parse(kind, msg) {
    var text = String(msg == null ? '' : msg).replace(/\r/g, '');
    var title = '', m = text.match(/^\s*\[([^\]\n]{1,40})\]\s*\n?/);
    if (m) { title = m[1]; text = text.slice(m[0].length).replace(/^\n+/, ''); }
    var tone;
    if (kind === 'confirm') tone = DANGER.test(title + text) ? 'danger' : 'info';
    else if (kind === 'prompt') tone = DANGER.test(title + text) ? 'danger' : 'info';
    else tone = /^\s*(✅|🎉)/.test(text) ? 'good' : WARN.test(text) ? 'warn' : GOOD.test(text) ? 'good' : 'info';
    // 첫 줄에 붙은 이모지는 큰 동그라미로 올림
    var em = text.match(/^\s*(⚠️|❗|❌|✅|🎉|🗑️|💸|🔒|🚦|📨|⏳)\s*/);
    var icon = em ? em[1] : null;
    if (em) text = text.slice(em[0].length);
    if (!title) {
      // 본문이 한 줄짜리 짧은 문장이면 그것을 제목으로
      var firstLine = text.split('\n')[0];
      if (kind !== 'alert' && text.indexOf('\n') === -1 && firstLine.length <= 26) { title = firstLine; text = ''; }
      else title = kind === 'confirm' ? (tone === 'danger' ? '정말 진행할까요?' : '확인해 주세요')
        : kind === 'prompt' ? '입력해 주세요'
        : tone === 'warn' ? '확인해 주세요' : tone === 'good' ? '완료!' : '알림';
    }
    if (!icon) icon = kind === 'prompt' ? '✏️' : tone === 'danger' ? '⚠️' : tone === 'warn' ? '⚠️' : tone === 'good' ? '✅' : kind === 'confirm' ? '❓' : '💬';
    return { title: title, text: text.trim(), tone: tone, icon: icon };
  }

  function next() {
    if (showing || !queue.length) return;
    showing = queue.shift();
    var b = ensureBox(), p = parse(showing.kind, showing.msg);
    b.className = 'open t-' + p.tone;
    b.querySelector('.ud-icon').textContent = p.icon;
    b.querySelector('.ud-title').textContent = p.title;
    b.querySelector('.ud-msg').textContent = p.text;
    var inp = b.querySelector('.ud-input');
    inp.style.display = showing.kind === 'prompt' ? 'block' : 'none';
    inp.value = showing.kind === 'prompt' ? String(showing.def == null ? '' : showing.def) : '';
    b.querySelector('.ud-cancel').hidden = showing.kind === 'alert';
    b.querySelector('.ud-ok').textContent = showing.kind === 'confirm' && p.tone === 'danger' ? '네, 진행할게요' : '확인';
    setTimeout(function () {
      try { (showing && showing.kind === 'prompt' ? inp : b.querySelector('.ud-ok')).focus(); if (showing && showing.kind === 'prompt') inp.select(); } catch (e) {}
    }, 30);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (window.anime && !reduce) {
      anime.remove(b.querySelector('.ud-card'));
      anime({ targets: b.querySelector('.ud-card'), scale: [0.88, 1], opacity: [0, 1], duration: 360, easing: 'easeOutBack' });
      anime({ targets: b.querySelector('.ud-icon'), scale: [0.4, 1], duration: 520, delay: 60, easing: 'easeOutElastic(1, .6)' });
    }
  }

  function finish(ok) {
    if (!showing) return;
    var cur = showing; showing = null;
    var val = cur.kind === 'prompt' ? (ok ? box.querySelector('.ud-input').value : null) : (cur.kind === 'confirm' ? !!ok : undefined);
    box.className = '';
    try { cur.resolve(val); } catch (e) {}
    setTimeout(next, 60);
  }

  function open(kind, msg, def) {
    return new Promise(function (resolve) {
      queue.push({ kind: kind, msg: msg, def: def, resolve: resolve });
      if (document.body) next(); else document.addEventListener('DOMContentLoaded', next);
    });
  }

  window.uiConfirm = function (msg) { return open('confirm', msg); };
  window.uiPrompt = function (msg, def) { return open('prompt', msg, def); };
  window.uiAlert = function (msg) { return open('alert', msg); };
  // 기존 코드의 alert(...)는 모두 예쁜 창으로 (기다릴 필요가 없는 알림이라 그대로 바꿔도 안전)
  window.alert = function (msg) { window.uiAlert(msg); };
  window.__nativeAlert = nativeAlert;
})();
