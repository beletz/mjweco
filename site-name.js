// ==========================================================================
// 홈페이지 이름 — 사이트 관리자 비밀번호를 아는 사람만 바꿀 수 있음
// 화면에서 data-site-name 이 붙은 글자와 브라우저 탭 제목이 모두 바뀝니다.
// ==========================================================================
(function () {
  var DEFAULT_NAME = '쇼미더머니 나라';
  var CACHE_KEY = 'smtm_site_name';
  var current = DEFAULT_NAME, hasPassword = false;
  var $ = function (id) { return document.getElementById(id); };

  function applySiteName(name) {
    current = name || DEFAULT_NAME;
    document.title = current;
    document.querySelectorAll('[data-site-name]').forEach(function (el) { el.textContent = current; });
    try { localStorage.setItem(CACHE_KEY, current); } catch (e) {}
  }

  // 1) 지난번에 본 이름을 먼저 보여 주고(깜빡임 방지) 2) 서버에서 최신 이름을 받아 옴
  try { applySiteName(localStorage.getItem(CACHE_KEY)); } catch (e) { applySiteName(DEFAULT_NAME); }
  function refresh() {
    google.script.run
      .withSuccessHandler(function (r) {
        if (r && r.success) { hasPassword = !!r.hasPassword; applySiteName(r.siteName); }
      })
      .withFailureHandler(function () {})
      .getSiteSettings();
  }
  refresh();

  window.openSiteNameModal = function () {
    $('site-nm-new').value = current;
    $('site-nm-pw').value = '';
    $('site-nm-pw2').value = '';
    $('site-nm-pw2-wrap').style.display = hasPassword ? 'none' : 'block';
    $('site-nm-info').innerHTML = hasPassword
      ? '사이트 관리자 비밀번호를 입력하면 홈페이지 이름이 <b>모든 화면에서</b> 바뀝니다.'
      : '🔐 아직 사이트 관리자 비밀번호가 없습니다.<br>지금 입력하는 비밀번호가 <b>사이트 관리자 비밀번호</b>가 되고, 앞으로는 이 비밀번호를 아는 사람만 이름을 바꿀 수 있습니다. 잊어버리지 않게 꼭 적어 두세요.';
    $('site-name-modal').classList.add('open');
    setTimeout(function () { $('site-nm-new').focus(); }, 50);
  };

  window.closeSiteNameModal = function () { $('site-name-modal').classList.remove('open'); };

  window.saveSiteName = function () {
    var name = $('site-nm-new').value.trim(), pw = $('site-nm-pw').value;
    if (!name) return alert('새 홈페이지 이름을 입력해 주세요.');
    if (!pw) return alert('사이트 관리자 비밀번호를 입력해 주세요.');
    if (!hasPassword && pw !== $('site-nm-pw2').value) return alert('비밀번호 두 개가 서로 다릅니다.');
    var btn = $('site-nm-save'); btn.disabled = true;
    google.script.run
      .withSuccessHandler(function (r) {
        btn.disabled = false;
        if (r && r.success) {
          hasPassword = true;
          applySiteName(r.siteName);
          closeSiteNameModal();
          alert(r.msg);
        } else alert((r && r.msg) || '저장하지 못했습니다.');
      })
      .withFailureHandler(function (err) { btn.disabled = false; alert('오류: ' + err.message); })
      .setSiteName(pw, name);
  };
})();
