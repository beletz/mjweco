// ==========================================================================
// ui-colors.js — 화면 전체 자동 꾸미기
//  1) +로 시작하는 금액·점수(+500, +2점)와 '수입'은 초록색, -로 시작하는 것과 '지출'은 빨간색
//  2) 아이콘과 그림 이모티콘이 위아래로 통통 움직이게 표시
// 새로 그려지는 목록도 자동으로 적용됩니다.
// ==========================================================================
(function () {
  var POS_NUM = /^[+＋]\s?\d/;
  var NEG_NUM = /^[-−–]\s?\d/;
  var POS_WORD = /^(총\s?)?수입(\s?\(\+\))?$/;
  var NEG_WORD = /^(총\s?)?지출(\s?\(-\))?$/;
  var EMOJI_ONLY = /^(\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*\s?)+$/u;
  var BOB_SEL = '.tile-icon, .ai, .crc > i, .role-icon, .deco-item i, .st > i:first-child, .lottery-emoji, .bob';
  var SKIP = { SCRIPT: 1, STYLE: 1, INPUT: 1, TEXTAREA: 1, SELECT: 1, OPTION: 1 };

  function onlyText(el) {
    // 자식 태그가 없거나 아이콘(<i>)만 있는 요소의 글자
    for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (c.tagName !== 'I') return null;
    return (el.textContent || '').trim();
  }

  function paint(el) {
    if (SKIP[el.tagName] || el.closest('.tog-row')) return;
    var t = onlyText(el);
    if (t === null || !t || t.length > 24) return;
    el.classList.remove('num-pos', 'num-neg');
    if (POS_NUM.test(t) || POS_WORD.test(t)) el.classList.add('num-pos');
    else if (NEG_NUM.test(t) || NEG_WORD.test(t)) el.classList.add('num-neg');
    else if (EMOJI_ONLY.test(t) && parseFloat(getComputedStyle(el).fontSize) >= 18) markBob(el);
  }

  function markBob(el) {
    if (el.dataset.bob) return;
    el.dataset.bob = '1';
    el.classList.add('bob');
    el.style.animationDelay = (-Math.random() * 2.6).toFixed(2) + 's';   // 제각각 다른 박자로
  }

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches(BOB_SEL)) markBob(root);
    root.querySelectorAll(BOB_SEL).forEach(markBob);
    paint(root);
    root.querySelectorAll('span,div,td,th,b,strong,button,p,small,label').forEach(paint);
  }

  var queue = new Set(), timer = 0;
  function flush() {
    timer = 0;
    var items = Array.from(queue); queue.clear();
    items.forEach(function (n) { if (n.isConnected) scan(n); });
  }
  new MutationObserver(function (list) {
    list.forEach(function (m) {
      if (m.type === 'characterData') { if (m.target.parentElement) queue.add(m.target.parentElement); }
      else m.addedNodes.forEach(function (n) {
        if (n.nodeType === 1) queue.add(n);
        else if (n.nodeType === 3 && n.parentElement) queue.add(n.parentElement);
      });
    });
    if (queue.size && !timer) timer = setTimeout(flush, 30);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  scan(document.body);
})();
