// ==========================================================================
// 결과 알림창 — 지급·구매·해지·삭제·취소·승인·저장 같은 "바꾸는" 일을 하면
// 성공했는지 실패했는지 화면 가운데 알림창으로 꼭 알려 줍니다.
//
// 동작 방식
//  - gas-bridge.js가 서버 함수를 부를 때마다 ssmResultHook.begin / end 를 부릅니다.
//  - 아래 ACTIONS 목록에 있는 함수일 때만 알림창을 띄웁니다. (조회 함수는 띄우지 않음)
//  - 화면 코드가 이미 alert(경고창)을 띄웠다면 또 띄우지 않습니다. (두 번 뜨지 않게)
//  - 화면 코드가 띄우려던 토스트 문구("✅ 1번 300머니 지급")를 알림창에 그대로 보여 줍니다.
// 새 기능을 만들면 그 서버 함수 이름을 ACTIONS에 넣어 주세요.
// ==========================================================================
(function () {
  var ACTIONS = {
    // 지급·수입·지출
    recordIncome: '지급', recordIncomeBulk: '일괄 지급', recordExpense: '지출 기록', executeSmartPayroll: '월급 지급',
    // 세금·벌금
    chargeTax: '세금 부과', chargeTaxBulk: '세금 일괄 부과', chargeFine: '벌금 부과', requestFine: '벌금 결재 청구', approveFineRequest: '벌금 승인', rejectFineRequest: '벌금 반려', cancelFineRequest: '벌금 청구 취소', setFineLaw: '벌칙 법전 저장', deleteFineRecord: '벌금 기록 삭제', editFineReason: '벌금 사유 수정',
    // 예금
    createDeposit: '예금 가입', createDepositByBankerWithCredit: '예금 가입', redeemDeposit: '예금 해지', redeemDepositByBanker: '예금 해지',
    cancelDepositByBanker: '예금 중도 해지', deleteDepositByBanker: '예금 삭제', editDepositByBanker: '예금 수정',
    // 국고
    addTreasuryRecord: '국고 기록', editTreasuryRecord: '국고 기록 수정', deleteTreasuryRecord: '국고 기록 삭제', setTreasuryMenu: '국고 메뉴 저장',
    approveTreasuryRecord: '국고 승인', rejectTreasuryRecord: '국고 반려',
    // 신용
    adjustCredit: '신용점수 조정', adjustCreditBulk: '신용점수 일괄 조정', savePendingCredit: '신용점수 저장',
    submitCreditReport: '신용 보고', approvePendingCredit: '신용 승인', rejectPendingCredit: '신용 반려',
    // 도매상
    recordWholesaleSale: '판매', addWholesaleItemBackend: '상품 등록', deleteWholesaleItem: '상품 삭제',
    deleteWholesaleSale: '판매 기록 삭제', editWholesaleSaleMemo: '메모 수정', payWholesaleCorpTax: '법인세 납부', payFineTreasury: '벌금 환수금 납부', donateToTreasury: '국고 기부', setCouponConfig: '쿠폰 설정 저장', setDonationLimit: '기부 한도 저장',
    // 부동산·증권·아바타
    buyRealEstate: '부동산 구매', addRealEstate: '부동산 등록', editRealEstate: '매물 수정', settleRent: '이번 주 월세 정산', processOverdueNow: '연체 처리', setDebtPlan: '분할 상환', setLeaseConfig: '임대 설정 저장', randomSeats: '랜덤 자리 배치', setPublicLease: '공공임대', setSeatPerks: '자리 혜택 저장', setTeacherDesk: '교사배정 자리', saveSeatLayout: '자리 배치 저장', setSeatPerk: '자리 혜택 저장', buyLottery: '구매', tradeStock: '주식 거래', runStockStep: '가격 돌리기', setStockAuto: '자동으로 돌리기 설정', setStockSettings: '종목 설정 저장', addStockRequest: '신청',
    resetStockMarket: '증권회사 초기화', buyAvatarItem: '아이템 구매', saveAvatar: '아바타 저장', setAvatarPrices: '가격 저장',
    // 간식 신청
    requestSnack: '간식 신청', cancelSnackRequest: '간식 신청 취소', approveSnackRequest: '간식 승인', rejectSnackRequest: '간식 반려', setSnackMenu: '간식 메뉴 저장',
    // 숙제
    addHomework: '숙제 등록', deleteHomework: '숙제 삭제', submitHomeworkReport: '숙제 보고',
    approveHomeworkReport: '숙제 승인', rejectHomeworkReport: '숙제 반려',
    // 국민 관리
    addStudent: '학생 추가', bulkCreateStudents: '학생 일괄 추가', updateStudent: '학생 정보 수정',
    deleteStudent: '학생 삭제', bulkDeleteStudents: '학생 삭제', bulkUpdateStudents: '학생 일괄 저장', regenerateAllCodes: '접속 코드 새로 만들기',
    // 기록·설정
    deleteActivityLog: '기록 삭제', bulkDeleteActivityLogs: '기록 일괄 삭제', editActivityLogMemo: '메모 수정', editStudentTx: '기록 수정', deleteStudentTx: '기록 삭제', setStudentAssets: '자산 수정', resetClassEconomy: '경제 초기화',
    setSalaryTable: '급여표 저장', setBankSettings: '이자율 저장', setDepositCreditSettings: '설정 저장', setDepositPenaltySettings: '하락 설정 저장',
    setCreditGradeSettings: '설정 저장', setHomeworkCreditSettings: '설정 저장',
    // 뉴스룸
    generateNews: 'AI 뉴스 만들기', announceNews: '전망 공표', cancelAnnouncement: '공표 취소', resetNews: '경제 소식 해제',
    // 은행 잔액 정리는 실제로 바꿀 때(두 번째 값이 true)만
    repairBankBalances: function (args) { return args[1] === true ? '은행 잔액 정리' : null; }
  };

  // 서버 문구가 짧을 때 덧붙일 설명 (누구에게 얼마)
  function who(cc, sno) {
    var list = (typeof _stuList !== 'undefined' && _stuList) || [];
    var s = list.find && list.find(function (x) { return String(x.studentNo) === String(sno); });
    return sno + '번' + (s && s.name ? ' ' + s.name : '');
  }
  function won(n) { return (Number(n) || 0).toLocaleString() + ' 머니'; }
  var DETAILS = {
    recordIncome:  function (a) { return who(a[0], a[1]) + '에게 ' + won(a[3]) + ' 지급' + (a[2] ? ' (' + a[2] + ')' : ''); },
    recordExpense: function (a) { return who(a[0], a[1]) + ' 카드에서 ' + won(a[3]) + ' 지출' + (a[2] ? ' (' + a[2] + ')' : ''); },
    chargeTax:     function (a) { return who(a[0], a[1]) + '에게 세금 ' + won(a[3]) + ' 부과' + (a[2] ? ' (' + a[2] + ')' : ''); }
  };

  var active = null; // 지금 결과를 지켜보고 있는 서버 함수

  function labelOf(fn, args) {
    var a = ACTIONS[fn];
    if (typeof a === 'function') return a(args || []);
    return a || null;
  }

  function finish(ctx) {
    if (!ctx || ctx.done) return;
    ctx.done = true;
    if (active === ctx) active = null;
    window.alert = ctx.origAlert;
    if (window.showToast === ctx.toastSpy) window.showToast = ctx.origToast;
    if (ctx.alerted) return; // 화면 코드가 이미 경고창으로 알려 줌
    var r = ctx.res;
    var ok = !ctx.failed && !(r && r.success === false);
    var msg = ctx.toast || (r && r.msg) || (ctx.failed ? String((ctx.err && ctx.err.message) || ctx.err || '') : '');
    msg = String(msg || '').replace(/^\s*(✅|⚠️|❌|🗑️|💸|🎉)\s*/, '');
    if (!msg) msg = ok ? ctx.label + ' 완료!' : ctx.label + '을(를) 하지 못했어요.';
    if (ok && DETAILS[ctx.fn]) { try { msg = DETAILS[ctx.fn](ctx.args) + '\n' + msg; } catch (e) {} }
    showResultPopup(ok, ok ? ctx.label + ' 완료' : ctx.label + ' 실패', msg);
  }

  window.ssmResultHook = {
    begin: function (fn, args, res, failed, err) {
      var label = labelOf(fn, args);
      if (!label) return null;
      if (active) finish(active);
      var ctx = {
        label: label, fn: fn, args: args || [], res: res, failed: !!failed, err: err, alerted: false, toast: '', done: false,
        origAlert: window.alert, origToast: window.showToast
      };
      window.alert = function () { ctx.alerted = true; return ctx.origAlert.apply(window, arguments); };
      if (typeof ctx.origToast === 'function') {
        ctx.toastSpy = function (m) { ctx.toast = String(m || ''); }; // 알림창에 담아 보여 주므로 토스트는 따로 띄우지 않음
        window.showToast = ctx.toastSpy;
      }
      active = ctx;
      return ctx;
    },
    // 화면 코드가 Promise로 이어서 처리하는 경우까지 기다렸다가 결정
    end: function (ctx) { if (ctx) setTimeout(function () { finish(ctx); }, 0); }
  };

  // ── 알림창 모양 ──
  function ensureBox() {
    var box = document.getElementById('result-popup');
    if (box) return box;
    var st = document.createElement('style');
    st.textContent =
      '#result-popup{position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.45);padding:16px}' +
      '#result-popup.open{display:flex}' +
      '#result-popup .rp-card{background:#fff;border-radius:22px;padding:28px 26px 22px;width:100%;max-width:380px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.2);border-top:6px solid #10B981}' +
      '#result-popup.fail .rp-card{border-top-color:#EF4444}' +
      '#result-popup .rp-icon{width:64px;height:64px;border-radius:50%;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:34px;background:#D1FAE5}' +
      '#result-popup.fail .rp-icon{background:#FEE2E2}' +
      '#result-popup .rp-title{font-family:Jua,sans-serif;font-size:22px;color:#065F46;margin-bottom:8px}' +
      '#result-popup.fail .rp-title{color:#B91C1C}' +
      '#result-popup .rp-msg{font-size:16px;color:#334155;line-height:1.55;white-space:pre-line;word-break:keep-all;margin-bottom:20px}' +
      '#result-popup .rp-btn{width:100%;border:none;border-radius:14px;padding:13px;font-size:16px;font-weight:700;color:#fff;background:#10B981;cursor:pointer;font-family:inherit}' +
      '#result-popup.fail .rp-btn{background:#EF4444}';
    document.head.appendChild(st);
    box = document.createElement('div');
    box.id = 'result-popup';
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<div class="rp-card"><div class="rp-icon"></div><div class="rp-title"></div><div class="rp-msg"></div><button class="rp-btn" type="button">확인</button></div>';
    box.addEventListener('click', function (e) { if (e.target === box) closeResultPopup(); });
    box.querySelector('.rp-btn').addEventListener('click', closeResultPopup);
    document.addEventListener('keydown', function (e) {
      if (box.classList.contains('open') && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); closeResultPopup(); }
    });
    document.body.appendChild(box);
    return box;
  }

  function closeResultPopup() { var b = document.getElementById('result-popup'); if (b) b.classList.remove('open'); }

  function showResultPopup(ok, title, msg) {
    var box = ensureBox();
    box.classList.toggle('fail', !ok);
    box.querySelector('.rp-icon').textContent = ok ? '✅' : '⚠️';
    box.querySelector('.rp-title').textContent = title;
    box.querySelector('.rp-msg').textContent = msg;
    box.classList.add('open');
    var btn = box.querySelector('.rp-btn');
    setTimeout(function () { try { btn.focus(); } catch (e) {} }, 30);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (window.anime && !reduce) {
      anime.remove(box.querySelector('.rp-card'));
      anime({ targets: box.querySelector('.rp-card'), scale: [0.85, 1], opacity: [0, 1], duration: 380, easing: 'easeOutBack' });
      anime({ targets: box.querySelector('.rp-icon'), scale: [0.4, 1], duration: 520, delay: 80, easing: 'easeOutElastic(1, .6)' });
    }
  }

  window.showResultPopup = showResultPopup;
  window.closeResultPopup = closeResultPopup;
})();
