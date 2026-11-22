// ==========================================================================
// ui-motion.js — 화면 움직임 (Anime.js)
// 화면이 바뀔 때, 탭을 누를 때, 창이 열릴 때 짧고 자연스럽게 움직입니다.
// 기능 코드(app.js)는 건드리지 않고, 화면 변화를 지켜보다가 효과만 입힙니다.
// ==========================================================================
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var A = window.anime;
  if (!A || reduce) return;                  // 라이브러리가 없거나 '동작 줄이기' 설정이면 그냥 둠
  document.documentElement.classList.add('motion-on');

  var EASE = 'cubicBezier(.2,.7,.2,1)';
  var ENTER = '.cf, .lc > div, .mh-top, .dash-tile, .sc, .lp, .rp, .role-box, .rate-card, ' +
              '.dep-card, .deposit-card, .ac2, .crb, .bank-form-panel, .bank-list-panel';

  function visible(el) { return el.offsetParent !== null || el.getClientRects().length > 0; }

  // 안전장치: 브라우저가 애니메이션을 멈춘 경우(백그라운드 탭 등)에도 내용은 반드시 보이게
  function settle(items, ms) {
    setTimeout(function () {
      Array.prototype.forEach.call(items, function (el) {
        if (el && Number(getComputedStyle(el).opacity) < 1) { A.remove(el); el.style.opacity = ''; el.style.transform = ''; }
      });
    }, ms || 1600);
  }

  // 위에서부터 차례로 살짝 떠오르며 나타나기
  function enter(root) {
    if (!root) return;
    var items = Array.prototype.filter.call(root.querySelectorAll(ENTER), function (el) {
      return visible(el) && !el.closest('.modal');
    }).slice(0, 40);
    if (!items.length) return;
    A.remove(items);
    A.set(items, { opacity: 0, translateY: 12 }); settle(items);
    A({
      targets: items, opacity: [0, 1], translateY: [12, 0],
      duration: 520, delay: A.stagger(35), easing: EASE,
      complete: function () { items.forEach(function (el) { el.style.transform = ''; el.style.opacity = ''; }); }
    });
  }

  // 1) 화면(view) 전환 · 탭 전환 감지
  var watch = new MutationObserver(function (list) {
    list.forEach(function (m) {
      var el = m.target;
      if (m.attributeName !== 'class') return;
      var on = el.classList.contains('active') || el.classList.contains('act') || el.classList.contains('open');
      var was = (m.oldValue || '').split(/\s+/);
      var wasOn = was.indexOf('active') >= 0 || was.indexOf('act') >= 0 || was.indexOf('open') >= 0;
      if (!on || wasOn) return;
      if (el.classList.contains('view') || el.classList.contains('md-panel') ||
          el.classList.contains('panel-content') || el.classList.contains('tc')) {
        enter(el);
      } else if (el.classList.contains('modal-wrap')) {
        popModal(el);
      } else if (el.classList.contains('mh-tab')) {
        A({ targets: el, scale: [0.96, 1], duration: 300, easing: 'easeOutBack' });
      }
    });
  });
  watch.observe(document.body, { attributes: true, attributeOldValue: true, subtree: true, attributeFilter: ['class'] });

  // 2) 나중에 그려지는 목록(메뉴 타일, 예금 카드 등)도 등장 효과
  var pending = new Set(), raf = 0;
  var adds = new MutationObserver(function (list) {
    list.forEach(function (m) {
      m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1) return;
        if (n.matches && n.matches('.dash-tile, .dep-card, .deposit-card, .sc, .rate-card')) pending.add(n);
      });
    });
    if (pending.size && !raf) raf = requestAnimationFrame(function () {
      var items = Array.from(pending).filter(visible); pending.clear(); raf = 0; settle(items);
      if (!items.length) return;
      A({
        targets: items, opacity: [0, 1], translateY: [10, 0],
        duration: 480, delay: A.stagger(30), easing: EASE,
        complete: function () { items.forEach(function (el) { el.style.transform = ''; el.style.opacity = ''; }); }
      });
    });
  });
  adds.observe(document.body, { childList: true, subtree: true });

  // 3) 창(모달) 열기
  function popModal(wrap) {
    var box = wrap.querySelector('.modal');
    A({ targets: wrap, opacity: [0, 1], duration: 200, easing: 'linear' });
    settle([wrap, box], 900);
    if (box) A({ targets: box, opacity: [0, 1], translateY: [16, 0], scale: [0.98, 1], duration: 380, easing: EASE });
  }

  // 4) 알림(토스트) — 아래에서 톡 올라오기
  var toast = document.getElementById('toast');
  if (toast) {
    new MutationObserver(function () {
      if (toast.style.display === 'block') {
        A.remove(toast); settle([toast], 900);
        A({ targets: toast, opacity: [0, 1], translateY: [14, 0], duration: 360, easing: 'easeOutBack' });
      }
    }).observe(toast, { attributes: true, attributeFilter: ['style'], childList: true });
  }

  // 5) 첫 화면 — 글씨가 순서대로 올라오고, 오른쪽 카드는 아주 천천히 떠 있음
  function intro() {
    var home = document.getElementById('view-home');
    if (!home || !home.classList.contains('active')) return;
    var left = home.querySelector('.lc > div:first-child');
    var card = home.querySelector('.deco-card');
    var parts = left ? left.children : [];
    A.set(parts, { opacity: 0, translateY: 18 });
    if (card) A.set(card, { opacity: 0, translateY: 24 });
    settle(parts, 2400); settle([card], 2400); settle(home.querySelectorAll(".deco-item"), 2400);
    A.timeline({ easing: EASE })
      .add({ targets: parts, opacity: [0, 1], translateY: [18, 0], duration: 640, delay: A.stagger(90) })
      .add({ targets: card, opacity: [0, 1], translateY: [24, 0], duration: 720 }, 180)
      .add({ targets: home.querySelectorAll('.deco-item'), scale: [0.92, 1], opacity: [0, 1], duration: 480, delay: A.stagger(70) }, 380);
    if (card) {
      A({ targets: card, translateY: [0, -6], duration: 3200, direction: 'alternate', loop: true, easing: 'easeInOutSine', delay: 1200 });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', intro); else intro();

  // 6) 스크롤하면 상단 바에 얇은 선
  var nav = document.getElementById('main-nav');
  window.addEventListener('scroll', function () {
    if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 4);
  }, { passive: true });

  // 7) 숫자 강조: 금액 카드의 숫자가 바뀌면 살짝 튀어 오름
  new MutationObserver(function (list) {
    list.forEach(function (m) {
      var el = m.target.nodeType === 3 ? m.target.parentElement : m.target;
      if (el && el.classList && el.classList.contains('av')) {
        A.remove(el); settle([el], 900);
        A({ targets: el, translateY: [4, 0], opacity: [0.4, 1], duration: 420, easing: EASE });
      }
    });
  }).observe(document.body, { characterData: true, childList: true, subtree: true });
})();
