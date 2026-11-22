// ============================================================
// 전역 상태
// ============================================================
var _cc='', _sno='', _adminCC='', _isTeacher=false, _myJob='';
var _stuList=[];
var _teacherMode='inc';
var _bills=[];
var _wsItems=[];
var _wsCorpTaxAccrued = 0;
var _allDepositList = [];
var _allTreasuryList = [];
var _treasuryMode = 'inc';
var _allTeacherTreasuryList = [];
var _depositCreditMap = { 1: 1, 2: 2, 3: 3, 4: 5 };
var _creditPendingMap = {};
var _creditGradeSettings = [
  {grade:1,minScore:90,emoji:'👑'},{grade:2,minScore:80,emoji:'💎'},
  {grade:3,minScore:70,emoji:'🏆'},{grade:4,minScore:60,emoji:'⭐'},
  {grade:5,minScore:50,emoji:'🌟'},{grade:6,minScore:40,emoji:'🌿'},
  {grade:7,minScore:30,emoji:'🌱'},{grade:8,minScore:20,emoji:'🍂'},
  {grade:9,minScore:10,emoji:'🌧️'},{grade:10,minScore:0,emoji:'⚡'}
];
var _hwPendingSaves  = {};  // debounce 대기 저장 항목
var _hwSaveTimer     = null; // debounce 타이머
var _hwSaveInFlight  = false; // ★ 서버에 저장 통신이 진행 중인지 여부
var _hwReportCache   = null; // 마스터 통계 프론트 캐시
var _hwReportCacheAt = 0;    // 캐시 저장 시각

// ============================================================
// 로딩 스피너 제어
// ============================================================
function showLoading() {
  document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading-overlay').style.display = 'none';
}

// ============================================================
// 공통 유틸
// ============================================================
function $(id){return document.getElementById(id);}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function go(id){
  document.querySelectorAll('.view').forEach(function(v){ v.classList.remove('active'); });

  var target = document.getElementById(id);
  if(!target){
    console.warn('[go] 뷰 없음: ' + id);
    showToast('⚠️ 패널을 찾을 수 없습니다. 관리자에게 문의하세요.');
    var dash = document.getElementById('view-student-dashboard');
    if(dash) dash.classList.add('active');
    var nav = document.getElementById('main-nav');
    if(nav) nav.style.display = 'none';
    window.scrollTo(0, 0);
    return;
  }

  target.classList.add('active');

  var hideNav = [
    'view-master-dashboard','view-citizen-wallet','view-student-dashboard',
    'view-bank','view-police','view-stock','view-realtor','view-credit-mgr',
    'view-tax-office','view-asset-inspect','view-stats-office','view-wholesale'
  ];
  var nav = document.getElementById('main-nav');
  if(nav) nav.style.display = hideNav.indexOf(id) !== -1 ? 'none' : 'flex';
  window.scrollTo(0, 0);
}

function showToast(msg,ms){
  var t=$('toast'); t.textContent=msg; t.style.display='block';
  setTimeout(function(){t.style.display='none'},ms||2500);
}

function showBankrupt(){ $('bankrupt-overlay').style.display='flex'; }
function closeBankrupt(){ $('bankrupt-overlay').style.display='none'; }

function creditGrade(score){
  var s = Number(score)||0;
  var sorted = _creditGradeSettings.slice().sort(function(a,b){ return b.minScore-a.minScore; });
  for(var i=0; i<sorted.length; i++){
    if(s >= sorted[i].minScore){
      return {
        num:   String(sorted[i].grade),
        label: sorted[i].emoji+' '+sorted[i].grade+'등급',
        emoji: sorted[i].emoji,
        grade: sorted[i].grade
      };
    }
  }
  var last = sorted[sorted.length-1];
  return { num: String(last.grade), label: last.emoji+' '+last.grade+'등급', emoji: last.emoji, grade: last.grade };
}

// ============================================================
// 인증 & 로그인
// ============================================================
function authTab(type){
  $('tl').classList.toggle('active',type==='login');
  $('ts2').classList.toggle('active',type==='signup');
  $('fla').style.display=type==='login'?'block':'none';
  $('fsa').style.display=type==='signup'?'block':'none';
}

function doSignup(){
  var form={name:$('sn').value,email:$('se').value,password:$('sp').value,securityQ:$('sq').value,securityA:$('sa').value};
  if(!form.name||!form.email||!form.password||!form.securityA)return alert('빈칸을 모두 채워주세요!');
  google.script.run.withSuccessHandler(function(r){
    alert(r.msg); if(r.success) authTab('login');
  }).registerTeacher(form);
}

function doLogin(){
  var form={email:$('le').value,password:$('lp').value};
  if(!form.email||!form.password)return alert('정보를 모두 입력해 주세요.');
  var remember = $('remember-me') ? $('remember-me').checked : false;
  google.script.run.withSuccessHandler(function(r){
    if(r.success){
      _isTeacher=true;
      $('lobby-name').innerText=r.name;
      $('nav-login-btn').style.display='none';
      $('nav-master-btn').style.display='block';

      // ★ 계정 저장하기 체크 시 localStorage에 저장 (브라우저 재방문 시 자동 로그인)
      if(remember){
        try{ localStorage.setItem('smtm_remember_teacher', JSON.stringify({email:form.email, password:form.password})); }catch(e){}
      } else {
        try{ localStorage.removeItem('smtm_remember_teacher'); }catch(e){}
      }

      go('view-teacher-lobby');
    } else alert(r.msg);
  }).loginTeacher(form);
}

function doCreateClass(){
  var form={className:$('cn').value,classCode:$('cc2').value,adminName:$('ca').value,adminPassword:$('cp').value};
  if(!form.className||!form.classCode||!form.adminName||!form.adminPassword)return alert('빈칸을 채워주세요!');
  google.script.run.withSuccessHandler(function(r){
    alert(r.msg);
    if(r.success){
      _adminCC=form.classCode;
      $('dash-title').innerText=form.adminName;
      go('view-master-dashboard'); // ★ 마스터 대시보드로 이동
      loadList();
      refreshMasterPendingBadges();
    }
  }).createClass(form);
}

function doAdminLogin(){
  if(!_isTeacher){alert('마스터 대시보드는 선생님 계정으로 로그인한 분만 입장할 수 있습니다.');return;}
  var code=$('ac').value, pw=$('ap').value;
  if(!code||!pw)return alert('입력란을 채워주세요!');

  google.script.run.withSuccessHandler(function(r){
    if(r.success){
      _adminCC=r.classCode;
      _cc=r.classCode;
      $('dash-title').innerText=r.adminName;
      
      // 1. 우측 상단 내 직업 표시에 '선생님' 띄우기
      if($('my-job-label')) $('my-job-label').innerText = '선생님 (마스터)';

      // 2. ★ 교사 로그인 시 학생 대시보드의 마스터 관리 버튼을 보여줍니다!
      if($('teacher-to-master-btn')) $('teacher-to-master-btn').style.display='inline-block';

      go('view-student-dashboard');
      renderStudentTiles();
      loadList();
      loadBankSettings();
      refreshMasterPendingBadges();

      var sessionData={role:'teacher',classCode:r.classCode,adminName:r.adminName};
      sessionStorage.setItem('smtm_session',JSON.stringify(sessionData));
    } else {
      alert(r.msg);
    }
  }).loginClassAdmin(code,pw);
}

function clickNavMaster(){
  if(_adminCC){
    go('view-master-dashboard');
  } else {
    go('view-teacher-lobby');
    showToast('학급을 먼저 선택해 주세요.');
  }
}

function doLogout(){
  sessionStorage.removeItem('smtm_session');
  try{ localStorage.removeItem('smtm_remember_teacher'); }catch(e){}
  _adminCC=''; _cc=''; _isTeacher=false;
  document.querySelectorAll('input').forEach(function(i){i.value='';});
  $('nav-login-btn').style.display='inline-flex';
  $('nav-master-btn').style.display='none';
  go('view-home');
}

function studentLogout(){
  sessionStorage.removeItem('smtm_session');
  if(_isTeacher){doLogout();return;}
  _cc='';_sno='';_myJob='';
  go('view-home');
}

// ============================================================
// 마스터 대시보드 탭
// ============================================================
function mdTab(panelId, tabEl){
  document.querySelectorAll('.mh-tab').forEach(function(t){t.classList.remove('act')});
  document.querySelectorAll('.md-panel').forEach(function(p){p.classList.remove('act')});

  // ★ md-panel 클래스 밖에 있는 서브패널도 명시적으로 숨김
  ['cad-panel-report','cad-panel-manual','cad-panel-grade'].forEach(function(id){
    var p=$(id); if(p) p.style.display='none';
  });

  if(tabEl) tabEl.classList.add('act');
  $(panelId).classList.add('act');

  if(panelId==='md-citizens')          { loadList(); }
  if(panelId==='md-salary')            { loadSalaryTable(); }
  if(panelId==='md-bank-admin')        { loadBankSettings(); loadDepositCreditSettings(); loadAllDeposits(); }
  if(panelId==='md-tax-admin')         { refreshTaxSels(); }
  if(panelId==='md-credit-admin')      { creditAdminTab('report', $('cad-tab1')); }
  if(panelId==='md-stats')             { loadStats(); loadHomeworkCreditSettings(); }
  if(panelId==='md-wallet')            { refreshTeacherSel(); }
  if(panelId==='md-treasury-approval') { loadTeacherTreasury(); }
  if(panelId==='md-fulllog'){ loadFullLog(); }

  refreshMasterPendingBadges(); // ★ 탭 전환마다 결재 대기 배지 갱신
}

// ── 마스터 대시보드 결재 대기 배지 갱신 (국고 승인 / 신용 관리) ──
function refreshMasterPendingBadges(){
  var targetCC = _adminCC || _cc;
  if(!targetCC) return;
  google.script.run
    .withSuccessHandler(function(r){
      if(!r || !r.success) return;
      var bt=$('mh-badge-treasury');
      if(bt){ if(r.treasury>0){ bt.textContent=r.treasury; bt.style.display='inline-block'; } else bt.style.display='none'; }
      var bc=$('mh-badge-credit');
      if(bc){ if(r.credit>0){ bc.textContent=r.credit; bc.style.display='inline-block'; } else bc.style.display='none'; }
      var bs=$('mh-badge-stats');
      if(bs){ if(r.stats>0){ bs.textContent=r.stats; bs.style.display='inline-block'; } else bs.style.display='none'; }
    })
    .withFailureHandler(function(){})
    .getMasterPendingBadgeCounts(targetCC);
}

// ============================================================
// 학생 명단 관리
// ============================================================
function loadList(){
  if(!_adminCC)return;
  $('stu-tbody').innerHTML='<tr><td colspan="8" class="empty-msg">불러오는 중...</td></tr>';
  google.script.run.withSuccessHandler(function(r){
    if(!r.success){showToast('⚠️ '+r.msg);return;}
    _stuList=r.list;
    renderList(r.list);
    $('stu-cnt-pill').textContent=r.list.length+'명';
    refreshAllSelects();
  }).getStudentList(_adminCC);
}

function renderList(list){
  var tb=$('stu-tbody');
  if(!list||!list.length){
    tb.innerHTML='<tr><td colspan="9" class="empty-msg">등록된 학생이 없습니다.</td></tr>';
    return;
  }
  var h='';
  list.forEach(function(s){
    var sno=s.studentNo;
    var isBankrupt=(s.card<0||s.bank<0);
    h+='<tr>'+
      // 체크박스
      '<td style="text-align:center;"><input type="checkbox" class="stu-check" value="'+sno+'" style="width:16px;height:16px;cursor:pointer;accent-color:var(--purple);"></td>'+
      // 번호
      '<td><span class="no-bdg">'+sno+'</span>'+(isBankrupt?'<span class="bankrupt-badge" style="margin-left:4px;">파산</span>':'')+'</td>'+
      // 이름
      '<td><input value="'+esc(s.name)+'" placeholder="이름" id="nm-'+sno+'" style="width:90px;"></td>'+
      // 직업
      '<td><select id="jb-'+sno+'" style="padding:5px 8px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-family:Pretendard,sans-serif;background:var(--surf);">'+jobOptions(s.job)+'</select></td>'+
      // 접속코드 (직접 수정 가능)
      '<td><div style="display:flex;align-items:center;gap:4px;">'+
        '<input type="text" id="cd-'+sno+'" value="'+(s.code||'')+'" maxlength="10" '+
          'style="width:88px;padding:5px 8px;border:1.5px solid var(--border);border-radius:8px;font-size:12px;font-family:monospace;letter-spacing:2px;text-transform:uppercase;background:var(--surf);">'+
        '<button class="btn btn-sm" style="background:#F0FDF4;color:#10B981;box-shadow:none;border:1px solid #A7F3D0;padding:5px 8px;font-size:11px;" onclick="doUpdateCode(\''+sno+'\')" title="코드 저장"><i class="fa-solid fa-check"></i></button>'+
        '<button class="btn btn-sm" style="background:#FFF7ED;color:#C2410C;box-shadow:none;border:1px solid #FED7AA;padding:5px 8px;font-size:11px;" onclick="doRegenOne(\''+sno+'\')" title="랜덤 재발급"><i class="fa-solid fa-rotate"></i></button>'+
      '</div></td>'+
      // 카드·은행·신용
      '<td><span class="ac">'+Number(s.card).toLocaleString()+'</span></td>'+
      '<td><span class="bc">'+Number(s.bank).toLocaleString()+'</span></td>'+
      '<td><span class="cr">'+s.credit+'점</span></td>'+
      // 관리 버튼
      '<td style="display:flex;gap:5px;">'+
        '<button class="btn btn-sm" style="background:#EFF6FF;color:var(--blue);box-shadow:none;border:1px solid #BFDBFE;" onclick="doUpdate(\''+sno+'\')"><i class="fa-solid fa-check"></i></button>'+
        '<button class="btn btn-sm btn-red" onclick="doDel(\''+sno+'\')"><i class="fa-solid fa-trash"></i></button>'+
      '</td></tr>';
  });
  tb.innerHTML=h;
}

function jobOptions(selected){
  var jobs=['','은행청장','국세청장','신용등급관리위원장','재산조사국장','부동산 중개인','통계청장','도매상인','경찰서장','증권회사'];
  var labels={'':'국민','은행청장':'은행청장','국세청장':'국세청장','신용등급관리위원장':'신용등급관리위원장','재산조사국장':'재산조사국장','부동산 중개인':'부동산 중개인','통계청장':'통계청장','도매상인':'도매상인','경찰서장':'경찰서장','증권회사':'증권회사'};
  return jobs.map(function(j){return '<option value="'+j+'"'+(j===(selected||'')?'selected':'')+'>'+labels[j]+'</option>';}).join('');
}

function refreshAllSelects(){
  var sel1=$('ind-pay-stu');
  if(sel1){sel1.innerHTML='<option value="">-- 학생 선택 --</option>';_stuList.forEach(function(s){var o=document.createElement('option');o.value=s.studentNo;o.textContent=s.studentNo+'번 '+(s.name||'(이름없음)');sel1.appendChild(o);});}
  var sel2=$('tax-stu');
  if(sel2){sel2.innerHTML='<option value="">-- 학생 선택 --</option>';_stuList.forEach(function(s){var o=document.createElement('option');o.value=s.studentNo;o.textContent=s.studentNo+'번 '+(s.name||'');sel2.appendChild(o);});}
  var sel3=$('teacher-stu-sel');
  if(sel3){sel3.innerHTML='<option value="">-- 학생을 선택하세요 --</option>';_stuList.forEach(function(s){var o=document.createElement('option');o.value=s.studentNo;o.textContent=s.studentNo+'번 '+(s.name||'(이름없음)')+' '+(s.job?'['+s.job+']':'');sel3.appendChild(o);});}
}

function doBulk(){
  var s=$('bs').value,c=$('bc2').value;
  if(!c)return alert('생성 인원 수를 입력해 주세요.');
  google.script.run.withSuccessHandler(function(r){
    showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);if(r.success)loadList();
  }).bulkCreateStudents(_adminCC,c,s);
}

function doRegenAll(){
  if(!confirm('모든 학생의 접속코드를 새로 발급합니까?'))return;
  google.script.run.withSuccessHandler(function(r){
    showToast(r.success?'🔄 '+r.msg:'⚠️ '+r.msg);if(r.success)loadList();
  }).regenerateAllCodes(_adminCC);
}

function doRegenOne(sno){
  google.script.run.withSuccessHandler(function(r){
    if(r.success){
      var el=$('cd-'+sno);
      if(el) el.value=r.code;  // ← textContent에서 value로 변경
      showToast('🔄 '+sno+'번 코드: '+r.code);
    } else showToast('⚠️ '+r.msg);
  }).regenerateStudentCode(_adminCC,sno);
}

function doAddStudent(){
  var no=$('an').value,name=$('aname').value,job=$('ajob').value;
  if(!no)return alert('학생 번호를 입력해 주세요.');
  google.script.run.withSuccessHandler(function(r){
    showToast(r.success?'✅ '+r.msg+' (코드: '+r.code+')':'⚠️ '+r.msg);
    if(r.success){$('an').value='';$('aname').value='';$('ajob').value='';loadList();}
  }).addStudent(_adminCC,no,name,job);
}

function doUpdate(sno){
  var name=$('nm-'+sno).value,job=$('jb-'+sno).value;
  google.script.run.withSuccessHandler(function(r){showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);if(r.success)loadList();}).updateStudent(_adminCC,sno,name,job);
}

function doDel(sno){
  if(!confirm(sno+'번 학생을 삭제할까요?'))return;
  google.script.run.withSuccessHandler(function(r){showToast(r.success?'🗑️ '+r.msg:'⚠️ '+r.msg);if(r.success)loadList();}).deleteStudent(_adminCC,sno);
}

// ============================================================
// 급여 지급
// ============================================================
function refreshPaySels(){
  var sel=$('ind-pay-stu');
  if(sel){sel.innerHTML='<option value="">-- 학생 선택 --</option>';_stuList.forEach(function(s){var o=document.createElement('option');o.value=s.studentNo;o.textContent=s.studentNo+'번 '+(s.name||'');sel.appendChild(o);});}
}

function doBulkPay(){
  var type=$('bulk-pay-type').value,amt=$('bulk-pay-amt').value,memo=$('bulk-pay-memo').value;
  if(!amt||amt<=0)return alert('금액을 입력해 주세요.');
  if(!memo)return alert('내역을 입력해 주세요.');
  if(!confirm('전체 학생에게 '+Number(amt).toLocaleString()+' 머니를 지급합니까?'))return;
  google.script.run.withSuccessHandler(function(r){
    showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);if(r.success)loadList();
  }).recordIncomeBulk(_adminCC,memo,amt,type);
}

function doIndPay(){
  var sno=$('ind-pay-stu').value,amt=$('ind-pay-amt').value,memo=$('ind-pay-memo').value;
  if(!sno)return alert('학생을 선택해 주세요.');
  if(!amt||amt<=0)return alert('금액을 입력해 주세요.');
  if(!memo)return alert('내역을 입력해 주세요.');
  google.script.run.withSuccessHandler(function(r){
    showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);
    if(r.success){$('ind-pay-amt').value='';$('ind-pay-memo').value='';loadList();}
  }).recordIncome(_adminCC,sno,memo,amt,'개별지급');
}

// ============================================================
// 은행 이자율 관리
// ============================================================
function loadBankSettings(){
  var targetCC=_adminCC||_cc;
  if(!targetCC)return;
  google.script.run.withSuccessHandler(function(r){
    if(r.success){
      if($('rate1'))$('rate1').value=r.r1;
      if($('rate2'))$('rate2').value=r.r2;
      if($('rate3'))$('rate3').value=r.r3;
      if($('rate4'))$('rate4').value=r.r4;
      if($('rate-prime'))$('rate-prime').value=r.prime;
    }
  }).getBankSettings(targetCC);
}

// 예금 신용점수 설정 불러오기
function loadDepositCreditSettings(){
  var targetCC = _adminCC || _cc;
  if(!targetCC) return;
  google.script.run
    .withSuccessHandler(function(r){
      if(!r.success) return;
      if($('credit1')) $('credit1').value = r.c1;
      if($('credit2')) $('credit2').value = r.c2;
      if($('credit3')) $('credit3').value = r.c3;
      if($('credit4')) $('credit4').value = r.c4;
      updateCreditPreviews();
      // 은행청장 패널에도 반영
      _depositCreditMap = { 1: r.c1, 2: r.c2, 3: r.c3, 4: r.c4 };
    })
    .getDepositCreditSettings(targetCC);
}

// 예금 신용점수 설정 저장
function saveDepositCreditSettings(){
  var c1=$('credit1').value, c2=$('credit2').value;
  var c3=$('credit3').value, c4=$('credit4').value;
  google.script.run
    .withSuccessHandler(function(r){
      showToast(r.success ? '✅ '+r.msg : '⚠️ '+r.msg);
      if(r.success){
        _depositCreditMap = { 1: Number(c1)||0, 2: Number(c2)||0, 3: Number(c3)||0, 4: Number(c4)||0 };
        updateCreditPreviews();
      }
    })
    .setDepositCreditSettings(_adminCC, c1, c2, c3, c4);
}

// 미리보기 숫자 업데이트
function updateCreditPreviews(){
  [1,2,3,4].forEach(function(w){
    var el=$('credit'+w);
    var prev=$('credit-preview-'+w);
    if(el && prev) prev.textContent = el.value || '0';
  });
}

function saveRates(){
  var r1=$('rate1').value,r2=$('rate2').value,r3=$('rate3').value,r4=$('rate4').value,prime=$('rate-prime').value;
  google.script.run.withSuccessHandler(function(r){
    showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);
  }).setBankSettings(_adminCC,r1,r2,r3,r4,prime);
}

// ============================================================
// 전체 예금 기록 불러오기 (은행청장/마스터용)
// ============================================================
// JavaScript.html 안의 loadAllDeposits() 함수 전체를 아래로 교체하세요

function loadAllDeposits(){
  var targetCC = _cc || _adminCC;
  if(!targetCC){ showToast('⚠️ 학급 코드를 찾을 수 없습니다. 다시 로그인해 주세요.'); return; }

  var container = $('deposit-records-container');
  var tbody     = $('deposit-tbody');

  if(container) container.innerHTML = '<div style="text-align:center;padding:40px;color:#aaa;font-family:Pretendard,sans-serif;font-size:15px;">⏳ 불러오는 중...</div>';
  if(tbody)     tbody.innerHTML     = '<tr><td colspan="8" class="empty-msg">⏳ 불러오는 중...</td></tr>';

  google.script.run
    .withSuccessHandler(function(r){
      _allDepositList = (r.success && r.list) ? r.list : [];

      // 은행청장 패널 카운트 뱃지
      var badge = $('deposit-total-count');
      if(badge) badge.textContent = '총 ' + _allDepositList.length + '건';

      // ① 은행청장 카드뷰
      renderDepositList(_allDepositList);

      // ② 마스터 대시보드 테이블뷰
      renderDepositTable(_allDepositList);
    })
    .withFailureHandler(function(err){
      var msg = '⚠️ 불러오기 실패: ' + err.message;
      if(container) container.innerHTML = '<div style="padding:30px;color:#ef4444;text-align:center;font-family:Pretendard,sans-serif;">'+msg+'</div>';
      if(tbody)     tbody.innerHTML     = '<tr><td colspan="8" class="empty-msg" style="color:#ef4444;">'+msg+'</td></tr>';
    })
    .getAllDeposits(targetCC);
}

function filterDeposits(){
  var keyword = ($('deposit-search') || {}).value || '';
  keyword = keyword.trim().toLowerCase();
  if(!keyword){ renderDepositList(_allDepositList); return; }
  var filtered = _allDepositList.filter(function(d){
    return (d.name||'').toLowerCase().indexOf(keyword) !== -1 ||
           String(d.studentNo).indexOf(keyword) !== -1;
  });
  renderDepositList(filtered);
}

function renderDepositList(list){
  var container = $('deposit-records-container');
  if(!container) return;

  if(!list || list.length === 0){
    container.innerHTML = '<div style="text-align:center;padding:50px 20px;color:#CBD5E1;font-family:Pretendard,sans-serif;font-size:15px;"><div style="font-size:48px;margin-bottom:12px;">📭</div>예금 기록이 없습니다.</div>';
    return;
  }

  var today = new Date(); today.setHours(0,0,0,0);
  var h = '';

  list.forEach(function(d){
    var startStr  = d.startDate  ? String(d.startDate).substring(0,10)  : '-';
    var expireStr = d.expireDate ? String(d.expireDate).substring(0,10) : '-';
    var expDate   = new Date(expireStr);
    var isExpired = today >= expDate;           // 만기일 도달 여부
    var isActive  = d.status === '활성';
    var canRedeem = isActive && isExpired;      // 만기 지급 가능
    var isMature  = d.status === '만기해지';
    var isCanceled= d.status === '중도해지';

    var interest  = Math.floor(d.principal * d.rate / 100);
    var total     = d.principal + interest;

    // ── 카드 색상 분기 ──
    var topBar, cardBg, cardBorder;
    if(canRedeem){
      topBar='#10B981'; cardBg='linear-gradient(135deg,#ECFDF5 0%,#D1FAE5 100%)'; cardBorder='2px solid #10B981';
    } else if(isActive){
      topBar='#7C3AED'; cardBg='#ffffff'; cardBorder='1px solid #E2E8F0';
    } else if(isMature){
      topBar='#94A3B8'; cardBg='#F8FAFC'; cardBorder='1px solid #CBD5E1';
    } else {
      topBar='#F59E0B'; cardBg='#FFFBEB'; cardBorder='1px solid #FDE68A';
    }

    var statusLabel = canRedeem ? '🔥 만기 도래'
      : isActive   ? '● 운용중'
      : isMature   ? '✓ 만기해지 완료'
      : isCanceled ? '✕ 중도해지'
      : d.status;

    var statusColor = canRedeem ? '#059669' : isActive ? '#3B82F6' : isMature ? '#94A3B8' : '#D97706';
    var statusBg    = canRedeem ? '#D1FAE5' : isActive ? '#EFF6FF' : isMature ? '#F1F5F9' : '#FEF3C7';

    h += '<div style="background:'+cardBg+';border:'+cardBorder+';border-radius:18px;margin-bottom:18px;box-shadow:0 4px 16px rgba(0,0,0,0.07);overflow:hidden;font-family:Pretendard,sans-serif;transition:transform 0.2s;" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'none\'">';
    
    // 상단 컬러 바
    h += '<div style="background:'+topBar+';height:6px;"></div>';
    h += '<div style="padding:22px 24px;">';

    // ── 행1: 이름 + 상태 + 금액 ──
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">';
    h += '  <div>';
    h += '    <div style="font-family:Jua,sans-serif;font-size:22px;color:#1E293B;margin-bottom:8px;">'+esc(d.studentNo)+'번 '+esc(d.name)+'</div>';
    h += '    <div style="display:flex;gap:7px;flex-wrap:wrap;">';
    h += '      <span style="background:'+statusBg+';color:'+statusColor+';font-size:12px;font-weight:700;padding:4px 13px;border-radius:20px;">'+statusLabel+'</span>';
    h += '      <span style="background:#EEF2FF;color:#6366F1;font-size:12px;font-weight:700;padding:4px 13px;border-radius:20px;">🏦 '+esc(d.type)+' 정기예금</span>';
    h += '    </div>';
    h += '  </div>';
    // 금액 영역
    h += '  <div style="text-align:right;min-width:170px;">';
    h += '    <div style="font-size:12px;color:#94A3B8;margin-bottom:3px;font-weight:600;letter-spacing:0.3px;">납입 원금</div>';
    h += '    <div style="font-family:Jua,sans-serif;font-size:26px;color:#1E293B;line-height:1.1;">'+Number(d.principal).toLocaleString()+' 머니</div>';
    h += '    <div style="font-size:13px;color:#10B981;font-weight:700;margin-top:4px;">수령 예정 → '+Number(total).toLocaleString()+' 머니</div>';
    h += '  </div>';
    h += '</div>';

    // ── 행2: 정보 칩 ──
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">';
    h += '  <span style="background:#F1F5F9;color:#475569;font-size:13px;font-weight:600;padding:6px 14px;border-radius:20px;">📅 만기: '+expireStr+'</span>';
    h += '  <span style="background:#EFF6FF;color:#3B82F6;font-size:13px;font-weight:600;padding:6px 14px;border-radius:20px;">이율: '+d.rate+'%</span>';
    h += '  <span style="background:#F5F3FF;color:#7C3AED;font-size:13px;font-weight:600;padding:6px 14px;border-radius:20px;">이자: +'+Number(interest).toLocaleString()+' 머니</span>';
    h += '  <span style="background:#ECFDF5;color:#059669;font-size:13px;font-weight:700;padding:6px 14px;border-radius:20px;">총액: '+Number(total).toLocaleString()+' 머니</span>';
    h += '</div>';

    // ── 행3: 날짜 + 액션 버튼 ──
    h += '<div style="display:flex;justify-content:space-between;align-items:center;border-top:1.5px dashed #E2E8F0;padding-top:14px;">';
    h += '  <div style="font-size:12px;color:#94A3B8;">📆 '+startStr+' ~ '+expireStr+'</div>';
    h += '  <div style="display:flex;gap:8px;align-items:center;">';

    if(canRedeem){
      h += '<button onclick="processMaturity('+d.rowNo+',\''+esc(d.studentNo)+'\','+d.principal+','+d.rate+')" style="background:#10B981;color:white;border:none;padding:9px 20px;font-size:14px;font-weight:700;border-radius:10px;cursor:pointer;font-family:Pretendard,sans-serif;box-shadow:0 3px 10px rgba(16,185,129,0.35);">💵 만기 지급</button>';
    } else if(isActive){
      h += '<button onclick="cancelDeposit('+d.rowNo+',\''+esc(d.studentNo)+'\','+d.principal+')" style="border:1.5px solid #EF4444;color:#EF4444;background:white;padding:7px 15px;font-size:13px;font-weight:700;border-radius:10px;cursor:pointer;font-family:Pretendard,sans-serif;">중도 해지 🚫</button>';
    }

    if(isActive){
      h += '<button onclick="editDeposit('+d.rowNo+',\''+esc(d.studentNo)+'\',\''+esc(d.name)+'\','+d.principal+','+d.rate+',\''+startStr+'\',\''+expireStr+'\')" title="수정" style="background:#F8FAFC;color:#64748B;border:1.5px solid #E2E8F0;padding:8px 12px;font-size:15px;border-radius:10px;cursor:pointer;">✏️</button>';
    }
    h += '<button onclick="deleteDeposit('+d.rowNo+',\''+esc(d.studentNo)+'\')" title="삭제" style="background:#FFF5F5;color:#EF4444;border:1.5px solid #FECACA;padding:8px 12px;font-size:15px;border-radius:10px;cursor:pointer;">🗑️</button>';

    h += '  </div>';
    h += '</div>';
    h += '</div></div>'; // card-body, card
  });

  container.innerHTML = h;
}

// ── 마스터 대시보드 전체 예금 현황 테이블 렌더링 ──
function renderDepositTable(list){
  var tbody = $('deposit-tbody');
  if(!tbody) return;

  if(!list || list.length === 0){
    tbody.innerHTML = '<tr><td colspan="8" class="empty-msg">예금 기록이 없습니다.</td></tr>';
    return;
  }

  var today = new Date(); today.setHours(0,0,0,0);
  var h = '';

  list.forEach(function(d){
    var startStr  = d.startDate  ? String(d.startDate).substring(0,10)  : '-';
    var expireStr = d.expireDate ? String(d.expireDate).substring(0,10) : '-';
    var expDate   = new Date(expireStr);
    var isExpired = today >= expDate;
    var isActive  = d.status === '활성';
    var canRedeem = isActive && isExpired;

    // 상태 표시
    var statusLabel, statusStyle;
    if(canRedeem){
      statusLabel = '🔥 만기도래';
      statusStyle = 'color:#059669;font-weight:700;background:#D1FAE5;padding:3px 9px;border-radius:12px;font-size:12px;';
    } else if(isActive){
      statusLabel = '● 운용중';
      statusStyle = 'color:#3B82F6;font-weight:700;background:#EFF6FF;padding:3px 9px;border-radius:12px;font-size:12px;';
    } else if(d.status === '만기해지'){
      statusLabel = '✓ 만기해지';
      statusStyle = 'color:#64748B;background:#F1F5F9;padding:3px 9px;border-radius:12px;font-size:12px;';
    } else if(d.status === '중도해지'){
      statusLabel = '✕ 중도해지';
      statusStyle = 'color:#D97706;background:#FEF3C7;padding:3px 9px;border-radius:12px;font-size:12px;';
    } else {
      statusLabel = d.status;
      statusStyle = 'color:#64748B;font-size:12px;';
    }

    var interest = Math.floor(d.principal * d.rate / 100);
    var total    = d.principal + interest;

    h += '<tr>';
    // 번호
    h += '<td><span class="no-bdg">'+esc(d.studentNo)+'</span></td>';
    // 이름
    h += '<td style="font-weight:600;color:#1E293B;">'+esc(d.name)+'</td>';
    // 예금 종류
    h += '<td><span style="background:#EEF2FF;color:#4338CA;font-size:12px;font-weight:700;padding:3px 9px;border-radius:12px;">'+esc(d.type)+'</span></td>';
    // 원금
    h += '<td style="font-weight:700;color:#1E293B;text-align:right;">'+Number(d.principal).toLocaleString()+' <span style="font-size:11px;color:#94A3B8;">머니</span></td>';
    // 이자율
    h += '<td style="text-align:center;color:#3B82F6;font-weight:700;">'+d.rate+'%</td>';
    // 시작일
    h += '<td style="font-size:12px;color:#64748B;text-align:center;">'+startStr+'</td>';
    // 만기일 (만기 도래 시 강조)
    h += '<td style="font-size:12px;text-align:center;'+(canRedeem?'color:#DC2626;font-weight:700;':'color:#64748B;')+'">'+expireStr+'</td>';
    // 상태
    h += '<td style="text-align:center;"><span style="'+statusStyle+'">'+statusLabel+'</span></td>';
    h += '</tr>';

    // ── 만기 도래 시 총액 강조 서브 행 ──
    if(canRedeem){
      h += '<tr style="background:#ECFDF5;">';
      h += '<td colspan="3" style="padding:5px 12px 8px;font-size:12px;color:#059669;">💰 만기 지급 시: 원금 '+Number(d.principal).toLocaleString()+' + 이자 '+Number(interest).toLocaleString()+' = <strong>'+Number(total).toLocaleString()+' 머니</strong></td>';
      h += '<td colspan="5" style="padding:5px 12px 8px;text-align:right;">';
      h += '<button onclick="processMaturity('+d.rowNo+',\''+esc(d.studentNo)+'\','+d.principal+','+d.rate+')" ';
      h += 'style="background:#10B981;color:white;border:none;padding:5px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:Pretendard,sans-serif;">💵 만기 지급</button>';
      h += '</td>';
      h += '</tr>';
    }
  });

  tbody.innerHTML = h;
}

// ============================================================
// 세금 관리
// ============================================================
function refreshTaxSels(){
  var sel=$('tax-stu');
  if(sel){sel.innerHTML='<option value="">-- 학생 선택 --</option>';_stuList.forEach(function(s){var o=document.createElement('option');o.value=s.studentNo;o.textContent=s.studentNo+'번 '+(s.name||'');sel.appendChild(o);});}
}

function doBulkTax(){
  var rate=$('tax-rate').value,memo=$('tax-memo').value;
  if(!rate||rate<=0)return alert('세율을 입력해 주세요.');
  if(!confirm('전체 학생에게 세율 '+rate+'% 세금을 부과합니까?'))return;
  google.script.run.withSuccessHandler(function(r){
    showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);if(r.success)loadList();
  }).chargeTaxBulk(_adminCC,rate,memo||'세금 징수');
}

function doIndTax(){
  var sno=$('tax-stu').value,amt=$('tax-amt').value,memo=$('tax-ind-memo').value;
  if(!sno)return alert('학생을 선택해 주세요.');
  if(!amt||amt<=0)return alert('금액을 입력해 주세요.');
  google.script.run.withSuccessHandler(function(r){
    showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);if(r.success){$('tax-amt').value='';loadList();}
  }).chargeTax(_adminCC,sno,memo||'세금',amt);
}

// ============================================================
// 신용 관리
// ============================================================
function renderCreditTable(){
  var tb=$('credit-tbody');
  if(!_stuList.length){tb.innerHTML='<tr><td colspan="6" class="empty-msg">학생 목록을 먼저 불러오세요.</td></tr>';return;}
  var h='';
  _stuList.forEach(function(s){
    var g=creditGrade(s.credit||0);
    h+='<tr><td><span class="no-bdg">'+s.studentNo+'</span></td>'+
      '<td>'+esc(s.name)+'</td><td>'+esc(s.job||'국민')+'</td>'+
      '<td><strong style="color:var(--orange);">'+s.credit+'점</strong></td>'+
      '<td><span class="pill">'+g.label+'</span></td>'+
      '<td><input type="number" id="cdelta-'+s.studentNo+'" placeholder="+5 또는 -5" style="width:120px;padding:6px 9px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-family:Pretendard,sans-serif;background:var(--surf);"></td>'+
      '<td><button class="btn btn-sm" onclick="doCreditAdj(\''+s.studentNo+'\')"><i class="fa-solid fa-check"></i></button></td></tr>';
  });
  tb.innerHTML=h;
}

function doBulkCredit(){
  var delta=$('credit-bulk-delta').value;
  if(!delta)return alert('변화량을 입력해 주세요.');
  if(!confirm('전체 학생 신용점수를 '+delta+' 조정합니까?'))return;
  google.script.run.withSuccessHandler(function(r){
    showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);if(r.success)loadList();
  }).adjustCreditBulk(_adminCC,delta,'일괄조정');
}

function doCreditAdj(sno){
  var delta=$('cdelta-'+sno).value;
  if(!delta)return showToast('변화량을 입력해 주세요.');
  google.script.run.withSuccessHandler(function(r){
    showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);if(r.success)loadList();
  }).adjustCredit(_adminCC,sno,delta,'수동조정');
}

// ============================================================
// 통계
// ============================================================
function loadStats(){
  var container=$('stats-hw-container');

  // ★ 30초 이내 캐시 데이터가 있으면 서버 호출 없이 즉시 렌더링
  if(_hwReportCache && (Date.now()-_hwReportCacheAt) < 30000){
    renderMasterHwReports(_hwReportCache.list||[], _hwReportCache.nameMap||{});
    return;
  }

  if(container) container.innerHTML='<div class="empty-msg">⏳ 불러오는 중...</div>';
  var targetCC=_adminCC||_cc;
  google.script.run
    .withSuccessHandler(function(r){
      if(!r.success){
        if(container) container.innerHTML='<div class="empty-msg">오류: '+r.msg+'</div>';
        return;
      }
      // ★ 결과 캐싱
      _hwReportCache   = r;
      _hwReportCacheAt = Date.now();
      renderMasterHwReports(r.list||[], r.nameMap||{});
    })
    .withFailureHandler(function(err){
      if(container) container.innerHTML='<div class="empty-msg">오류: '+err.message+'</div>';
    })
    .getHomeworkReports(targetCC);
}

// ── 과제 제출 상태별 신용점수 설정 (마스터) ──
function loadHomeworkCreditSettings(){
  var targetCC = _adminCC || _cc;
  if(!targetCC) return;
  google.script.run
    .withSuccessHandler(function(r){
      if(!r.success) return;
      if($('hwcredit-o')) $('hwcredit-o').value = r.oScore;
      if($('hwcredit-d')) $('hwcredit-d').value = r.dScore;
      if($('hwcredit-x')) $('hwcredit-x').value = r.xScore;
    })
    .getHomeworkCreditSettings(targetCC);
}

function saveHomeworkCreditSettings(){
  var o=$('hwcredit-o').value, d=$('hwcredit-d').value, x=$('hwcredit-x').value;
  google.script.run
    .withSuccessHandler(function(r){
      showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);
    })
    .setHomeworkCreditSettings(_adminCC, o, d, x);
}

// ============================================================
// 교사 용돈기입장
// ============================================================
function refreshTeacherSel(){
  var sel=$('teacher-stu-sel');
  sel.innerHTML='<option value="">-- 학생을 선택하세요 --</option>';
  _stuList.forEach(function(s){
    var opt=document.createElement('option');opt.value=s.studentNo;
    opt.textContent=s.studentNo+'번 '+(s.name||'(이름없음)')+' '+(s.job?'['+s.job+']':'');
    sel.appendChild(opt);
  });
  $('teacher-wallet-wrap').style.display='none';
}

function loadTeacherWallet(){
  var sno=$('teacher-stu-sel').value;
  if(!sno){$('teacher-wallet-wrap').style.display='none';return;}
  var stu=_stuList.find(function(s){return s.studentNo===sno});if(!stu)return;
  $('teacher-wallet-wrap').style.display='block';
  $('t-stu-label').textContent=sno+'번 '+(stu.name||'');
  var g=creditGrade(stu.credit||0);$('t-grade-num').textContent=g.num;$('t-grade-lbl').textContent=g.label;
  $('t-credit').textContent=stu.credit||0;
  $('t-total').textContent=(Number(stu.card||0)+Number(stu.bank||0)).toLocaleString()+' 머니';
  $('t-card').textContent=Number(stu.card||0).toLocaleString()+' 머니';
  $('t-bank').textContent=Number(stu.bank||0).toLocaleString()+' 머니';
  loadTx(_adminCC,sno,'t-tx-tbody','t-tx-cnt');
}

function setTeacherMode(m){
  _teacherMode=m;
  $('t-inc-btn').className='tog-btn '+(m==='inc'?'tog-on-inc':'');
  $('t-exp-btn').className='tog-btn '+(m==='exp'?'tog-on-exp':'');
}

function doTeacherRecord(){
  var sno=$('teacher-stu-sel').value;if(!sno)return alert('학생을 선택해 주세요.');
  var memo=$('t-memo').value,amt=$('t-amt').value;
  if(!memo||!amt||amt<=0)return alert('내역과 금액을 입력해 주세요.');
  if(_teacherMode==='inc'){
    google.script.run.withSuccessHandler(function(r){
      if(r.success){
        showToast('✅ 수입 기록 완료');$('t-memo').value='';$('t-amt').value='';
        $('t-card').textContent=Number(r.newCard).toLocaleString()+' 머니';
        var bank=parseInt(($('t-bank').textContent||'0').replace(/[^0-9]/g,''))||0;
        $('t-total').textContent=(Number(r.newCard)+bank).toLocaleString()+' 머니';
        loadTx(_adminCC,sno,'t-tx-tbody','t-tx-cnt');loadList();
      } else alert(r.msg);
    }).recordIncome(_adminCC,sno,memo,amt,'교사수동지급');
  } else {
    google.script.run.withSuccessHandler(function(r){
      if(r.success){
        showToast('✅ 지출 기록 완료');$('t-memo').value='';$('t-amt').value='';
        $('t-card').textContent=Number(r.newCard).toLocaleString()+' 머니';
        var bank=parseInt(($('t-bank').textContent||'0').replace(/[^0-9]/g,''))||0;
        $('t-total').textContent=(Number(r.newCard)+bank).toLocaleString()+' 머니';
        loadTx(_adminCC,sno,'t-tx-tbody','t-tx-cnt');loadList();
      } else alert(r.msg);
    }).recordExpense(_adminCC,sno,memo,amt);
  }
}

// ============================================================
// 거래 내역 공통
// ============================================================
function loadTx(cc,sno,tbodyId,cntId){
  google.script.run.withSuccessHandler(function(r){
    if(!r.success)return;
    $(cntId).textContent='총 '+r.list.length+'건';
    var tb=$(tbodyId);
    if(!r.list.length){tb.innerHTML='<tr><td colspan="5" class="empty-msg">거래 내역이 없습니다.</td></tr>';return;}
    var h='';
    r.list.forEach(function(tx){
      var inc=tx.income?'<span class="tp">+'+Number(tx.income).toLocaleString()+'</span>':'<span style="color:#CBD5E1;">-</span>';
      var exp=tx.expense?'<span class="tm">-'+Number(tx.expense).toLocaleString()+'</span>':'<span style="color:#CBD5E1;">-</span>';
      h+='<tr><td class="td">'+tx.date+'</td><td>'+esc(tx.memo)+' <span class="tt">'+esc(tx.type||'')+'</span></td><td>'+inc+'</td><td>'+exp+'</td><td class="tb">'+Number(tx.balance).toLocaleString()+' 머니</td></tr>';
    });
    tb.innerHTML=h;
  }).getTransactions(cc,sno);
}

// ============================================================
// 학생 로그인 & 대시보드
// ============================================================
function doStudentLogin(){
  var cc=$('stcc').value, sno=$('stno').value, sc=$('stcode').value;
  if(!cc||!sno||!sc) return alert('학급코드, 학생번호, 접속코드를 모두 입력해 주세요.');

  google.script.run.withSuccessHandler(function(r){
    if(r.success){
      _cc=cc; _sno=String(sno); _myJob=r.job||'';
      _isTeacher=false;

      if($('my-job-label')) $('my-job-label').innerText = _myJob||'국민';
      if($('teacher-to-master-btn')) $('teacher-to-master-btn').style.display='none';

      go('view-student-dashboard');
      renderStudentTiles();
      initStudentWallet(r);
      loadTx(cc, sno, 's-tx-tbody', 's-tx-cnt');

      // ★ 세션 저장 (탭을 닫으면 자동 소멸, 새로고침에는 유지)
      var sessionData={role:'student',classCode:cc,sno:sno,myJob:_myJob,studentData:r};
      sessionStorage.setItem('smtm_session',JSON.stringify(sessionData));
    } else {
      alert(r.msg);
    }
  }).loginStudent(cc, sno, sc);
}

function initStudentWallet(r){
  var g=creditGrade(Number(r.credit)||0);
  $('s-grade-num').textContent=g.num;$('s-grade-lbl').textContent=g.label;
  $('s-credit').textContent=r.credit||0;
  $('s-total').textContent=(Number(r.card||0)+Number(r.bank||0)).toLocaleString()+' 머니';
  $('s-card').textContent=Number(r.card||0).toLocaleString()+' 머니';
  $('s-bank').textContent=Number(r.bank||0).toLocaleString()+' 머니';
}

var _jobTiles=[
  {name:'국민(용돈기입장)',icon:'fa-users',bg:'var(--green)',desc:'나의 용돈기입장 및 자산 확인',view:'view-citizen-wallet',jobs:['__ALL__']},
  {name:'은행청장',icon:'fa-building-columns',bg:'var(--blue)',desc:'예금 서비스 관리',view:'view-bank',jobs:['은행청장']},
  {name:'국세청장',icon:'fa-shield-heart',bg:'var(--red)',desc:'세금 부과 및 예산 관리',view:'view-tax-office',jobs:['국세청장']},
  {name:'신용등급관리위원장',icon:'fa-chart-line',bg:'var(--purple)',desc:'학생 신용점수 조정',view:'view-credit-mgr',jobs:['신용등급관리위원장']},
  {name:'재산조사국장',icon:'fa-magnifying-glass',bg:'var(--orange)',desc:'전체 자산 현황 조사',view:'view-asset-inspect',jobs:['재산조사국장']},
  {name:'부동산 중개인',icon:'fa-house-chimney',bg:'var(--green)',desc:'사물함·자리 매매 임대',view:'view-realtor',jobs:['부동산 중개인']},
  {name:'통계청장',icon:'fa-chart-simple',bg:'var(--cyan)',desc:'경제 활동 통계 분석',view:'view-stats-office',jobs:['통계청장']},
  {name:'도매상인',icon:'fa-box-open',bg:'var(--yellow)',desc:'매점 물품 및 수익 관리',view:'view-wholesale',jobs:['도매상인']},
  {name:'경찰서장',icon:'fa-shield',bg:'var(--slate)',desc:'벌금 부과 및 치안 관리',view:'view-police',jobs:['경찰서장']},
  {name:'증권회사',icon:'fa-arrow-trend-up',bg:'var(--purple)',desc:'복권 구매 및 투자',view:'view-stock',jobs:['증권회사']}
];

function renderStudentTiles(){
  var grid=$('student-tile-grid'); var html='';
  _jobTiles.forEach(function(j){
    var isUnlocked=(_isTeacher||j.jobs[0]==='__ALL__'||j.jobs.indexOf(_myJob)!==-1);
    var lockClass=isUnlocked?'':'locked';
    var lockIcon=isUnlocked?'<div class="tile-dot"></div>':'<i class="fa-solid fa-lock lock-icon"></i>';
    var clickAction='';
    if(isUnlocked){
      if(j.view==='view-bank'){
        clickAction='onclick="openBank()"';
      } else {
        clickAction='onclick="openStudentPanel(\''+j.view+'\')"';
      }
    } else {
      clickAction='onclick="showToast(\'🔒 '+j.name+' 직업을 가진 학생만 접근 가능합니다.\')"';
    }
    html+='<div class="dash-tile '+lockClass+'" '+clickAction+'>'+lockIcon+
      '<div class="tile-icon" style="background:'+j.bg+';"><i class="fa-solid '+j.icon+'"></i></div>'+
      '<h3>'+j.name+'</h3><p>'+j.desc+'</p></div>';
  });
  grid.innerHTML=html;
}

function openStudentPanel(viewId){
  if(!document.getElementById(viewId)){
    showToast('⚠️ ['+viewId+'] 패널을 찾을 수 없습니다.');
    console.error('누락된 뷰: '+viewId);
    return;
  }
  if(viewId==='view-police')      { loadFineStudents(); loadFineLog(); }
  if(viewId==='view-credit-mgr')  { loadCreditMgrList(); }
  if(viewId==='view-tax-office')  { loadTaxOfficeDashboard(); }
  if(viewId==='view-asset-inspect'){ loadAssetInspect(); }
  if(viewId==='view-stats-office') { loadStatsOffice(); }
  if(viewId==='view-wholesale')    { initWholesalePanel(); }
  go(viewId);
}

function openBank(){
  var isBanker = (_myJob==='은행청장' || _isTeacher);
  
  $('bank-citizen-panel').style.display = isBanker ? 'none' : 'block';
  $('bank-banker-panel').style.display  = isBanker ? 'block' : 'none';

  if(isBanker){
    $('bank-mode-label').textContent = '은행청장 관리 패널';
    var targetCode = _cc || _adminCC;
    if(!targetCode){ alert('학급 코드가 없습니다. 다시 로그인해 주세요.'); return; }
    initBankDashboard();
    loadAllDeposits();
  } else {
    $('bank-mode-label').textContent = '예금 서비스';
    loadBankRatesInfo();
    loadMyDeposits();
  }

  go('view-bank');
}

// ============================================================
// 학생 지출
// ============================================================
function doExpense(){
  var memo=$('exp-memo').value, amt=$('exp-amt').value;
  if(!memo) return alert('내역을 입력해 주세요.');
  if(!amt||amt<=0) return alert('금액을 올바르게 입력해 주세요.');
  
  showLoading(); // ★ 서버 통신 시작 전 로딩 켜기
  
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading(); // ★ 통신 성공 시 로딩 끄기
      if(r.success){
        showToast('✅ 지출이 기록되었습니다.');
        $('exp-memo').value=''; $('exp-amt').value='';
        $('s-card').textContent=Number(r.newCard).toLocaleString()+' 머니';
        var bank=parseInt(($('s-bank').textContent||'0').replace(/[^0-9]/g,''))||0;
        $('s-total').textContent=(Number(r.newCard)+bank).toLocaleString()+' 머니';
        loadTx(_cc,_sno,'s-tx-tbody','s-tx-cnt');
        if(r.newCard<0) showBankrupt();
      } else {
        alert(r.msg);
      }
    })
    .withFailureHandler(function(err){
      hideLoading(); // ★ 서버 에러 발생 시에도 로딩 끄기
      alert('서버와 통신 중 오류가 발생했습니다: ' + err.message);
    })
    .recordExpense(_cc, _sno, memo, amt);
}

// ============================================================
// 은행 (학생/은행청장)
// ============================================================
function loadBankRatesInfo(){
  google.script.run.withSuccessHandler(function(r){
    if(r.success){
      $('bank-rates-info').innerHTML='📊 현재 이자율: 1주 <b style="color:var(--green)">'+r.r1+'%</b> | 2주 <b style="color:var(--green)">'+r.r2+'%</b> | 3주 <b style="color:var(--green)">'+r.r3+'%</b> | 4주 <b style="color:var(--green)">'+r.r4+'%</b>';
    }
  }).getBankSettings(_cc);
}

function loadMyDeposits(){
  google.script.run.withSuccessHandler(function(r){
    var wrap=$('my-deposits-list');
    if(!r.success||!r.list.length){wrap.innerHTML='<div class="empty-msg">가입한 예금이 없습니다.</div>';return;}
    var h='';
    r.list.forEach(function(d){
      var activeClass=d.status==='활성'?'active-dep':d.status==='만기해지'?'redeemed':'expired';
      var interest=Math.floor(d.principal*d.rate/100);
      var canRedeem=(d.status==='활성');
      h+='<div class="dep-card '+activeClass+'">'+
        '<div class="dep-info"><div class="dep-type">'+esc(d.type)+'</div>'+
        '<div class="dep-meta">만기: '+esc(d.expireDate)+' | 이자율: '+d.rate+'% | 상태: '+esc(d.status)+'</div></div>'+
        '<div><div class="dep-amt">'+Number(d.principal).toLocaleString()+' 머니</div>'+
        '<div class="dep-interest">이자 +'+interest.toLocaleString()+' 머니 예정</div>'+
        (canRedeem?'<button class="btn btn-sm btn-green" style="margin-top:6px;font-size:11px;" onclick="doRedeem('+d.idx+')">만기해지</button>':'<span style="font-size:11px;color:var(--gray);">'+esc(d.status)+'</span>')+
        '</div></div>';
    });
    wrap.innerHTML=h;
  }).getMyDeposits(_cc,_sno);
}

function doDeposit(){
  var weeks=$('dep-weeks').value,amt=$('dep-amt').value;
  if(!amt||amt<=0)return alert('예금 금액을 입력해 주세요.');
  google.script.run.withSuccessHandler(function(r){
    if(r.success){
      showToast('✅ '+r.msg);$('dep-amt').value='';
      $('s-card').textContent=Number(r.newCard).toLocaleString()+' 머니';
      $('s-bank').textContent=Number(r.newBank).toLocaleString()+' 머니';
      $('s-total').textContent=(Number(r.newCard)+Number(r.newBank)).toLocaleString()+' 머니';
      loadMyDeposits();
    } else alert(r.msg);
  }).createDeposit(_cc,_sno,weeks,amt);
}

function doRedeem(idx){
  if(!confirm('예금을 만기해지 하겠습니까?\n원금+이자가 카드로 입금되고 신용점수가 자동 부여됩니다.')) return;
  google.script.run.withSuccessHandler(function(r){
    if(r.success){
      showToast('✅ '+r.msg);
      $('s-card').textContent = Number(r.newCard).toLocaleString()+' 머니';
      $('s-bank').textContent = Number(r.newBank).toLocaleString()+' 머니';
      $('s-total').textContent= (Number(r.newCard)+Number(r.newBank)).toLocaleString()+' 머니';
      // ★ 신용점수 화면 즉시 반영
      if(r.creditGain > 0){
        if($('s-credit')) $('s-credit').textContent = r.newCredit;
        var g = creditGrade(r.newCredit);
        if($('s-grade-num')) $('s-grade-num').textContent = g.num;
        if($('s-grade-lbl')) $('s-grade-lbl').textContent = g.label;
      }
      loadMyDeposits();
    } else alert(r.msg);
  }).redeemDeposit(_cc, _sno, idx);
}

// ============================================================
// 은행청장 대시보드
// ============================================================
var depositInterestRates={1:5.0,2:8.0,3:11.0,4:15.0};
var primeInterestRate=2.0;
var currentBankRecords=[];

function initBankDashboard(){
  var today=new Date().toISOString().split('T')[0];
  if($('deposit-start-date'))$('deposit-start-date').value=today;
  var currentCode=_cc||_adminCC;
  var sel=$('deposit-customer');
  if(sel){
    sel.innerHTML='<option value="">데이터 불러오는 중...</option>';
    google.script.run.withSuccessHandler(function(r){
      if(r.success){
        sel.innerHTML='<option value="">-- 학생을 선택하세요 --</option>';
        r.list.forEach(function(s){
          var o=document.createElement('option');o.value=s.studentNo;
          o.textContent=s.studentNo+'번 '+(s.name||'');sel.appendChild(o);
        });
      }
    }).getStudentList(currentCode);
  }
  google.script.run.withSuccessHandler(function(r){
    if(r.success){
      depositInterestRates={1:r.r1,2:r.r2,3:r.r3,4:r.r4};
      primeInterestRate=r.prime;
      var info=$('banker-rates-info');
      if(info){
        info.innerHTML='📊 <b>현재 이자율:</b> 1주 <span style="color:var(--green)">'+r.r1+'%</span> | 2주 <span style="color:var(--green)">'+r.r2+'%</span> | 3주 <span style="color:var(--green)">'+r.r3+'%</span> | 4주 <span style="color:var(--green)">'+r.r4+'%</span><br>👑 <b>우대 금리:</b> 기본 이자율 + <span style="color:var(--orange)">'+r.prime+'%</span>';
      }
       loadAndShowCreditInBanker(currentCode);
    }
  }).getBankSettings(currentCode);
}

function loadAndShowCreditInBanker(targetCC){
  google.script.run
    .withSuccessHandler(function(r){
      if(!r.success) return;
      _depositCreditMap = { 1: r.c1||0, 2: r.c2||0, 3: r.c3||0, 4: r.c4||0 };
      var info = $('banker-rates-info');
      if(info && info.innerHTML.indexOf('만기 해지') === -1){
        info.innerHTML +=
          '<br>⭐ <b>만기 해지 시 신용점수 자동 부여:</b> ' +
          '1주 <span style="color:var(--yellow)">+'+r.c1+'점</span> | ' +
          '2주 <span style="color:var(--yellow)">+'+r.c2+'점</span> | ' +
          '3주 <span style="color:var(--yellow)">+'+r.c3+'점</span> | ' +
          '4주 <span style="color:var(--yellow)">+'+r.c4+'점</span>';
      }
    })
    .getDepositCreditSettings(targetCC);
}

function calculatePreview(){
  var amount=parseInt($('deposit-amount').value)||0;
  var period=$('deposit-period').value;
  var isPrime=$('deposit-prime-rate').checked;
  var previewBox=$('deposit-preview-box');
  if(amount>0){
    previewBox.style.display='block';
    var baseRate=depositInterestRates[period]||0;
    var finalRate=isPrime?(baseRate+primeInterestRate):baseRate;
    var interest=Math.floor(amount*(finalRate/100));
    var total=amount+interest;
    var rateText=finalRate+'% (기본 '+baseRate+'%';
    if(isPrime)rateText+=' + 우대 '+primeInterestRate+'%';
    rateText+=')';
    $('preview-rate').innerText=rateText;
    $('preview-total').innerText=total.toLocaleString();
  } else {
    previewBox.style.display='none';
  }
}

function saveNewDeposit(){
  var customerEl = $('deposit-customer');
  var customerNo = customerEl.value;
  if(!customerNo) return alert('학생을 먼저 선택해주세요.');

  var period    = $('deposit-period').value;
  var amount    = parseInt($('deposit-amount').value);
  var startDate = $('deposit-start-date').value;
  var isPrime   = $('deposit-prime-rate').checked;

  if(!amount || !startDate) return alert('금액과 날짜를 정확히 입력해주세요.');

  var baseRate  = depositInterestRates[period] || 0;
  var finalRate = isPrime ? (baseRate + primeInterestRate) : baseRate;
  var targetCC  = _cc || _adminCC;

  // 이 기간 신용점수 미리 확인
  var creditGainPreview = _depositCreditMap[parseInt(period)] || 0;

  if(!confirm(
  '예금을 등록하시겠습니까?\n\n' +
  '고객: ' + customerEl.options[customerEl.selectedIndex].text + '\n' +
  '기간: ' + period + '주 / 이율: ' + finalRate + '%\n' +
  '금액: ' + amount.toLocaleString() + ' 머니\n' +
  '⭐ 만기 해지 시 신용점수 +' + creditGainPreview + '점 자동 부여'
)) return;

  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      if(r.success){
        showToast('✅ ' + r.msg);
        $('deposit-amount').value = '';
        $('deposit-prime-rate').checked = false;
        $('deposit-preview-box').style.display = 'none';
        loadAllDeposits();
      } else {
        alert('저장 실패: ' + r.msg);
      }
    })
    .withFailureHandler(function(err){
      hideLoading();
      alert('서버 오류: ' + err.message);
    })
    // ★ 신용점수 연동 함수로 교체
    .createDepositByBankerWithCredit(targetCC, customerNo, period, amount, finalRate, startDate);
}

function renderDepositCards(records){
  var container=$('deposit-records-container');
  if(!container)return;
  if(records.length===0){
    container.innerHTML='<div style="padding:20px;text-align:center;color:#888;background:#fff;border-radius:8px;">아직 기록된 예금이 없습니다.</div>';
    return;
  }
  var html='';
  var today=new Date();today.setHours(0,0,0,0);
  records.forEach(function(rec){
    var startDate=new Date(rec.startDate);
    var weeks=parseInt(rec.period);
    var maturityDate=new Date(startDate);maturityDate.setDate(maturityDate.getDate()+(weeks*7));
    var isMatured=today>=maturityDate;
    var cardClass=isMatured?'deposit-card matured':'deposit-card';
    var interest=Math.floor(rec.amount*(rec.rate/100));
    var totalAmount=rec.amount+interest;
    var fmtStart=startDate.getFullYear()+'.'+(startDate.getMonth()+1)+'.'+startDate.getDate();
    var fmtMaturity=maturityDate.getFullYear()+'.'+(maturityDate.getMonth()+1)+'.'+maturityDate.getDate();
    html+='<div class="'+cardClass+'">';
    html+='<div style="flex:1;">';
    html+='<div style="font-weight:bold;font-size:16px;margin-bottom:8px;color:#333;">'+rec.studentName;
    if(isMatured)html+=' <span class="matured-badge">만기 🔥</span>';
    html+='</div>';
    html+='<div style="font-size:13px;color:#555;display:flex;flex-direction:column;gap:4px;">';
    html+='<div>📅 기간: '+fmtStart+' ~ '+fmtMaturity+' ('+weeks+'주)</div>';
    html+='<div><span style="color:#007bff;font-weight:bold;">적용 이율: '+rec.rate+'%</span></div>';
    html+='<div>원금 '+rec.amount.toLocaleString()+'머니 + 이자 '+interest.toLocaleString()+'머니</div>';
    html+='</div></div>';
    html+='<div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;">';
    html+='<div style="font-size:18px;font-weight:bold;color:var(--purple);">'+totalAmount.toLocaleString()+'머니</div>';
    html+='<div style="display:flex;gap:5px;">';
    if(isMatured){html+='<button class="btn-success-outline" onclick="processMaturity(\''+rec.id+'\','+totalAmount+')">만기 지급 💵</button>';}
    else{html+='<button class="btn-danger-outline" onclick="cancelDeposit(\''+rec.id+'\','+rec.amount+')">중도 해지 🚫</button>';}
    html+='<button class="action-icon" style="color:#dc3545;" onclick="deleteDeposit(\''+rec.id+'\')"><i class="fa-solid fa-trash"></i></button>';
    html+='</div></div></div>';
  });
  container.innerHTML=html;
}

function processMaturity(depositRowNo, studentNo, principal, rate){
  if(!confirm('만기 지급을 처리하겠습니까? 원금+이자가 카드로 입금됩니다.')) return;
  var targetCC = _cc || _adminCC;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      showToast(r.success ? '✅ ' + r.msg : '⚠️ ' + r.msg);
      if(r.success) loadAllDeposits();
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: ' + err.message); })
    .redeemDepositByBanker(targetCC, studentNo, depositRowNo);
}

function cancelDeposit(depositRowNo, studentNo, principal){
  if(!confirm('중도 해지 시 이자는 지급되지 않습니다. 원금(' + Number(principal).toLocaleString() + ' 머니)만 반환하시겠습니까?')) return;
  var targetCC = _cc || _adminCC;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      showToast(r.success ? '✅ ' + r.msg : '⚠️ ' + r.msg);
      if(r.success) loadAllDeposits();
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: ' + err.message); })
    .cancelDepositByBanker(targetCC, studentNo, depositRowNo);
}

function deleteDeposit(rowNo, studentNo){
  if(!confirm('이 예금 기록을 삭제하시겠습니까?\n삭제된 기록은 복구할 수 없습니다.')) return;
  var targetCC = _cc || _adminCC;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      showToast(r.success ? '🗑️ 삭제 완료' : '⚠️ ' + r.msg);
      if(r.success) loadAllDeposits();
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: ' + err.message); })
    .deleteDepositByBanker(targetCC, rowNo);
}

function exportDepositsCSV(){
  if(!_allDepositList || !_allDepositList.length){ showToast('⚠️ 내보낼 데이터가 없습니다.'); return; }
  var rows = ['번호,이름,예금종류,원금(머니),이율(%),가입일,만기일,상태,이자(머니),총액(머니)'];
  _allDepositList.forEach(function(d){
    var interest = Math.floor(d.principal * d.rate / 100);
    rows.push([
      d.studentNo, d.name, d.type, d.principal, d.rate,
      String(d.startDate||'').substring(0,10),
      String(d.expireDate||'').substring(0,10),
      d.status, interest, d.principal + interest
    ].join(','));
  });
  var csv  = '\uFEFF' + rows.join('\n');
  var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = '예금기록_' + new Date().toLocaleDateString('ko-KR').replace(/\. /g,'-').replace('.','')+'.csv';
  a.click(); URL.revokeObjectURL(url);
  showToast('✅ CSV 파일 다운로드 완료!');
}

function editDeposit(rowNo, studentNo, studentName, principal, rate, startDate, expireDate){
  // 모달이 없으면 동적으로 생성
  if(!$('deposit-edit-modal')){
    var m = document.createElement('div');
    m.id = 'deposit-edit-modal';
    m.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99999;justify-content:center;align-items:center;';
    m.innerHTML =
      '<div style="background:#fff;border-radius:22px;padding:36px;width:90%;max-width:440px;font-family:Pretendard,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,0.2);">' +
        '<div style="font-family:Jua,sans-serif;font-size:22px;color:#1E293B;margin-bottom:18px;">✏️ 예금 수정</div>' +
        '<div id="deposit-edit-info" style="background:#F8FAFC;border-radius:12px;padding:14px 16px;margin-bottom:20px;font-size:14px;color:#475569;border:1px solid #E2E8F0;line-height:1.7;"></div>' +
        '<div style="margin-bottom:16px;">' +
          '<label style="font-size:13px;font-weight:700;color:#475569;display:block;margin-bottom:7px;">이자율 (%)</label>' +
          '<input id="edit-rate" type="number" step="0.1" min="0" style="width:100%;padding:13px 14px;border:2px solid #E2E8F0;border-radius:11px;font-size:16px;font-family:Pretendard,sans-serif;outline:none;">' +
        '</div>' +
        '<div style="margin-bottom:26px;">' +
          '<label style="font-size:13px;font-weight:700;color:#475569;display:block;margin-bottom:7px;">만기일</label>' +
          '<input id="edit-expire" type="date" style="width:100%;padding:13px 14px;border:2px solid #E2E8F0;border-radius:11px;font-size:15px;font-family:Pretendard,sans-serif;outline:none;">' +
        '</div>' +
        '<input type="hidden" id="edit-row-no"><input type="hidden" id="edit-stu-no">' +
        '<div style="display:flex;gap:10px;">' +
          '<button onclick="submitDepositEdit()" style="flex:1;background:#7C3AED;color:white;border:none;padding:14px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:Pretendard,sans-serif;">💾 저장</button>' +
          '<button onclick="closeDepositEditModal()" style="flex:1;background:#F1F5F9;color:#64748B;border:none;padding:14px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:Pretendard,sans-serif;">취소</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
  }
  $('deposit-edit-info').innerHTML =
    '<strong style="color:#1E293B;">' + esc(studentNo) + '번 ' + esc(studentName) + '</strong><br>' +
    '원금: <strong>' + Number(principal).toLocaleString() + ' 머니</strong> &nbsp;|&nbsp; 가입일: ' + startDate;
  $('edit-rate').value    = rate;
  $('edit-expire').value  = expireDate;
  $('edit-row-no').value  = rowNo;
  $('edit-stu-no').value  = studentNo;
  $('deposit-edit-modal').style.display = 'flex';
}

function closeDepositEditModal(){
  var m = $('deposit-edit-modal');
  if(m) m.style.display = 'none';
}

function submitDepositEdit(){
  var rowNo  = $('edit-row-no').value;
  var rate   = $('edit-rate').value;
  var expire = $('edit-expire').value;
  if(!rate || !expire) return alert('이자율과 만기일을 모두 입력해 주세요.');
  var targetCC = _cc || _adminCC;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading(); closeDepositEditModal();
      showToast(r.success ? '✅ 수정 완료!' : '⚠️ ' + r.msg);
      if(r.success) loadAllDeposits();
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: ' + err.message); })
    .editDepositByBanker(targetCC, rowNo, rate, expire);
}

// ============================================================
// 경찰서
// ============================================================
function loadFineStudents(){
  var sel=$('fine-stu');
  sel.innerHTML='<option value="">-- 학생 선택 --</option>';
  google.script.run.withSuccessHandler(function(r){
    if(!r.success)return;
    r.list.forEach(function(s){var o=document.createElement('option');o.value=s.studentNo;o.textContent=s.studentNo+'번 '+(s.name||'');sel.appendChild(o);});
  }).getStudentList(_cc);
}

function fineReasonChange(){
  var v=$('fine-reason-sel').value;
  $('fine-reason-custom').style.display=(v==='직접입력')?'block':'none';
}

function doFine(){
  var sno=$('fine-stu').value;
  if(!sno)return alert('학생을 선택해 주세요.');
  var reasonSel=$('fine-reason-sel').value;
  var reason=reasonSel==='직접입력'?$('fine-reason-custom').value:reasonSel;
  var amt=$('fine-amt').value;
  if(!amt||amt<=0)return alert('벌금 금액을 입력해 주세요.');
  showLoading();
  google.script.run.withSuccessHandler(function(r){
    hideLoading();
    if(r.success){
      showToast('✅ '+r.msg);
      $('fine-amt').value='';
      loadFineLog(); // ★ 저장 후 즉시 새로고침
    } else {
      alert(r.msg);
    }
  })
  .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
  .chargeFine(_cc,sno,reason,amt);
}

var _fineLogData = [];

function loadFineLog(){
  var tb=$('fine-log-tbody');
  var cnt=$('fine-log-cnt');
  if(tb) tb.innerHTML='<tr><td colspan="6" class="empty-msg">⏳ 불러오는 중...</td></tr>';
  var targetCC=_cc||_adminCC;
  if(!targetCC){
    if(tb) tb.innerHTML='<tr><td colspan="6" class="empty-msg">학급 코드가 없습니다.</td></tr>';
    return;
  }
  google.script.run
    .withSuccessHandler(function(r){
      if(!r.success){
        if(tb) tb.innerHTML='<tr><td colspan="6" class="empty-msg">오류: '+r.msg+'</td></tr>';
        return;
      }
      _fineLogData=r.list||[];
      if(cnt) cnt.textContent=_fineLogData.length+'건';
      if(!_fineLogData.length){
        if(tb) tb.innerHTML='<tr><td colspan="6" class="empty-msg">벌금 내역이 없습니다.</td></tr>';
        return;
      }
      renderFineLog();
    })
    .withFailureHandler(function(err){
      if(tb) tb.innerHTML='<tr><td colspan="6" class="empty-msg">오류: '+err.message+'</td></tr>';
    })
    .getAllFines(targetCC);
}

function renderFineLog(){
  var tb=$('fine-log-tbody'); if(!tb) return;
  var h='';
  _fineLogData.forEach(function(item, idx){
    h+='<tr id="fine-row-'+idx+'">';
    // 날짜
    h+='<td class="td" style="white-space:nowrap;font-size:12px;">'+esc(item.date)+'</td>';
    // 번호
    h+='<td><span class="no-bdg">'+esc(item.sno)+'</span></td>';
    // 이름
    h+='<td style="font-weight:600;color:#1E293B;">'+esc(item.name)+'</td>';
    // 사유 (뷰/편집 전환)
    h+='<td>';
    h+='  <div id="fine-view-'+idx+'" style="font-size:13px;color:#475569;">'+esc(item.reason)+'</div>';
    h+='  <div id="fine-edit-'+idx+'" style="display:none;">';
    h+='    <input type="text" id="fine-input-'+idx+'" value="'+esc(item.reason)+'"';
    h+='      style="width:100%;padding:5px 8px;border:1.5px solid #C4B5FD;border-radius:8px;font-size:13px;font-family:Pretendard,sans-serif;outline:none;">';
    h+='  </div>';
    h+='</td>';
    // 금액
    h+='<td class="tm" style="font-weight:700;text-align:right;white-space:nowrap;">-'+Number(item.expense).toLocaleString()+' 머니</td>';
    // 관리
    h+='<td>';
    h+='  <div id="fine-btn-view-'+idx+'" style="display:flex;gap:4px;">';
    h+='    <button onclick="startFineEdit('+idx+')" title="수정"';
    h+='      style="background:#EFF6FF;color:#3B82F6;border:1px solid #BFDBFE;padding:5px 7px;border-radius:7px;font-size:11px;cursor:pointer;">✏️</button>';
    h+='    <button onclick="doDeleteFine('+idx+')" title="삭제"';
    h+='      style="background:#FFF5F5;color:#EF4444;border:1px solid #FECACA;padding:5px 7px;border-radius:7px;font-size:11px;cursor:pointer;">🗑️</button>';
    h+='  </div>';
    h+='  <div id="fine-btn-edit-'+idx+'" style="display:none;gap:4px;">';
    h+='    <button onclick="saveFineEdit('+idx+')"';
    h+='      style="background:#10B981;color:white;border:none;padding:5px 8px;border-radius:7px;font-size:11px;cursor:pointer;font-weight:700;">✓</button>';
    h+='    <button onclick="cancelFineEdit('+idx+')"';
    h+='      style="background:#F1F5F9;color:#64748B;border:none;padding:5px 8px;border-radius:7px;font-size:11px;cursor:pointer;">✕</button>';
    h+='  </div>';
    h+='</td>';
    h+='</tr>';
  });
  tb.innerHTML=h;
}

function startFineEdit(idx){
  $('fine-view-'+idx).style.display='none';
  $('fine-edit-'+idx).style.display='block';
  $('fine-btn-view-'+idx).style.display='none';
  $('fine-btn-edit-'+idx).style.display='flex';
  var inp=$('fine-input-'+idx); if(inp) inp.focus();
}

function cancelFineEdit(idx){
  $('fine-view-'+idx).style.display='block';
  $('fine-edit-'+idx).style.display='none';
  $('fine-btn-view-'+idx).style.display='flex';
  $('fine-btn-edit-'+idx).style.display='none';
  // 원래 값 복원
  var inp=$('fine-input-'+idx);
  if(inp && _fineLogData[idx]) inp.value=_fineLogData[idx].reason;
}

function saveFineEdit(idx){
  var inp=$('fine-input-'+idx);
  var newReason=(inp?inp.value:'').trim();
  if(!newReason) return alert('사유를 입력해 주세요.');
  var item=_fineLogData[idx]; if(!item) return;
  var targetCC=_cc||_adminCC;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);
      if(r.success){
        _fineLogData[idx].reason=newReason;
        _fineLogData[idx].memo='[벌금] '+newReason;
        cancelFineEdit(idx);
        $('fine-view-'+idx).textContent=newReason;
      }
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .editFineReason(targetCC, item.rowNo, newReason);
}

function doDeleteFine(idx){
  var item=_fineLogData[idx]; if(!item) return;
  if(!confirm(
    '[벌금 취소 확인]\n\n'+
    '학생: '+item.name+' ('+item.sno+'번)\n'+
    '사유: '+item.reason+'\n'+
    '금액: '+Number(item.expense).toLocaleString()+' 머니\n\n'+
    '⚠️ 삭제 시 벌금이 환불되고 신용점수 +5점이 복원됩니다.\n'+
    '계속하시겠습니까?'
  )) return;
  var targetCC=_cc||_adminCC;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      showToast(r.success?'🗑️ '+r.msg:'⚠️ '+r.msg);
      if(r.success) loadFineLog();
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .deleteFineRecord(targetCC, item.rowNo);
}

// ============================================================
// 복권
// ============================================================
function doLottery(){
  var amt=$('lottery-amt').value;
  if(!amt||amt<=0)return alert('금액을 입력해 주세요.');
  google.script.run.withSuccessHandler(function(r){
    if(r.success){
      var box=$('lottery-result-box');box.style.display='block';
      var emoji=r.prize>0?(r.result.includes('1등')?'🎉':r.result.includes('2등')?'🎊':'🙂'):'😢';
      $('lottery-emoji').textContent=emoji;$('lottery-text').textContent=r.result;
      $('lottery-sub').textContent=r.prize>0?'당첨금: '+Number(r.prize).toLocaleString()+' 머니 → 카드 입금':'아쉽지만 다음 기회를 노려보세요!';
      $('s-card').textContent=Number(r.newCard).toLocaleString()+' 머니';
      var bank=parseInt(($('s-bank').textContent||'0').replace(/[^0-9]/g,''))||0;
      $('s-total').textContent=(Number(r.newCard)+bank).toLocaleString()+' 머니';
    } else alert(r.msg);
  }).buyLottery(_cc,_sno,amt);
}

// ============================================================
// 부동산
// ============================================================
function realtorTab(id,el){
  document.querySelectorAll('.panel-tab').forEach(function(t){t.classList.remove('act')});
  document.querySelectorAll('#realtor-panel-wrap .panel-content').forEach(function(c){c.classList.remove('act')});
  el.classList.add('act');$(id).classList.add('act');
  if(id==='re-market')loadRealEstate();
}

function loadRealEstate(){
  google.script.run.withSuccessHandler(function(r){
    var tb=$('re-tbody');
    if(!r.success||!r.list.length){tb.innerHTML='<tr><td colspan="8" class="empty-msg">등록된 매물이 없습니다.</td></tr>';return;}
    var h='';
    r.list.forEach(function(re){
      var canBuy=(re.status==='매물');
      h+='<tr><td>'+esc(re.assetNo)+'</td><td><strong>'+esc(re.name)+'</strong></td><td>'+esc(re.type)+'</td>'+
        '<td>'+esc(re.ownerName||'국가')+'</td><td><strong>'+Number(re.price).toLocaleString()+'</strong></td>'+
        '<td>'+Number(re.rent).toLocaleString()+'</td>'+
        '<td><span style="color:'+(re.status==='매물'?'var(--green)':'var(--gray)')+';font-weight:600;">'+esc(re.status)+'</span></td>'+
        '<td>'+(canBuy&&_myJob!=='부동산 중개인'?'<button class="btn btn-sm btn-green" onclick="doBuyRE(\''+re.assetNo+'\')"><i class="fa-solid fa-cart-shopping"></i> 구매</button>':'<span style="font-size:12px;color:var(--gray);">'+(re.status==='소유'?'소유됨':'중개인')+'</span>')+'</td></tr>';
    });
    tb.innerHTML=h;
  }).getRealEstateList(_cc||_adminCC);
}

function doAddRealEstate(){
  var no=$('re-no').value,name=$('re-name').value,type=$('re-type').value,price=$('re-price').value,rent=$('re-rent').value;
  if(!no||!name||!price)return alert('자산번호, 이름, 가격을 입력해 주세요.');
  google.script.run.withSuccessHandler(function(r){
    showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);
    if(r.success){$('re-no').value='';$('re-name').value='';$('re-price').value='';loadRealEstate();}
  }).addRealEstate(_cc,no,name,type,price,rent);
}

function doBuyRE(assetNo){
  if(!confirm('이 부동산을 구매하겠습니까?'))return;
  google.script.run.withSuccessHandler(function(r){
    if(r.success){showToast('✅ '+r.msg);$('s-card').textContent=Number(r.newCard).toLocaleString()+' 머니';loadRealEstate();}
    else alert(r.msg);
  }).buyRealEstate(_cc,_sno,assetNo);
}

// ============================================================
// 신용등급관리위원장
// ============================================================
var _creditPendingMap = {};

function loadCreditMgrList(){
  var grid = $('credit-mgr-grid');
  if(grid) grid.innerHTML='<div style="text-align:center;padding:40px;color:#aaa;grid-column:1/-1;">⏳ 불러오는 중...</div>';
  var targetCC = _cc || _adminCC;

  google.script.run
    .withSuccessHandler(function(mapResult){
      if(mapResult.success) _creditPendingMap = mapResult.map || {};
      if(_stuList.length > 0){
        renderCreditMgrGrid(_stuList);
      } else {
        google.script.run
          .withSuccessHandler(function(r){
            if(r.success){ _stuList = r.list; renderCreditMgrGrid(r.list); }
          })
          .getStudentList(targetCC);
      }
    })
    .getCreditPendingMap(targetCC);
}

function doCreditMgrAdj(sno){
  var delta=$('cmgr-delta-'+sno).value;
  if(!delta)return showToast('변화량을 입력해 주세요.');
  google.script.run.withSuccessHandler(function(r){
    showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);if(r.success)loadCreditMgrList();
  }).adjustCredit(_cc,sno,delta,'신용위원장조정');
}

// ── 신용위원회 패널 렌더링 ──
function renderCreditMgrGrid(list){
  var grid = $('credit-mgr-grid');
  if(!grid||!list||!list.length){
    if(grid) grid.innerHTML='<div style="text-align:center;padding:40px;color:#CBD5E1;grid-column:1/-1;">학생 데이터가 없습니다.</div>';
    return;
  }
  var pendingCount = Object.keys(_creditPendingMap).length;
  var badge = $('credit-pending-count');
  if(badge){
    if(pendingCount>0){ badge.style.display='inline-block'; badge.textContent='대기 '+pendingCount+'건'; }
    else { badge.style.display='none'; }
  }
  // 신용점수 내림차순 정렬
  var sorted = list.slice().sort(function(a,b){ return (b.credit||0)-(a.credit||0); });
  var h = '';
  sorted.forEach(function(s){
    var sno     = String(s.studentNo);
    var g       = creditGrade(s.credit||0);
    var pending = _creditPendingMap[sno];
    var hasPending    = !!pending;
    var pendingDelta  = hasPending ? pending.delta  : 0;
    var pendingStatus = hasPending ? pending.status : '';

    var gradeColor = s.credit>=80?'#10B981':s.credit>=60?'#3B82F6':s.credit>=40?'#F59E0B':'#EF4444';
    var gradeBg    = s.credit>=80?'#ECFDF5':s.credit>=60?'#EFF6FF':s.credit>=40?'#FFFBEB':'#FFF5F5';

    h += '<div style="background:white;border:1.5px solid #E2E8F0;border-radius:18px;padding:20px;box-shadow:0 3px 12px rgba(0,0,0,0.05);position:relative;overflow:hidden;font-family:Pretendard,sans-serif;">';

    // 대기/반려 배지 (상단 바)
    if(hasPending){
      var badgeBg   = pendingStatus==='반려' ? '#EF4444' : '#F59E0B';
      var badgeText = (pendingDelta>0?'+':'')+pendingDelta+'점 '+(pendingStatus==='반려'?'반려됨 — 재보고 대기중':'대기중');
      h += '<div style="position:absolute;top:0;left:0;right:0;background:'+badgeBg+';color:white;text-align:center;font-size:12px;font-weight:700;padding:6px;letter-spacing:0.3px;">⏳ '+badgeText+'</div>';
      h += '<div style="margin-top:26px;"></div>';
    }

    // 학생 정보
    h += '<div style="text-align:center;margin-bottom:12px;">';
    h += '  <div style="font-family:Jua,sans-serif;font-size:20px;color:#1E293B;margin-bottom:2px;">'+esc(s.name||'')+'</div>';
    h += '  <div style="font-size:12px;color:#94A3B8;">'+sno+'번 &nbsp;·&nbsp; '+esc(s.job||'국민')+'</div>';
    h += '</div>';

    // 신용등급 크게 표시
    h += '<div style="background:'+gradeBg+';border-radius:14px;padding:16px;text-align:center;margin-bottom:14px;">';
    h += '  <div style="font-family:Jua,sans-serif;font-size:34px;color:'+gradeColor+';line-height:1;">'+g.label+'</div>';
    h += '  <div style="font-size:18px;font-weight:700;color:'+gradeColor+';margin-top:4px;">'+(s.credit||0)+'점</div>';
    h += '</div>';

    // 빠른 버튼 4개
    h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:10px;">';
    [{v:-5,lbl:'-5'},{v:-1,lbl:'-1'},{v:1,lbl:'+1'},{v:5,lbl:'+5'}].forEach(function(btn){
      var isPlus = btn.v > 0;
      var bg  = isPlus?'#EFF6FF':'#FFF5F5';
      var col = isPlus?'#3B82F6':'#EF4444';
      var bdr = isPlus?'#BFDBFE':'#FECACA';
      h += '<button onclick="adjustCreditInput(\'cmgr-delta-'+sno+'\','+btn.v+')"';
      h += ' style="background:'+bg+';color:'+col+';border:1.5px solid '+bdr+';padding:9px 0;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;font-family:Pretendard,sans-serif;">'+btn.lbl+'</button>';
    });
    h += '</div>';

    // 직접 입력
    h += '<input type="number" id="cmgr-delta-'+sno+'" placeholder="직접 입력 (예: +3, -2)"';
    h += ' style="width:100%;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:10px;font-size:14px;text-align:center;font-family:Pretendard,sans-serif;outline:none;box-sizing:border-box;margin-bottom:10px;">';

    // 저장 버튼
    h += '<button onclick="saveCreditMgr(\''+sno+'\',\''+esc(s.name||'')+'\')"';
    h += ' style="width:100%;background:#7C3AED;color:white;border:none;padding:11px;border-radius:11px;font-size:14px;font-weight:700;cursor:pointer;font-family:Pretendard,sans-serif;">';
    h += '<i class="fa-solid fa-floppy-disk"></i> 저장';
    h += '</button>';

    h += '</div>';
  });
  grid.innerHTML = h;
}

function adjustCreditInput(inputId, delta){
  var el=$(inputId); if(!el) return;
  var cur=parseInt(el.value)||0; el.value=cur+delta;
}

function saveCreditMgr(sno, name){
  var el=$('cmgr-delta-'+sno); if(!el) return;
  var delta=parseInt(el.value)||0;
  if(delta===0) return showToast('⚠️ 변화량을 입력해 주세요.');
  var targetCC=_cc||_adminCC;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      if(r.success){
        showToast('✅ '+(name||sno+' 번')+' '+(delta>0?'+':'')+delta+'점 저장 — 대기중');
        _creditPendingMap[String(sno)] = { delta: delta, status: '대기' };
        el.value='';
        renderCreditMgrGrid(_stuList);
      } else { showToast('⚠️ '+r.msg); }
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .savePendingCredit(targetCC, sno, name, delta);
}

function submitCreditReportUI(){
  var pendingCount=Object.keys(_creditPendingMap).length;
  if(pendingCount===0) return showToast('⚠️ 보고할 내역이 없습니다.');
  if(!confirm('대통령 정기 보고를 제출하시겠습니까?\n\n대기중인 '+pendingCount+'건이 마스터 관리로 전달됩니다.')) return;
  var targetCC=_cc||_adminCC;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      if(r.success){
        showToast('✅ '+r.msg);
        _creditPendingMap={};
        renderCreditMgrGrid(_stuList);
      } else { showToast('⚠️ '+r.msg); }
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .submitCreditReport(targetCC);
}

// ── 마스터 신용 어드민 탭 ──
function creditAdminTab(mode, el){
  // 모든 탭 버튼 비활성화
  ['cad-tab1','cad-tab2','cad-tab3'].forEach(function(id){
    var t=$(id);
    if(t){ t.style.background='transparent'; t.style.color='#64748B'; t.style.boxShadow='none'; }
  });

  // ★ 모든 패널 ID를 명시적으로 숨김 (querySelectorAll 방식 안 씀)
  ['cad-panel-report','cad-panel-manual','cad-panel-grade'].forEach(function(id){
    var p=$(id); if(p) p.style.display='none';
  });

  // 선택한 탭 버튼 활성화
  if(el){
    el.style.background='white';
    el.style.color='#7C3AED';
    el.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)';
  }

  // 선택한 패널만 표시
  var panel=$('cad-panel-'+mode);
  if(panel) panel.style.display='block';

  if(mode==='report') loadCreditReportList();
  if(mode==='manual') renderCreditTable();
  if(mode==='grade')  loadCreditGradeSettings();
}

function loadCreditReportList(){
  var container=$('credit-report-container'); if(!container) return;
  container.innerHTML='<div style="text-align:center;padding:40px;color:#aaa;font-family:Pretendard,sans-serif;">⏳ 불러오는 중...</div>';
  var targetCC=_adminCC||_cc;
  google.script.run
    .withSuccessHandler(function(r){
      if(!r.success){ container.innerHTML='<div class="empty-msg">오류: '+r.msg+'</div>'; return; }
      var badge=$('cad-pending-badge'); if(badge) badge.textContent=r.list.length;
      renderCreditReportList(r.list);
    })
    .getPendingCredits(targetCC,'보고');
}

function renderCreditReportList(list){
  var container=$('credit-report-container'); if(!container) return;
  if(!list||!list.length){
    container.innerHTML='<div class="empty-msg" style="padding:40px;">보고된 신용 조정 내역이 없습니다.</div>';
    return;
  }
  var h='';
  list.forEach(function(item){
    var isPlus    = item.delta>0;
    var deltaColor= isPlus?'#10B981':'#EF4444';
    var deltaText = (isPlus?'+':'')+item.delta+'점';
    var g         = creditGrade(item.currentCredit||0);
    var afterCredit= Math.max(0,Math.min(100,(item.currentCredit||0)+item.delta));
    var afterG    = creditGrade(afterCredit);

    h += '<div style="background:white;border:1.5px solid #E2E8F0;border-radius:14px;margin-bottom:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);font-family:Pretendard,sans-serif;">';
    h += '<div style="background:linear-gradient(90deg,#7C3AED,#9333EA);height:4px;"></div>';
    h += '<div style="padding:18px 22px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">';
    h += '  <div>';
    h += '    <div style="font-family:Jua,sans-serif;font-size:19px;color:#1E293B;margin-bottom:6px;">';
    h += esc(item.name)+'&nbsp;<span style="font-size:14px;color:#94A3B8;">'+item.studentNo+'번</span></div>';
    h += '    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
    h += '      <span style="background:#F1F5F9;color:#475569;font-size:13px;font-weight:600;padding:4px 12px;border-radius:20px;">현재 '+g.label+' ('+item.currentCredit+'점)</span>';
    h += '      <i class="fa-solid fa-arrow-right" style="color:#94A3B8;"></i>';
    h += '      <span style="background:'+(isPlus?'#ECFDF5':'#FFF5F5')+';color:'+deltaColor+';font-size:13px;font-weight:700;padding:4px 12px;border-radius:20px;">'+deltaText+' 후 '+afterG.label+' ('+afterCredit+'점)</span>';
    h += '    </div>';
    h += '    <div style="font-size:12px;color:#94A3B8;margin-top:5px;">보고일: '+esc(item.date||'')+'</div>';
    h += '  </div>';
    h += '  <div style="display:flex;gap:8px;">';
    h += '    <button onclick="approveCreditItem('+item.rowNo+')" style="background:#10B981;color:white;border:none;padding:10px 20px;font-size:14px;font-weight:700;border-radius:10px;cursor:pointer;font-family:Pretendard,sans-serif;">✅ 승인</button>';
    h += '    <button onclick="rejectCreditItem('+item.rowNo+')" style="background:#EF4444;color:white;border:none;padding:10px 20px;font-size:14px;font-weight:700;border-radius:10px;cursor:pointer;font-family:Pretendard,sans-serif;">❌ 반려</button>';
    h += '  </div>';
    h += '</div></div>';
  });
  container.innerHTML=h;
}

function approveCreditItem(rowNo){
  if(!confirm('이 신용점수 조정을 승인하시겠습니까?')) return;
  var targetCC=_adminCC||_cc;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){ hideLoading(); showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg); if(r.success){ loadCreditReportList(); refreshMasterPendingBadges(); } })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .approvePendingCredit(targetCC, rowNo);
}

function rejectCreditItem(rowNo){
  if(!confirm('이 신용점수 조정을 반려하시겠습니까?\n반려 시 신용위원장 패널에 다시 표시됩니다.')) return;
  var targetCC=_adminCC||_cc;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){ hideLoading(); showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg); if(r.success){ loadCreditReportList(); refreshMasterPendingBadges(); } })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .rejectPendingCredit(targetCC, rowNo);
}

function approveAllCreditReport(){
  if(!confirm('보고된 모든 신용점수 조정을 일괄 승인하시겠습니까?')) return;
  var targetCC=_adminCC||_cc;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      if(!r.success||!r.list||!r.list.length){ hideLoading(); showToast('⚠️ 승인할 항목이 없습니다.'); return; }
      var rowNos=r.list.map(function(item){ return item.rowNo; });
      approveAllSeq(targetCC, rowNos, 0, function(){
        hideLoading(); showToast('✅ 전체 승인 완료!'); loadCreditReportList(); refreshMasterPendingBadges();
      });
    })
    .getPendingCredits(targetCC,'보고');
}

function approveAllSeq(cc, rowNos, idx, done){
  if(idx>=rowNos.length){ done(); return; }
  google.script.run
    .withSuccessHandler(function(){ approveAllSeq(cc,rowNos,idx+1,done); })
    .approvePendingCredit(cc, rowNos[idx]);
}

// ── 앱 전체 설정 로드 (로그인 시 1회) ──
function loadAppSettings(classCode){
  if(!classCode) return;
  google.script.run
    .withSuccessHandler(function(r){
      if(r.success && r.settings && r.settings.length) _creditGradeSettings=r.settings;
    })
    .getCreditGradeSettings(classCode);
}

// ── 등급 급간 설정 불러오기 (설정 탭 진입 시) ──
function loadCreditGradeSettings(){
  var targetCC=_adminCC||_cc; if(!targetCC) return;
  google.script.run
    .withSuccessHandler(function(r){
      if(r.success && r.settings && r.settings.length) _creditGradeSettings=r.settings;
      renderGradeSettingsUI();
    })
    .getCreditGradeSettings(targetCC);
}

// ── 등급 급간 UI 렌더링 ──
var _gradeCardStyles=[
  {bg:'linear-gradient(135deg,#FFFBEB,#FEF3C7)',border:'#FDE68A',accent:'#D97706'}, // 1
  {bg:'linear-gradient(135deg,#F5F3FF,#EDE9FE)',border:'#C4B5FD',accent:'#7C3AED'}, // 2
  {bg:'linear-gradient(135deg,#EFF6FF,#DBEAFE)',border:'#93C5FD',accent:'#2563EB'}, // 3
  {bg:'linear-gradient(135deg,#ECFDF5,#D1FAE5)',border:'#6EE7B7',accent:'#059669'}, // 4
  {bg:'linear-gradient(135deg,#F0FDF4,#DCFCE7)',border:'#86EFAC',accent:'#16A34A'}, // 5
  {bg:'linear-gradient(135deg,#FEFCE8,#FEF9C3)',border:'#FDE047',accent:'#CA8A04'}, // 6
  {bg:'linear-gradient(135deg,#FFF7ED,#FFEDD5)',border:'#FDBA74',accent:'#EA580C'}, // 7
  {bg:'linear-gradient(135deg,#FEF2F2,#FEE2E2)',border:'#FCA5A5',accent:'#DC2626'}, // 8
  {bg:'linear-gradient(135deg,#FDF4FF,#FAE8FF)',border:'#D8B4FE',accent:'#9333EA'}, // 9
  {bg:'linear-gradient(135deg,#F8FAFC,#F1F5F9)',border:'#CBD5E1',accent:'#475569'}  // 10
];

function renderGradeSettingsUI(){
  var container=$('grade-settings-grid'); if(!container) return;
  var sorted=_creditGradeSettings.slice().sort(function(a,b){ return a.grade-b.grade; });
  var h='';
  sorted.forEach(function(g,idx){
    var c=_gradeCardStyles[idx]||_gradeCardStyles[_gradeCardStyles.length-1];
    var isLast=(g.grade===10);
    h+='<div style="background:'+c.bg+';border:2px solid '+c.border+';border-radius:16px;padding:16px;text-align:center;transition:transform 0.2s;" onmouseover="this.style.transform=\'translateY(-3px)\'" onmouseout="this.style.transform=\'none\'">';
    // 이모티콘 미리보기
    h+='<div id="gp-emoji-'+g.grade+'" style="font-size:36px;margin-bottom:6px;line-height:1.2;">'+g.emoji+'</div>';
    // 등급명
    h+='<div style="font-family:Jua,sans-serif;font-size:16px;color:'+c.accent+';margin-bottom:12px;font-weight:900;">'+g.grade+'등급</div>';
    // 이모티콘 입력
    h+='<div style="margin-bottom:10px;">';
    h+='  <div style="font-size:10px;font-weight:700;color:'+c.accent+';margin-bottom:4px;letter-spacing:0.3px;">이모티콘</div>';
    h+='  <input type="text" id="gc-emoji-'+g.grade+'" value="'+g.emoji+'" maxlength="4"';
    h+='    oninput="updateEmojiPreview('+g.grade+',this.value)"';
    h+='    style="width:100%;padding:8px 6px;border:1.5px solid '+c.border+';border-radius:9px;font-size:22px;text-align:center;font-family:Pretendard,sans-serif;outline:none;box-sizing:border-box;background:rgba(255,255,255,0.85);">';
    h+='</div>';
    // 최소 점수
    h+='<div>';
    h+='  <div style="font-size:10px;font-weight:700;color:'+c.accent+';margin-bottom:4px;letter-spacing:0.3px;">최소 점수</div>';
    h+='  <div style="display:flex;align-items:center;gap:4px;justify-content:center;">';
    if(isLast){
      h+='    <input type="number" value="0" disabled style="width:55px;padding:7px 4px;border:1.5px solid '+c.border+';border-radius:9px;font-size:15px;font-weight:700;text-align:center;font-family:Pretendard,sans-serif;background:#F1F5F9;color:#94A3B8;">';
    } else {
      h+='    <input type="number" id="gc-score-'+g.grade+'" value="'+g.minScore+'" min="0" max="100"';
      h+='      style="width:55px;padding:7px 4px;border:1.5px solid '+c.border+';border-radius:9px;font-size:15px;font-weight:700;text-align:center;font-family:Pretendard,sans-serif;outline:none;background:rgba(255,255,255,0.9);">';
    }
    h+='    <span style="font-size:11px;color:'+c.accent+';font-weight:600;">점~</span>';
    h+='  </div>';
    h+='</div>';
    h+='</div>';
  });
  container.innerHTML=h;
}

function updateEmojiPreview(grade, val){
  var p=$('gp-emoji-'+grade); if(p) p.textContent=val||'?';
}

// ── 등급 설정 저장 ──
function saveCreditGradeSettings(){
  var settings=[];
  for(var i=1; i<=10; i++){
    var emojiEl=$('gc-emoji-'+i);
    var scoreEl=$('gc-score-'+i);
    settings.push({
      grade:    i,
      minScore: i===10 ? 0 : (parseInt((scoreEl||{}).value)||0),
      emoji:    ((emojiEl||{}).value||'⭐').trim()
    });
  }
  // 점수 내림차순 검증
  var valid=true;
  for(var j=0; j<settings.length-1; j++){
    if(settings[j].minScore <= settings[j+1].minScore){
      valid=false; break;
    }
  }
  if(!valid) return alert('⚠️ 등급 점수는 1등급부터 내림차순이어야 합니다.\n예: 1등급(90) > 2등급(80) > ... > 9등급(10) > 10등급(0)');
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);
      if(r.success){ _creditGradeSettings=settings; }
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .setCreditGradeSettings(_adminCC, JSON.stringify(settings));
}

// ── 기본값 초기화 ──
function resetGradeSettings(){
  if(!confirm('기본 등급 설정으로 초기화하시겠습니까?')) return;
  _creditGradeSettings=[
    {grade:1,minScore:90,emoji:'👑'},{grade:2,minScore:80,emoji:'💎'},
    {grade:3,minScore:70,emoji:'🏆'},{grade:4,minScore:60,emoji:'⭐'},
    {grade:5,minScore:50,emoji:'🌟'},{grade:6,minScore:40,emoji:'🌿'},
    {grade:7,minScore:30,emoji:'🌱'},{grade:8,minScore:20,emoji:'🍂'},
    {grade:9,minScore:10,emoji:'🌧️'},{grade:10,minScore:0,emoji:'⚡'}
  ];
  renderGradeSettingsUI();
  showToast('✅ 기본값으로 초기화되었습니다. 저장 버튼을 눌러 적용하세요.');
}

function loadTaxStatsStu(){
  var sel=$('to-stu');
  if(!sel) return;
  sel.innerHTML='<option value="">-- 학생 선택 --</option>';
  google.script.run.withSuccessHandler(function(r){
    if(!r.success) return;
    r.list.forEach(function(s){
      var o=document.createElement('option');
      o.value=s.studentNo;
      o.textContent=s.studentNo+'번 '+(s.name||'');
      sel.appendChild(o);
    });
    loadTaxStats();
  }).getStudentList(_cc);
}

function loadTaxStats(){
  google.script.run.withSuccessHandler(function(r){
    var tb=$('to-stats-tbody');
    if(!r.success) return;
    var h='';
    r.students.forEach(function(s){
      h+='<tr><td><span class="no-bdg">'+s.no+'</span></td>'+
        '<td>'+esc(s.name)+'</td>'+
        '<td class="ac">'+s.card.toLocaleString()+'</td>'+
        '<td class="bc">'+s.bank.toLocaleString()+'</td>'+
        '<td><strong>'+s.total.toLocaleString()+'</strong></td></tr>';
    });
    tb.innerHTML=h||'<tr><td colspan="5" class="empty-msg">데이터 없음</td></tr>';
  }).getClassStats(_cc);
}

function doTaxBulkStu(){
  var rate=$('to-rate').value,memo=$('to-memo').value;
  if(!rate||rate<=0)return alert('세율을 입력해 주세요.');
  if(!confirm('전체 학생에게 세율 '+rate+'% 세금을 부과합니까?'))return;
  google.script.run.withSuccessHandler(function(r){
    showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);
  }).chargeTaxBulk(_cc,rate,memo||'세금 징수');
}

function doTaxIndStu(){
  var sno=$('to-stu').value,amt=$('to-amt').value,memo=$('to-ind-memo').value;
  if(!sno)return alert('학생을 선택해 주세요.');
  if(!amt||amt<=0)return alert('금액을 입력해 주세요.');
  google.script.run.withSuccessHandler(function(r){
    showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);
  }).chargeTax(_cc,sno,memo||'세금',amt);
}

// ============================================================
// 재산조사국장
// ============================================================
function loadAssetInspect(){
  var container=$('ai-cards-container');
  if(container) container.innerHTML='<div class="empty-msg" style="grid-column:1/-1;">⏳ 불러오는 중...</div>';

  google.script.run.withSuccessHandler(function(r){
    if(!r.success) return;

    // 요약 카드 업데이트
    var totalAll = r.totalCard + r.totalBank;
    $('ai-total').textContent = totalAll.toLocaleString()+' 머니';
    $('ai-card').textContent  = r.totalCard.toLocaleString()+' 머니';
    $('ai-bank').textContent  = r.totalBank.toLocaleString()+' 머니';

    if(!container) return;
    if(!r.students||!r.students.length){
      container.innerHTML='<div class="empty-msg" style="grid-column:1/-1;">학생 데이터가 없습니다.</div>';
      return;
    }

    // ★ 3열 그리드 적용
    container.style.cssText='display:grid;grid-template-columns:repeat(3,1fr);gap:14px;';

    var maxTotal = (r.students[0]&&r.students[0].total>0) ? r.students[0].total : 1;

    var h='';
    r.students.forEach(function(s,i){
      var rank  = i+1;
      var rc    = rank===1?'gold':rank===2?'silver':rank===3?'bronze':'';
      var total = (s.card||0)+(s.bank||0);
      var g     = creditGrade(s.credit||0);

      // 비율 계산
      var cardPct     = Math.round((s.card||0)/maxTotal*100);
      var bankPct     = Math.round((s.bank||0)/maxTotal*100);
      var cardOfTotal = total>0 ? Math.round((s.card||0)/total*100) : 0;
      var bankOfTotal = total>0 ? Math.round((s.bank||0)/total*100) : 0;

      var gradeColor = s.credit>=80?'#10B981':s.credit>=60?'#3B82F6':s.credit>=40?'#F59E0B':'#EF4444';
      var gradeBg    = s.credit>=80?'#ECFDF5':s.credit>=60?'#EFF6FF':s.credit>=40?'#FFFBEB':'#FFF5F5';

      h += '<div style="background:white;border:1.5px solid #E2E8F0;border-radius:16px;padding:18px;box-shadow:0 3px 10px rgba(0,0,0,0.05);font-family:Pretendard,sans-serif;transition:transform 0.2s;" onmouseover="this.style.transform=\'translateY(-3px)\'" onmouseout="this.style.transform=\'none\'">';

      // ── 상단: 순위 + 이름 + 직업 ──
      h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">';
      h += '  <span class="rank-badge '+rc+'" style="width:28px;height:28px;font-size:13px;flex-shrink:0;">'+rank+'</span>';
      h += '  <div style="min-width:0;">';
      h += '    <div style="font-family:Jua,sans-serif;font-size:17px;color:#1E293B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(s.name||'')+'</div>';
      h += '    <div style="font-size:11px;color:#94A3B8;">'+s.no+'번 &nbsp;·&nbsp; '+esc(s.job||'국민')+'</div>';
      h += '  </div>';
      // 신용등급 우측
      h += '  <div style="margin-left:auto;background:'+gradeBg+';border-radius:10px;padding:5px 9px;text-align:center;flex-shrink:0;">';
      h += '    <div style="font-size:10px;color:'+gradeColor+';font-weight:600;">신용</div>';
      h += '    <div style="font-family:Jua,sans-serif;font-size:14px;color:'+gradeColor+';line-height:1.1;">'+g.label+'</div>';
      h += '  </div>';
      h += '</div>';

      // ── 전체 자산 강조 ──
      h += '<div style="background:linear-gradient(135deg,#1E293B,#334155);border-radius:12px;padding:12px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">';
      h += '  <div style="font-size:12px;color:#94A3B8;">👑 전체 자산</div>';
      h += '  <div style="font-family:Jua,sans-serif;font-size:20px;color:white;">'+total.toLocaleString()+'<span style="font-size:12px;color:#94A3B8;margin-left:3px;">머니</span></div>';
      h += '</div>';

      // ── 카드 잔액 바 ──
      h += '<div style="margin-bottom:10px;">';
      h += '  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
      h += '    <span style="font-size:12px;font-weight:700;color:#3B82F6;">💳 카드</span>';
      h += '    <span style="font-size:13px;font-weight:700;color:#3B82F6;">'+Number(s.card||0).toLocaleString()+' 머니</span>';
      h += '  </div>';
      h += '  <div style="background:#EFF6FF;border-radius:20px;height:9px;overflow:hidden;">';
      h += '    <div style="height:100%;background:linear-gradient(90deg,#3B82F6,#60A5FA);border-radius:20px;width:'+cardPct+'%;transition:width 0.6s;"></div>';
      h += '  </div>';
      h += '  <div style="font-size:10px;color:#94A3B8;text-align:right;margin-top:2px;">전체의 '+cardOfTotal+'%</div>';
      h += '</div>';

      // ── 은행 예금 바 ──
      h += '<div style="margin-bottom:12px;">';
      h += '  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
      h += '    <span style="font-size:12px;font-weight:700;color:#10B981;">🏦 은행</span>';
      h += '    <span style="font-size:13px;font-weight:700;color:#10B981;">'+Number(s.bank||0).toLocaleString()+' 머니</span>';
      h += '  </div>';
      h += '  <div style="background:#ECFDF5;border-radius:20px;height:9px;overflow:hidden;">';
      h += '    <div style="height:100%;background:linear-gradient(90deg,#10B981,#34D399);border-radius:20px;width:'+bankPct+'%;transition:width 0.6s;"></div>';
      h += '  </div>';
      h += '  <div style="font-size:10px;color:#94A3B8;text-align:right;margin-top:2px;">전체의 '+bankOfTotal+'%</div>';
      h += '</div>';

      // ── 구성 비율 바 (하단) ──
      h += '<div style="display:flex;gap:8px;align-items:center;">';
      h += '  <div style="display:flex;align-items:center;gap:4px;white-space:nowrap;">';
      h += '    <div style="width:9px;height:9px;border-radius:50%;background:#3B82F6;"></div>';
      h += '    <span style="font-size:11px;color:#64748B;">카드 '+cardOfTotal+'%</span>';
      h += '  </div>';
      h += '  <div style="flex:1;background:#E2E8F0;border-radius:20px;height:6px;overflow:hidden;display:flex;">';
      h += '    <div style="height:100%;background:#3B82F6;width:'+cardOfTotal+'%;"></div>';
      h += '    <div style="height:100%;background:#10B981;width:'+bankOfTotal+'%;"></div>';
      h += '  </div>';
      h += '  <div style="display:flex;align-items:center;gap:4px;white-space:nowrap;">';
      h += '    <div style="width:9px;height:9px;border-radius:50%;background:#10B981;"></div>';
      h += '    <span style="font-size:11px;color:#64748B;">은행 '+bankOfTotal+'%</span>';
      h += '  </div>';
      h += '</div>';

      h += '</div>'; // card end
    });

    container.innerHTML=h;
  }).getClassStats(_cc);
}

// ============================================================
// 통계청장
// ============================================================
var _hwList          = [];
var _hwLocalStatuses = {};
var _hwStudents      = [];

function loadStatsOffice(){
  var container=$('so-hw-container');
  if(container) container.innerHTML='<div class="empty-msg">⏳ 불러오는 중...</div>';
  var targetCC=_cc||_adminCC;

  google.script.run
    .withSuccessHandler(function(r){
      if(!r.success){
        if(container) container.innerHTML='<div class="empty-msg">오류: '+r.msg+'</div>';
        return;
      }
      _hwList=r.hwList||[];
      _hwLocalStatuses={};
      _hwList.forEach(function(hw){
        _hwLocalStatuses[hw.hwId]={};
        for(var sno in (hw.statuses||{})) _hwLocalStatuses[hw.hwId][sno]=hw.statuses[sno];
      });
      if(r.stuList && r.stuList.length) _stuList=r.stuList;
      _hwStudents=(_stuList||[]).slice().sort(function(a,b){ return Number(a.studentNo)-Number(b.studentNo); });
      renderHomeworkPanel();
    })
    .withFailureHandler(function(err){
      if(container) container.innerHTML='<div class="empty-msg">오류: '+err.message+'</div>';
    })
    .getStatsOfficeData(targetCC);
}

// ── 과제 패널 렌더링 ──
function renderHomeworkPanel(){
  var container=$('so-hw-container'); if(!container) return;
  if(!_hwList.length){
    container.innerHTML='<div style="text-align:center;padding:60px;color:#CBD5E1;font-family:Pretendard,sans-serif;font-size:15px;"><div style="font-size:56px;margin-bottom:14px;">📋</div>등록된 과제가 없습니다.<br><br>위의 <strong>항목 추가</strong> 버튼을 눌러 과제를 등록하세요.</div>';
    return;
  }
  var h='';
  _hwList.forEach(function(hw){
    var counts=calcHwCounts(hw.hwId);
    var status = hw.reportStatus || '대기'; // 대기 / 보고 / 승인 / 반려
    var locked = (status==='보고' || status==='승인'); // 수정 불가 여부

    var topColor   = status==='승인' ? '#10B981,#059669'
                    : status==='보고' ? '#F59E0B,#D97706'
                    : status==='반려' ? '#EF4444,#DC2626'
                    : '#06B6D4,#0891B2';
    var borderColor= status==='승인' ? '#A7F3D0'
                    : status==='보고' ? '#FDE68A'
                    : status==='반려' ? '#FECACA'
                    : '#E2E8F0';

    h+='<div style="background:white;border:1.5px solid '+borderColor+';border-radius:18px;margin-bottom:20px;overflow:hidden;box-shadow:0 3px 14px rgba(0,0,0,0.07);font-family:Pretendard,sans-serif;">';
    h+='<div style="background:linear-gradient(90deg,'+topColor+');height:5px;"></div>';
    // 헤더
    h+='<div style="padding:18px 22px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">';
    h+='<div><div style="font-family:Jua,sans-serif;font-size:22px;color:#1E293B;margin-bottom:4px;">📝 '+esc(hw.title)+'</div>';
    h+='<div style="font-size:13px;color:#94A3B8;">📅 '+esc(hw.date)+'</div></div>';
    h+='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
    h+='<span style="background:#ECFDF5;color:#059669;font-size:13px;font-weight:700;padding:5px 13px;border-radius:20px;" id="hw-cnt-O-'+hw.hwId+'">● '+counts.O+'명</span>';
    h+='<span style="background:#FFFBEB;color:#D97706;font-size:13px;font-weight:700;padding:5px 13px;border-radius:20px;" id="hw-cnt-D-'+hw.hwId+'">▲ '+counts.D+'명</span>';
    h+='<span style="background:#FFF5F5;color:#EF4444;font-size:13px;font-weight:700;padding:5px 13px;border-radius:20px;" id="hw-cnt-X-'+hw.hwId+'">✕ '+counts.X+'명</span>';

    if(status==='대기' || status==='반려'){
      h+='<button onclick="submitHwReport(\''+hw.hwId+'\')" style="background:#7C3AED;color:white;border:none;padding:8px 16px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:Pretendard,sans-serif;"><i class="fa-solid fa-file-signature"></i> '+(status==='반려'?'재보고':'대통령 보고')+'</button>';
    } else if(status==='보고'){
      h+='<span style="background:#FEF3C7;color:#D97706;font-size:12px;font-weight:700;padding:6px 14px;border-radius:20px;">⏳ 대통령 결재 대기중</span>';
    } else if(status==='승인'){
      h+='<span style="background:#D1FAE5;color:#059669;font-size:12px;font-weight:700;padding:6px 14px;border-radius:20px;">✅ 결재 완료</span>';
    }
    if(status==='반려'){
      h+='<span style="background:#FEE2E2;color:#DC2626;font-size:12px;font-weight:700;padding:6px 14px;border-radius:20px;">❌ 반려됨</span>';
    }

    if(!locked){
      h+='<button onclick="deleteHwUI(\''+hw.hwId+'\')" style="background:#FFF5F5;color:#EF4444;border:1.5px solid #FECACA;padding:7px 11px;border-radius:9px;font-size:13px;cursor:pointer;">🗑️</button>';
    }
    h+='</div></div>';

    // 학생 그리드
    h+='<div style="padding:4px 22px 20px;border-top:1px solid #F1F5F9;">';
    if(locked){
      h+='<div style="font-size:12px;color:#94A3B8;margin:12px 0 4px;">'+(status==='승인'?'✅ 결재가 완료되어 더 이상 수정할 수 없습니다.':'⏳ 대통령 결재 대기 중에는 수정할 수 없습니다.')+'</div>';
    }
    h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin-top:14px;">';
    _hwStudents.forEach(function(s){
      var sno=String(s.studentNo);
      var st=(_hwLocalStatuses[hw.hwId]||{})[sno]||'';
      h+=makeHwStudentCell(hw.hwId, sno, s.name||'', st, locked);
    });
    h+='</div></div></div>';
  });
  container.innerHTML=h;
}

function makeHwStudentCell(hwId, sno, name, st, locked){
  var h='<div style="background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:12px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;font-family:Pretendard,sans-serif;'+(locked?'opacity:0.6;':'')+'">';

  // 이름
  h+='<div style="min-width:0;flex:1;">';
  h+='  <div style="font-size:10px;color:#94A3B8;margin-bottom:1px;">'+esc(sno)+'번</div>';
  h+='  <div style="font-size:14px;font-weight:600;color:#1E293B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(name)+'</div>';
  h+='</div>';

  // ★ 3개 버튼 (동그라미, 세모, 엑스)
  h+='<div style="display:flex;gap:5px;flex-shrink:0;">';

  var cursorStyle = locked ? 'not-allowed' : 'pointer';

  // ● 동그라미 (제출)
  var oActive = st==='O';
  h+='<button'+(locked?'':' onclick="selectHwStatus(\''+hwId+'\',\''+sno+'\',\'O\')"')+' id="hw-O-'+hwId+'-'+sno+'"';
  h+=' title="제출"'+(locked?' disabled':'');
  h+=' style="width:34px;height:34px;border-radius:50%;border:2px solid '+(oActive?'#10B981':'#D1FAE5')+';';
  h+='background:'+(oActive?'#10B981':'white')+';';
  h+='cursor:'+cursorStyle+';font-size:16px;display:flex;align-items:center;justify-content:center;';
  h+='transition:all 0.15s;box-shadow:'+(oActive?'0 2px 8px rgba(16,185,129,0.4)':'none')+';">';
  h+='<span style="color:'+(oActive?'white':'#10B981')+';">●</span>';
  h+='</button>';

  // ▲ 세모 (지각)
  var dActive = st==='△';
  h+='<button'+(locked?'':' onclick="selectHwStatus(\''+hwId+'\',\''+sno+'\',\'△\')"')+' id="hw-D-'+hwId+'-'+sno+'"';
  h+=' title="지각"'+(locked?' disabled':'');
  h+=' style="width:34px;height:34px;border-radius:50%;border:2px solid '+(dActive?'#F59E0B':'#FDE68A')+';';
  h+='background:'+(dActive?'#F59E0B':'white')+';';
  h+='cursor:'+cursorStyle+';font-size:14px;display:flex;align-items:center;justify-content:center;';
  h+='transition:all 0.15s;box-shadow:'+(dActive?'0 2px 8px rgba(245,158,11,0.4)':'none')+';">';
  h+='<span style="color:'+(dActive?'white':'#F59E0B')+';">▲</span>';
  h+='</button>';

  // ✕ 엑스 (미제출)
  var xActive = st==='X';
  h+='<button'+(locked?'':' onclick="selectHwStatus(\''+hwId+'\',\''+sno+'\',\'X\')"')+' id="hw-X-'+hwId+'-'+sno+'"';
  h+=' title="미제출"'+(locked?' disabled':'');
  h+=' style="width:34px;height:34px;border-radius:50%;border:2px solid '+(xActive?'#EF4444':'#FECACA')+';';
  h+='background:'+(xActive?'#EF4444':'white')+';';
  h+='cursor:'+cursorStyle+';font-size:15px;font-weight:900;display:flex;align-items:center;justify-content:center;';
  h+='transition:all 0.15s;box-shadow:'+(xActive?'0 2px 8px rgba(239,68,68,0.4)':'none')+';">';
  h+='<span style="color:'+(xActive?'white':'#EF4444')+';">✕</span>';
  h+='</button>';

  h+='</div>';
  h+='</div>';
  return h;
}

function calcHwCounts(hwId){
  var statuses=_hwLocalStatuses[hwId]||{};
  var O=0,D=0,X=0;
  _hwStudents.forEach(function(s){
    var st=statuses[String(s.studentNo)]||'';
    if(st==='O') O++; else if(st==='△') D++; else if(st==='X') X++;
  });
  return {O:O,D:D,X:X};
}

function selectHwStatus(hwId, sno, picked){
  var _hw = _hwList.find(function(h){ return h.hwId===hwId; });
  if(_hw && (_hw.reportStatus==='보고' || _hw.reportStatus==='승인')){
    showToast('⚠️ 결재 대기/완료 중인 과제는 수정할 수 없습니다.');
    return;
  }
  if(!_hwLocalStatuses[hwId]) _hwLocalStatuses[hwId]={};
  var cur = _hwLocalStatuses[hwId][sno]||'';

  // ★ 이미 선택된 버튼을 다시 누르면 해제(빈값), 아니면 선택
  var next = (cur===picked) ? '' : picked;
  _hwLocalStatuses[hwId][sno] = next;

  // ── 3개 버튼 스타일 즉시 업데이트 ──
  var configs = {
    'O':  { id:'hw-O-'+hwId+'-'+sno, activeColor:'#10B981', borderOff:'#D1FAE5', textColor:'#10B981' },
    '△': { id:'hw-D-'+hwId+'-'+sno, activeColor:'#F59E0B', borderOff:'#FDE68A', textColor:'#F59E0B' },
    'X':  { id:'hw-X-'+hwId+'-'+sno, activeColor:'#EF4444', borderOff:'#FECACA', textColor:'#EF4444' }
  };

  Object.keys(configs).forEach(function(key){
    var cfg = configs[key];
    var btn = $(cfg.id);
    if(!btn) return;
    var isActive = (next===key);
    btn.style.background    = isActive ? cfg.activeColor : 'white';
    btn.style.borderColor   = isActive ? cfg.activeColor : cfg.borderOff;
    btn.style.boxShadow     = isActive ? '0 2px 8px rgba(0,0,0,0.2)' : 'none';
    btn.querySelector('span').style.color = isActive ? 'white' : cfg.textColor;
  });

  // ── 카운트 즉시 업데이트 ──
  var counts = calcHwCounts(hwId);
  var elO=$('hw-cnt-O-'+hwId), elD=$('hw-cnt-D-'+hwId), elX=$('hw-cnt-X-'+hwId);
  if(elO) elO.textContent='● '+counts.O+'명';
  if(elD) elD.textContent='▲ '+counts.D+'명';
  if(elX) elX.textContent='✕ '+counts.X+'명';

  // ── debounce 일괄 저장 ──
  var saveKey = hwId+'|'+sno;
  _hwPendingSaves[saveKey] = { hwId: hwId, studentNo: sno, status: next };
  if(_hwSaveTimer) clearTimeout(_hwSaveTimer);
  _hwSaveTimer = setTimeout(flushHwSaves, 800);
}

// ── 대기 중인 저장 항목을 한 번에 서버로 전송 (callback 지원) ──
function flushHwSaves(callback){
  if(_hwSaveTimer){ clearTimeout(_hwSaveTimer); _hwSaveTimer = null; }
  var updates = [];
  for(var key in _hwPendingSaves) updates.push(_hwPendingSaves[key]);
  _hwPendingSaves = {};
  if(!updates.length){ if(callback) callback(); return; }

  _hwSaveInFlight = true;
  var targetCC = _cc || _adminCC;
  google.script.run
    .withSuccessHandler(function(r){
      _hwSaveInFlight = false;
      if(!r.success) showToast('⚠️ 저장 실패: '+r.msg);
      if(callback) callback();
    })
    .withFailureHandler(function(err){
      _hwSaveInFlight = false;
      showToast('⚠️ 저장 오류: '+err.message);
      if(callback) callback();
    })
    .updateHomeworkStatusBatch(targetCC, JSON.stringify(updates));
}

function openAddHomeworkModal(){
  if(!$('hw-add-modal')){
    var m=document.createElement('div');
    m.id='hw-add-modal';
    m.style.cssText='display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:99999;justify-content:center;align-items:center;';
    m.innerHTML=
      '<div style="background:#fff;border-radius:22px;padding:36px;width:90%;max-width:420px;font-family:Pretendard,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,0.2);">'+
        '<div style="font-family:Jua,sans-serif;font-size:22px;color:#1E293B;margin-bottom:20px;">📋 과제 항목 추가</div>'+
        '<div style="margin-bottom:16px;"><label style="font-size:13px;font-weight:700;color:#475569;display:block;margin-bottom:6px;">과제 이름</label>'+
          '<input id="hw-title-input" type="text" placeholder="예: 수학 1단원 문제지, 독서록 3편"'+
            ' style="width:100%;padding:12px 14px;border:2px solid #E2E8F0;border-radius:11px;font-size:14px;font-family:Pretendard,sans-serif;outline:none;box-sizing:border-box;"></div>'+
        '<div style="margin-bottom:24px;"><label style="font-size:13px;font-weight:700;color:#475569;display:block;margin-bottom:6px;">제출 날짜</label>'+
          '<input id="hw-date-input" type="date"'+
            ' style="width:100%;padding:12px 14px;border:2px solid #E2E8F0;border-radius:11px;font-size:14px;font-family:Pretendard,sans-serif;outline:none;box-sizing:border-box;"></div>'+
        '<div style="display:flex;gap:10px;">'+
          '<button onclick="doAddHomework()" style="flex:1;background:#06B6D4;color:white;border:none;padding:13px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:Pretendard,sans-serif;">추가하기</button>'+
          '<button onclick="closeHwModal()" style="flex:1;background:#F1F5F9;color:#64748B;border:none;padding:13px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:Pretendard,sans-serif;">취소</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(m);
  }
  var today=new Date().toISOString().split('T')[0];
  if($('hw-date-input')) $('hw-date-input').value=today;
  if($('hw-title-input')) $('hw-title-input').value='';
  $('hw-add-modal').style.display='flex';
}

function closeHwModal(){ var m=$('hw-add-modal'); if(m) m.style.display='none'; }

function doAddHomework(){
  var title=($('hw-title-input')||{}).value||'';
  var date=($('hw-date-input')||{}).value||'';
  if(!title.trim()) return alert('과제 이름을 입력해 주세요.');
  if(!date) return alert('날짜를 선택해 주세요.');
  var targetCC=_cc||_adminCC;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){ hideLoading(); closeHwModal(); if(r.success){ showToast('✅ '+r.msg); loadStatsOffice(); } else alert('추가 실패: '+r.msg); })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .addHomework(targetCC, title.trim(), date);
}

function submitHwReport(hwId){
  if(!confirm('대통령에게 이 과제의 제출 현황을 보고하시겠습니까?\n보고 후에는 마스터 관리-통계에 표시됩니다.')) return;
  var targetCC=_cc||_adminCC;
  showLoading();

  // ★ 체크한 내용이 서버에 다 저장된 뒤에 보고를 진행 (레이스 컨디션 방지)
  function proceedSubmit(){
    if(_hwSaveInFlight){
      setTimeout(proceedSubmit, 200); // 저장 통신이 끝날 때까지 잠깐씩 재확인
      return;
    }
    flushHwSaves(function(){
      google.script.run
        .withSuccessHandler(function(r){ hideLoading(); showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg); if(r.success) loadStatsOffice(); })
        .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
        .submitHomeworkReport(targetCC, hwId);
    });
  }
  proceedSubmit();
}

function deleteHwUI(hwId){
  var _hw = _hwList.find(function(h){ return h.hwId===hwId; });
  if(_hw && (_hw.reportStatus==='보고' || _hw.reportStatus==='승인')){
    return showToast('⚠️ 보고 중이거나 결재 완료된 과제는 삭제할 수 없습니다.');
  }
  if(!confirm('이 과제 항목을 삭제하시겠습니까?\n모든 제출 현황도 함께 삭제됩니다.')) return;
  var targetCC=_cc||_adminCC;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){ hideLoading(); showToast(r.success?'🗑️ '+r.msg:'⚠️ '+r.msg); if(r.success) loadStatsOffice(); })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .deleteHomework(targetCC, hwId);
}

// ── 마스터 통계 탭 과제 보고 렌더링 ──
function renderMasterHwReports(list, nameMap){
  var container=$('stats-hw-container'); if(!container) return;
  if(!list.length){
    container.innerHTML='<div style="text-align:center;padding:60px;color:#CBD5E1;font-family:Pretendard,sans-serif;font-size:15px;"><div style="font-size:56px;margin-bottom:14px;">📊</div>결재 대기 중인 과제 보고가 없습니다.<br><br>통계청장이 대통령 보고를 완료하면 여기에 표시됩니다.</div>';
    return;
  }
  var h='';
  list.forEach(function(hw){
    var total=Object.keys(hw.statuses||{}).length;
    h+='<div style="background:white;border:1.5px solid #FDE68A;border-radius:18px;margin-bottom:20px;overflow:hidden;box-shadow:0 3px 14px rgba(0,0,0,0.07);font-family:Pretendard,sans-serif;">';
    h+='<div style="background:linear-gradient(90deg,#F59E0B,#D97706);height:5px;"></div>';
    h+='<div style="padding:18px 22px;border-bottom:1px solid #F1F5F9;">';
    h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:10px;">';
    h+='  <div>';
    h+='    <div style="font-family:Jua,sans-serif;font-size:20px;color:#1E293B;margin-bottom:5px;">📝 '+esc(hw.title)+'</div>';
    h+='    <div style="font-size:13px;color:#94A3B8;">📅 '+esc(hw.date)+'</div>';
    h+='  </div>';
    h+='  <div style="display:flex;gap:8px;">';
    h+='    <button onclick="approveHwReportUI(\''+hw.hwId+'\')" style="background:#10B981;color:white;border:none;padding:9px 18px;font-size:13px;font-weight:700;border-radius:10px;cursor:pointer;font-family:Pretendard,sans-serif;">✅ 결재 완료</button>';
    h+='    <button onclick="rejectHwReportUI(\''+hw.hwId+'\')" style="background:#EF4444;color:white;border:none;padding:9px 18px;font-size:13px;font-weight:700;border-radius:10px;cursor:pointer;font-family:Pretendard,sans-serif;">❌ 반려</button>';
    h+='  </div>';
    h+='</div>';
    h+='<div style="display:flex;gap:8px;flex-wrap:wrap;">';
    h+='<span style="background:#ECFDF5;color:#059669;font-size:13px;font-weight:700;padding:5px 14px;border-radius:20px;">● 제출 '+hw.submitCount+'명</span>';
    h+='<span style="background:#FFFBEB;color:#D97706;font-size:13px;font-weight:700;padding:5px 14px;border-radius:20px;">▲ 지각 '+hw.lateCount+'명</span>';
    h+='<span style="background:#FFF5F5;color:#EF4444;font-size:13px;font-weight:700;padding:5px 14px;border-radius:20px;">✕ 미제출 '+hw.missCount+'명</span>';
    h+='<span style="background:#F1F5F9;color:#64748B;font-size:13px;font-weight:600;padding:5px 14px;border-radius:20px;">총 '+total+'명 기록</span>';
    h+='</div></div>';
    // 학생 상세
    h+='<div style="padding:16px 22px;">';
    h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;">';
    var stuEntries=[];
    for(var sno in (hw.statuses||{})) stuEntries.push({sno:sno,name:nameMap[sno]||'',status:hw.statuses[sno]});
    stuEntries.sort(function(a,b){ return Number(a.sno)-Number(b.sno); });
    stuEntries.forEach(function(e){
      var st=e.status;
      var icon,bg,tc;
      if(st==='O'){ icon='●'; bg='#ECFDF5'; tc='#059669'; }
      else if(st==='△'){ icon='▲'; bg='#FFFBEB'; tc='#D97706'; }
      else if(st==='X'){ icon='✕'; bg='#FFF5F5'; tc='#EF4444'; }
      else { icon='○'; bg='#F8FAFC'; tc='#CBD5E1'; }
      h+='<div style="background:'+bg+';border-radius:10px;padding:9px 12px;display:flex;align-items:center;justify-content:space-between;gap:6px;">';
      h+='<div><div style="font-size:10px;color:#94A3B8;">'+esc(e.sno)+'번</div>';
      h+='<div style="font-size:13px;font-weight:600;color:#1E293B;">'+esc(e.name)+'</div></div>';
      h+='<span style="font-size:20px;color:'+tc+';">'+icon+'</span></div>';
    });
    h+='</div></div></div>';
  });
  container.innerHTML=h;
}

// ── 과제 보고 결재 완료 (마스터) ──
function approveHwReportUI(hwId){
  if(!confirm('이 과제 보고를 결재 완료하시겠습니까?\n결재 완료 후에는 통계청장이 수정할 수 없습니다.')) return;
  var targetCC=_adminCC||_cc;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);
      if(r.success){ _hwReportCache=null; loadStats(); refreshMasterPendingBadges(); }
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .approveHomeworkReport(targetCC, hwId);
}

// ── 과제 보고 반려 (마스터) ──
function rejectHwReportUI(hwId){
  if(!confirm('이 과제 보고를 반려하시겠습니까?\n반려 시 통계청장이 다시 수정 후 재보고할 수 있습니다.')) return;
  var targetCC=_adminCC||_cc;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);
      if(r.success){ _hwReportCache=null; loadStats(); refreshMasterPendingBadges(); }
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .rejectHomeworkReport(targetCC, hwId);
}

// ============================================================
// 도매상인
// ============================================================
function goToTeacherLobby(){
  _adminCC = '';
  _cc = '';
  go('view-teacher-lobby');
}
// ============================================================
// 국세청 국고 관리
// ============================================================
function taxOfficeTab(panelId, el){
  document.querySelectorAll('#tof-tabs .panel-tab').forEach(function(t){t.classList.remove('act');});
  document.querySelectorAll('#tof-panels .panel-content').forEach(function(c){c.classList.remove('act');});
  el.classList.add('act');
  $(panelId).classList.add('act');
  if(panelId==='tof-treasury') loadTaxOfficeDashboard();
  if(panelId==='tof-tax') loadTaxStatsStu();
}

function loadTaxOfficeDashboard(){
  var targetCC = _cc || _adminCC;
  if(!targetCC) return;
  var container = $('treasury-records-container');
  if(container) container.innerHTML = '<div style="text-align:center;padding:40px;color:#aaa;font-family:Pretendard,sans-serif;">⏳ 불러오는 중...</div>';

  // tr-date 기본값 오늘로 설정
  var dateEl = $('tr-date');
  if(dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];

  google.script.run
    .withSuccessHandler(function(r){
      if(!r.success){ showToast('⚠️ '+r.msg); return; }
      _allTreasuryList = r.list || [];

      var bal = r.balance || 0;
      if($('treasury-balance')){
        $('treasury-balance').textContent = bal.toLocaleString()+' 머니';
        $('treasury-balance').style.color = bal >= 0 ? '#10B981' : '#EF4444';
      }
      if($('treasury-total-income'))  $('treasury-total-income').textContent  = (r.totalIncome||0).toLocaleString()+' 머니';
      if($('treasury-total-expense')) $('treasury-total-expense').textContent = (r.totalExpense||0).toLocaleString()+' 머니';
      var pb = $('treasury-pending-badge');
      if(pb){
        if(r.pendingCount > 0){
          pb.style.display = 'block';
          pb.textContent = '⏳ 교사 승인 대기 '+r.pendingCount+'건';
        } else {
          pb.style.display = 'none';
        }
      }
      renderTreasuryList(_allTreasuryList);
    })
    .withFailureHandler(function(err){ showToast('⚠️ 오류: '+err.message); })
    .getTreasuryStatus(targetCC);
}

function setTreasuryMode(mode){
  _treasuryMode = mode;
  $('tr-inc-btn').className = 'tog-btn '+(mode==='inc'?'tog-on-inc':'');
  $('tr-exp-btn').className = 'tog-btn '+(mode==='exp'?'tog-on-exp':'');
}

function saveTreasuryRecord(){
  var date = $('tr-date').value;
  var memo = $('tr-memo').value;
  var amt  = $('tr-amt').value;
  var targetCC = _cc || _adminCC;
  if(!date) return alert('날짜를 입력해 주세요.');
  if(!memo) return alert('내용을 입력해 주세요.');
  if(!amt||Number(amt)<=0) return alert('금액을 입력해 주세요.');
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      if(r.success){ showToast('✅ '+r.msg); $('tr-memo').value=''; $('tr-amt').value=''; loadTaxOfficeDashboard(); }
      else alert(r.msg);
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .addTreasuryRecord(targetCC, _sno||'교사', date, memo, _treasuryMode==='inc'?'수입':'지출', amt);
}

function filterTreasuryRecords(){
  var keyword = ($('treasury-search')||{}).value||'';
  var status  = ($('treasury-filter')||{}).value||'전체';
  keyword = keyword.trim().toLowerCase();
  var filtered = _allTreasuryList.filter(function(d){
    return (!keyword||(d.memo||'').toLowerCase().indexOf(keyword)!==-1) &&
           (status==='전체'||d.status===status);
  });
  renderTreasuryList(filtered);
}

function renderTreasuryList(list){
  var container = $('treasury-records-container');
  var badge = $('treasury-total-count');
  if(!container) return;
  if(badge) badge.textContent = '총 '+list.length+'건';

  if(!list||list.length===0){
    container.innerHTML = '<div style="text-align:center;padding:50px;color:#CBD5E1;font-family:Pretendard,sans-serif;"><div style="font-size:48px;margin-bottom:12px;">📋</div>기록이 없습니다.</div>';
    return;
  }

  var h = '';
  list.forEach(function(d){
    var isIncome  = d.type==='수입';
    var isPending = d.status==='대기';
    var isApproved= d.status==='승인';
    var topBar, cardBorder, cardBg, statusBg, statusColor, statusLabel;
    if(isPending){
      topBar='#F59E0B'; cardBorder='1.5px solid #FDE68A'; cardBg='#fff';
      statusBg='#FEF3C7'; statusColor='#D97706'; statusLabel='⏳ 교사 승인 대기중';
    } else if(isApproved){
      topBar='#10B981'; cardBorder='1.5px solid #A7F3D0'; cardBg='#FAFFFE';
      statusBg='#D1FAE5'; statusColor='#059669'; statusLabel='✅ 승인 완료';
    } else {
      topBar='#EF4444'; cardBorder='1.5px solid #FECACA'; cardBg='#FFF5F5';
      statusBg='#FEE2E2'; statusColor='#DC2626'; statusLabel='❌ 반려됨';
    }
    var amtColor  = isIncome?'#10B981':'#EF4444';
    var amtSign   = isIncome?'+':'-';
    var typeBg    = isIncome?'#ECFDF5':'#FFF5F5';
    var typeColor = isIncome?'#059669':'#DC2626';
    var typeLabel = isIncome?'📈 수입':'📉 지출';

    h += '<div style="background:'+cardBg+';border:'+cardBorder+';border-radius:16px;margin-bottom:14px;overflow:hidden;box-shadow:0 3px 12px rgba(0,0,0,0.06);font-family:Pretendard,sans-serif;">';
    h += '<div style="background:'+topBar+';height:5px;"></div>';
    h += '<div style="padding:18px 20px;">';

    // 날짜 + 상태
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
    h += '  <span style="font-size:13px;color:#94A3B8;font-weight:600;">📆 '+esc(d.date)+'</span>';
    h += '  <span style="background:'+statusBg+';color:'+statusColor+';font-size:12px;font-weight:700;padding:4px 13px;border-radius:20px;">'+statusLabel+'</span>';
    h += '</div>';

    // 내용 + 금액
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:13px;">';
    h += '  <div>';
    h += '    <div style="font-family:Jua,sans-serif;font-size:20px;color:#1E293B;margin-bottom:6px;">'+esc(d.memo)+'</div>';
    h += '    <span style="background:'+typeBg+';color:'+typeColor+';font-size:12px;font-weight:700;padding:4px 13px;border-radius:20px;">'+typeLabel+'</span>';
    h += '  </div>';
    h += '  <div style="text-align:right;">';
    h += '    <div style="font-family:Jua,sans-serif;font-size:28px;color:'+amtColor+';">'+amtSign+Number(d.amount).toLocaleString()+' 머니</div>';
    if(d.processedAt) h += '    <div style="font-size:11px;color:#94A3B8;margin-top:2px;">'+(isApproved?'승인일':'반려일')+': '+esc(d.processedAt)+'</div>';
    h += '  </div>';
    h += '</div>';

    // 버튼
    h += '<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px dashed #E2E8F0;padding-top:12px;">';
    h += '  <div style="font-size:12px;color:#94A3B8;">등록: '+esc(d.registeredBy||'-')+'번</div>';
    h += '  <div style="display:flex;gap:7px;align-items:center;">';
    if(_isTeacher && isPending){
      h += '<button onclick="approveRecordUI('+d.rowNo+')" style="background:#10B981;color:white;border:none;padding:7px 14px;font-size:13px;font-weight:700;border-radius:9px;cursor:pointer;font-family:Pretendard,sans-serif;">✅ 승인</button>';
      h += '<button onclick="rejectRecordUI('+d.rowNo+')" style="background:#EF4444;color:white;border:none;padding:7px 14px;font-size:13px;font-weight:700;border-radius:9px;cursor:pointer;font-family:Pretendard,sans-serif;">❌ 반려</button>';
    }
    if(!isApproved){
      h += '<button onclick="editTreasuryUI('+d.rowNo+',\''+esc(d.date)+'\',\''+esc(d.memo)+'\',\''+d.type+'\','+d.amount+')" style="background:#F8FAFC;color:#64748B;border:1.5px solid #E2E8F0;padding:7px 12px;font-size:14px;border-radius:9px;cursor:pointer;">✏️</button>';
      h += '<button onclick="deleteTreasuryUI('+d.rowNo+')" style="background:#FFF5F5;color:#EF4444;border:1.5px solid #FECACA;padding:7px 12px;font-size:14px;border-radius:9px;cursor:pointer;">🗑️</button>';
    } else {
      h += '<span style="font-size:11px;color:#94A3B8;">수정/삭제 불가</span>';
    }
    h += '</div></div>';
    h += '</div></div>';
  });
  container.innerHTML = h;
}

function editTreasuryUI(rowNo, date, memo, type, amount){
  if(!$('treasury-edit-modal')){
    var m = document.createElement('div');
    m.id = 'treasury-edit-modal';
    m.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:99999;justify-content:center;align-items:center;';
    m.innerHTML =
      '<div style="background:#fff;border-radius:22px;padding:36px;width:90%;max-width:440px;font-family:Pretendard,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,0.2);">'+
        '<div style="font-family:Jua,sans-serif;font-size:22px;color:#1E293B;margin-bottom:22px;">✏️ 국고 기록 수정</div>'+
        '<div style="margin-bottom:14px;"><label style="font-size:13px;font-weight:700;color:#475569;display:block;margin-bottom:6px;">날짜</label>'+
        '<input id="te-date" type="date" style="width:100%;padding:12px;border:2px solid #E2E8F0;border-radius:10px;font-size:14px;font-family:Pretendard,sans-serif;outline:none;box-sizing:border-box;"></div>'+
        '<div style="margin-bottom:14px;"><label style="font-size:13px;font-weight:700;color:#475569;display:block;margin-bottom:6px;">내용</label>'+
        '<input id="te-memo" type="text" style="width:100%;padding:12px;border:2px solid #E2E8F0;border-radius:10px;font-size:14px;font-family:Pretendard,sans-serif;outline:none;box-sizing:border-box;"></div>'+
        '<div style="margin-bottom:14px;"><label style="font-size:13px;font-weight:700;color:#475569;display:block;margin-bottom:6px;">구분</label>'+
        '<select id="te-type" style="width:100%;padding:12px;border:2px solid #E2E8F0;border-radius:10px;font-size:14px;font-family:Pretendard,sans-serif;outline:none;box-sizing:border-box;">'+
        '<option value="수입">📈 수입</option><option value="지출">📉 지출</option></select></div>'+
        '<div style="margin-bottom:20px;"><label style="font-size:13px;font-weight:700;color:#475569;display:block;margin-bottom:6px;">금액 (머니)</label>'+
        '<input id="te-amt" type="number" min="1" style="width:100%;padding:12px;border:2px solid #E2E8F0;border-radius:10px;font-size:14px;font-family:Pretendard,sans-serif;outline:none;box-sizing:border-box;"></div>'+
        '<input type="hidden" id="te-row-no">'+
        '<div style="background:#FEF3C7;border-radius:10px;padding:11px 15px;margin-bottom:20px;font-size:13px;color:#D97706;">⚠️ 수정 후 교사 승인이 다시 필요합니다.</div>'+
        '<div style="display:flex;gap:10px;">'+
          '<button onclick="submitTreasuryEdit()" style="flex:1;background:#7C3AED;color:white;border:none;padding:14px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:Pretendard,sans-serif;">💾 저장</button>'+
          '<button onclick="closeTreasuryEditModal()" style="flex:1;background:#F1F5F9;color:#64748B;border:none;padding:14px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:Pretendard,sans-serif;">취소</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(m);
  }
  $('te-date').value   = date;
  $('te-memo').value   = memo;
  $('te-type').value   = type;
  $('te-amt').value    = amount;
  $('te-row-no').value = rowNo;
  $('treasury-edit-modal').style.display = 'flex';
}

function closeTreasuryEditModal(){ var m=$('treasury-edit-modal'); if(m) m.style.display='none'; }

function submitTreasuryEdit(){
  var rowNo=$('te-row-no').value, date=$('te-date').value, memo=$('te-memo').value;
  var type=$('te-type').value, amt=$('te-amt').value;
  if(!date||!memo||!amt) return alert('모든 항목을 입력해 주세요.');
  var targetCC = _cc || _adminCC;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading(); closeTreasuryEditModal();
      showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);
      if(r.success) loadTaxOfficeDashboard();
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .editTreasuryRecord(targetCC, rowNo, date, memo, type, amt);
}

function deleteTreasuryUI(rowNo){
  if(!confirm('이 국고 기록을 삭제하시겠습니까?')) return;
  var targetCC = _cc || _adminCC;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      showToast(r.success?'🗑️ 삭제 완료':'⚠️ '+r.msg);
      if(r.success) loadTaxOfficeDashboard();
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .deleteTreasuryRecord(targetCC, rowNo);
}

function approveRecordUI(rowNo){
  if(!confirm('이 기록을 승인하여 국고에 반영하시겠습니까?')) return;
  var targetCC = _adminCC || _cc;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);
      if(r.success){ loadTaxOfficeDashboard(); if($('teacher-treasury-container')) loadTeacherTreasury(); refreshMasterPendingBadges(); }
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .approveTreasuryRecord(targetCC, rowNo);
}

function rejectRecordUI(rowNo){
  if(!confirm('이 기록을 반려하시겠습니까?')) return;
  var targetCC = _adminCC || _cc;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);
      if(r.success){ loadTaxOfficeDashboard(); if($('teacher-treasury-container')) loadTeacherTreasury(); refreshMasterPendingBadges(); }
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .rejectTreasuryRecord(targetCC, rowNo);
}

// ── 마스터 대시보드 국고 승인 탭 ──
function loadTeacherTreasury(){
  var targetCC = _adminCC || _cc;
  if(!targetCC) return;
  var container = $('teacher-treasury-container');
  if(container) container.innerHTML = '<div style="text-align:center;padding:40px;color:#aaa;font-family:Pretendard,sans-serif;">⏳ 불러오는 중...</div>';

  google.script.run
    .withSuccessHandler(function(r){
      if(!r.success){ showToast('⚠️ '+r.msg); return; }
      _allTeacherTreasuryList = r.list || [];
      if($('tt-balance')) $('tt-balance').textContent = (r.balance||0).toLocaleString()+' 머니';
      if($('tt-income'))  $('tt-income').textContent  = (r.totalIncome||0).toLocaleString()+' 머니';
      if($('tt-expense')) $('tt-expense').textContent = (r.totalExpense||0).toLocaleString()+' 머니';
      if($('tt-pending')) $('tt-pending').textContent = r.pendingCount||0;
      filterTeacherTreasury();
    })
    .withFailureHandler(function(err){ showToast('⚠️ 오류: '+err.message); })
    .getTreasuryStatus(targetCC);
}

function filterTeacherTreasury(){
  var status = ($('teacher-treasury-filter')||{}).value||'전체';
  var filtered = status==='전체' ? _allTeacherTreasuryList
    : _allTeacherTreasuryList.filter(function(d){ return d.status===status; });
  renderTeacherTreasuryList(filtered);
}

function renderTeacherTreasuryList(list){
  var container = $('teacher-treasury-container');
  var countEl   = $('teacher-treasury-count');
  if(!container) return;
  if(countEl) countEl.textContent = '총 '+list.length+'건';

  if(!list||list.length===0){
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#CBD5E1;font-family:Pretendard,sans-serif;font-size:15px;"><div style="font-size:48px;margin-bottom:12px;">📋</div>기록이 없습니다.</div>';
    return;
  }

  var h = '';
  list.forEach(function(d){
    var isIncome  = d.type==='수입';
    var isPending = d.status==='대기';
    var isApproved= d.status==='승인';
    var topBar    = isPending?'#F59E0B':isApproved?'#10B981':'#EF4444';
    var statusBg  = isPending?'#FEF3C7':isApproved?'#D1FAE5':'#FEE2E2';
    var statusC   = isPending?'#D97706':isApproved?'#059669':'#DC2626';
    var statusLbl = isPending?'⏳ 승인 대기':isApproved?'✅ 승인':'❌ 반려';
    var amtColor  = isIncome?'#10B981':'#EF4444';
    var amtSign   = isIncome?'+':'-';

    h += '<div style="background:#fff;border:1.5px solid #E2E8F0;border-radius:14px;margin-bottom:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);font-family:Pretendard,sans-serif;">';
    h += '<div style="background:'+topBar+';height:4px;"></div>';
    h += '<div style="padding:16px 18px;display:flex;justify-content:space-between;align-items:center;gap:12px;">';
    h += '  <div style="flex:1;">';
    h += '    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">';
    h += '      <span style="font-size:12px;color:#94A3B8;font-weight:600;">📆 '+esc(d.date)+'</span>';
    h += '      <span style="background:'+statusBg+';color:'+statusC+';font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">'+statusLbl+'</span>';
    h += '    </div>';
    h += '    <div style="font-family:Jua,sans-serif;font-size:18px;color:#1E293B;margin-bottom:3px;">'+esc(d.memo)+'</div>';
    h += '    <div style="font-size:12px;color:#94A3B8;">등록: '+esc(d.registeredBy||'-')+'번 &nbsp;|&nbsp; '+(isIncome?'📈 수입':'📉 지출')+'</div>';
    h += '  </div>';
    h += '  <div style="display:flex;align-items:center;gap:10px;">';
    h += '    <div style="text-align:right;">';
    h += '      <div style="font-family:Jua,sans-serif;font-size:22px;color:'+amtColor+';">'+amtSign+Number(d.amount).toLocaleString()+' 머니</div>';
    if(d.processedAt) h += '      <div style="font-size:11px;color:#94A3B8;">'+(isApproved?'승인일':'반려일')+': '+esc(d.processedAt)+'</div>';
    h += '    </div>';
    if(isPending){
      h += '    <button onclick="approveRecordUI('+d.rowNo+')" style="background:#10B981;color:white;border:none;padding:8px 14px;font-size:13px;font-weight:700;border-radius:9px;cursor:pointer;font-family:Pretendard,sans-serif;white-space:nowrap;">✅ 승인</button>';
      h += '    <button onclick="rejectRecordUI('+d.rowNo+')" style="background:#EF4444;color:white;border:none;padding:8px 14px;font-size:13px;font-weight:700;border-radius:9px;cursor:pointer;font-family:Pretendard,sans-serif;white-space:nowrap;">❌ 반려</button>';
    }
    h += '  </div>';
    h += '</div></div>';
  });
  container.innerHTML = h;
}

// ============================================================
// 급여 관리 시스템 (직업 급여표 / 퀵 알바비 / 스마트 월급)
// ============================================================
var _salaryJobs   = [];
var _salaryTable  = {};
var _civilServants= '';
var _payrollColumns = [];
var _tempColumns  = [];
var _DEFAULT_JOBS = ['국민','은행청장','국세청장','신용등급관리위원장','재산조사국장','부동산 중개인','통계청장','도매상인','경찰서장','증권회사'];

function salaryTab(mode, el) {
  ['table','quick','smart'].forEach(function(m){
    var t=$('slt-'+m);
    if(t){ t.style.background='transparent'; t.style.color='#64748B'; t.style.boxShadow='none'; }
    var p=$('sal-panel-'+m);
    if(p) p.style.display='none';
  });
  el.style.background='white'; el.style.color='#7C3AED'; el.style.boxShadow='0 2px 8px rgba(0,0,0,0.08)';
  $('sal-panel-'+mode).style.display='block';
  if(mode==='table') loadSalaryTable();
  if(mode==='quick') refreshPaySels();
  if(mode==='smart') initSmartPayroll();
}

// ── 직업 기본 급여표 ──
function loadSalaryTable() {
  if(!_adminCC) return;
  var c=$('salary-table-grid');
  if(c) c.innerHTML='<div style="text-align:center;padding:30px;color:#CBD5E1;grid-column:span 3;">불러오는 중...</div>';
  google.script.run
    .withSuccessHandler(function(r){
      if(r.success){ _salaryTable=r.table||{}; _civilServants=r.civilServants||''; }
      if($('civil-servant-jobs')) $('civil-servant-jobs').value=_civilServants;
      renderSalaryTableUI();
    })
    .getSalaryTable(_adminCC);
}

function renderSalaryTableUI() {
  var c=$('salary-table-grid'); if(!c) return;
  _salaryJobs=_DEFAULT_JOBS.slice();
  for(var job in _salaryTable){ if(_salaryJobs.indexOf(job)===-1) _salaryJobs.push(job); }
  var h='';
  _salaryJobs.forEach(function(job,idx){
    var salary=_salaryTable[job]||0;
    var isDef=_DEFAULT_JOBS.indexOf(job)!==-1;
    h+='<div style="background:white;border:1.5px solid #E2E8F0;border-radius:14px;padding:16px 18px;display:flex;justify-content:space-between;align-items:center;" onmouseover="this.style.borderColor=\'#C7D2FE\'" onmouseout="this.style.borderColor=\'#E2E8F0\'">';
    h+='<span style="font-family:Pretendard,sans-serif;font-size:15px;font-weight:600;color:#4338CA;">'+esc(job)+'</span>';
    h+='<div style="display:flex;align-items:center;gap:8px;">';
    h+='<input type="number" id="salrow-'+idx+'" value="'+salary+'" min="0" style="width:88px;padding:8px 10px;border:2px solid #E2E8F0;border-radius:10px;font-size:15px;font-weight:700;text-align:center;font-family:Pretendard,sans-serif;outline:none;" onfocus="this.style.borderColor=\'#7C3AED\'" onblur="this.style.borderColor=\'#E2E8F0\'">';
    if(!isDef) h+='<button onclick="deleteSalaryJob('+idx+')" style="background:#FFF5F5;color:#EF4444;border:1.5px solid #FECACA;width:34px;height:34px;border-radius:8px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">🗑️</button>';
    h+='</div></div>';
  });
  c.innerHTML=h;
}

function addSalaryJob(){
  var name=($('new-job-name').value||'').trim();
  var salary=parseInt($('new-job-salary').value)||0;
  if(!name) return alert('직업명을 입력해 주세요.');
  if(_salaryJobs.indexOf(name)!==-1) return alert('이미 존재하는 직업명입니다.');
  _salaryTable[name]=salary;
  $('new-job-name').value=''; $('new-job-salary').value='';
  renderSalaryTableUI();
  showToast('✅ '+name+' 직업이 추가되었습니다.');
}

function deleteSalaryJob(idx){
  var job=_salaryJobs[idx];
  if(_DEFAULT_JOBS.indexOf(job)!==-1) return showToast('⚠️ 기본 직업은 삭제할 수 없습니다.');
  if(!confirm('"'+job+'" 직업을 급여표에서 삭제하시겠습니까?')) return;
  delete _salaryTable[job]; _salaryJobs.splice(idx,1);
  renderSalaryTableUI();
}

function collectSalaryFromUI(){
  var table={};
  _salaryJobs.forEach(function(job,idx){ var el=$('salrow-'+idx); if(el) table[job]=parseInt(el.value)||0; });
  return table;
}

function saveSalaryTable(){
  var table=collectSalaryFromUI();
  var civil=($('civil-servant-jobs')?$('civil-servant-jobs').value:'').trim();
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);
      if(r.success){ _salaryTable=table; _civilServants=civil; }
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .setSalaryTable(_adminCC, JSON.stringify(table), civil);
}

// ── 스마트 월급 지급 ──
function getEffectiveCols(){
  return _payrollColumns.length>0 ? _payrollColumns : [{id:'tax',name:'소득세',type:'deduct',valueType:'rate',rate:10}];
}

function initSmartPayroll(){
  var c=$('smart-payroll-table');
  if(!_stuList.length){
    if(c) c.innerHTML='<div style="text-align:center;padding:40px;color:#94A3B8;font-family:Pretendard,sans-serif;">국민 관리 탭에서 학생 목록을 먼저 불러주세요.</div>';
    return;
  }
  if(Object.keys(_salaryTable).length===0){
    google.script.run
      .withSuccessHandler(function(r){
        if(r.success){ _salaryTable=r.table||{}; _civilServants=r.civilServants||''; }
        renderSmartPayrollTable();
      })
      .getSalaryTable(_adminCC);
  } else { renderSmartPayrollTable(); }
}

function renderSmartPayrollTable(){
  var c=$('smart-payroll-table'); if(!c||!_stuList.length) return;
  var cols=getEffectiveCols();

  var h='<table style="width:100%;border-collapse:collapse;min-width:700px;font-family:Pretendard,sans-serif;">';

  // ── 헤더 행1: 컬럼 제목 ──
  h+='<thead>';
  h+='<tr style="background:#F8FAFC;">';
  h+='<th style="padding:16px 18px;text-align:left;font-size:15px;font-weight:700;color:#475569;border-bottom:2px solid #E2E8F0;white-space:nowrap;">직업</th>';
  h+='<th style="padding:16px 18px;text-align:left;font-size:15px;font-weight:700;color:#475569;border-bottom:2px solid #E2E8F0;white-space:nowrap;">이름</th>';
  h+='<th style="padding:16px 18px;text-align:center;font-size:15px;font-weight:700;color:#3B82F6;border-bottom:2px solid #E2E8F0;white-space:nowrap;min-width:170px;">기본금 (+)</th>';
  cols.forEach(function(col){
    var cc=col.type==='deduct'?'#EF4444':'#10B981';
    var sign=col.type==='deduct'?'(-)':'(+)';
    h+='<th style="padding:16px 18px;text-align:center;font-size:15px;font-weight:700;color:'+cc+';border-bottom:2px solid #E2E8F0;white-space:nowrap;min-width:150px;">'+esc(col.name)+' '+sign+'</th>';
  });
  h+='<th style="padding:16px 18px;text-align:center;font-size:15px;font-weight:700;color:#10B981;border-bottom:2px solid #E2E8F0;white-space:nowrap;background:#F0FDF4;min-width:130px;">실수령액</th>';
  h+='</tr>';

  // ── 헤더 행2: 일괄 입력 컨트롤 ──
  h+='<tr style="background:#FAFBFF;border-bottom:2px solid #E2E8F0;">';
  h+='<td colspan="2" style="padding:10px 18px;text-align:center;">';
  h+='  <span style="font-size:13px;font-weight:700;color:#64748B;background:#E2E8F0;padding:5px 12px;border-radius:20px;">일괄 입력</span>';
  h+='</td>';
  // 기본금 일괄
  h+='<td style="padding:10px 12px;text-align:center;">';
  h+='  <div style="display:flex;flex-direction:column;gap:6px;align-items:center;">';
  h+='    <div style="display:flex;gap:6px;align-items:center;">';
  h+='      <input type="number" id="bulk-base" placeholder="금액" min="0" style="width:75px;padding:7px 9px;border:1.5px solid #BFDBFE;border-radius:8px;font-size:14px;text-align:center;font-family:Pretendard,sans-serif;outline:none;">';
  h+='      <button onclick="bulkFillBase()" style="background:#EFF6FF;color:#3B82F6;border:1.5px solid #BFDBFE;padding:7px 12px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:Pretendard,sans-serif;">일괄</button>';
  h+='    </div>';
  h+='    <button onclick="applyHobongTable()" style="background:#7C3AED;color:white;border:none;padding:7px 14px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:Pretendard,sans-serif;box-shadow:0 2px 6px rgba(124,58,237,0.25);">✨ 호봉표 적용</button>';
  h+='  </div>';
  h+='</td>';
  // 각 컬럼 일괄
  cols.forEach(function(col,cidx){
    var bc=col.type==='deduct'?'#FECACA':'#A7F3D0';
    var tc=col.type==='deduct'?'#EF4444':'#10B981';
    var bg=col.type==='deduct'?'#FFF5F5':'#F0FDF4';
    h+='<td style="padding:10px 12px;text-align:center;">';
    h+='  <div style="display:flex;gap:6px;align-items:center;justify-content:center;">';
    h+='    <input type="number" id="bulk-col-'+cidx+'" placeholder="금액" min="0" style="width:75px;padding:7px 9px;border:1.5px solid '+bc+';border-radius:8px;font-size:14px;text-align:center;font-family:Pretendard,sans-serif;outline:none;">';
    h+='    <button onclick="bulkFillCol('+cidx+')" style="background:'+bg+';color:'+tc+';border:1.5px solid '+bc+';padding:7px 12px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:Pretendard,sans-serif;">일괄</button>';
    h+='  </div>';
    h+='</td>';
  });
  h+='<td style="background:#F0FDF4;"></td>';
  h+='</tr>';
  h+='</thead>';

  // ── Body: 학생 행 ──
  h+='<tbody>';
  _stuList.forEach(function(s,idx){
    var base=_salaryTable[s.job||'국민']||_salaryTable['국민']||0;
    var netCalc=base;
    h+='<tr style="border-bottom:1px solid #F1F5F9;" onmouseover="this.style.background=\'#FAFBFF\'" onmouseout="this.style.background=\'white\'">';
    h+='<td style="padding:14px 18px;">';
    h+='  <span style="background:#EEF2FF;color:#4338CA;font-size:14px;font-weight:700;padding:5px 12px;border-radius:20px;">'+esc(s.job||'국민')+'</span>';
    h+='</td>';
    h+='<td style="padding:14px 18px;">';
    h+='  <div style="font-size:17px;font-weight:700;color:#1E293B;">'+esc(s.name||'')+'</div>';
    h+='  <div style="font-size:13px;color:#94A3B8;">'+s.studentNo+'번</div>';
    h+='</td>';
    h+='<td style="padding:14px 18px;text-align:center;">';
    h+='  <input type="number" id="sp-base-'+idx+'" value="'+base+'" min="0" onchange="updateNetPay('+idx+')"';
    h+='    style="width:90px;padding:9px 10px;border:2px solid #BFDBFE;border-radius:10px;font-size:16px;font-weight:700;text-align:center;color:#3B82F6;font-family:Pretendard,sans-serif;outline:none;">';
    h+='</td>';
    cols.forEach(function(col,cidx){
      var cv=col.valueType==='rate'?Math.floor(base*(col.rate/100)):(col.amount||0);
      if(col.type==='deduct') netCalc-=cv; else netCalc+=cv;
      var bc=col.type==='deduct'?'#FECACA':'#A7F3D0';
      var tc=col.type==='deduct'?'#EF4444':'#10B981';
      h+='<td style="padding:14px 18px;text-align:center;">';
      h+='  <input type="number" id="sp-col-'+idx+'-'+cidx+'" value="'+cv+'" min="0" onchange="updateNetPay('+idx+')"';
      h+='    style="width:90px;padding:9px 10px;border:2px solid '+bc+';border-radius:10px;font-size:16px;font-weight:600;text-align:center;color:'+tc+';font-family:Pretendard,sans-serif;outline:none;">';
      h+='</td>';
    });
    h+='<td style="padding:14px 18px;text-align:center;background:#F0FDF4;">';
    h+='  <span id="sp-net-'+idx+'" style="font-family:Jua,sans-serif;font-size:26px;color:'+(netCalc>=0?'#10B981':'#EF4444')+';">'+netCalc.toLocaleString()+'</span>';
    h+='  <div style="font-size:12px;color:#94A3B8;margin-top:2px;">머니</div>';
    h+='</td>';
    h+='</tr>';
  });
  h+='</tbody>';

  // ── Footer: 합계 행 ──
  h+='<tfoot>';
  h+='<tr style="background:linear-gradient(135deg,#1E293B 0%,#334155 100%);">';
  h+='<td colspan="2" style="padding:16px 18px;text-align:center;">';
  h+='  <span style="font-family:Jua,sans-serif;font-size:16px;color:white;">📊 합 계</span>';
  h+='</td>';
  h+='<td style="padding:16px 18px;text-align:center;">';
  h+='  <div style="font-size:12px;color:#94A3B8;margin-bottom:3px;">총 기본금</div>';
  h+='  <div id="total-base" style="font-family:Jua,sans-serif;font-size:20px;color:#93C5FD;">0</div>';
  h+='</td>';
  cols.forEach(function(col,cidx){
    var tc=col.type==='deduct'?'#FCA5A5':'#6EE7B7';
    h+='<td style="padding:16px 18px;text-align:center;">';
    h+='  <div style="font-size:12px;color:#94A3B8;margin-bottom:3px;">'+esc(col.name)+' 합계</div>';
    h+='  <div id="total-col-'+cidx+'" style="font-family:Jua,sans-serif;font-size:20px;color:'+tc+';">0</div>';
    h+='</td>';
  });
  h+='<td style="padding:16px 18px;text-align:center;background:rgba(16,185,129,0.15);">';
  h+='  <div style="font-size:12px;color:#6EE7B7;margin-bottom:3px;">총 실수령액</div>';
  h+='  <div id="total-net" style="font-family:Jua,sans-serif;font-size:26px;color:#34D399;">0</div>';
  h+='  <div style="font-size:12px;color:#6EE7B7;margin-top:2px;">머니</div>';
  h+='</td>';
  h+='</tr>';
  h+='</tfoot>';

  h+='</table>';
  c.innerHTML=h;
  updatePayrollTotals();
}

// 기본금 일괄 입력
function bulkFillBase(){
  var val=parseInt(($('bulk-base')||{}).value)||0;
  _stuList.forEach(function(s,idx){
    var el=$('sp-base-'+idx);
    if(el){ el.value=val; updateNetPay(idx); }
  });
  showToast('✅ 기본금 '+val.toLocaleString()+' 머니 일괄 입력 완료');
}

// 호봉표 기준으로 직업별 기본금 자동 적용
function applyHobongTable(){
  if(Object.keys(_salaryTable).length===0){
    showToast('⚠️ 급여표를 먼저 저장해 주세요.');
    return;
  }
  _stuList.forEach(function(s,idx){
    var salary=_salaryTable[s.job||'국민']||_salaryTable['국민']||0;
    var el=$('sp-base-'+idx);
    if(el){ el.value=salary; updateNetPay(idx); }
  });
  showToast('✅ 호봉표 기준으로 직업별 기본금이 적용되었습니다.');
}

// 특정 지출/수입 컬럼 일괄 입력
function bulkFillCol(cidx){
  var val=parseInt(($('bulk-col-'+cidx)||{}).value)||0;
  _stuList.forEach(function(s,idx){
    var el=$('sp-col-'+idx+'-'+cidx);
    if(el){ el.value=val; updateNetPay(idx); }
  });
  var cols=getEffectiveCols();
  var colName=cols[cidx]?cols[cidx].name:'항목';
  showToast('✅ ['+colName+'] '+val.toLocaleString()+' 머니 일괄 입력 완료');
}

function updateNetPay(idx){
  var cols=getEffectiveCols();
  var base=parseInt(($('sp-base-'+idx)||{}).value)||0;
  var net=base;
  cols.forEach(function(col,cidx){
    var v=parseInt(($('sp-col-'+idx+'-'+cidx)||{}).value)||0;
    if(col.type==='deduct') net-=v; else net+=v;
  });
  var el=$('sp-net-'+idx);
  if(el){ el.textContent=net.toLocaleString(); el.style.color=net>=0?'#10B981':'#EF4444'; }
  updatePayrollTotals(); // ← 이 줄 추가
}

// 합계 행 업데이트
function updatePayrollTotals(){
  var cols=getEffectiveCols();
  var totalBase=0, totalNet=0;
  var colTotals=cols.map(function(){ return 0; });
  _stuList.forEach(function(s,idx){
    var base=parseInt(($('sp-base-'+idx)||{}).value)||0;
    totalBase+=base;
    var net=base;
    cols.forEach(function(col,cidx){
      var v=parseInt(($('sp-col-'+idx+'-'+cidx)||{}).value)||0;
      colTotals[cidx]+=v;
      if(col.type==='deduct') net-=v; else net+=v;
    });
    totalNet+=net;
  });
  if($('total-base')) $('total-base').textContent=totalBase.toLocaleString();
  cols.forEach(function(col,cidx){
    var el=$('total-col-'+cidx);
    if(el) el.textContent=colTotals[cidx].toLocaleString();
  });
  if($('total-net')){ $('total-net').textContent=totalNet.toLocaleString(); $('total-net').style.color=totalNet>=0?'#34D399':'#FCA5A5'; }
}

// 전체 선택 / 해제
function toggleAllStudents(){
  var master=$('check-all-header');
  var checked=master?master.checked:false;
  document.querySelectorAll('.stu-check').forEach(function(cb){ cb.checked=checked; });
}

// 선택 학생 일괄 삭제
function doDelSelected(){
  var selected=[];
  document.querySelectorAll('.stu-check:checked').forEach(function(cb){ selected.push(cb.value); });
  if(!selected.length) return alert('삭제할 학생을 선택해 주세요.');
  if(!confirm(selected.length+'명의 학생을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) return;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      showToast(r.success?'🗑️ '+r.msg:'⚠️ '+r.msg);
      if(r.success){ var h=$('check-all-header'); if(h) h.checked=false; loadList(); }
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .bulkDeleteStudents(_adminCC, selected);
}

// 접속 코드 직접 저장
function doUpdateCode(sno){
  var el=$('cd-'+sno); if(!el) return;
  var code=el.value.trim().toUpperCase();
  if(!code||code.length<4) return alert('코드는 4자리 이상 입력해 주세요.');
  google.script.run
    .withSuccessHandler(function(r){
      showToast(r.success?'✅ '+sno+'번 코드 저장: '+r.code:'⚠️ '+r.msg);
      if(r.success&&el) el.value=r.code;
    })
    .updateStudentCode(_adminCC, sno, code);
}

function resetSmartPayroll(){
  if(!confirm('모든 입력값을 급여표 기준으로 초기화하시겠습니까?')) return;
  renderSmartPayrollTable(); showToast('✅ 초기화 완료');
}

function executeSmartPayrollUI(){
  if(!_stuList.length) return alert('학생 목록이 없습니다.');
  var cols=getEffectiveCols();
  var payroll=[];
  _stuList.forEach(function(s,idx){
    var baseEl=$('sp-base-'+idx); if(!baseEl) return;
    var net=parseInt(baseEl.value)||0;
    cols.forEach(function(col,cidx){
      var v=parseInt(($('sp-col-'+idx+'-'+cidx)||{}).value)||0;
      if(col.type==='deduct') net-=v; else net+=v;
    });
    payroll.push({studentNo:s.studentNo, netPay:net});
  });
  if(!confirm(_stuList.length+'명에게 스마트 월급을 지급하시겠습니까?\n실수령액 기준으로 카드에 입금됩니다.')) return;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);
      if(r.success) loadList();
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .executeSmartPayroll(_adminCC, JSON.stringify(payroll));
}

// ── 항목 설정 모달 ──
function openColumnSettings(){
  if(!$('col-modal')){
    var m=document.createElement('div');
    m.id='col-modal';
    m.style.cssText='display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:99999;justify-content:center;align-items:center;';
    m.innerHTML=
      '<div style="background:#fff;border-radius:22px;padding:36px;width:90%;max-width:560px;font-family:Pretendard,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,0.2);max-height:88vh;overflow-y:auto;">'+
        '<div style="font-family:Jua,sans-serif;font-size:22px;color:#1E293B;margin-bottom:4px;">⚙️ 수입 / 지출 항목 설정</div>'+
        '<div style="font-size:13px;color:#94A3B8;margin-bottom:18px;">스마트 월급 지급 시 적용할 항목을 설정하세요.</div>'+
        '<div id="col-settings-list" style="margin-bottom:14px;"></div>'+
        '<div style="background:#F8FAFC;border:1.5px dashed #CBD5E1;border-radius:12px;padding:18px;margin-bottom:20px;">'+
          '<div style="font-size:13px;font-weight:700;color:#475569;margin-bottom:12px;">새 항목 추가</div>'+
          '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">'+
            '<div><div style="font-size:11px;color:#94A3B8;margin-bottom:4px;">항목명</div><input id="nc-name" type="text" placeholder="급식비" style="padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-size:13px;font-family:Pretendard,sans-serif;outline:none;width:100px;"></div>'+
            '<div><div style="font-size:11px;color:#94A3B8;margin-bottom:4px;">유형</div><select id="nc-type" style="padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-size:13px;font-family:Pretendard,sans-serif;outline:none;"><option value="deduct">지출 (-)</option><option value="income">수입 (+)</option></select></div>'+
            '<div><div style="font-size:11px;color:#94A3B8;margin-bottom:4px;">값 유형</div><select id="nc-vtype" onchange="toggleColValInput()" style="padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-size:13px;font-family:Pretendard,sans-serif;outline:none;"><option value="rate">비율 (%)</option><option value="fixed">고정액</option><option value="individual">개별 입력</option></select></div>'+
            '<div id="nc-val-wrap"><div style="font-size:11px;color:#94A3B8;margin-bottom:4px;">값</div><input id="nc-val" type="number" placeholder="10" style="padding:9px 10px;border:1.5px solid #E2E8F0;border-radius:9px;font-size:13px;font-family:Pretendard,sans-serif;outline:none;width:70px;"></div>'+
            '<button onclick="addColSetting()" style="background:#7C3AED;color:white;border:none;padding:9px 16px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;font-family:Pretendard,sans-serif;margin-top:16px;">+ 추가</button>'+
          '</div>'+
        '</div>'+
        '<div style="display:flex;gap:10px;">'+
          '<button onclick="applyColSettings()" style="flex:1;background:#7C3AED;color:white;border:none;padding:13px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:Pretendard,sans-serif;">✅ 적용</button>'+
          '<button onclick="closeColModal()" style="flex:1;background:#F1F5F9;color:#64748B;border:none;padding:13px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:Pretendard,sans-serif;">취소</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(m);
  }
  _tempColumns=JSON.parse(JSON.stringify(getEffectiveCols()));
  renderColList();
  $('col-modal').style.display='flex';
}

function closeColModal(){ var m=$('col-modal'); if(m) m.style.display='none'; }

function toggleColValInput(){
  var vt=$('nc-vtype').value;
  var w=$('nc-val-wrap');
  if(w) w.style.display=vt==='individual'?'none':'block';
}

function renderColList(){
  var c=$('col-settings-list'); if(!c) return;
  if(!_tempColumns.length){ c.innerHTML='<div style="text-align:center;padding:15px;color:#CBD5E1;font-size:13px;">항목이 없습니다. 아래에서 추가하세요.</div>'; return; }
  var h='';
  _tempColumns.forEach(function(col,idx){
    var tc=col.type==='deduct'?'#EF4444':'#10B981';
    var tl=col.type==='deduct'?'지출 (-)':'수입 (+)';
    var vl=col.valueType==='rate'?col.rate+'%':col.valueType==='fixed'?col.amount+' 머니':'개별입력';
    h+='<div style="background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:11px;padding:13px 16px;margin-bottom:9px;display:flex;justify-content:space-between;align-items:center;">';
    h+='<div><div style="font-size:14px;font-weight:700;color:#1E293B;">'+esc(col.name)+'</div>';
    h+='<div style="font-size:12px;color:'+tc+';margin-top:2px;">'+tl+' · '+vl+'</div></div>';
    h+='<button onclick="removeColSetting('+idx+')" style="background:#FFF5F5;color:#EF4444;border:1.5px solid #FECACA;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:13px;">🗑️</button>';
    h+='</div>';
  });
  c.innerHTML=h;
}

function removeColSetting(idx){ _tempColumns.splice(idx,1); renderColList(); }

function addColSetting(){
  var name=($('nc-name').value||'').trim();
  var type=$('nc-type').value;
  var vtype=$('nc-vtype').value;
  var val=parseInt($('nc-val').value)||0;
  if(!name) return alert('항목명을 입력해 주세요.');
  var col={id:'col_'+Date.now(),name:name,type:type,valueType:vtype};
  if(vtype==='rate') col.rate=val;
  if(vtype==='fixed') col.amount=val;
  _tempColumns.push(col);
  $('nc-name').value=''; $('nc-val').value='';
  renderColList();
}

function applyColSettings(){
  _payrollColumns=_tempColumns.slice();
  closeColModal();
  renderSmartPayrollTable();
  showToast('✅ 항목 설정이 적용되었습니다.');
}

// ============================================================
// 교사 테스트 계정
// ============================================================
var _testStudentCode = '';
var _testStudentNo   = '';

function hideTestAccountResult(){
  var r=$('test-account-result');
  if(r) r.style.display='none';
}

function setupTestAccount(){
  var sno  = ($('test-sno')  ||{}).value||'';
  var name = ($('test-name') ||{}).value||'';
  var code = ($('test-code') ||{}).value||'';
  sno  = sno.trim();
  name = name.trim();
  code = code.trim().toUpperCase();

  if(!sno) return alert('테스트 학생번호를 입력해 주세요.');
  if(!_adminCC) return alert('학급을 먼저 선택해 주세요.');

  showLoading();

  // ① 기존 계정 조회
  google.script.run
    .withSuccessHandler(function(r){
      if(!r.success){ hideLoading(); showToast('⚠️ 조회 실패: '+r.msg); return; }

      if(r.found){
        // 이미 존재 → 코드만 업데이트 (코드 입력 시)
        if(code && code !== r.code){
          google.script.run
            .withSuccessHandler(function(cr){
              hideLoading();
              if(cr.success){
                r.code = cr.code;
                _testStudentCode = cr.code;
                _testStudentNo   = String(sno);
                showTestAccountResult(r);
                showToast('✅ 코드가 변경되었습니다: '+cr.code);
              } else {
                showTestAccountResult(r);
                showToast('⚠️ 코드 변경 실패: '+cr.msg);
              }
            })
            .updateStudentCode(_adminCC, sno, code);
        } else {
          hideLoading();
          _testStudentCode = r.code;
          _testStudentNo   = String(sno);
          showTestAccountResult(r);
          showToast('✅ 기존 테스트 계정을 불러왔습니다.');
        }
      } else {
        // 없으면 새로 생성
        google.script.run
          .withSuccessHandler(function(ar){
            if(!ar.success){ hideLoading(); alert('생성 실패: '+ar.msg); return; }
            // 코드 직접 설정 요청이 있으면 한 번 더 업데이트
            if(code){
              google.script.run
                .withSuccessHandler(function(cr){
                  hideLoading();
                  var finalCode = cr.success ? cr.code : ar.code;
                  _testStudentCode = finalCode;
                  _testStudentNo   = String(sno);
                  showTestAccountResult({
                    studentNo:String(sno), name:name||'테스트계정',
                    job:'', card:0, bank:0, credit:0, code:finalCode
                  });
                  loadList();
                  showToast('✅ 테스트 계정이 생성되었습니다! 코드: '+finalCode);
                })
                .updateStudentCode(_adminCC, sno, code);
            } else {
              hideLoading();
              _testStudentCode = ar.code;
              _testStudentNo   = String(sno);
              showTestAccountResult({
                studentNo:String(sno), name:name||'테스트계정',
                job:'', card:0, bank:0, credit:0, code:ar.code
              });
              loadList();
              showToast('✅ 테스트 계정 생성 완료! 코드: '+ar.code);
            }
          })
          .addStudent(_adminCC, sno, name||'테스트계정', '');
      }
    })
    .getTeacherTestStudent(_adminCC, sno);
}

function showTestAccountResult(s){
  var r=$('test-account-result');
  if(!r) return;
  r.style.display='block';
  if($('tr-sno-label'))   $('tr-sno-label').textContent   = s.studentNo||'';
  if($('tr-name-label'))  $('tr-name-label').textContent  = s.name||'';
  if($('tr-card'))        $('tr-card').textContent        = Number(s.card||0).toLocaleString()+' 머니';
  if($('tr-bank'))        $('tr-bank').textContent        = Number(s.bank||0).toLocaleString()+' 머니';
  if($('tr-credit'))      $('tr-credit').textContent      = (s.credit||0)+'점';
  if($('tr-code-display'))$('tr-code-display').textContent= s.code||'------';
}

function copyTestCode(){
  var code=($('tr-code-display')||{}).textContent||'';
  if(!code||code==='------') return showToast('⚠️ 코드가 없습니다.');
  navigator.clipboard.writeText(code)
    .then(function(){ showToast('✅ 코드 복사 완료: '+code); })
    .catch(function(){
      // fallback
      var ta=document.createElement('textarea');
      ta.value=code; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('✅ 코드 복사 완료: '+code);
    });
}

function loginAsTestStudent(){
  var code=($('tr-code-display')||{}).textContent||'';
  var sno=_testStudentNo;
  if(!code||code==='------'||!sno){
    return alert('먼저 테스트 계정을 생성해 주세요.');
  }
  // 학생 로그인 처리
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      if(r.success){
        _cc    = _adminCC;
        _sno   = String(sno);
        _myJob = r.job||'';
        // 교사 권한은 유지 (마스터 버튼 보이게)
        if($('my-job-label'))        $('my-job-label').innerText = (_myJob||'국민')+' (테스트)';
        if($('teacher-to-master-btn')) $('teacher-to-master-btn').style.display='inline-block';
        loadAppSettings(r.classCode);
        go('view-student-dashboard');
        renderStudentTiles();
        initStudentWallet(r);
        loadTx(_adminCC, sno, 's-tx-tbody', 's-tx-cnt');
        showToast('✅ 테스트 계정으로 입장했습니다. 마스터 관리 버튼으로 복귀 가능합니다.');
      } else {
        alert('입장 실패: '+r.msg);
      }
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .loginStudent(_adminCC, sno, code);
}

// ============================================================
// 도매상인 패널
// ============================================================
var _wsItemsData = [];
var _wsSalesData = [];
var _wsCorpTaxAccrued = 0;

function initWholesalePanel(){
  // ★ 판매 기록 탭이 제일 먼저 나오도록
  wsTab('sales', $('ws-tab-sales'));
}

function wsTab(mode, el){
  ['sales','items','stock','stats'].forEach(function(m){
    var t=$('ws-tab-'+m);
    if(t){ t.style.color='#64748B'; t.style.borderBottomColor='transparent'; }
    var p=$('ws-panel-'+m); if(p) p.style.display='none';
  });
  if(el){ el.style.color='#7C3AED'; el.style.borderBottomColor='#7C3AED'; }
  var panel=$('ws-panel-'+mode); if(panel) panel.style.display='block';
  if(mode==='sales'){ loadWsItems(); loadWsSales(); }
  if(mode==='items') loadWsItems();
  if(mode==='stock') loadStockRequests();
  if(mode==='stats') loadWsStats();
}

// ── 상품 목록 불러오기 ──
function loadWsItems(){
  var targetCC  = _cc||_adminCC;
  var targetSno = _sno||_testStudentNo||'';
  google.script.run
    .withSuccessHandler(function(r){ _wsItemsData=r.success?r.list:[]; renderWsItemsList(); })
    .getWholesaleItems(targetCC, targetSno);
}

function renderWsItemsList(){
  var c=$('ws-items-list'); if(!c) return;
  if(!_wsItemsData.length){ c.innerHTML='<div class="empty-msg">등록된 상품이 없습니다.</div>'; return; }
  var h='<div class="stw"><table class="stb"><thead><tr><th>상품명</th><th>가격</th><th>재고</th><th>판매수</th><th>관리</th></tr></thead><tbody>';
  _wsItemsData.forEach(function(item,idx){
    h+='<tr>';
    h+='<td style="font-weight:700;color:#1E293B;">'+esc(item.name)+'</td>';
    h+='<td style="color:#7C3AED;font-weight:700;">'+Number(item.price).toLocaleString()+' 머니</td>';
    h+='<td><input type="number" id="ws-stock-edit-'+idx+'" value="'+item.stock+'" min="0" style="width:70px;padding:5px 8px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;text-align:center;"></td>';
    h+='<td style="color:var(--green);font-weight:600;">'+item.sold+'개</td>';
    h+='<td style="display:flex;gap:4px;">';
    h+='<button class="btn btn-sm" style="background:#EFF6FF;color:var(--blue);box-shadow:none;border:1px solid #BFDBFE;" onclick="doUpdateWsStock('+idx+')" title="재고 저장"><i class="fa-solid fa-floppy-disk"></i></button>';
    h+='<button class="btn btn-sm btn-red" onclick="doDeleteWsItem('+idx+')" title="삭제"><i class="fa-solid fa-trash"></i></button>';
    h+='</td></tr>';
  });
  h+='</tbody></table></div>';
  c.innerHTML=h;
}

function doAddWsItem(){
  var name  = ($('ws-reg-name') ||{}).value||'';
  var price = ($('ws-reg-price')||{}).value||'';
  var stock = ($('ws-reg-stock')||{}).value||'0';
  var targetCC=_cc||_adminCC, targetSno=_sno||_testStudentNo||'';
  if(!name.trim()||!price) return alert('상품명과 가격을 입력해 주세요.');
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading(); showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);
      if(r.success){ $('ws-reg-name').value=''; $('ws-reg-price').value=''; $('ws-reg-stock').value='0'; loadWsItems(); }
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .addWholesaleItemBackend(targetCC, targetSno, name.trim(), price, stock);
}

function doUpdateWsStock(idx){
  var item=_wsItemsData[idx]; if(!item) return;
  var el=$('ws-stock-edit-'+idx); if(!el) return;
  var targetCC=_cc||_adminCC, targetSno=_sno||_testStudentNo||'';
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){ hideLoading(); showToast(r.success?'✅ 재고 업데이트 완료':'⚠️ '+r.msg); if(r.success) loadWsItems(); })
    .updateWholesaleItemStock(targetCC, targetSno, item.rowNo, el.value);
}

function doDeleteWsItem(idx){
  var item=_wsItemsData[idx]; if(!item) return;
  if(!confirm('"'+item.name+'" 상품을 삭제하시겠습니까?')) return;
  var targetCC=_cc||_adminCC, targetSno=_sno||_testStudentNo||'';
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){ hideLoading(); showToast(r.success?'🗑️ '+r.msg:'⚠️ '+r.msg); if(r.success) loadWsItems(); })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .deleteWholesaleItem(targetCC, targetSno, item.rowNo);
}

// ── 구매자 선택 모달 ──
function openWsBuyerSelect(){
  if(!$('ws-buyer-modal')){
    var m=document.createElement('div');
    m.id='ws-buyer-modal';
    m.style.cssText='display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:99999;justify-content:center;align-items:center;';
    m.innerHTML='<div style="background:#fff;border-radius:22px;padding:30px;width:90%;max-width:420px;font-family:Pretendard,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,0.2);">'+
      '<div style="font-family:Jua,sans-serif;font-size:20px;color:#1E293B;margin-bottom:14px;">👤 구매자 선택</div>'+
      '<input id="ws-buyer-search" type="text" placeholder="이름 또는 번호로 검색..." oninput="filterWsBuyers()" style="width:100%;padding:11px 14px;border:1.5px solid #E2E8F0;border-radius:11px;font-size:14px;font-family:Pretendard,sans-serif;outline:none;box-sizing:border-box;margin-bottom:10px;">'+
      '<div id="ws-buyer-list" style="max-height:300px;overflow-y:auto;"></div>'+
      '<button onclick="closeWsBuyerModal()" style="width:100%;margin-top:12px;background:#F1F5F9;color:#64748B;border:none;padding:12px;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:Pretendard,sans-serif;">닫기</button>'+
      '</div>';
    document.body.appendChild(m);
  }
  renderWsBuyerList(_stuList);
  if($('ws-buyer-search')) $('ws-buyer-search').value='';
  $('ws-buyer-modal').style.display='flex';
}
function closeWsBuyerModal(){ var m=$('ws-buyer-modal'); if(m) m.style.display='none'; }

function renderWsBuyerList(list){
  var c=$('ws-buyer-list'); if(!c) return;
  var targetSno=String(_sno||_testStudentNo||'');
  var h='';
  list.forEach(function(s){
    if(String(s.studentNo)===targetSno) return;
    h+='<div onclick="selectWsBuyer(\''+s.studentNo+'\',\''+esc(s.name||'')+'\')" '+
      'style="padding:12px 14px;border:1.5px solid #E2E8F0;border-radius:11px;margin-bottom:7px;cursor:pointer;display:flex;align-items:center;gap:10px;" '+
      'onmouseover="this.style.background=\'#F5F3FF\'" onmouseout="this.style.background=\'white\'">';
    h+='<span class="no-bdg">'+s.studentNo+'</span>';
    h+='<span style="font-size:15px;font-weight:600;color:#1E293B;flex:1;">'+esc(s.name||'')+'</span>';
    h+='<span style="font-size:12px;color:#94A3B8;">💳 '+Number(s.card||0).toLocaleString()+'</span>';
    h+='</div>';
  });
  c.innerHTML=h||'<div class="empty-msg">학생이 없습니다.</div>';
}

function filterWsBuyers(){
  var kw=(($('ws-buyer-search')||{}).value||'').trim().toLowerCase();
  var filtered=kw?_stuList.filter(function(s){ return (s.name||'').toLowerCase().indexOf(kw)!==-1||String(s.studentNo).indexOf(kw)!==-1; }):_stuList;
  renderWsBuyerList(filtered);
}

function selectWsBuyer(sno, name){
  if($('ws-buyer-no')) $('ws-buyer-no').value=sno;
  if($('ws-buyer-label')){ $('ws-buyer-label').textContent=sno+'번 '+name; $('ws-buyer-label').style.color='#1E293B'; }
  closeWsBuyerModal();
}

// ── 상품 선택 모달 ──
function openWsItemSelect(){
  if(!$('ws-item-sel-modal')){
    var m=document.createElement('div');
    m.id='ws-item-sel-modal';
    m.style.cssText='display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:99999;justify-content:center;align-items:center;';
    m.innerHTML='<div style="background:#fff;border-radius:22px;padding:30px;width:90%;max-width:420px;font-family:Pretendard,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,0.2);">'+
      '<div style="font-family:Jua,sans-serif;font-size:20px;color:#1E293B;margin-bottom:14px;">📦 판매 물건 선택</div>'+
      '<input id="ws-item-search" type="text" placeholder="상품명으로 검색..." oninput="filterWsItemSel()" style="width:100%;padding:11px 14px;border:1.5px solid #E2E8F0;border-radius:11px;font-size:14px;font-family:Pretendard,sans-serif;outline:none;box-sizing:border-box;margin-bottom:10px;">'+
      '<div id="ws-item-sel-list" style="max-height:300px;overflow-y:auto;"></div>'+
      '<button onclick="closeWsItemModal()" style="width:100%;margin-top:12px;background:#F1F5F9;color:#64748B;border:none;padding:12px;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:Pretendard,sans-serif;">닫기</button>'+
      '</div>';
    document.body.appendChild(m);
  }
  renderWsItemSelList(_wsItemsData);
  if($('ws-item-search')) $('ws-item-search').value='';
  $('ws-item-sel-modal').style.display='flex';
}
function closeWsItemModal(){ var m=$('ws-item-sel-modal'); if(m) m.style.display='none'; }

function renderWsItemSelList(list){
  var c=$('ws-item-sel-list'); if(!c) return;
  var h='';
  list.forEach(function(item){
    var sBg=item.stock>0?'#ECFDF5':'#FFF5F5';
    var sC =item.stock>0?'#059669':'#EF4444';
    h+='<div onclick="selectWsItem(\''+esc(item.name)+'\','+item.price+','+item.stock+')" '+
      'style="padding:12px 14px;border:1.5px solid #E2E8F0;border-radius:11px;margin-bottom:7px;cursor:pointer;display:flex;align-items:center;gap:10px;" '+
      'onmouseover="this.style.background=\'#F5F3FF\'" onmouseout="this.style.background=\'white\'">';
    h+='<div style="flex:1;">';
    h+='<div style="font-size:15px;font-weight:700;color:#1E293B;">'+esc(item.name)+'</div>';
    h+='<div style="font-size:13px;color:#7C3AED;font-weight:700;margin-top:2px;">'+Number(item.price).toLocaleString()+' 머니</div></div>';
    h+='<span style="background:'+sBg+';color:'+sC+';font-size:12px;font-weight:700;padding:4px 10px;border-radius:20px;">재고 '+item.stock+'개</span>';
    h+='</div>';
  });
  c.innerHTML=h||'<div class="empty-msg">상품 등록/재고 탭에서 먼저 상품을 등록하세요.</div>';
}

function filterWsItemSel(){
  var kw=(($('ws-item-search')||{}).value||'').trim().toLowerCase();
  var filtered=kw?_wsItemsData.filter(function(i){ return (i.name||'').toLowerCase().indexOf(kw)!==-1; }):_wsItemsData;
  renderWsItemSelList(filtered);
}

function selectWsItem(name, price, stock){
  if($('ws-sale-item-name'))  $('ws-sale-item-name').value=name;
  if($('ws-sale-item-price')) $('ws-sale-item-price').value=price;
  if($('ws-sale-item-label')){ $('ws-sale-item-label').textContent=name; $('ws-sale-item-label').style.color='#1E293B'; }
  if($('ws-unit-price-label')) $('ws-unit-price-label').textContent=Number(price).toLocaleString()+' 머니';
  calcWsTotal();
  closeWsItemModal();
}

function calcWsTotal(){
  var price=parseInt(($('ws-sale-item-price')||{}).value)||0;
  var qty  =parseInt(($('ws-qty')||{}).value)||0;
  var total=price*qty;
  if($('ws-total-label')) $('ws-total-label').textContent=total>0?total.toLocaleString()+' 머니':'- 머니';
}

// ── 판매 저장 ──
function doWsSale(){
  var targetCC  = _cc || _adminCC;
  var targetSno = _sno || _testStudentNo || ''; // ★ 비어있으면 교사 모드

  var buyerNo   = ($('ws-buyer-no')        ||{}).value||'';
  var itemName  = ($('ws-sale-item-name')  ||{}).value||'';
  var unitPrice = parseInt(($('ws-sale-item-price')||{}).value)||0;
  var qty       = parseInt(($('ws-qty')    ||{}).value)||0;

  if(!buyerNo)   return alert('구매자를 선택해 주세요.');
  if(!itemName)  return alert('판매 물건을 선택해 주세요.');
  if(qty <= 0)   return alert('수량을 입력해 주세요.');
  if(!unitPrice) return alert('상품 가격이 올바르지 않습니다. 물건을 다시 선택해 주세요.');

  var total      = unitPrice * qty;
  var buyerLabel = ($('ws-buyer-label')||{}).textContent || '';
  var sellerLabel= targetSno ? targetSno+'번' : '교사(마스터)';

  if(!confirm(
    '[판매 확인]\n\n판매자: '+sellerLabel+
    '\n구매자: '+buyerLabel+
    '\n상품: '+itemName+' × '+qty+'개'+
    '\n금액: '+total.toLocaleString()+' 머니'+
    '\n결제: 통장이체\n\n진행하시겠습니까?'
  )) return;

  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      showToast(r.success ? '✅ '+r.msg : '⚠️ '+r.msg, 3500);
      if(r.success){
        if($('ws-buyer-no'))        $('ws-buyer-no').value='';
        if($('ws-buyer-label'))     { $('ws-buyer-label').textContent='구매자 이름 검색 및 선택'; $('ws-buyer-label').style.color='#94A3B8'; }
        if($('ws-sale-item-name'))  $('ws-sale-item-name').value='';
        if($('ws-sale-item-price')) $('ws-sale-item-price').value='0';
        if($('ws-sale-item-label')){ $('ws-sale-item-label').textContent='판매 물건 검색 및 선택'; $('ws-sale-item-label').style.color='#94A3B8'; }
        if($('ws-unit-price-label'))$('ws-unit-price-label').textContent='-';
        if($('ws-qty'))             $('ws-qty').value='1';
        if($('ws-total-label'))     $('ws-total-label').textContent='- 머니';
        loadWsSales();
        loadWsItems();
      }
    })
    .withFailureHandler(function(err){ hideLoading(); alert('서버 오류: '+err.message); })
    .recordWholesaleSale(targetCC, targetSno, buyerNo, itemName, unitPrice, qty);
}

// ── 판매 로그 ──
function loadWsSales(){
  var targetCC=_cc||_adminCC, targetSno=_sno||_testStudentNo||'';
  google.script.run
    .withSuccessHandler(function(r){ _wsSalesData=r.success?r.list:[]; renderWsSalesLog(); })
    .getWholesaleSales(targetCC, targetSno);
}

function renderWsSalesLog(){
  var c=$('ws-sales-log'); if(!c) return;
  var cnt=$('ws-log-cnt'); if(cnt) cnt.textContent=_wsSalesData.length+'건';
  if(!_wsSalesData.length){ c.innerHTML='<div class="empty-msg">판매 기록이 없습니다.</div>'; return; }

  var h='';
  _wsSalesData.forEach(function(sale, idx){
    h+='<div id="ws-log-card-'+idx+'" style="background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:12px;padding:14px 16px;margin-bottom:10px;font-family:Pretendard,sans-serif;">';

    // ── 뷰 모드 ──
    h+='<div id="ws-log-view-'+idx+'">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
    h+='  <div style="font-size:15px;font-weight:700;color:#1E293B;">'+esc(sale.itemName)+'</div>';
    h+='  <div style="display:flex;align-items:center;gap:6px;">';
    h+='    <div style="font-family:Jua,sans-serif;font-size:18px;color:#10B981;">'+Number(sale.total).toLocaleString()+' 머니 차감</div>';
    h+='    <button onclick="startWsLogEdit('+idx+')" title="메모 수정"';
    h+='      style="background:#EFF6FF;color:#3B82F6;border:1px solid #BFDBFE;padding:5px 8px;border-radius:8px;font-size:12px;cursor:pointer;">✏️</button>';
    h+='    <button onclick="deleteWsLog('+idx+')" title="삭제 (환불)"';
    h+='      style="background:#FFF5F5;color:#EF4444;border:1px solid #FECACA;padding:5px 8px;border-radius:8px;font-size:12px;cursor:pointer;">🗑️</button>';
    h+='  </div>';
    h+='</div>';
    h+='<div style="display:flex;gap:10px;font-size:12px;color:#64748B;flex-wrap:wrap;">';
    h+='  <span>👤 '+esc(sale.buyerName)+' ('+sale.buyerNo+'번)</span>';
    h+='  <span>📦 '+sale.quantity+'개 × '+Number(sale.unitPrice).toLocaleString()+' 머니</span>';
    h+='  <span>🏦 통장이체</span>';
    h+='  <span style="margin-left:auto;">📅 '+esc(sale.date)+'</span>';
    h+='</div>';
    if(sale.memo){
      h+='<div style="margin-top:6px;font-size:12px;color:#7C3AED;background:#F5F3FF;border-radius:8px;padding:5px 10px;">📝 '+esc(sale.memo)+'</div>';
    }
    h+='</div>';

    // ── 편집 모드 ──
    h+='<div id="ws-log-edit-'+idx+'" style="display:none;">';
    h+='<div style="font-size:13px;font-weight:700;color:#1E293B;margin-bottom:8px;">📝 메모 수정</div>';
    h+='<input type="text" id="ws-log-memo-'+idx+'" value="'+(sale.memo?esc(sale.memo):'')+'" placeholder="메모를 입력하세요"';
    h+='  style="width:100%;padding:9px 12px;border:1.5px solid #C4B5FD;border-radius:9px;font-size:13px;font-family:Pretendard,sans-serif;outline:none;box-sizing:border-box;margin-bottom:8px;">';
    h+='<div style="display:flex;gap:6px;">';
    h+='  <button onclick="saveWsLogMemo('+idx+')" style="flex:1;background:#7C3AED;color:white;border:none;padding:8px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;font-family:Pretendard,sans-serif;">✅ 저장</button>';
    h+='  <button onclick="cancelWsLogEdit('+idx+')" style="flex:1;background:#F1F5F9;color:#64748B;border:none;padding:8px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;font-family:Pretendard,sans-serif;">취소</button>';
    h+='</div>';
    h+='</div>';

    h+='</div>';
  });
  c.innerHTML=h;
}

function startWsLogEdit(idx){
  var view=$('ws-log-view-'+idx);
  var edit=$('ws-log-edit-'+idx);
  if(view) view.style.display='none';
  if(edit){ edit.style.display='block'; var inp=$('ws-log-memo-'+idx); if(inp) inp.focus(); }
}

function cancelWsLogEdit(idx){
  var view=$('ws-log-view-'+idx);
  var edit=$('ws-log-edit-'+idx);
  if(view) view.style.display='block';
  if(edit) edit.style.display='none';
}

function saveWsLogMemo(idx){
  var memo=($('ws-log-memo-'+idx)||{}).value||'';
  var targetCC=_cc||_adminCC, targetSno=_sno||_testStudentNo||'';
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);
      if(r.success){
        _wsSalesData[idx].memo=memo;
        cancelWsLogEdit(idx);
        renderWsSalesLog();
      }
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .editWholesaleSaleMemo(targetCC, targetSno, idx, memo);
}

function deleteWsLog(idx){
  var sale=_wsSalesData[idx];
  if(!sale) return;
  if(!confirm(
    '[삭제 및 환불 확인]\n\n'+
    '상품: '+sale.itemName+' × '+sale.quantity+'개\n'+
    '구매자: '+sale.buyerName+' ('+sale.buyerNo+'번)\n'+
    '금액: '+Number(sale.total).toLocaleString()+' 머니\n\n'+
    '⚠️ 삭제 시 구매자에게 자동 환불됩니다.\n'+
    '계속하시겠습니까?'
  )) return;
  var targetCC=_cc||_adminCC, targetSno=_sno||_testStudentNo||'';
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      showToast(r.success?'🗑️ '+r.msg:'⚠️ '+r.msg);
      if(r.success){ loadWsSales(); loadWsItems(); }
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .deleteWholesaleSale(targetCC, targetSno, idx);
}

// ── 입고 신청 ──
function doStockRequest(){
  var item=($('ws-stock-req-item')||{}).value||'';
  var qty =($('ws-stock-req-qty') ||{}).value||'1';
  var note=($('ws-stock-req-note')||{}).value||'';
  var targetCC=_cc||_adminCC, targetSno=_sno||_testStudentNo||'';
  if(!item.trim()) return alert('상품명을 입력해 주세요.');
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading(); showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);
      if(r.success){ $('ws-stock-req-item').value=''; $('ws-stock-req-qty').value=''; $('ws-stock-req-note').value=''; loadStockRequests(); }
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .addStockRequest(targetCC, targetSno, item.trim(), qty, note);
}

function loadStockRequests(){
  var targetCC=_cc||_adminCC, targetSno=_sno||_testStudentNo||'';
  google.script.run
    .withSuccessHandler(function(r){
      var c=$('ws-stock-req-list'); if(!c) return;
      if(!r.success||!r.list.length){ c.innerHTML='<div class="empty-msg">신청 내역이 없습니다.</div>'; return; }
      var h='';
      r.list.forEach(function(req){
        var sBg=req.status==='승인'?'#ECFDF5':req.status==='반려'?'#FFF5F5':'#FFFBEB';
        var sC =req.status==='승인'?'#059669':req.status==='반려'?'#EF4444':'#D97706';
        var sL =req.status==='승인'?'✅ 승인':req.status==='반려'?'❌ 반려':'⏳ 대기';
        h+='<div style="background:white;border:1.5px solid #E2E8F0;border-radius:12px;padding:14px 16px;margin-bottom:9px;font-family:Pretendard,sans-serif;">';
        h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
        h+='<span style="font-size:15px;font-weight:700;color:#1E293B;">'+esc(req.itemName)+'</span>';
        h+='<span style="background:'+sBg+';color:'+sC+';font-size:12px;font-weight:700;padding:4px 11px;border-radius:20px;">'+sL+'</span></div>';
        h+='<div style="font-size:12px;color:#64748B;">수량: '+req.quantity+'개 &nbsp;|&nbsp; 📅 '+esc(req.date)+(req.note?' &nbsp;|&nbsp; '+esc(req.note):'')+'</div>';
        h+='</div>';
      });
      c.innerHTML=h;
    })
    .getStockRequests(targetCC, targetSno);
}

// ── 판매 통계 ──
function loadWsStats(){
  if(_wsSalesData.length){ loadWsCorpTaxThenRender(); return; }
  var c=$('ws-stats-container'); if(c) c.innerHTML='<div class="empty-msg">⏳ 불러오는 중...</div>';
  var targetCC=_cc||_adminCC, targetSno=_sno||_testStudentNo||'';
  google.script.run
    .withSuccessHandler(function(r){ _wsSalesData=r.success?r.list:[]; loadWsCorpTaxThenRender(); })
    .getWholesaleSales(targetCC, targetSno);
}

// ★ 매점 법인세 적립액을 불러온 뒤 통계 화면을 그림
function loadWsCorpTaxThenRender(){
  var targetCC=_cc||_adminCC, targetSno=_sno||_testStudentNo||'';
  google.script.run
    .withSuccessHandler(function(r){
      _wsCorpTaxAccrued = (r && r.success) ? (r.accrued||0) : 0;
      renderWsStats();
    })
    .withFailureHandler(function(){ _wsCorpTaxAccrued = 0; renderWsStats(); })
    .getWholesaleCorpTax(targetCC, targetSno);
}

// ★ 납부 완료 버튼 클릭 핸들러
function payWsCorpTax(){
  if(_wsCorpTaxAccrued<=0) return showToast('⚠️ 납부할 환수금이 없습니다.');
  if(!confirm('현재 적립된 '+Number(_wsCorpTaxAccrued).toLocaleString()+' 머니를 국고에 납부하시겠습니까?\n납부 후 적립액은 0원으로 초기화되고, 국세청 세금 내역에 자동 등록됩니다.')) return;
  var targetCC=_cc||_adminCC, targetSno=_sno||_testStudentNo||'';
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);
      if(r.success){ _wsCorpTaxAccrued=0; renderWsStats(); }
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .payWholesaleCorpTax(targetCC, targetSno);
}

function renderWsStats(){
  var c=$('ws-stats-container'); if(!c) return;
  if(!_wsSalesData.length){ c.innerHTML='<div class="empty-msg">판매 기록이 없습니다.</div>'; return; }
  var totalSales=0, totalQty=0, itemMap={};
  _wsSalesData.forEach(function(s){
    totalSales+=s.total; totalQty+=s.quantity;
    if(!itemMap[s.itemName]) itemMap[s.itemName]={qty:0,total:0};
    itemMap[s.itemName].qty+=s.quantity; itemMap[s.itemName].total+=s.total;
  });

  var h='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px;">';
  h+='<div class="ac2 tot"><div class="ai">💰</div><div class="al">총 매출</div><div class="av" style="font-size:17px;">'+totalSales.toLocaleString()+' 머니</div></div>';
  h+='<div class="ac2"><div class="ai" style="color:var(--blue);">📦</div><div class="al">총 판매 수량</div><div class="av" style="color:var(--blue);">'+totalQty+'개</div></div>';
  h+='<div class="ac2"><div class="ai" style="color:var(--green);">🛒</div><div class="al">거래 건수</div><div class="av" style="color:var(--green);">'+_wsSalesData.length+'건</div></div>';
  h+='</div>';

  // ★★★ 매점 수익 국고 환수 보고 시스템 ★★★
  var canPay = _wsCorpTaxAccrued > 0;
  h+='<div style="background:linear-gradient(135deg,#FFFBEB 0%,#FEF3C7 100%);border:1.5px solid #FDE68A;border-radius:18px;padding:20px 24px;margin-bottom:20px;">';
  h+='  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">';
  h+='    <div>';
  h+='      <div style="font-family:Jua,sans-serif;font-size:18px;color:#92400E;margin-bottom:4px;">🏛️ 매점 수익 국고 환수 보고 시스템</div>';
  h+='      <div style="font-size:12px;color:#B45309;">판매 금액의 10%가 자동으로 적립됩니다. 납부 완료 시 국세청 세금 내역에 즉시 반영됩니다.</div>';
  h+='    </div>';
  h+='    <div style="display:flex;align-items:center;gap:14px;">';
  h+='      <div style="text-align:right;">';
  h+='        <div style="font-size:11px;color:#92400E;margin-bottom:2px;">현재 적립액</div>';
  h+='        <div style="font-family:Jua,sans-serif;font-size:24px;color:#D97706;">'+Number(_wsCorpTaxAccrued).toLocaleString()+' 머니</div>';
  h+='      </div>';
  h+='      <button onclick="payWsCorpTax()" '+(canPay?'':'disabled')+'';
  h+='        style="background:'+(canPay?'#F59E0B':'#E5E7EB')+';color:'+(canPay?'white':'#9CA3AF')+';border:none;padding:12px 22px;border-radius:12px;font-size:14px;font-weight:700;cursor:'+(canPay?'pointer':'not-allowed')+';font-family:Pretendard,sans-serif;white-space:nowrap;">';
  h+='        <i class="fa-solid fa-landmark"></i> 납부 완료';
  h+='      </button>';
  h+='    </div>';
  h+='  </div>';
  h+='</div>';
  // ★★★ 여기까지 ★★★

  h+='<div class="st" style="margin-bottom:12px;"><i class="fa-solid fa-chart-bar" style="color:var(--cyan);"></i> 상품별 판매 현황</div>';
  var items=Object.keys(itemMap).map(function(k){ return {name:k,qty:itemMap[k].qty,total:itemMap[k].total}; });
  items.sort(function(a,b){ return b.total-a.total; });
  var maxTotal=items[0]?items[0].total:1;
  h+='<div style="display:flex;flex-direction:column;gap:10px;">';
  items.forEach(function(item){
    var pct=Math.round(item.total/maxTotal*100);
    h+='<div style="background:white;border:1.5px solid #E2E8F0;border-radius:12px;padding:14px 16px;">';
    h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
    h+='<span style="font-size:15px;font-weight:700;color:#1E293B;">'+esc(item.name)+'</span>';
    h+='<div style="text-align:right;"><div style="font-family:Jua,sans-serif;font-size:18px;color:#7C3AED;">'+item.total.toLocaleString()+' 머니</div>';
    h+='<div style="font-size:12px;color:#94A3B8;">'+item.qty+'개 판매</div></div></div>';
    h+='<div style="background:#E2E8F0;border-radius:20px;height:8px;overflow:hidden;"><div style="height:100%;background:linear-gradient(90deg,#7C3AED,#9333EA);border-radius:20px;width:'+pct+'%;"></div></div>';
    h+='</div>';
  });
  h+='</div>';
  c.innerHTML=h;
}

// ============================================================
// 전체 로그 패널
// ============================================================
var _fullLogData    = [];
var _fullLogFiltered= [];

var _txTypeMap = {
  '학생직접입력':   {label:'💰 용돈기입장', bg:'#FFF7ED', tc:'#C2410C'},
  '교사지급':       {label:'👨‍🏫 교사지급',  bg:'#F5F3FF', tc:'#5B21B6'},
  '교사수동지급':   {label:'👨‍🏫 교사지급',  bg:'#F5F3FF', tc:'#5B21B6'},
  '교사수동':       {label:'👨‍🏫 교사지급',  bg:'#F5F3FF', tc:'#5B21B6'},
  '개별지급':       {label:'👨‍🏫 개별지급',  bg:'#F5F3FF', tc:'#5B21B6'},
  '일괄지급':       {label:'💸 일괄지급',   bg:'#DBEAFE', tc:'#1E40AF'},
  '월급지급':       {label:'💸 월급',       bg:'#DBEAFE', tc:'#1E40AF'},
  '주급지급':       {label:'💸 주급',       bg:'#DBEAFE', tc:'#1E40AF'},
  '보상지급':       {label:'🎁 특별보상',   bg:'#FEF3C7', tc:'#B45309'},
  '알바비':         {label:'⚡ 알바비',     bg:'#FFFBEB', tc:'#B45309'},
  '스마트월급':     {label:'💸 스마트월급', bg:'#DBEAFE', tc:'#1E40AF'},
  '예금가입':       {label:'🏦 예금가입',   bg:'#EFF6FF', tc:'#1D4ED8'},
  '예금만기':       {label:'🏦 예금만기',   bg:'#ECFDF5', tc:'#065F46'},
  '예금중도해지':   {label:'🏦 중도해지',   bg:'#FEF3C7', tc:'#92400E'},
  '벌금':           {label:'🚨 경찰서',     bg:'#FFF5F5', tc:'#DC2626'},
  '세금':           {label:'🧾 국세청',     bg:'#FEF3C7', tc:'#92400E'},
  '부동산':         {label:'🏠 부동산',     bg:'#ECFDF5', tc:'#065F46'},
  '복권':           {label:'📈 증권회사',   bg:'#F5F3FF', tc:'#5B21B6'},
  '도매구매':       {label:'🛒 도매구매',   bg:'#FFFBEB', tc:'#B45309'},
  '도매판매':       {label:'🛒 도매판매',   bg:'#ECFDF5', tc:'#065F46'},
  '신용위원장조정': {label:'⭐ 신용조정',   bg:'#FFFBEB', tc:'#B45309'},
};

function getTxTypeInfo(type){
  if(!type) return {label:'기타', bg:'#F1F5F9', tc:'#64748B'};
  if(_txTypeMap[type]) return _txTypeMap[type];
  // 부분 매칭
  var keys=Object.keys(_txTypeMap);
  for(var i=0;i<keys.length;i++){
    if(type.indexOf(keys[i])!==-1) return _txTypeMap[keys[i]];
  }
  return {label:type, bg:'#F1F5F9', tc:'#64748B'};
}

function loadFullLog(){
  var tbody=$('fl-tbody');
  if(tbody) tbody.innerHTML='<tr><td colspan="7" class="empty-msg">⏳ 불러오는 중...</td></tr>';
  google.script.run
    .withSuccessHandler(function(r){
      if(!r.success){ if(tbody) tbody.innerHTML='<tr><td colspan="7" class="empty-msg">오류: '+r.msg+'</td></tr>'; return; }
      _fullLogData = r.list || [];
      // 상단 요약
      if($('fl-total-amount')) $('fl-total-amount').textContent = r.totalAmount.toLocaleString()+' 머니';
      if($('fl-total-count'))  $('fl-total-count').textContent  = r.totalCount.toLocaleString()+'건';
      if($('fl-stu-count'))    $('fl-stu-count').textContent    = r.stuCount+'명';
      filterFullLog();
    })
    .withFailureHandler(function(err){
      if(tbody) tbody.innerHTML='<tr><td colspan="7" class="empty-msg">오류: '+err.message+'</td></tr>';
    })
    .getAllActivityLog(_adminCC);
}

// ── 학급 전체 초기화 (2단계 확인) ──
function doResetClassEconomy(){
  var targetCC = _adminCC || _cc;
  if(!targetCC) return alert('학급을 먼저 선택해 주세요.');

  if(!confirm(
    '⚠️ [학급 전체 초기화]\n\n'+
    '다음 항목이 모두 초기화됩니다:\n'+
    '• 전체 학생의 카드·은행 잔액 → 0\n'+
    '• 전체 학생의 신용점수 → 0\n'+
    '• 거래 로그 / 예금 / 국고 기록 전부 삭제\n'+
    '• 신용위원회 대기 내역 전부 삭제\n'+
    '• 도매상 상품·판매기록·법인세 전부 삭제\n'+
    '• 통계청 과제와 제출현황 전부 삭제\n'+
    '• 부동산은 소유권만 해제 (매물 정보는 유지)\n\n'+
    '유지되는 것: 학생 명단·이름·직업·접속코드,\n'+
    '이자율·급여표·신용등급 등 설정값\n\n'+
    '계속하시겠습니까?'
  )) return;

  if(!confirm('❗ 마지막 확인입니다.\n\n이 작업은 되돌릴 수 없습니다.\n정말 학급을 처음 상태로 초기화하시겠습니까?')) return;

  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      if(r.success){
        alert('✅ '+r.msg);
        loadFullLog();
        loadList();
        refreshMasterPendingBadges();
      } else {
        alert('⚠️ 초기화 실패: '+r.msg);
      }
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .resetClassEconomy(targetCC);
}

function filterFullLog(){
  var kw      = (($('fl-search')     ||{}).value||'').trim().toLowerCase();
  var typeF   = (($('fl-type-filter')||{}).value||'').trim();
  var ioF     = (($('fl-io-filter')  ||{}).value||'').trim();

  _fullLogFiltered = _fullLogData.filter(function(row){
    // 검색
    if(kw && (row.name||'').toLowerCase().indexOf(kw)===-1
           && String(row.sno).indexOf(kw)===-1
           && (row.memo||'').toLowerCase().indexOf(kw)===-1) return false;
    // 패널 필터
    if(typeF){
      var t=row.type||'';
      if(typeF==='예금'    && t.indexOf('예금')===-1) return false;
      if(typeF==='도매'    && t.indexOf('도매')===-1) return false;
      if(typeF==='월급'    && t.indexOf('급')===-1 && t.indexOf('월급')===-1 && t.indexOf('주급')===-1 && t.indexOf('알바')===-1 && t.indexOf('스마트')===-1) return false;
      if(typeF==='교사'    && t.indexOf('교사')===-1 && t.indexOf('개별')===-1 && t.indexOf('일괄')===-1) return false;
      if(typeF!=='예금'&&typeF!=='도매'&&typeF!=='월급'&&typeF!=='교사' && t!==typeF) return false;
    }
    // 수입/지출 필터
    if(ioF==='income'  && !row.income)  return false;
    if(ioF==='expense' && !row.expense) return false;
    return true;
  });

  var cnt=$('fl-shown-count');
  if(cnt) cnt.textContent = _fullLogFiltered.length+'건';
  renderFullLogTable(_fullLogFiltered);
}

function renderFullLogTable(list){
  var tbody=$('fl-tbody'); if(!tbody) return;
  if(!list||!list.length){
    tbody.innerHTML='<tr><td colspan="7" class="empty-msg">해당 내역이 없습니다.</td></tr>';
    return;
  }
  var h='';
  list.forEach(function(row){
    var info=getTxTypeInfo(row.type);
    var incTxt = row.income  ? '<span class="tp">+'+Number(row.income).toLocaleString()+'</span>' : '<span style="color:#CBD5E1;">-</span>';
    var expTxt = row.expense ? '<span class="tm">-'+Number(row.expense).toLocaleString()+'</span>': '<span style="color:#CBD5E1;">-</span>';
    var balColor = row.balance>=0?'#1E293B':'#EF4444';

    h+='<tr id="fl-row-'+row.rowNo+'" onmouseover="this.style.background=\'#FAFBFF\'" onmouseout="this.style.background=\'white\'">';

    // 날짜
    h+='<td style="font-size:12px;color:#64748B;white-space:nowrap;">'+esc(row.date)+'</td>';

    // 학생 + 패널
    h+='<td>';
    h+='  <div style="display:flex;align-items:center;gap:6px;">';
    h+='    <span class="no-bdg" style="flex-shrink:0;">'+esc(row.sno)+'</span>';
    h+='    <div>';
    h+='      <div style="font-size:14px;font-weight:700;color:#1E293B;">'+esc(row.name||'')+'</div>';
    h+='      <span style="background:'+info.bg+';color:'+info.tc+';font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;">'+info.label+'</span>';
    h+='    </div>';
    h+='  </div>';
    h+='</td>';

    // 내역 (수정 가능 inline)
    h+='<td>';
    h+='  <div id="fl-memo-view-'+row.rowNo+'" style="font-size:13px;color:#334155;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="'+esc(row.memo)+'">'+esc(row.memo)+'</div>';
    h+='  <input id="fl-memo-edit-'+row.rowNo+'" type="text" value="'+esc(row.memo)+'" style="display:none;width:100%;padding:5px 8px;border:1.5px solid #C4B5FD;border-radius:8px;font-size:13px;font-family:Pretendard,sans-serif;outline:none;">';
    h+='</td>';

    // 수입
    h+='<td style="text-align:right;font-size:14px;font-weight:600;">'+incTxt+'</td>';
    // 지출
    h+='<td style="text-align:right;font-size:14px;font-weight:600;">'+expTxt+'</td>';
    // 잔액
    h+='<td style="text-align:right;font-family:Jua,sans-serif;font-size:15px;color:'+balColor+';">'+Number(row.balance).toLocaleString()+'</td>';

    // 관리
    h+='<td>';
    h+='  <div style="display:flex;gap:4px;" id="fl-btn-view-'+row.rowNo+'">';
    h+='    <button onclick="startEditLog('+row.rowNo+')" title="내역 수정" style="background:#EFF6FF;color:#3B82F6;border:1px solid #BFDBFE;padding:5px 8px;border-radius:7px;font-size:12px;cursor:pointer;">✏️</button>';
    h+='    <button onclick="deleteLog('+row.rowNo+')" title="삭제" style="background:#FFF5F5;color:#EF4444;border:1px solid #FECACA;padding:5px 8px;border-radius:7px;font-size:12px;cursor:pointer;">🗑️</button>';
    h+='  </div>';
    h+='  <div style="display:none;gap:4px;" id="fl-btn-edit-'+row.rowNo+'">';
    h+='    <button onclick="saveEditLog('+row.rowNo+')" style="background:#10B981;color:white;border:none;padding:5px 9px;border-radius:7px;font-size:12px;cursor:pointer;font-weight:700;">✓</button>';
    h+='    <button onclick="cancelEditLog('+row.rowNo+')" style="background:#F1F5F9;color:#64748B;border:none;padding:5px 9px;border-radius:7px;font-size:12px;cursor:pointer;">✕</button>';
    h+='  </div>';
    h+='</td>';

    h+='</tr>';
  });
  tbody.innerHTML=h;
}

function startEditLog(rowNo){
  var view=$('fl-memo-view-'+rowNo);
  var edit=$('fl-memo-edit-'+rowNo);
  var bView=$('fl-btn-view-'+rowNo);
  var bEdit=$('fl-btn-edit-'+rowNo);
  if(view) view.style.display='none';
  if(edit){ edit.style.display='block'; edit.focus(); }
  if(bView) bView.style.display='none';
  if(bEdit) bEdit.style.display='flex';
}

function cancelEditLog(rowNo){
  var view=$('fl-memo-view-'+rowNo);
  var edit=$('fl-memo-edit-'+rowNo);
  var bView=$('fl-btn-view-'+rowNo);
  var bEdit=$('fl-btn-edit-'+rowNo);
  // 원래 값으로 복원
  var orig=_fullLogData.find(function(r){ return r.rowNo===rowNo; });
  if(edit && orig) edit.value=orig.memo||'';
  if(view) view.style.display='block';
  if(edit) edit.style.display='none';
  if(bView) bView.style.display='flex';
  if(bEdit) bEdit.style.display='none';
}

function saveEditLog(rowNo){
  var edit=$('fl-memo-edit-'+rowNo);
  var newMemo=(edit?edit.value:'').trim();
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      showToast(r.success?'✅ '+r.msg:'⚠️ '+r.msg);
      if(r.success){
        // 로컬 데이터 업데이트 후 재렌더
        var found=_fullLogData.find(function(row){ return row.rowNo===rowNo; });
        if(found) found.memo=newMemo;
        cancelEditLog(rowNo);
        var view=$('fl-memo-view-'+rowNo);
        if(view) view.textContent=newMemo;
      }
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .editActivityLogMemo(_adminCC, rowNo, newMemo);
}

function deleteLog(rowNo){
  var found=_fullLogData.find(function(r){ return r.rowNo===rowNo; });
  var name=found?found.name+' ('+found.sno+'번)':'';
  var memo=found?found.memo:'';
  if(!confirm('[삭제 확인]\n\n학생: '+name+'\n내역: '+memo+'\n\n⚠️ 삭제 시 카드 잔액이 자동으로 복원됩니다.\n계속 진행하시겠습니까?')) return;
  showLoading();
  google.script.run
    .withSuccessHandler(function(r){
      hideLoading();
      showToast(r.success?'🗑️ '+r.msg:'⚠️ '+r.msg);
      if(r.success) loadFullLog();
    })
    .withFailureHandler(function(err){ hideLoading(); alert('오류: '+err.message); })
    .deleteActivityLog(_adminCC, rowNo);
}

window.addEventListener('DOMContentLoaded',function(){
  var savedSession=sessionStorage.getItem('smtm_session');
  if(savedSession){
    try{
      var data=JSON.parse(savedSession);

      if(data.role==='teacher'){
        _adminCC=data.classCode;
        _cc=data.classCode;
        _isTeacher=true;
        loadAppSettings(data.classCode);

        if($('dash-title')) $('dash-title').innerText=data.adminName;
        if($('nav-login-btn')) $('nav-login-btn').style.display='none';
        if($('nav-master-btn')) $('nav-master-btn').style.display='block';
        if($('my-job-label')) $('my-job-label').innerText='선생님 (마스터)';
        if($('teacher-to-master-btn')) $('teacher-to-master-btn').style.display='inline-block';

        go('view-student-dashboard');
        renderStudentTiles();
        if(typeof loadList==='function') loadList();
        if(typeof loadBankSettings==='function') loadBankSettings();
        if(typeof refreshMasterPendingBadges==='function') refreshMasterPendingBadges();

      } else if(data.role==='student'){
        _cc=data.classCode;
        _sno=String(data.sno||'');
        _myJob=data.myJob||'';
        _isTeacher=false;

        if($('my-job-label')) $('my-job-label').innerText=_myJob||'국민';
        if($('teacher-to-master-btn')) $('teacher-to-master-btn').style.display='none';

        if(data.studentData) initStudentWallet(data.studentData);
        go('view-student-dashboard');
        renderStudentTiles();
        if(typeof loadTx==='function') loadTx(_cc,_sno,'s-tx-tbody','s-tx-cnt');
      }
      return; // ★ 학급까지 선택된 세션이 이미 복구됐으면 자동 로그인은 건너뜀

    } catch(e){
      sessionStorage.removeItem('smtm_session');
    }
  }

  // ★ 저장된 선생님 계정으로 자동 로그인 시도 (학급 세션 복구가 없을 때만)
  var remembered = null;
  try{ remembered = JSON.parse(localStorage.getItem('smtm_remember_teacher')||'null'); }catch(e){}
  if(remembered && remembered.email && remembered.password){
    google.script.run
      .withSuccessHandler(function(r){
        if(r.success){
          _isTeacher=true;
          if($('lobby-name')) $('lobby-name').innerText=r.name;
          if($('nav-login-btn')) $('nav-login-btn').style.display='none';
          if($('nav-master-btn')) $('nav-master-btn').style.display='block';
          go('view-teacher-lobby');
        } else {
          // 저장된 정보로 로그인 실패(비밀번호 변경 등) → 저장된 정보 삭제
          try{ localStorage.removeItem('smtm_remember_teacher'); }catch(e){}
        }
      })
      .withFailureHandler(function(){
        // 통신 실패 시에는 그냥 홈 화면 유지 (저장 정보는 지우지 않음)
      })
      .loginTeacher(remembered);
  }
});

// ============================================================
// 마스터 대시보드에서 학생 대시보드로 돌아가기
// ============================================================
function returnToStudentDash(){
  // 1. 모든 md-panel 비활성화
  document.querySelectorAll('.md-panel').forEach(function(p){
    p.classList.remove('act');
  });

  // 2. 홈 패널만 다시 act (다음 번 마스터 진입 시 홈이 기본값)
  var homePanel = $('md-home');
  if(homePanel) homePanel.classList.add('act');

  // 3. 마스터 탭 버튼 초기화 (첫 번째 탭만 act)
  document.querySelectorAll('.mh-tab').forEach(function(t){ t.classList.remove('act'); });
  var firstTab = document.querySelector('.mh-tab');
  if(firstTab) firstTab.classList.add('act');

  // 4. 서브패널 전부 숨김 (sal-panel, cad-panel 등 inline display 초기화)
  ['sal-panel-table','sal-panel-quick','sal-panel-smart',
   'cad-panel-report','cad-panel-manual','cad-panel-grade'].forEach(function(id){
    var p=$(id); if(p) p.style.display='none';
  });

  // 5. 학생 대시보드로 이동
  go('view-student-dashboard');
  renderStudentTiles();
}

