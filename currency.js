// ==========================================================================
// 화폐 이름 — 학급마다 '머니' 대신 다른 이름을 쓸 수 있음
// 마스터 → 홈 → "화폐 이름"에서 바꿉니다. (서버: Code.gs getCurrencyName / setCurrencyName)
// 화면에 나오는 글자, 입력칸 안내글, 알림창(alert/confirm/prompt) 속 '머니'를 새 이름으로 바꿔 보여 줍니다.
// 바꾸지 않는 곳: 홈페이지 이름(쇼미더머니 나라), 할머니·어머니·주머니 같은 낱말, class="cur-keep"이 붙은 곳, 입력칸에 직접 쓴 글자
// ==========================================================================
(function () {
  var BASE = '머니';
  var CACHE_PREFIX = 'smtm_currency_';
  var applied = BASE;     // 지금 화면에 적용된 이름
  var re = null;          // '머니'를 찾는 규칙
  var observer = null;
  var lastCC = null;
  var done = typeof WeakMap === 'function' ? new WeakMap() : null; // 이미 바꾼 글자는 다시 건드리지 않음
  var $ = function (id) { return document.getElementById(id); };

  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function buildRe(name) {
    // 새 이름 안에 '머니'가 들어 있으면(예: 드림머니) 바꾼 결과를 또 바꾸지 않도록 앞뒤 글자를 빼고 찾음
    var guard = '';
    var p = name.indexOf(BASE);
    if (p !== -1) {
      var pre = name.slice(0, p), post = name.slice(p + BASE.length);
      if (pre) guard += '(?<!' + escRe(pre) + ')';
      if (post) guard += '(?!' + escRe(post) + ')';
    }
    try { return new RegExp('(?<!쇼미더|할|어|주)' + guard + BASE, 'g'); }
    catch (e) { return /머니/g; } // 아주 오래된 브라우저
  }

  function swap(text) {
    if (applied === BASE || !text || text.indexOf(BASE) === -1) return text;
    re.lastIndex = 0;
    return text.replace(re, applied);
  }

  function skip(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'NOSCRIPT') return true;
    return !!(el.closest && el.closest('[data-site-name], .cur-keep'));
  }

  function fixText(node) {
    if (done && done.get(node) === node.data) return;
    if (skip(node.parentElement)) return;
    var out = swap(node.data);
    if (out !== node.data) node.data = out;
    if (done) done.set(node, node.data);
  }

  function fixAttrs(el) {
    if (skip(el)) return;
    ['placeholder', 'title', 'aria-label'].forEach(function (a) {
      var v = el.getAttribute && el.getAttribute(a);
      if (v && v.indexOf(BASE) !== -1) { var o = swap(v); if (o !== v) el.setAttribute(a, o); }
    });
    if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit') && el.value.indexOf(BASE) !== -1) el.value = swap(el.value);
  }

  function fixTree(root) {
    if (!root) return;
    if (root.nodeType === 3) return fixText(root);
    if (root.nodeType !== 1 || skip(root)) return;
    fixAttrs(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) fixText(n);
      else fixAttrs(n);
    }
  }

  function startObserver() {
    if (observer || !window.MutationObserver) return;
    observer = new MutationObserver(function (list) {
      if (applied === BASE) return;
      list.forEach(function (m) {
        if (m.type === 'characterData') fixText(m.target);
        else if (m.type === 'attributes') fixAttrs(m.target);
        else m.addedNodes.forEach(fixTree);
      });
    });
    observer.observe(document.body, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label']
    });
  }

  // 알림창 속 글자도 바꿈 (서버가 보낸 "OO머니 지급 완료!" 같은 문장 포함)
  ['alert', 'confirm', 'prompt'].forEach(function (fn) {
    var orig = window[fn];
    if (typeof orig !== 'function') return;
    window[fn] = function (msg) {
      var args = Array.prototype.slice.call(arguments);
      if (typeof msg === 'string') args[0] = swap(msg);
      return orig.apply(window, args);
    };
  });

  function showNow(name) {
    var now = $('cur-now');
    if (now) now.textContent = name;
    var inp = $('cur-new');
    if (inp && document.activeElement !== inp) inp.value = '';
  }

  function apply(name) {
    name = String(name || '').trim() || BASE;
    showNow(name);
    if (name === applied) return;
    if (applied !== BASE) { location.reload(); return; } // 이미 다른 이름으로 바꿔 둔 화면은 새로 불러와야 깔끔하게 바뀜
    applied = name;
    window.CURRENCY_NAME = name;
    re = buildRe(name);
    fixTree(document.body);
    startObserver();
  }

  function curCC() {
    return (typeof _cc !== 'undefined' && _cc) || (typeof _adminCC !== 'undefined' && _adminCC) || '';
  }

  function load(cc) {
    try { var c = localStorage.getItem(CACHE_PREFIX + cc); if (c) apply(c); } catch (e) {}
    google.script.run
      .withSuccessHandler(function (r) {
        if (!r || !r.success || cc !== curCC()) return;
        try { localStorage.setItem(CACHE_PREFIX + cc, r.name); } catch (e) {}
        apply(r.name);
      })
      .withFailureHandler(function () {})
      .getCurrencyName(cc);
  }

  // 로그인/로그아웃으로 학급이 바뀌면 그 학급의 화폐 이름을 불러옴
  function watch() {
    var cc = curCC();
    if (cc === lastCC) return;
    lastCC = cc;
    if (cc) load(cc);
    else if (applied !== BASE) location.reload(); // 로그아웃하면 기본 이름으로
  }
  window.CURRENCY_NAME = BASE;
  setInterval(watch, 1000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();

  window.saveCurrencyName = async function () {
    var cc = (typeof _adminCC !== 'undefined' && _adminCC) || curCC();
    var inp = $('cur-new');
    var name = (inp.value || '').trim();
    if (!name) return alert('새 화폐 이름을 입력해 주세요.');
    if (name.length > 10) return alert('화폐 이름은 10자 이내로 입력해 주세요.');
    if (!await uiConfirm("화폐 이름을 '" + name + "'(으)로 바꿀까요?\n홈페이지에 나오는 돈 이름이 모두 바뀝니다.")) return;
    if (typeof showLoading === 'function') showLoading();
    google.script.run
      .withSuccessHandler(function (r) {
        if (typeof hideLoading === 'function') hideLoading();
        if (!r || !r.success) return alert((r && r.msg) || '저장하지 못했습니다.');
        try { localStorage.setItem(CACHE_PREFIX + cc, r.name); } catch (e) {}
        inp.value = '';
        // 화면을 새로 불러올 수도 있으니, 알림창의 확인을 누른 뒤에 적용
        if (typeof window.uiAlert === 'function') window.uiAlert(r.msg).then(function () { apply(r.name); });
        else { alert(r.msg); apply(r.name); }
      })
      .withFailureHandler(function (err) {
        if (typeof hideLoading === 'function') hideLoading();
        alert('오류: ' + err.message);
      })
      .setCurrencyName(cc, name);
  };
})();
