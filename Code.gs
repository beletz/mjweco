// ==========================================
// 쇼미더머니 나라 - 백엔드 (Code.gs) v2.0
// ==========================================

// ==========================================
// 웹앱 초기 실행 (템플릿 평가 방식 적용)
// ==========================================
function doGet() {
  // 기존 createHtmlOutputFromFile 대신 createTemplateFromFile을 사용합니다.
  return HtmlService.createTemplateFromFile('Index')
    .evaluate() // 분리된 파일들을 합쳐서 HTML로 굽는(평가하는) 명령어입니다.
    .setTitle('쇼미더머니 나라')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// 다른 HTML 파일의 내용을 본문에 쏙 넣어주는 헬퍼 함수
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function cleanText(text) {
  if (!text) return "";
  return String(text).replace(/[\s\uFEFF\xA0]/g, '');
}

function getTodayStr() {
  var d = new Date();
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// ============================================================
// 캐시 헬퍼 (CacheService로 반복 시트 읽기 방지)
// ============================================================
function _getCache(type, classCode) {
  try {
    var raw = CacheService.getScriptCache().get(type+'_'+cleanText(classCode));
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function _setCache(type, classCode, data, ttl) {
  try {
    CacheService.getScriptCache().put(
      type+'_'+cleanText(classCode),
      JSON.stringify(data),
      ttl || 60
    );
  } catch(e) {}
}

function _clearCache(classCode) {
  try {
    var cc = cleanText(classCode);
    CacheService.getScriptCache().removeAll([
      'students_'     + cc,
      'stats_'        + cc,
      'banksettings_' + cc,
      'depcredit_'    + cc
    ]);
  } catch(e) {}
}

// ==========================================
// [교사] 회원가입 / 로그인
// Teachers: [0]이름 [1]이메일 [2]비밀번호 [3]보안질문 [4]보안답변
// ==========================================
function registerTeacher(form) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Teachers');
    if (!sheet) {
      sheet = ss.insertSheet('Teachers');
      sheet.appendRow(['이름','이메일','비밀번호','보안질문','보안답변']);
    }
    var data = sheet.getDataRange().getValues();
    var inputEmail = cleanText(form.email).toLowerCase();
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][1]).toLowerCase() === inputEmail)
        return { success: false, msg: "이미 가입된 이메일 주소입니다." };
    }
    sheet.appendRow([form.name, inputEmail, cleanText(form.password), form.securityQ, form.securityA]);
    return { success: true, msg: "회원가입이 완료되었습니다! 로그인해 주세요." };
  } catch(e) { return { success: false, msg: "오류: " + e.message }; }
}

function loginTeacher(form) {
  try {
    var email   = cleanText(form.email   || form.loginEmail).toLowerCase();
    var inputPw = cleanText(form.password|| form.loginPw);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Teachers');
    if (!sheet) return { success: false, msg: "가입 정보가 없습니다." };
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][1]).toLowerCase() === email && cleanText(data[i][2]) === inputPw)
        return { success: true, name: data[i][0], isTeacher: true };
    }
    return { success: false, msg: "이메일 또는 비밀번호가 일치하지 않습니다." };
  } catch(e) { return { success: false, msg: "시스템 에러: " + e.message }; }
}

// ==========================================
// [학급] 개설 / 관리자 로그인
// Classes: [0]학급명칭 [1]학급코드 [2]선생님성함 [3]관리자비밀번호
// ==========================================
function createClass(form) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Classes');
    if (!sheet) {
      sheet = ss.insertSheet('Classes');
      sheet.appendRow(['학급명칭','학급코드','선생님성함','관리자비밀번호']);
    }
    var data = sheet.getDataRange().getValues();
    var newCode = cleanText(form.classCode);
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][1]) === newCode)
        return { success: false, msg: "이미 존재하는 학급 코드입니다." };
    }
    sheet.appendRow([form.className, newCode, form.adminName, cleanText(form.adminPassword)]);
    return { success: true, msg: "학급이 성공적으로 개설되었습니다!" };
  } catch(e) { return { success: false, msg: "오류: " + e.message }; }
}

function loginClassAdmin(classCode, password) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Classes');
    if (!sheet) return { success: false, msg: "개설된 학급 정보가 없습니다." };
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode), cp = cleanText(password);
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][1]) === cc && cleanText(data[i][3]) === cp)
        return { success: true, className: data[i][0], adminName: data[i][2], classCode: data[i][1] };
    }
    return { success: false, msg: "학급 코드 또는 비밀번호가 틀렸습니다." };
  } catch(e) { return { success: false, msg: "오류: " + e.message }; }
}

// ==========================================
// [학생] 명단 관리
// Students: [0]학급코드 [1]학생번호 [2]이름 [3]직업 [4]카드잔액 [5]은행잔액 [6]신용점수 [7]학생코드
// ==========================================
function getOrCreateStudentsSheet(ss) {
  var sheet = ss.getSheetByName('Students');
  if (!sheet) {
    sheet = ss.insertSheet('Students');
    sheet.appendRow(['학급코드','학생번호','이름','직업','카드잔액','은행잔액','신용점수','학생코드']);
  }
  return sheet;
}

function generateCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getStudentList(classCode) {
  try {
    var cached = _getCache('students', classCode);
    if (cached) return cached;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateStudentsSheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode);
    var list = [];
    var stockMap = _stockValueMap(cc);   // 주식 평가액 (총 자산에 포함)
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) === cc) {
        list.push({
          studentNo: String(data[i][1]),
          name:      data[i][2] || '',
          job:       data[i][3] || '',
          card:      Number(data[i][4]) || 0,
          bank:      Number(data[i][5]) || 0,
          credit:    Number(data[i][6]) || 0,
          code:      data[i][7] || '',
          stock:     stockMap[cleanText(String(data[i][1]))] || 0
        });
      }
    }
    list.sort(function(a,b){ return Number(a.studentNo)-Number(b.studentNo); });
    var result = { success: true, list: list };
    _setCache('students', classCode, result, 15);
    return result;
  } catch(e) { return { success: false, msg: e.message }; }
}
function addStudent(classCode, studentNo, name, job) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateStudentsSheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode), sno = cleanText(String(studentNo));
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) === cc && cleanText(String(data[i][1])) === sno)
        return { success: false, msg: "이미 존재하는 학생번호입니다." };
    }
    var code = generateCode();
    sheet.appendRow([cc, sno, name||'', job||'', 0, 0, 0, code]);
    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    return { success: true, msg: "학생이 추가되었습니다.", code: code };
  } catch(e) { return { success: false, msg: e.message }; }
}
 
function bulkCreateStudents(classCode, count, startNo) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateStudentsSheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode);
    var start = parseInt(startNo)||1, cnt = parseInt(count);
    if (isNaN(cnt)||cnt<1||cnt>100) return { success: false, msg: "1~100명 사이로 입력해 주세요." };
    var existing = {};
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) === cc) existing[String(data[i][1])] = true;
    }
    var rows = [], added = 0;
    for (var n = start; n < start+cnt; n++) {
      if (!existing[String(n)]) {
        rows.push([cc, String(n), '', '', 0, 0, 0, generateCode()]);
        added++;
      }
    }
    if (rows.length > 0)
      sheet.getRange(sheet.getLastRow()+1, 1, rows.length, 8).setValues(rows);
    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    return { success: true, msg: added + "명이 생성되었습니다." };
  } catch(e) { return { success: false, msg: e.message }; }
}
 
function updateStudent(classCode, studentNo, name, job) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateStudentsSheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode), sno = cleanText(String(studentNo));
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0])===cc && cleanText(String(data[i][1]))===sno) {
        sheet.getRange(i+1,3).setValue(name||'');
        sheet.getRange(i+1,4).setValue(job||'');
        try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
        return { success: true, msg: "수정되었습니다." };
      }
    }
    return { success: false, msg: "학생을 찾을 수 없습니다." };
  } catch(e) { return { success: false, msg: e.message }; }
}
 
function deleteStudent(classCode, studentNo) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateStudentsSheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode), sno = cleanText(String(studentNo));
    for (var i = data.length-1; i >= 1; i--) {
      if (cleanText(data[i][0])===cc && cleanText(String(data[i][1]))===sno) {
        sheet.deleteRow(i+1);
        try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
        return { success: true, msg: "삭제되었습니다." };
      }
    }
    return { success: false, msg: "학생을 찾을 수 없습니다." };
  } catch(e) { return { success: false, msg: e.message }; }
}
 
function regenerateStudentCode(classCode, studentNo) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateStudentsSheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode), sno = cleanText(String(studentNo));
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0])===cc && cleanText(String(data[i][1]))===sno) {
        var newCode = generateCode();
        sheet.getRange(i+1,8).setValue(newCode);
        try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
        return { success: true, code: newCode };
      }
    }
    return { success: false, msg: "학생을 찾을 수 없습니다." };
  } catch(e) { return { success: false, msg: e.message }; }
}
 
function regenerateAllCodes(classCode) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateStudentsSheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode), cnt = 0;
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0])===cc) {
        sheet.getRange(i+1,8).setValue(generateCode());
        cnt++;
      }
    }
    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    return { success: true, msg: cnt + "명의 코드가 재생성되었습니다." };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [학생] 로그인
// ==========================================
function loginStudent(classCode, studentNo, studentCode) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateStudentsSheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc  = cleanText(classCode);
    var sno = cleanText(String(studentNo));
    var sc  = cleanText(studentCode).toUpperCase();
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0])===cc && cleanText(String(data[i][1]))===sno) {
        if (cleanText(String(data[i][7]||'')).toUpperCase() !== sc)
          return { success: false, msg: "학생 코드가 올바르지 않습니다." };
        return {
          success:   true,
          studentNo: data[i][1],
          name:      data[i][2]||'',
          job:       data[i][3]||'',
          card:      Number(data[i][4])||0,
          bank:      Number(data[i][5])||0,
          credit:    Number(data[i][6])||0,
          stock:     _stockValueMap(cc)[sno] || 0
        };
      }
    }
    return { success: false, msg: "학급코드 또는 학생번호가 올바르지 않습니다." };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [거래] 트랜잭션 시트
// Transactions: [0]날짜 [1]학급코드 [2]학생번호 [3]내역 [4]수입 [5]지출 [6]누적잔액(카드) [7]구분
// ==========================================
function getOrCreateTransSheet(ss) {
  var sheet = ss.getSheetByName('Transactions');
  if (!sheet) {
    sheet = ss.insertSheet('Transactions');
    sheet.appendRow(['날짜','학급코드','학생번호','내역','수입','지출','누적잔액(카드)','구분']);
  }
  return sheet;
}

function getTransactions(classCode, studentNo) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tSheet = getOrCreateTransSheet(ss);
    var data = tSheet.getDataRange().getValues();
    var cc = cleanText(classCode), sno = cleanText(String(studentNo));
    var list = [];
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][1])===cc && cleanText(String(data[i][2]))===sno) {
        list.push({
          rowNo:   i,
          date:    data[i][0],
          memo:    data[i][3],
          income:  data[i][4]||'',
          expense: data[i][5]||'',
          balance: data[i][6]||0,
          type:    data[i][7]||''
        });
      }
    }
    list.reverse();
    return { success: true, list: list.slice(0,50) };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 잔액 검증 헬퍼 (파산 방지) ──
function checkBankruptcy(card, bank) {
  return (Number(card)||0) < 0 || (Number(bank)||0) < 0;
}

// ==========================================
// [지출] 학생 직접 지출 기록
// ==========================================
// ==========================================
// [지출] 학생 직접 지출 기록 (LockService 적용)
// ==========================================
function recordExpense(classCode, studentNo, memo, amount) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000); // 5초 대기
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stuSheet = getOrCreateStudentsSheet(ss);
    var tSheet   = getOrCreateTransSheet(ss);
    var stuData  = stuSheet.getDataRange().getValues();
    var cc  = cleanText(classCode), sno = cleanText(String(studentNo));
    var amt = parseInt(amount);
    
    if (isNaN(amt)||amt<=0) return { success: false, msg: "금액을 올바르게 입력해 주세요." };
    if (!memo||cleanText(memo)==='') return { success: false, msg: "내역을 입력해 주세요." };
    
    var stuRowIdx = -1, cardBalance = 0;
    for (var i = 1; i < stuData.length; i++) {
      if (cleanText(stuData[i][0])===cc && cleanText(String(stuData[i][1]))===sno) {
        stuRowIdx = i+1; cardBalance = Number(stuData[i][4])||0; break;
      }
    }
    if (stuRowIdx===-1) return { success: false, msg: "학생 정보를 찾을 수 없습니다." };
    
    var newCard = cardBalance - amt;
    if (newCard < 0) return { success: false, msg: "잔액이 부족합니다. 파산 위기! 카드 잔액: " + cardBalance + " 머니" };
    
    stuSheet.getRange(stuRowIdx,5).setValue(newCard);
    tSheet.appendRow([getTodayStr(), cc, sno, cleanText(memo), '', amt, newCard, '학생직접입력']);
    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    
    // SpreadSheet가 완전히 업데이트 되도록 강제 적용 (안정성 증가)
    SpreadsheetApp.flush(); 
    
    return { success: true, msg: "지출이 기록되었습니다.", newCard: newCard };
    
  } catch(e) { 
    if(e.message.match(/lock/i)) return { success: false, msg: "🚦 현재 처리량이 많습니다. 2~3초 뒤에 다시 시도해주세요." };
    return { success: false, msg: e.message }; 
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// [수입] 교사 → 학생 지급 (월급/주급/보상)
// ==========================================
function recordIncome(classCode, studentNo, memo, amount, type) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stuSheet = getOrCreateStudentsSheet(ss);
    var tSheet   = getOrCreateTransSheet(ss);
    var stuData  = stuSheet.getDataRange().getValues();
    var cc  = cleanText(classCode), sno = cleanText(String(studentNo));
    var amt = parseInt(amount);
    if (isNaN(amt)||amt<=0) return { success: false, msg: "금액을 올바르게 입력해 주세요." };
    if (!memo||cleanText(memo)==='') return { success: false, msg: "내역을 입력해 주세요." };
    var stuRowIdx = -1, cardBalance = 0;
    for (var i = 1; i < stuData.length; i++) {
      if (cleanText(stuData[i][0])===cc && cleanText(String(stuData[i][1]))===sno) {
        stuRowIdx = i+1; cardBalance = Number(stuData[i][4])||0; break;
      }
    }
    if (stuRowIdx===-1) return { success: false, msg: "학생 정보를 찾을 수 없습니다." };
    var newCard = cardBalance + amt;
    stuSheet.getRange(stuRowIdx,5).setValue(newCard);
    tSheet.appendRow([getTodayStr(), cc, sno, cleanText(memo), amt, '', newCard, type||'교사지급']);
    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    return { success: true, msg: "지급 완료!", newCard: newCard };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 전체 학생 일괄 지급 (월급/주급) ──
function recordIncomeBulk(classCode, memo, amount, type) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stuSheet = getOrCreateStudentsSheet(ss);
    var tSheet   = getOrCreateTransSheet(ss);
    var stuData  = stuSheet.getDataRange().getValues();
    var cc  = cleanText(classCode);
    var amt = parseInt(amount);
    if (isNaN(amt)||amt<=0) return { success: false, msg: "금액을 올바르게 입력해 주세요." };
    var count = 0, today = getTodayStr();
    var rows = [];
    for (var i = 1; i < stuData.length; i++) {
      if (cleanText(stuData[i][0])===cc) {
        var card = Number(stuData[i][4])||0;
        var newCard = card + amt;
        stuSheet.getRange(i+1,5).setValue(newCard);
        rows.push([today, cc, String(stuData[i][1]), cleanText(memo), amt, '', newCard, type||'일괄지급']);
        count++;
      }
    }
    if (rows.length>0)
      tSheet.getRange(tSheet.getLastRow()+1,1,rows.length,8).setValues(rows);
    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    return { success: true, msg: count + "명에게 " + amt + " 머니 지급 완료!" };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [은행] 예금 기능
// Deposits: [0]학급코드 [1]학생번호 [2]예금종류(1~4주) [3]원금 [4]이자율 [5]시작일 [6]만기일 [7]상태(활성/만기/해지)
// ==========================================
function getOrCreateDepositsSheet(ss) {
  var sheet = ss.getSheetByName('Deposits');
  if (!sheet) {
    sheet = ss.insertSheet('Deposits');
    sheet.appendRow(['학급코드','학생번호','예금종류','원금','이자율','시작일','만기일','상태']);
  }
  return sheet;
}

// ── 예금 이자율 설정/조회 (BankSettings 시트) ──
// BankSettings: [0]학급코드 [1]1주이자율 [2]2주이자율 [3]3주이자율 [4]4주이자율
function getOrCreateBankSettingsSheet(ss) {
  var sheet = ss.getSheetByName('BankSettings');
  if (!sheet) {
    sheet = ss.insertSheet('BankSettings');
    sheet.appendRow(['학급코드','1주이자율','2주이자율','3주이자율','4주이자율','우대금리']);
  }
  return sheet;
}

function getBankSettings(classCode) {
  try {
    var cached = _getCache('banksettings', classCode);
    if (cached) return cached;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateBankSettingsSheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode);
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) === cc) {
        var p = (data[i][5] !== undefined && data[i][5] !== '') ? Number(data[i][5]) : 2.0;
        var result = { success: true, r1: Number(data[i][1])||3, r2: Number(data[i][2])||5, r3: Number(data[i][3])||8, r4: Number(data[i][4])||12, prime: p };
        _newsBankRates(classCode, result);
        _setCache('banksettings', classCode, result, 120);
        return result;
      }
    }
    var def = _newsBankRates(classCode, { success: true, r1: 3, r2: 5, r3: 8, r4: 12, prime: 2.0 });
    _setCache('banksettings', classCode, def, 120);
    return def;
  } catch(e) { return { success: false, msg: e.message }; }
}

function setBankSettings(classCode, r1, r2, r3, r4, prime) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateBankSettingsSheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode);
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) === cc) {
        sheet.getRange(i+1,2,1,5).setValues([[Number(r1)||0, Number(r2)||0, Number(r3)||0, Number(r4)||0, Number(prime)||0]]);
        try { CacheService.getScriptCache().remove('banksettings_'+cc); } catch(e){}
        return { success: true, msg: "이자율과 우대금리가 저장되었습니다." };
      }
    }
    sheet.appendRow([cc, Number(r1)||0, Number(r2)||0, Number(r3)||0, Number(r4)||0, Number(prime)||0]);
    try { CacheService.getScriptCache().remove('banksettings_'+cc); } catch(e){}
    return { success: true, msg: "이자율과 우대금리가 저장되었습니다." };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 은행청장이 날짜·이율을 직접 지정해서 예금 등록 ──
function createDepositByBanker(classCode, studentNo, weeks, amount, finalRate, startDate) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
 
    var ss       = SpreadsheetApp.getActiveSpreadsheet();
    var stuSheet = getOrCreateStudentsSheet(ss);
    var depSheet = getOrCreateDepositsSheet(ss);
    var tSheet   = getOrCreateTransSheet(ss);
    var stuData  = stuSheet.getDataRange().getValues();
    var cc  = cleanText(classCode);
    var sno = cleanText(String(studentNo));
    var amt = parseInt(amount);
    var wk  = parseInt(weeks);
    var rate = parseFloat(finalRate);
 
    if (isNaN(amt) || amt <= 0) return { success: false, msg: "금액을 올바르게 입력해 주세요." };
 
    var stuRowIdx = -1, cardBalance = 0, bankBalance = 0;
    for (var i = 1; i < stuData.length; i++) {
      if (cleanText(stuData[i][0]) === cc && cleanText(String(stuData[i][1])) === sno) {
        stuRowIdx = i + 1;
        cardBalance = Number(stuData[i][4]) || 0;
        bankBalance = Number(stuData[i][5]) || 0;
        break;
      }
    }
    if (stuRowIdx === -1) return { success: false, msg: "학생 정보를 찾을 수 없습니다." };
    if (cardBalance < amt) return { success: false, msg: "카드 잔액이 부족합니다. (보유: " + cardBalance + " 머니)" };
 
    var start   = new Date(startDate);
    var expire  = new Date(start.getTime() + wk * 7 * 24 * 60 * 60 * 1000);
    var expireStr = Utilities.formatDate(expire, Session.getScriptTimeZone(), 'yyyy-MM-dd');
 
    var newCard = cardBalance - amt;
    var newBank = bankBalance + amt;
 
    stuSheet.getRange(stuRowIdx, 5).setValue(newCard);
    stuSheet.getRange(stuRowIdx, 6).setValue(newBank);
    depSheet.appendRow([cc, sno, wk + '주', amt, rate, startDate, expireStr, '활성']);
    tSheet.appendRow([startDate, cc, sno, wk + '주 예금 가입 (은행청장 등록, ' + rate + '%)', '', amt, newCard, '예금가입']);
 
    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    SpreadsheetApp.flush();
    return { success: true, msg: wk + "주 예금 등록 완료!" };
 
  } catch(e) {
    if (e.message.match(/lock/i)) return { success: false, msg: "🚦 서버가 혼잡합니다. 잠시 후 다시 시도해주세요." };
    return { success: false, msg: e.message };
  } finally {
    lock.releaseLock();
  }
}

// ── 예금 기록 수정 (은행청장: 이자율 + 만기일 변경) ──
// byTeacher=true(교사)만 수정 가능 (만기일을 앞당겨 중도 해지 신용점수 하락을 피하지 못하게)
function editDepositByBanker(classCode, rowNo, newRate, newExpireDate, byTeacher) {
  try {
    if (byTeacher !== true) return { success: false, msg: "예금 수정은 선생님만 할 수 있어요." };
    var ss       = SpreadsheetApp.getActiveSpreadsheet();
    var depSheet = getOrCreateDepositsSheet(ss);
    var depData  = depSheet.getDataRange().getValues();
    var cc = cleanText(classCode);
    var rn = parseInt(rowNo); // depData[rn] = 해당 행, 시트 행 = rn+1

    if(rn < 1 || rn >= depData.length)
      return { success: false, msg: "해당 예금 기록을 찾을 수 없습니다." };
    if(cleanText(depData[rn][0]) !== cc)
      return { success: false, msg: "접근 권한이 없습니다." };

    // Deposits: col5=이자율, col7=만기일 (1-indexed)
    depSheet.getRange(rn + 1, 5).setValue(parseFloat(newRate) || 0);
    depSheet.getRange(rn + 1, 7).setValue(newExpireDate);
    SpreadsheetApp.flush();
    return { success: true, msg: "수정 완료" };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 예금 기록 삭제 (은행청장) ──
// byTeacher=true(교사)만 진행 중인 예금을 삭제할 수 있음 (중도 해지 신용점수 하락을 삭제로 피하지 못하게)
function deleteDepositByBanker(classCode, rowNo, byTeacher) {
  try {
    var ss       = SpreadsheetApp.getActiveSpreadsheet();
    var depSheet = getOrCreateDepositsSheet(ss);
    var depData  = depSheet.getDataRange().getValues();
    var cc = cleanText(classCode);
    var rn = parseInt(rowNo);

    if(rn < 1 || rn >= depData.length)
      return { success: false, msg: "해당 예금 기록을 찾을 수 없습니다." };
    if(cleanText(depData[rn][0]) !== cc)
      return { success: false, msg: "접근 권한이 없습니다." };

    if (cleanText(depData[rn][7]) === '활성' && byTeacher !== true)
      return { success: false, msg: "진행 중인 예금은 선생님만 삭제할 수 있어요. 해지하려면 중도 해지를 눌러 주세요. 잘못 만든 예금이면 선생님께 말씀드려 주세요." };

    // ★ 아직 살아 있는(활성) 예금이면, 은행에 묶인 원금을 카드로 돌려준 뒤 지움
    //   (예전에는 기록만 지워서 은행 잔액이 그대로 남는 오류가 있었음)
    var refundMsg = '';
    if (cleanText(depData[rn][7]) === '활성') {
      var sno       = cleanText(String(depData[rn][1]));
      var principal = Number(depData[rn][3]) || 0;
      var stuSheet  = getOrCreateStudentsSheet(ss);
      var stuData   = stuSheet.getDataRange().getValues();
      for (var i = 1; i < stuData.length; i++) {
        if (cleanText(stuData[i][0]) === cc && cleanText(String(stuData[i][1])) === sno) {
          var newBank = (Number(stuData[i][5]) || 0) - principal;
          var newCard = (Number(stuData[i][4]) || 0) + principal;
          stuSheet.getRange(i + 1, 5).setValue(newCard);
          stuSheet.getRange(i + 1, 6).setValue(newBank);
          getOrCreateTransSheet(ss).appendRow([getTodayStr(), cc, sno,
            String(depData[rn][2]) + ' 예금 삭제 (원금 ' + principal + '머니 카드로 반환)', principal, '', newCard, '예금삭제']);
          refundMsg = ' 원금 ' + principal + ' 머니를 카드로 돌려줬어요.';
          break;
        }
      }
      try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    }

    depSheet.deleteRow(rn + 1); // 시트 행 = 배열 인덱스 + 1
    SpreadsheetApp.flush();
    return { success: true, msg: "삭제 완료!" + refundMsg };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 은행 잔액 점검·정리 (선생님) ──
// 은행 잔액은 '활성' 예금 원금의 합과 같아야 함. 예금 없이 은행에 남은 돈은 카드로 돌려줌.
// apply=false 이면 점검만 하고 바꾸지 않음.
function repairBankBalances(classCode, apply) {
  try {
    var ss       = SpreadsheetApp.getActiveSpreadsheet();
    var cc       = cleanText(classCode);
    var stuSheet = getOrCreateStudentsSheet(ss);
    var stuData  = stuSheet.getDataRange().getValues();
    var depData  = getOrCreateDepositsSheet(ss).getDataRange().getValues();
    var active = {};
    for (var j = 1; j < depData.length; j++) {
      if (cleanText(depData[j][0]) !== cc || cleanText(depData[j][7]) !== '활성') continue;
      var k = cleanText(String(depData[j][1]));
      active[k] = (active[k] || 0) + (Number(depData[j][3]) || 0);
    }
    var fixes = [], short = [], tSheet = null;
    for (var i = 1; i < stuData.length; i++) {
      if (cleanText(stuData[i][0]) !== cc) continue;
      var sno = cleanText(String(stuData[i][1]));
      var bank = Number(stuData[i][5]) || 0, card = Number(stuData[i][4]) || 0;
      var should = active[sno] || 0;
      if (bank > should) {
        var extra = bank - should;
        fixes.push({ studentNo: sno, name: stuData[i][2] || '', bank: bank, should: should, extra: extra });
        if (apply) {
          stuSheet.getRange(i + 1, 5).setValue(card + extra);
          stuSheet.getRange(i + 1, 6).setValue(should);
          tSheet = tSheet || getOrCreateTransSheet(ss);
          tSheet.appendRow([getTodayStr(), cc, sno, '은행 잔액 정리 (예금 없이 남은 ' + extra + '머니 카드로 반환)', extra, '', card + extra, '은행정리']);
        }
      } else if (bank < should) {
        short.push({ studentNo: sno, name: stuData[i][2] || '', bank: bank, should: should });
      }
    }
    if (apply && fixes.length) {
      try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
      SpreadsheetApp.flush();
    }
    return { success: true, fixes: fixes, short: short, applied: !!apply };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 은행청장: 만기 지급 처리 ──
function redeemDepositByBanker(classCode, studentNo, depositRowNo) {
  try {
    var ss       = SpreadsheetApp.getActiveSpreadsheet();
    var stuSheet = getOrCreateStudentsSheet(ss);
    var depSheet = getOrCreateDepositsSheet(ss);
    var tSheet   = getOrCreateTransSheet(ss);
    var stuData  = stuSheet.getDataRange().getValues();
    var depData  = depSheet.getDataRange().getValues();
    var cc  = cleanText(classCode);
    var sno = cleanText(String(studentNo));

    var depRowIdx = parseInt(depositRowNo) + 1;
    if (depRowIdx < 2 || depRowIdx >= depData.length + 1)
      return { success: false, msg: '예금 기록을 찾을 수 없습니다.' };

    var rowData = depData[depRowIdx - 1];
    if (cleanText(rowData[7]) !== '활성')
      return { success: false, msg: '이미 처리된 예금입니다.' };

    var principal = Number(rowData[3]) || 0;
    var rate      = Number(rowData[4]) || 0;
    var wkLabel   = String(rowData[2]);          // "1주", "2주" 등
    var wkNum     = parseInt(wkLabel) || 0;       // 숫자만 추출
    var interest  = Math.floor(principal * rate / 100);
    var total     = principal + interest;

    // ★ 만기 해지 신용점수 조회
    var creditSettings = getDepositCreditSettings(classCode);
    var creditMap = {
      1: creditSettings.c1||0, 2: creditSettings.c2||0,
      3: creditSettings.c3||0, 4: creditSettings.c4||0
    };
    var creditGain = creditMap[wkNum] || 0;

    var stuRowIdx = -1, cardBalance = 0, bankBalance = 0, currentCredit = 0;
    for (var i = 1; i < stuData.length; i++) {
      if (cleanText(stuData[i][0]) === cc && cleanText(String(stuData[i][1])) === sno) {
        stuRowIdx     = i + 1;
        cardBalance   = Number(stuData[i][4]) || 0;
        bankBalance   = Number(stuData[i][5]) || 0;
        currentCredit = Number(stuData[i][6]) || 0;
        break;
      }
    }
    if (stuRowIdx === -1) return { success: false, msg: '학생 정보를 찾을 수 없습니다.' };

    var newBank   = bankBalance - principal;
    var newCard   = cardBalance + total;
    var newCredit = Math.min(100, currentCredit + creditGain);

    stuSheet.getRange(stuRowIdx, 5).setValue(newCard);
    stuSheet.getRange(stuRowIdx, 6).setValue(newBank);
    if (creditGain > 0) stuSheet.getRange(stuRowIdx, 7).setValue(newCredit); // ★ 신용점수 부여

    depSheet.getRange(depRowIdx, 8).setValue('만기해지');
    tSheet.appendRow([getTodayStr(), cc, sno,
      wkLabel+' 만기해지 (원금+이자) — 신용점수 +'+creditGain+'점 자동 부여',
      total, '', newCard, '예금만기']);

    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    SpreadsheetApp.flush();
    return {
      success: true,
      msg: '만기 지급 완료! '+total.toLocaleString()+'머니 지급 + 신용점수 +'+creditGain+'점 부여',
      creditGain: creditGain,
      newCredit: newCredit
    };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 은행청장: 중도 해지 처리 ──
function cancelDepositByBanker(classCode, studentNo, depositRowNo) {
  try {
    var ss       = SpreadsheetApp.getActiveSpreadsheet();
    var stuSheet = getOrCreateStudentsSheet(ss);
    var depSheet = getOrCreateDepositsSheet(ss);
    var tSheet   = getOrCreateTransSheet(ss);
    var stuData  = stuSheet.getDataRange().getValues();
    var depData  = depSheet.getDataRange().getValues();
    var cc  = cleanText(classCode);
    var sno = cleanText(String(studentNo));
 
    var depRowIdx = parseInt(depositRowNo) + 1;
    if (depRowIdx < 2 || depRowIdx >= depData.length + 1)
      return { success: false, msg: "예금 기록을 찾을 수 없습니다." };
 
    var rowData   = depData[depRowIdx - 1];
    if (cleanText(rowData[7]) !== '활성')
      return { success: false, msg: "이미 처리된 예금입니다." };
 
    var principal = Number(rowData[3]) || 0;
    var wkLabel   = rowData[2];
 
    // ★ 예금 기간별 신용점수 하락 (0점 아래로는 내려가지 않음)
    var creditSettings = getDepositCreditSettings(classCode);
    if (!creditSettings.success) return creditSettings;
    var penalty = creditSettings.penalties[(parseInt(wkLabel) || 0) - 1] || 0;

    var stuRowIdx = -1, cardBalance = 0, bankBalance = 0, currentCredit = 0;
    for (var i = 1; i < stuData.length; i++) {
      if (cleanText(stuData[i][0]) === cc && cleanText(String(stuData[i][1])) === sno) {
        stuRowIdx = i + 1; cardBalance = Number(stuData[i][4]) || 0; bankBalance = Number(stuData[i][5]) || 0;
        currentCredit = Number(stuData[i][6]) || 0; break;
      }
    }
    if (stuRowIdx === -1) return { success: false, msg: "학생 정보를 찾을 수 없습니다." };
 
    var newBank = bankBalance - principal;
    var newCard = cardBalance + principal;
    var newCredit = penalty > 0 ? Math.max(0, currentCredit - penalty) : currentCredit;
    var creditLoss = currentCredit - newCredit;
 
    stuSheet.getRange(stuRowIdx, 5).setValue(newCard);
    stuSheet.getRange(stuRowIdx, 6).setValue(newBank);
    if (creditLoss > 0) stuSheet.getRange(stuRowIdx, 7).setValue(newCredit);
    depSheet.getRange(depRowIdx, 8).setValue('중도해지');
    tSheet.appendRow([getTodayStr(), cc, sno, wkLabel + ' 중도해지 (원금만 반환)' + (creditLoss > 0 ? ' — 신용점수 -' + creditLoss + '점' : ''), principal, '', newCard, '예금중도해지']);
 
    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    SpreadsheetApp.flush();
    return { success: true, newCredit: newCredit, creditLoss: creditLoss,
      msg: "중도 해지 완료! 원금 " + principal + " 머니 반환" + (creditLoss > 0 ? "\n신용점수 -" + creditLoss + "점 (" + currentCredit + " → " + newCredit + "점)" : "") };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 내 예금 목록 조회 ──
function getMyDeposits(classCode, studentNo) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var depSheet = getOrCreateDepositsSheet(ss);
    var data = depSheet.getDataRange().getValues();
    var cc = cleanText(classCode), sno = cleanText(String(studentNo));
    var list = [];
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0])===cc && cleanText(String(data[i][1]))===sno) {
        list.push({
          idx:       list.length,
          type:      data[i][2],
          principal: Number(data[i][3])||0,
          rate:      Number(data[i][4])||0,
          startDate: data[i][5],
          expireDate:data[i][6],
          status:    data[i][7]
        });
      }
    }
    list.reverse();
    return { success: true, list: list };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 전체 예금 목록 (은행청장용) ──
function getAllDeposits(classCode) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var depSheet = getOrCreateDepositsSheet(ss);
    var stuSheet = getOrCreateStudentsSheet(ss);
    var depData = depSheet.getDataRange().getValues();
    var stuData = stuSheet.getDataRange().getValues();
    var cc = cleanText(classCode);
    // 학생 이름 맵
    var nameMap = {};
    for (var i=1; i<stuData.length; i++) {
      if (cleanText(stuData[i][0])===cc) nameMap[String(stuData[i][1])]=stuData[i][2]||'';
    }
    var list = [];
    for (var j = 1; j < depData.length; j++) {
      if (cleanText(depData[j][0])===cc) {
        var sno = String(depData[j][1]);
        list.push({
  rowNo:      j,
  studentNo:  sno,
  name:       nameMap[sno] || '',
  type:       String(depData[j][2] || ''),
  principal:  Number(depData[j][3]) || 0,
  rate:       Number(depData[j][4]) || 0,
  // ★ 날짜가 Date 객체인 경우 강제로 문자열 변환
  startDate:  depData[j][5] instanceof Date
                ? Utilities.formatDate(depData[j][5], Session.getScriptTimeZone(), 'yyyy-MM-dd')
                : String(depData[j][5] || ''),
  expireDate: depData[j][6] instanceof Date
                ? Utilities.formatDate(depData[j][6], Session.getScriptTimeZone(), 'yyyy-MM-dd')
                : String(depData[j][6] || ''),
  status:     String(depData[j][7] || '')
});
      }
    }
    list.reverse();
    return { success: true, list: list };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 학생 직접 예금 가입 (카드 → 은행) ──
function createDeposit(classCode, studentNo, weeks, amount) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var ss       = SpreadsheetApp.getActiveSpreadsheet();
    var stuSheet = getOrCreateStudentsSheet(ss);
    var depSheet = getOrCreateDepositsSheet(ss);
    var tSheet   = getOrCreateTransSheet(ss);
    var stuData  = stuSheet.getDataRange().getValues();
    var cc  = cleanText(classCode), sno = cleanText(String(studentNo));
    var amt = parseInt(amount), wk = parseInt(weeks);
    if (isNaN(amt)||amt<=0) return { success: false, msg: "금액을 올바르게 입력해 주세요." };
    if ([1,2,3,4].indexOf(wk)===-1) return { success: false, msg: "예금 기간을 선택해 주세요." };
 
    var settings = getBankSettings(classCode);
    var rateMap  = { 1: settings.r1, 2: settings.r2, 3: settings.r3, 4: settings.r4 };
    var rate     = rateMap[wk];
 
    var stuRowIdx=-1, cardBalance=0, bankBalance=0;
    for (var i=1; i<stuData.length; i++) {
      if (cleanText(stuData[i][0])===cc && cleanText(String(stuData[i][1]))===sno) {
        stuRowIdx=i+1; cardBalance=Number(stuData[i][4])||0; bankBalance=Number(stuData[i][5])||0; break;
      }
    }
    if (stuRowIdx===-1) return { success: false, msg: "학생 정보를 찾을 수 없습니다." };
    if (cardBalance < amt) return { success: false, msg: "카드 잔액이 부족합니다. (보유: "+cardBalance+" 머니)" };
 
    var today     = new Date();
    var expire    = new Date(today.getTime() + wk*7*24*60*60*1000);
    var todayStr  = getTodayStr();
    var expireStr = Utilities.formatDate(expire, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var newCard   = cardBalance - amt;
    var newBank   = bankBalance + amt;
 
    stuSheet.getRange(stuRowIdx,5).setValue(newCard);
    stuSheet.getRange(stuRowIdx,6).setValue(newBank);
    depSheet.appendRow([cc, sno, wk+'주', amt, rate, todayStr, expireStr, '활성']);
    tSheet.appendRow([todayStr, cc, sno, wk+'주 예금 가입 ('+rate+'%)', '', amt, newCard, '예금가입']);
    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    SpreadsheetApp.flush();
    return { success: true, msg: wk+"주 예금 가입 완료! (이자율 "+rate+"%)", newCard: newCard, newBank: newBank };
 
  } catch(e) {
    if(e.message.match(/lock/i)) return { success: false, msg: "🚦 은행에 손님이 많습니다. 잠시 후 다시 눌러주세요." };
    return { success: false, msg: e.message };
  } finally {
    lock.releaseLock();
  }
}

// ── 학생 직접 예금 만기 해지 (은행 → 카드, 이자 포함) ──
function redeemDeposit(classCode, studentNo, depositIdx) {
  try {
    var ss       = SpreadsheetApp.getActiveSpreadsheet();
    var stuSheet = getOrCreateStudentsSheet(ss);
    var depSheet = getOrCreateDepositsSheet(ss);
    var tSheet   = getOrCreateTransSheet(ss);
    var stuData  = stuSheet.getDataRange().getValues();
    var depData  = depSheet.getDataRange().getValues();
    var cc  = cleanText(classCode), sno = cleanText(String(studentNo));

    var stuRowIdx = -1, cardBalance = 0, bankBalance = 0, currentCredit = 0;
    for (var i = 1; i < stuData.length; i++) {
      if (cleanText(stuData[i][0])===cc && cleanText(String(stuData[i][1]))===sno) {
        stuRowIdx     = i+1;
        cardBalance   = Number(stuData[i][4])||0;
        bankBalance   = Number(stuData[i][5])||0;
        currentCredit = Number(stuData[i][6])||0;
        break;
      }
    }
    if (stuRowIdx===-1) return { success: false, msg: '학생 정보를 찾을 수 없습니다.' };

    var depRowIdx = -1, principal = 0, rate = 0, wkLabel = '';
    var rowNum = 0;
    for (var j = 1; j < depData.length; j++) {
      if (cleanText(depData[j][0])===cc && cleanText(String(depData[j][1]))===sno && cleanText(depData[j][7])==='활성') {
        if (rowNum === parseInt(depositIdx)) {
          depRowIdx = j+1;
          principal = Number(depData[j][3])||0;
          rate      = Number(depData[j][4])||0;
          wkLabel   = String(depData[j][2]);
          break;
        }
        rowNum++;
      }
    }
    if (depRowIdx===-1) return { success: false, msg: '예금을 찾을 수 없습니다.' };

    var interest = Math.floor(principal * rate / 100);
    var total    = principal + interest;
    var newBank  = bankBalance - principal;
    var newCard  = cardBalance + total;

    // ★ 만기 해지 신용점수 조회 및 부여
    var wkNum          = parseInt(wkLabel) || 0;
    var creditSettings = getDepositCreditSettings(classCode);
    var creditMap      = {
      1: creditSettings.c1||0, 2: creditSettings.c2||0,
      3: creditSettings.c3||0, 4: creditSettings.c4||0
    };
    var creditGain = creditMap[wkNum] || 0;
    var newCredit  = Math.min(100, currentCredit + creditGain);

    stuSheet.getRange(stuRowIdx,5).setValue(newCard);
    stuSheet.getRange(stuRowIdx,6).setValue(newBank);
    if (creditGain > 0) stuSheet.getRange(stuRowIdx,7).setValue(newCredit);

    depSheet.getRange(depRowIdx,8).setValue('만기해지');
    tSheet.appendRow([getTodayStr(), cc, sno,
      wkLabel+' 예금 만기해지 (원금+이자) — 신용점수 +'+creditGain+'점 자동 부여',
      total, '', newCard, '예금만기']);

    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}

    return {
      success: true,
      msg: '만기 해지 완료! 원금'+principal+' + 이자'+interest+' = '+total+'머니 지급 + 신용점수 +'+creditGain+'점 부여',
      newCard: newCard, newBank: newBank, interest: interest,
      creditGain: creditGain, newCredit: newCredit
    };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [신용] 신용점수 수동 조정
// ==========================================
function adjustCredit(classCode, studentNo, delta, reason) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stuSheet = getOrCreateStudentsSheet(ss);
    var data = stuSheet.getDataRange().getValues();
    var cc = cleanText(classCode), sno = cleanText(String(studentNo));
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0])===cc && cleanText(String(data[i][1]))===sno) {
        var cur = Number(data[i][6])||0;
        var next = Math.max(0, Math.min(100, cur + parseInt(delta)));
        stuSheet.getRange(i+1,7).setValue(next);
        try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
        return { success: true, msg: "신용점수 조정 완료 ("+cur+" → "+next+")", newCredit: next };
      }
    }
    return { success: false, msg: "학생을 찾을 수 없습니다." };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 신용점수 일괄 조정 ──
function adjustCreditBulk(classCode, delta, reason) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stuSheet = getOrCreateStudentsSheet(ss);
    var data = stuSheet.getDataRange().getValues();
    var cc = cleanText(classCode), cnt = 0;
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0])===cc) {
        var cur = Number(data[i][6])||0;
        var next = Math.max(0, Math.min(100, cur + parseInt(delta)));
        stuSheet.getRange(i+1,7).setValue(next);
        cnt++;
      }
    }
    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    return { success: true, msg: cnt+"명 신용점수 일괄 조정 완료" };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [신용] 대기(CreditPending) 큐에 델타를 자동 반영하는 헬퍼
// - 상태가 '승인'이 아닌 기존 항목이 있으면 델타를 가산 (누적)
// - 없으면 false를 반환 (호출부에서 신규 생성하거나 직접 반영하도록 함)
// ==========================================
function _adjustPendingIfExists(classCode, studentNo, delta) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateCreditPendingSheet(ss);
  var data  = sheet.getDataRange().getValues();
  var cc    = cleanText(classCode), sno = cleanText(String(studentNo));
  for (var i = 1; i < data.length; i++) {
    if (cleanText(data[i][0]) === cc && cleanText(String(data[i][1])) === sno
        && String(data[i][4]) !== '승인') {
      var newDelta = (Number(data[i][3]) || 0) + delta;
      sheet.getRange(i+1, 4).setValue(newDelta);
      sheet.getRange(i+1, 5).setValue('대기');
      sheet.getRange(i+1, 6).setValue(getTodayStr());
      sheet.getRange(i+1, 7).setValue('');
      SpreadsheetApp.flush();
      return true;
    }
  }
  return false;
}

// ── 경찰서(벌금) 등 자동화된 소스에서 신용위원회 "대기" 큐에 델타 등록 ──
function queuePendingCreditDelta(classCode, studentNo, studentName, delta) {
  try {
    var d = parseInt(delta);
    if (isNaN(d) || d === 0) return { success: false, msg: '변화량이 올바르지 않습니다.' };

    if (_adjustPendingIfExists(classCode, studentNo, d)) {
      return { success: true, msg: '신용위원회 대기 큐에 반영되었습니다.' };
    }

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateCreditPendingSheet(ss);
    sheet.appendRow([cleanText(classCode), cleanText(String(studentNo)), studentName||'', d, '대기', getTodayStr(), '']);
    SpreadsheetApp.flush();
    return { success: true, msg: '신용위원회 대기 큐에 등록되었습니다.', delta: d };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [국고] 국세청 예산 관리
// Treasury: [0]학급코드 [1]날짜 [2]내용 [3]구분(수입/지출) [4]금액 [5]상태(대기/승인/반려) [6]등록자번호 [7]처리일
// ==========================================
function getOrCreateTreasurySheet(ss) {
  var sheet = ss.getSheetByName('Treasury');
  if (!sheet) {
    sheet = ss.insertSheet('Treasury');
    sheet.appendRow(['학급코드','날짜','내용','구분','금액','상태','등록자번호','처리일']);
  }
  return sheet;
}

function getTreasuryStatus(classCode) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateTreasurySheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode);
    var list = [], balance = 0, totalIncome = 0, totalExpense = 0, pendingCount = 0;
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) !== cc) continue;
      var type   = String(data[i][3] || '');
      var amount = Number(data[i][4]) || 0;
      var status = String(data[i][5] || '대기');
      if (status === '승인') {
        if (type === '수입') { balance += amount; totalIncome += amount; }
        else if (type === '지출') { balance -= amount; totalExpense += amount; }
      }
      if (status === '대기') pendingCount++;
      var dateVal = data[i][1];
      var dateStr = dateVal instanceof Date ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(dateVal || '');
      var procVal = data[i][7];
      var procStr = procVal instanceof Date ? Utilities.formatDate(procVal, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(procVal || '');
      list.push({ rowNo: i, date: dateStr, memo: String(data[i][2]||''), type: type, amount: amount, status: status, registeredBy: String(data[i][6]||''), processedAt: procStr });
    }
    list.reverse();
    return { success: true, list: list, balance: balance, totalIncome: totalIncome, totalExpense: totalExpense, pendingCount: pendingCount };
  } catch(e) { return { success: false, msg: e.message }; }
}

function addTreasuryRecord(classCode, studentNo, date, memo, type, amount) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateTreasurySheet(ss);
    var amt = parseInt(amount);
    if (isNaN(amt)||amt<=0) return { success: false, msg: "금액을 올바르게 입력해 주세요." };
    if (!memo||cleanText(memo)==='') return { success: false, msg: "내용을 입력해 주세요." };
    if (!date) return { success: false, msg: "날짜를 입력해 주세요." };
    if (type!=='수입'&&type!=='지출') return { success: false, msg: "구분을 선택해 주세요." };
    sheet.appendRow([cleanText(classCode), date, cleanText(memo), type, amt, '대기', String(studentNo||''), '']);
    return { success: true, msg: "저장 완료! 교사 승인 후 국고에 반영됩니다." };
  } catch(e) { return { success: false, msg: e.message }; }
}

// byTeacher=true(교사·마스터 계정)이면 승인된 기록도 수정 가능. 교사가 고친 기록은 승인 상태를 그대로 유지
function editTreasuryRecord(classCode, rowNo, date, memo, type, amount, byTeacher) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateTreasurySheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode), rn = parseInt(rowNo);
    var teacher = byTeacher === true;
    if (rn<1||rn>=data.length) return { success: false, msg: "기록을 찾을 수 없습니다." };
    if (cleanText(data[rn][0])!==cc) return { success: false, msg: "접근 권한이 없습니다." };
    if (String(data[rn][5])==='승인' && !teacher) return { success: false, msg: "승인된 기록은 선생님만 수정할 수 있습니다." };
    var amt = parseInt(amount);
    if (isNaN(amt)||amt<=0) return { success: false, msg: "금액을 올바르게 입력해 주세요." };
    if (type!=='수입'&&type!=='지출') return { success: false, msg: "구분을 선택해 주세요." };
    var text = String(memo||'').trim();
    if (!text) return { success: false, msg: "내용을 입력해 주세요." };
    sheet.getRange(rn+1,2).setValue(date);
    sheet.getRange(rn+1,3).setValue(text);
    sheet.getRange(rn+1,4).setValue(type);
    sheet.getRange(rn+1,5).setValue(amt);
    if (!teacher) {
      sheet.getRange(rn+1,6).setValue('대기');
      sheet.getRange(rn+1,8).setValue('');
    }
    SpreadsheetApp.flush();
    return { success: true, msg: teacher ? "수정 완료! 국고에 바로 반영됩니다." : "수정 완료. 교사 승인이 다시 필요합니다." };
  } catch(e) { return { success: false, msg: e.message }; }
}

function deleteTreasuryRecord(classCode, rowNo, byTeacher) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateTreasurySheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode), rn = parseInt(rowNo);
    if (rn<1||rn>=data.length) return { success: false, msg: "기록을 찾을 수 없습니다." };
    if (cleanText(data[rn][0])!==cc) return { success: false, msg: "접근 권한이 없습니다." };
    if (String(data[rn][5])==='승인' && byTeacher !== true) return { success: false, msg: "승인된 기록은 선생님만 삭제할 수 있습니다." };
    sheet.deleteRow(rn+1);
    SpreadsheetApp.flush();
    return { success: true, msg: "삭제 완료" };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [국고 메뉴] 국고로 할 수 있는 것들 (선생님이 마스터 → 국고 승인에서 적음, 국세청 화면에서 보여 줌)
// TreasuryMenu: [0]학급코드 [1]메뉴(JSON 배열: {name, price, desc})
// ==========================================
function getTreasuryMenu(classCode) {
  try {
    var cc = cleanText(classCode);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('TreasuryMenu');
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (cleanText(data[i][0]) === cc) {
          var list = [];
          try { list = JSON.parse(String(data[i][1] || '[]')); } catch (pe) { list = []; }
          return { success: true, list: Array.isArray(list) ? list : [] };
        }
      }
    }
    return { success: true, list: [] };
  } catch(e) { return { success: false, msg: e.message }; }
}

function setTreasuryMenu(classCode, menuJson) {
  try {
    var cc = cleanText(classCode);
    if (!cc) return { success: false, msg: "학급 코드가 없습니다. 다시 로그인해 주세요." };
    var raw = typeof menuJson === 'string' ? JSON.parse(menuJson || '[]') : (menuJson || []);
    if (!Array.isArray(raw)) return { success: false, msg: "메뉴 형식이 올바르지 않습니다." };
    var list = [];
    raw.forEach(function (m) {
      var name = String((m && m.name) || '').trim().slice(0, 40);
      if (!name) return;
      var price = parseInt(m.price);
      list.push({ name: name, price: isNaN(price) || price < 0 ? 0 : price, desc: String(m.desc || '').trim().slice(0, 100) });
    });
    if (list.length > 50) return { success: false, msg: "국고 메뉴는 50개까지 적을 수 있습니다." };
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('TreasuryMenu');
    if (!sheet) { sheet = ss.insertSheet('TreasuryMenu'); sheet.appendRow(['학급코드','메뉴']); }
    var data = sheet.getDataRange().getValues();
    var json = JSON.stringify(list);
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) === cc) {
        sheet.getRange(i + 1, 2).setValue(json);
        return { success: true, list: list, msg: "국고 메뉴 " + list.length + "개를 저장했습니다!" };
      }
    }
    sheet.appendRow([cc, json]);
    return { success: true, list: list, msg: "국고 메뉴 " + list.length + "개를 저장했습니다!" };
  } catch(e) { return { success: false, msg: "오류: " + e.message }; }
}

function approveTreasuryRecord(classCode, rowNo) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateTreasurySheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode), rn = parseInt(rowNo);
    if (rn<1||rn>=data.length) return { success: false, msg: "기록을 찾을 수 없습니다." };
    if (cleanText(data[rn][0])!==cc) return { success: false, msg: "접근 권한이 없습니다." };
    sheet.getRange(rn+1,6).setValue('승인');
    sheet.getRange(rn+1,8).setValue(getTodayStr());
    SpreadsheetApp.flush();
    return { success: true, msg: "승인 완료! 국고에 반영되었습니다." };
  } catch(e) { return { success: false, msg: e.message }; }
}

function rejectTreasuryRecord(classCode, rowNo) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateTreasurySheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode), rn = parseInt(rowNo);
    if (rn<1||rn>=data.length) return { success: false, msg: "기록을 찾을 수 없습니다." };
    if (cleanText(data[rn][0])!==cc) return { success: false, msg: "접근 권한이 없습니다." };
    sheet.getRange(rn+1,6).setValue('반려');
    sheet.getRange(rn+1,8).setValue(getTodayStr());
    SpreadsheetApp.flush();
    return { success: true, msg: "반려 처리 완료." };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [벌금] 경찰서장 벌금 부과
// ==========================================
function chargeFine(classCode, studentNo, reason, amount) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stuSheet = getOrCreateStudentsSheet(ss);
    var tSheet   = getOrCreateTransSheet(ss);
    var stuData  = stuSheet.getDataRange().getValues();
    var cc  = cleanText(classCode), sno = cleanText(String(studentNo));
    var amt = parseInt(amount);
    if (isNaN(amt)||amt<=0) return { success: false, msg: "벌금 금액을 입력해 주세요." };
    var stuRowIdx=-1, cardBalance=0, studentName='';
    for (var i = 1; i < stuData.length; i++) {
      if (cleanText(stuData[i][0])===cc && cleanText(String(stuData[i][1]))===sno) {
        stuRowIdx=i+1; cardBalance=Number(stuData[i][4])||0; studentName=stuData[i][2]||''; break;
      }
    }
    if (stuRowIdx===-1) return { success: false, msg: "학생 정보를 찾을 수 없습니다." };
    if (cardBalance < amt) return { success: false, msg: "잔액이 부족합니다. (파산 방지)" };
    var newCard = cardBalance - amt;
    stuSheet.getRange(stuRowIdx,5).setValue(newCard);
    tSheet.appendRow([getTodayStr(), cc, sno, '[벌금] '+(reason||'규정위반'), '', amt, newCard, '벌금']);
 
    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
 
    // ★ 신용점수는 즉시 차감하지 않고, 신용등급관리위원회 "대기" 큐에 -5점 등록
    var pend = queuePendingCreditDelta(cc, sno, studentName, -5);
 
    return {
      success: true,
      msg: "벌금 부과 완료! 신용등급관리위원회에 -5점이 대기 등록되었습니다.",
      newCard: newCard,
      pendingDelta: (pend && pend.delta) || -5
    };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [부동산] 사물함/자리 거래
// RealEstate: [0]학급코드 [1]자산번호 [2]자산명 [3]종류 [4]소유자학생번호 [5]가격 [6]임대료 [7]상태(매물/소유/임대중)
// ==========================================
function getOrCreateRealEstateSheet(ss) {
  var sheet = ss.getSheetByName('RealEstate');
  if (!sheet) {
    sheet = ss.insertSheet('RealEstate');
    sheet.appendRow(['학급코드','자산번호','자산명','종류','소유자학생번호','가격','임대료','상태']);
  }
  return sheet;
}

function getRealEstateList(classCode) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var reSheet = getOrCreateRealEstateSheet(ss);
    var stuSheet = getOrCreateStudentsSheet(ss);
    var reData = reSheet.getDataRange().getValues();
    var stuData = stuSheet.getDataRange().getValues();
    var cc = cleanText(classCode);
    var nameMap = {};
    for (var i=1; i<stuData.length; i++) {
      if (cleanText(stuData[i][0])===cc) nameMap[String(stuData[i][1])]=stuData[i][2]||'';
    }
    var list = [], fx = _newsEffects(cc);
    for (var j = 1; j < reData.length; j++) {
      if (cleanText(reData[j][0])===cc) {
        var owner = String(reData[j][4]);
        list.push({
          idx:       j-1,
          assetNo:   reData[j][1],
          name:      reData[j][2],
          type:      reData[j][3],
          ownerNo:   owner,
          ownerName: nameMap[owner]||'국가',
          price:     _newsPrice(Number(reData[j][5])||0, fx.estate),
          rent:      _newsPrice(Number(reData[j][6])||0, fx.rent),
          basePrice: Number(reData[j][5])||0,
          baseRent:  Number(reData[j][6])||0,
          status:    reData[j][7]
        });
      }
    }
    return { success: true, list: list };
  } catch(e) { return { success: false, msg: e.message }; }
}

// perk: 자리 혜택 (선택, 자리 배치도에 보임)
function addRealEstate(classCode, assetNo, name, type, price, rent, perk) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var reSheet = getOrCreateRealEstateSheet(ss), cc = cleanText(classCode), no = String(assetNo || '').trim();
    if (!no) return { success: false, msg: '자산 번호를 적어 주세요.' };
    var dup = reSheet.getDataRange().getValues().some(function (r, i) { return i && cleanText(r[0]) === cc && String(r[1]).trim() === no; });
    if (dup) return { success: false, msg: '자산 번호 ' + no + '은(는) 이미 있어요. 다른 번호를 적어 주세요.' };
    reSheet.appendRow([cc, no, name, type||'기타', '', Number(price)||0, Number(rent)||0, '매물']);
    perk = String(perk || '').trim().slice(0, SEAT_PERK_MAX);
    if (perk) { var m = _seatLoad(cc); m.seats[no] = m.seats[no] || {}; m.seats[no].perk = perk; _seatSave(cc, m); }
    return { success: true, msg: "부동산 자산이 등록되었습니다." };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [부동산] 매입 기록 (LockService 적용)
// ==========================================
function buyRealEstate(classCode, studentNo, assetNo) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var reSheet = getOrCreateRealEstateSheet(ss);
    var stuSheet = getOrCreateStudentsSheet(ss);
    var tSheet   = getOrCreateTransSheet(ss);
    var reData = reSheet.getDataRange().getValues();
    var stuData = stuSheet.getDataRange().getValues();
    var cc = cleanText(classCode), sno = cleanText(String(studentNo));
 
    var reRowIdx=-1, price=0, assetName='';
    for (var j=1; j<reData.length; j++) {
      if (cleanText(reData[j][0])===cc && String(reData[j][1])===String(assetNo)) {
        if (cleanText(reData[j][7]) !== '매물') {
          return { success: false, msg: "앗! 누군가 방금 먼저 구매했습니다. 😭" };
        }
        reRowIdx=j+1; price=_newsPrice(Number(reData[j][5])||0, _newsEffects(cc).estate); assetName=reData[j][2]; break;
      }
    }
    if (reRowIdx===-1) return { success: false, msg: "해당 매물을 찾을 수 없습니다." };
 
    var stuRowIdx=-1, cardBalance=0;
    for (var i=1; i<stuData.length; i++) {
      if (cleanText(stuData[i][0])===cc && cleanText(String(stuData[i][1]))===sno) {
        stuRowIdx=i+1; cardBalance=Number(stuData[i][4])||0; break;
      }
    }
    if (stuRowIdx===-1) return { success: false, msg: "학생 정보를 찾을 수 없습니다." };
    if (cardBalance < price) return { success: false, msg: "잔액이 부족합니다." };
 
    var newCard = cardBalance - price;
    stuSheet.getRange(stuRowIdx,5).setValue(newCard);
    reSheet.getRange(reRowIdx,5).setValue(sno);
    reSheet.getRange(reRowIdx,8).setValue('소유');
    tSheet.appendRow([getTodayStr(), cc, sno, '[부동산매입] '+assetName, '', price, newCard, '부동산']);
    
    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    SpreadsheetApp.flush();
    return { success: true, msg: assetName+" 구매 완료!", newCard: newCard };
    
  } catch(e) { 
    if(e.message.match(/lock/i)) return { success: false, msg: "🚦 부동산 중개소 서버가 혼잡합니다. 다시 시도해주세요." };
    return { success: false, msg: e.message }; 
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// [복권/투자] 증권회사
// ==========================================
function buyLottery(classCode, studentNo, amount) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stuSheet = getOrCreateStudentsSheet(ss);
    var tSheet   = getOrCreateTransSheet(ss);
    var stuData  = stuSheet.getDataRange().getValues();
    var cc = cleanText(classCode), sno = cleanText(String(studentNo));
    var amt = parseInt(amount);
    if (isNaN(amt)||amt<=0) return { success: false, msg: "복권 금액을 입력해 주세요." };
 
    var stuRowIdx=-1, cardBalance=0;
    for (var i=1; i<stuData.length; i++) {
      if (cleanText(stuData[i][0])===cc && cleanText(String(stuData[i][1]))===sno) {
        stuRowIdx=i+1; cardBalance=Number(stuData[i][4])||0; break;
      }
    }
    if (stuRowIdx===-1) return { success: false, msg: "학생 정보를 찾을 수 없습니다." };
    if (cardBalance < amt) return { success: false, msg: "잔액이 부족합니다." };
 
    var rand = Math.random() * 100;
    var prize = 0, result = '';
    if (rand < 0.5)       { prize = amt * 10; result = '🎉 1등 당첨! x10배'; }
    else if (rand < 3.5)  { prize = amt * 5;  result = '🎊 2등 당첨! x5배'; }
    else if (rand < 13.5) { prize = amt * 2;  result = '🙂 3등 당첨! x2배'; }
    else                   { prize = 0;        result = '😢 꽝! 다음 기회에~'; }
 
    var newCard = cardBalance - amt + prize;
    stuSheet.getRange(stuRowIdx,5).setValue(newCard);
    var memo = '[복권] '+result;
    if (prize>0) tSheet.appendRow([getTodayStr(), cc, sno, memo, prize, amt, newCard, '복권']);
    else         tSheet.appendRow([getTodayStr(), cc, sno, memo, '', amt, newCard, '복권']);
 
    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
 
    return { success: true, result: result, prize: prize, newCard: newCard };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [증권] AI 모의 투자 — 가상 주식 3종목
// 가격은 저장된 값이 "돌릴 때"만 바뀝니다.
//  - 직접 돌리기: 선생님이 버튼을 누를 때마다 한 번 바뀜 (runStockStep)
//  - 자동으로 돌리기: 켜 두면 평일(월~금) 오전 8시 45분마다 한 번 바뀜.
//    서버 예약 작업이 없으므로, 그 시각이 지난 뒤 누군가 시장을 처음 열 때 밀린 만큼 돌립니다(_stockLoad).
//  - 한 번 돌릴 때 종목마다 [최소%, 최대%] 사이에서 무작위로 바뀜. 기본 -3% ~ +3%, 선생님이 마스터 → 증권회사에서 바꿈.
//  - 크게 움직이면 "AI 뉴스" 문장이 붙습니다. 외부 AI(API 키)는 쓰지 않습니다(공개 사이트라 키가 노출됨).
// StockMarket:   [0]학급코드 [1]시장 상태(JSON)
// StockHoldings: [0]학급코드 [1]학생번호 [2]종목ID [3]보유수량 [4]평균매수가
// ==========================================
var STOCK_HISTORY_MAX = 150;         // 그래프에 남길 가격 개수 (전체 그래프용. 카드에는 최근 7일만 보임)
var STOCK_AUTO_HOUR = 8, STOCK_AUTO_MIN = 45;
var STOCK_DEFAULTS = [
  { id: 'cookie', name: '달콤쿠키',     emoji: '🍪', sector: '과자·식품', price: 100 },
  { id: 'rocket', name: '별빛우주항공', emoji: '🚀', sector: '우주·과학', price: 100 },
  { id: 'game',   name: '픽셀게임즈',   emoji: '🎮', sector: '게임·놀이', price: 100 }
];
var STOCK_NEWS_GOOD = ['{n}의 새 상품이 큰 인기를 끌었어요', '{n}이(가) 큰 계약을 따냈어요', '{n}의 이번 달 판매가 아주 좋았대요',
                       '{n}에 대한 좋은 소식이 퍼졌어요', '{n}이(가) 새 기술 개발에 성공했어요', '{n}의 손님이 크게 늘었어요'];
var STOCK_NEWS_BAD  = ['{n}의 새 상품이 기대보다 덜 팔렸어요', '{n}의 공장에 문제가 생겼어요', '{n}의 재료 값이 크게 올랐어요',
                       '{n}에 대한 걱정스러운 소식이 퍼졌어요', '{n}의 경쟁 회사가 더 좋은 상품을 내놓았어요', '{n}의 손님이 줄었어요'];

// 한국 시간(UTC+9, 서머타임 없음) 기준 계산
var KST_MS = 9 * 60 * 60 * 1000;
function _stockNextAutoAt(fromMs) {           // fromMs 이후 첫 평일 08:45
  var k = new Date(fromMs + KST_MS);
  var t = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), STOCK_AUTO_HOUR, STOCK_AUTO_MIN) - KST_MS;
  for (var i = 0; i < 10; i++) {
    var dow = new Date(t + KST_MS).getUTCDay();   // 0=일, 6=토
    if (t > fromMs && dow !== 0 && dow !== 6) return t;
    t += 24 * 60 * 60 * 1000;
  }
  return t;
}
function _stockWhenLabel(ms) {
  if (!ms) return '';
  var k = new Date(ms + KST_MS), days = ['일','월','화','수','목','금','토'];
  var h = k.getUTCHours(), m = k.getUTCMinutes();
  return (k.getUTCMonth() + 1) + '월 ' + k.getUTCDate() + '일(' + days[k.getUTCDay()] + ') ' + (h < 12 ? '오전 ' : '오후 ') + ((h % 12) || 12) + ':' + (m < 10 ? '0' : '') + m;
}

function _stockDefaultState() {
  return {
    round: 0, auto: false, nextAutoAt: 0, lastRunAt: 0, lastRunBy: '',
    stocks: STOCK_DEFAULTS.map(function (d) {
      return { id: d.id, name: d.name, emoji: d.emoji, sector: d.sector, price: d.price, minPct: -3, maxPct: 3, history: [d.price], historyAt: [Date.now()], lastPct: 0 };
    }),
    news: []
  };
}

function _stockSheet(ss, create) {
  var sheet = ss.getSheetByName('StockMarket');
  if (!sheet && create) { sheet = ss.insertSheet('StockMarket'); sheet.appendRow(['학급코드', '시장상태']); }
  return sheet;
}

function _stockSave(cc, state) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = _stockSheet(ss, true);
  var data = sheet.getDataRange().getValues(), json = JSON.stringify(state);
  for (var i = 1; i < data.length; i++) if (cleanText(data[i][0]) === cc) { sheet.getRange(i + 1, 2).setValue(json); return; }
  sheet.appendRow([cc, json]);
}

// 고정 % (없으면 null). 고정 해제하면 다시 무작위로 바뀜
function _stockFixedOf(s) {
  if (s.fixedPct === null || s.fixedPct === undefined || s.fixedPct === '') return null;
  var f = Number(s.fixedPct);
  return isNaN(f) ? null : f;
}

// 가격 기록마다 바뀐 시각 (예전에 날짜 없이 저장된 가격은 null로 채워 길이를 맞춤)
function _stockTimesOf(s) {
  var n = (s.history || []).length, t = Array.isArray(s.historyAt) ? s.historyAt.slice(-n) : [];
  while (t.length < n) t.unshift(null);
  return t;
}

// 한 번 돌리기 (가격 변동)
// atMs: 바뀐 시각 (자동으로 밀린 만큼 돌릴 때는 원래 예정 시각). 가격마다 날짜를 historyAt에 함께 남김
function _stockStep(state, by, atMs) {
  var at = atMs || Date.now();
  state.stocks.forEach(function (s) {
    var lo = Number(s.minPct), hi = Number(s.maxPct);
    if (isNaN(lo)) lo = -3; if (isNaN(hi)) hi = 3; if (hi < lo) { var t = lo; lo = hi; hi = t; }
    // 선생님이 % 고정을 켜 두면 그 값으로, 아니면 [최소, 최대] 사이 무작위
    var fixed = _stockFixedOf(s);
    var pct = fixed !== null ? fixed : Math.round((lo + Math.random() * (hi - lo)) * 10) / 10;
    s.price = Math.max(10, Math.round(s.price * (1 + pct / 100)));
    s.lastPct = pct;
    var hist = s.history || [], times = _stockTimesOf(s);
    s.history = hist.concat([s.price]).slice(-STOCK_HISTORY_MAX);
    s.historyAt = times.concat([at]).slice(-STOCK_HISTORY_MAX);
    var big = Math.max(Math.abs(lo), Math.abs(hi)) * 0.6;            // 범위의 60% 넘게 움직이면 뉴스
    if (big > 0 && Math.abs(pct) >= big) {
      var pool = pct > 0 ? STOCK_NEWS_GOOD : STOCK_NEWS_BAD;
      state.news.unshift({ at: at, stockId: s.id, up: pct > 0, pct: pct, text: pool[Math.floor(Math.random() * pool.length)].replace('{n}', s.name) });
    }
  });
  state.news = state.news.slice(0, 15);
  state.round = (state.round || 0) + 1;
  state.lastRunAt = at;
  state.lastRunBy = by || '';
}

// 시장 상태 읽기 (+ 자동 돌리기 시각이 지났으면 밀린 만큼 돌리고 저장)
function _stockLoad(classCode) {
  var cc = cleanText(classCode);
  var sheet = _stockSheet(SpreadsheetApp.getActiveSpreadsheet(), false), state = null;
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) if (cleanText(data[i][0]) === cc) { try { state = JSON.parse(String(data[i][1] || '')); } catch (pe) { state = null; } break; }
  }
  var fresh = !state;
  if (fresh) state = _stockDefaultState();
  var ran = 0;
  if (state.auto && state.nextAutoAt) {
    while (Date.now() >= state.nextAutoAt && ran < 20) {   // 오래 안 열었으면 밀린 평일 수만큼 (최대 20번)
      _stockStep(state, '자동', state.nextAutoAt);
      state.lastRunAt = state.nextAutoAt;
      state.nextAutoAt = _stockNextAutoAt(state.nextAutoAt);
      ran++;
    }
  }
  if (ran > 0) _stockSave(cc, state);
  return state;
}

function _stockComment(s) {
  var h = s.history || [], n = h.length, now = h[n - 1];
  if (n < 2) return '아직 가격이 한 번도 바뀌지 않았어요. 첫 변동을 기다려 봐요.';
  var last = s.lastPct || 0;
  var back = h[Math.max(0, n - 6)], five = back ? (now - back) / back : 0;
  var msg;
  if (last >= 2) msg = '지난번에 많이 올랐어요. 많이 오른 뒤에는 다시 내려가기도 해요.';
  else if (last <= -2) msg = '지난번에 많이 내렸어요. 왜 내렸는지 뉴스를 살펴봐요.';
  else if (last > 0) msg = '지난번에 조금 올랐어요.';
  else if (last < 0) msg = '지난번에 조금 내렸어요.';
  else msg = '지난번과 가격이 같아요.';
  if (n >= 6) msg += five > 0.05 ? ' 최근 5번 동안 꾸준히 오르는 편이에요.' : five < -0.05 ? ' 최근 5번 동안 내려가는 편이에요.' : ' 최근 5번 동안은 비슷한 가격이었어요.';
  var range = Math.max(Math.abs(s.minPct), Math.abs(s.maxPct));
  msg += range >= 8 ? ' 한 번에 크게 움직이는 종목이라 위험도 커요.' : '';
  return msg;
}

function _stockPublic(state) {
  return state.stocks.map(function (s) {
    return { id: s.id, name: s.name, emoji: s.emoji, sector: s.sector, price: s.price, change: s.lastPct || 0,
             history: s.history || [s.price], historyAt: _stockTimesOf(s), minPct: s.minPct, maxPct: s.maxPct, fixedPct: _stockFixedOf(s), comment: _stockComment(s) };
  });
}

function getStockMarket(classCode, studentNo) {
  try {
    var cc = cleanText(classCode);
    var state = _stockLoad(cc);
    var stocks = _stockPublic(state), byId = {};
    stocks.forEach(function (s) { byId[s.id] = s; });
    var news = (state.news || []).map(function (e) {
      var s = byId[e.stockId] || { emoji: '📈', name: '' };
      return { when: _stockWhenLabel(e.at), stockId: e.stockId, emoji: s.emoji, name: s.name, up: e.up, pct: e.pct, text: e.text };
    });
    var res = { success: true, round: state.round || 0, auto: !!state.auto, nextAutoAt: state.auto ? state.nextAutoAt : 0,
                nextAutoLabel: state.auto ? _stockWhenLabel(state.nextAutoAt) : '', lastRunLabel: _stockWhenLabel(state.lastRunAt),
                lastRunBy: state.lastRunBy || '', stocks: stocks, news: news };
    if (studentNo !== undefined && studentNo !== null && String(studentNo) !== '') res.holdings = _stockHoldingsOf(cc, String(studentNo), stocks);
    return res;
  } catch(e) { return { success: false, msg: e.message }; }
}

// 직접 돌리기 (선생님)
function runStockStep(classCode) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var cc = cleanText(classCode);
    var state = _stockLoad(cc);
    _stockStep(state, '직접');
    _stockSave(cc, state);
    try { CacheService.getScriptCache().removeAll(['students_' + cc]); } catch (ce) {}
    var lines = state.stocks.map(function (s) { return s.emoji + ' ' + s.name + ' ' + (s.lastPct > 0 ? '▲ +' : s.lastPct < 0 ? '▼ ' : '') + s.lastPct + '% → ' + s.price.toLocaleString(); });
    return { success: true, msg: state.round + '번째 가격 변동 완료!\n' + lines.join('\n') };
  } catch(e) { return { success: false, msg: e.message }; }
  finally { lock.releaseLock(); }
}

// 자동으로 돌리기 켜기/끄기
function setStockAuto(classCode, on) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var cc = cleanText(classCode);
    var state = _stockLoad(cc);
    state.auto = on === true;
    state.nextAutoAt = state.auto ? _stockNextAutoAt(Date.now()) : 0;
    _stockSave(cc, state);
    return { success: true, auto: state.auto, nextAutoLabel: state.auto ? _stockWhenLabel(state.nextAutoAt) : '',
             msg: state.auto ? '자동으로 돌리기를 켰어요. 다음 변동: ' + _stockWhenLabel(state.nextAutoAt) + ' (토·일 제외)' : '자동으로 돌리기를 껐어요. 이제 직접 돌릴 때만 바뀌어요.' };
  } catch(e) { return { success: false, msg: e.message }; }
  finally { lock.releaseLock(); }
}

// 종목 이름·이모지·업종·변동 폭 설정 (선생님)
function setStockSettings(classCode, settingsJson) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var cc = cleanText(classCode);
    var list = typeof settingsJson === 'string' ? JSON.parse(settingsJson || '[]') : (settingsJson || []);
    var state = _stockLoad(cc), byId = {};
    list.forEach(function (x) { if (x && x.id) byId[x.id] = x; });
    for (var i = 0; i < state.stocks.length; i++) {
      var s = state.stocks[i], x = byId[s.id]; if (!x) continue;
      var name = String(x.name || '').trim().slice(0, 20);
      if (!name) return { success: false, msg: (i + 1) + '번째 종목 이름을 적어 주세요.' };
      var lo = Number(x.minPct), hi = Number(x.maxPct);
      if (isNaN(lo) || isNaN(hi)) return { success: false, msg: name + ': 변동 폭을 숫자로 적어 주세요.' };
      if (lo < -30 || hi > 30) return { success: false, msg: name + ': 변동 폭은 -30% ~ +30% 사이로 적어 주세요.' };
      if (lo > hi) return { success: false, msg: name + ': 최소(%)가 최대(%)보다 클 수 없어요.' };
      s.name = name;
      s.emoji = String(x.emoji || s.emoji).trim().slice(0, 4) || s.emoji;
      s.sector = String(x.sector || '').trim().slice(0, 20);
      s.minPct = Math.round(lo * 10) / 10; s.maxPct = Math.round(hi * 10) / 10;
      // 고정 %: 비어 있으면(null/'') 고정 해제 → 무작위
      if (!('fixedPct' in x)) { /* 고정 칸을 보내지 않은 예전 화면 → 그대로 둠 */ }
      else if (x.fixedPct === null || String(x.fixedPct).trim() === '') s.fixedPct = null;
      else {
        var fx = Number(x.fixedPct);
        if (isNaN(fx)) return { success: false, msg: name + ': 고정 %를 숫자로 적어 주세요.' };
        if (fx < -30 || fx > 30) return { success: false, msg: name + ': 고정 %는 -30% ~ +30% 사이로 적어 주세요.' };
        s.fixedPct = Math.round(fx * 10) / 10;
      }
    }
    _stockSave(cc, state);
    return { success: true, msg: '증권회사 종목 설정을 저장했어요!' };
  } catch(e) { return { success: false, msg: e.message }; }
  finally { lock.releaseLock(); }
}

function getOrCreateStockHoldingsSheet(ss) {
  var sheet = ss.getSheetByName('StockHoldings');
  if (!sheet) { sheet = ss.insertSheet('StockHoldings'); sheet.appendRow(['학급코드','학생번호','종목ID','보유수량','평균매수가']); }
  return sheet;
}

function _stockHoldingsOf(cc, sno, stocks) {
  var data = getOrCreateStockHoldingsSheet(SpreadsheetApp.getActiveSpreadsheet()).getDataRange().getValues();
  var priceOf = {}; stocks.forEach(function (s) { priceOf[s.id] = s; });
  var list = [], total = 0, cost = 0;
  for (var i = 1; i < data.length; i++) {
    if (cleanText(data[i][0]) !== cc || cleanText(String(data[i][1])) !== sno) continue;
    var qty = Number(data[i][3]) || 0; if (qty <= 0) continue;
    var s = priceOf[String(data[i][2])]; if (!s) continue;
    var avg = Number(data[i][4]) || 0, value = qty * s.price;
    total += value; cost += qty * avg;
    list.push({ stockId: s.id, name: s.name, emoji: s.emoji, qty: qty, avg: avg, price: s.price, value: value,
                profit: value - qty * avg, pct: avg ? Math.round((s.price - avg) / avg * 1000) / 10 : 0 });
  }
  return { list: list, totalValue: total, totalCost: cost, profit: total - cost };
}

// 학생별 주식 평가액 { 학생번호: 지금 가격 × 보유 수량 } — 총 자산 계산에 씀 (주식이 없으면 빈 객체)
function _stockValueMap(classCode) {
  var cc = cleanText(classCode), map = {};
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('StockHoldings');
  if (!sheet) return map;
  var data = sheet.getDataRange().getValues(), any = false;
  for (var i = 1; i < data.length; i++) if (cleanText(data[i][0]) === cc && (Number(data[i][3]) || 0) > 0) { any = true; break; }
  if (!any) return map;
  var price = {};
  _stockLoad(cc).stocks.forEach(function (s) { price[s.id] = s.price; });
  for (var j = 1; j < data.length; j++) {
    if (cleanText(data[j][0]) !== cc) continue;
    var qty = Number(data[j][3]) || 0, p2 = price[String(data[j][2])];
    if (qty <= 0 || !p2) continue;
    var sno = cleanText(String(data[j][1]));
    map[sno] = (map[sno] || 0) + qty * p2;
  }
  return map;
}

// 주식 사고팔기 (증권회사 직원이 고객 대신 처리). side: 'buy' | 'sell'
function tradeStock(classCode, operatorNo, customerNo, stockId, side, quantity) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var cc = cleanText(classCode), sno = cleanText(String(customerNo || ''));
    var qty = parseInt(quantity);
    if (!sno) return { success: false, msg: '고객을 선택해 주세요.' };
    if (isNaN(qty) || qty <= 0) return { success: false, msg: '수량을 1주 이상 입력해 주세요.' };
    if (qty > 1000) return { success: false, msg: '한 번에 1000주까지 거래할 수 있어요.' };
    if (side !== 'buy' && side !== 'sell') return { success: false, msg: '사기/팔기를 골라 주세요.' };
    var s = null; _stockLoad(cc).stocks.forEach(function (x) { if (x.id === stockId) s = x; });
    if (!s) return { success: false, msg: '종목을 찾을 수 없습니다.' };
    var price = s.price, total = price * qty;

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stuSheet = getOrCreateStudentsSheet(ss), tSheet = getOrCreateTransSheet(ss), hSheet = getOrCreateStockHoldingsSheet(ss);
    var stuData = stuSheet.getDataRange().getValues();
    var rowIdx = -1, card = 0, name = '';
    for (var i = 1; i < stuData.length; i++) {
      if (cleanText(stuData[i][0]) === cc && cleanText(String(stuData[i][1])) === sno) { rowIdx = i + 1; card = Number(stuData[i][4]) || 0; name = stuData[i][2] || ''; break; }
    }
    if (rowIdx === -1) return { success: false, msg: '고객 정보를 찾을 수 없습니다.' };

    var hData = hSheet.getDataRange().getValues(), hRow = -1, have = 0, avg = 0;
    for (var j = 1; j < hData.length; j++) {
      if (cleanText(hData[j][0]) === cc && cleanText(String(hData[j][1])) === sno && String(hData[j][2]) === s.id) { hRow = j + 1; have = Number(hData[j][3]) || 0; avg = Number(hData[j][4]) || 0; break; }
    }

    var newCard, memo, today = getTodayStr();
    if (side === 'buy') {
      if (card < total) return { success: false, msg: (name || sno + '번') + ' 카드 잔액이 부족해요. (필요: ' + total.toLocaleString() + ' 머니, 보유: ' + card.toLocaleString() + ' 머니)' };
      newCard = card - total;
      var newQty = have + qty, newAvg = Math.round((have * avg + total) / newQty);
      if (hRow === -1) hSheet.appendRow([cc, sno, s.id, newQty, newAvg]);
      else { hSheet.getRange(hRow, 4).setValue(newQty); hSheet.getRange(hRow, 5).setValue(newAvg); }
      memo = '[주식] ' + s.emoji + ' ' + s.name + ' ' + qty + '주 매수 (1주 ' + price.toLocaleString() + ')';
      stuSheet.getRange(rowIdx, 5).setValue(newCard);
      tSheet.appendRow([today, cc, sno, memo, '', total, newCard, '주식매수']);
    } else {
      if (have < qty) return { success: false, msg: (name || sno + '번') + '은(는) ' + s.name + ' 주식을 ' + have + '주만 가지고 있어요.' };
      newCard = card + total;
      var left = have - qty;
      hSheet.getRange(hRow, 4).setValue(left);
      if (left === 0) hSheet.getRange(hRow, 5).setValue(0);
      var gain = (price - avg) * qty;
      memo = '[주식] ' + s.emoji + ' ' + s.name + ' ' + qty + '주 매도 (1주 ' + price.toLocaleString() + ', ' + (gain >= 0 ? '이익 +' : '손해 ') + gain.toLocaleString() + ')';
      stuSheet.getRange(rowIdx, 5).setValue(newCard);
      tSheet.appendRow([today, cc, sno, memo, total, '', newCard, '주식매도']);
    }
    try { CacheService.getScriptCache().removeAll(['students_' + cc]); } catch (ce) {}
    SpreadsheetApp.flush();
    return { success: true, price: price, total: total, newCard: newCard,
             msg: (name || sno + '번') + ' 고객: ' + s.emoji + ' ' + s.name + ' ' + qty + '주 ' + (side === 'buy' ? '매수' : '매도') + ' 완료! (' + total.toLocaleString() + ' 머니)' };
  } catch(e) {
    if (String(e.message).match(/lock/i)) return { success: false, msg: '🚦 서버가 혼잡합니다. 잠시 후 다시 시도해주세요.' };
    return { success: false, msg: e.message };
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// [통계] 전체 자산 현황
// ==========================================
function getClassStats(classCode) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stuSheet = getOrCreateStudentsSheet(ss);
    var data = stuSheet.getDataRange().getValues();
    var cc = cleanText(classCode);
    var students = [];
    var totalCard=0, totalBank=0, totalStock=0;
    var stockMap = _stockValueMap(cc);   // 주식 평가액 (총 자산에 포함)
    for (var i=1; i<data.length; i++) {
      if (cleanText(data[i][0])===cc) {
        var card=Number(data[i][4])||0, bank=Number(data[i][5])||0, credit=Number(data[i][6])||0;
        var stock = stockMap[cleanText(String(data[i][1]))] || 0;
        students.push({ no: String(data[i][1]), name: data[i][2]||'', job: data[i][3]||'', card: card, bank: bank, stock: stock, credit: credit, total: card+bank+stock });
        totalCard += card; totalBank += bank; totalStock += stock;
      }
    }
    students.sort(function(a,b){ return b.total - a.total; });
    return { success: true, students: students, totalCard: totalCard, totalBank: totalBank, totalStock: totalStock, count: students.length };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [급여] 직업별 기본 급여표 & 스마트 월급
// SalaryTable: [0]학급코드 [1]항목키 [2]값
// ==========================================
function getOrCreateSalaryTableSheet(ss) {
  var sheet = ss.getSheetByName('SalaryTable');
  if (!sheet) {
    sheet = ss.insertSheet('SalaryTable');
    sheet.appendRow(['학급코드','항목키','값']);
  }
  return sheet;
}

function getSalaryTable(classCode) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSalaryTableSheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode);
    var table = {}, civilServants = '';
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) !== cc) continue;
      if (String(data[i][1]) === '__civil__') civilServants = String(data[i][2]||'');
      else table[String(data[i][1])] = Number(data[i][2])||0;
    }
    return { success: true, table: table, civilServants: civilServants };
  } catch(e) { return { success: false, msg: e.message }; }
}

function setSalaryTable(classCode, tableJson, civilServants) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateSalaryTableSheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode);
    for (var i = data.length-1; i >= 1; i--) {
      if (cleanText(data[i][0]) === cc) sheet.deleteRow(i+1);
    }
    var table = JSON.parse(tableJson);
    var rows = [];
    for (var job in table) rows.push([cc, job, Number(table[job])||0]);
    rows.push([cc, '__civil__', String(civilServants||'')]);
    if (rows.length > 0) sheet.getRange(sheet.getLastRow()+1,1,rows.length,3).setValues(rows);
    SpreadsheetApp.flush();
    return { success: true, msg: '급여표가 저장되었습니다!' };
  } catch(e) { return { success: false, msg: e.message }; }
}

function executeSmartPayroll(classCode, payrollJson) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stuSheet = getOrCreateStudentsSheet(ss);
    var tSheet = getOrCreateTransSheet(ss);
    var stuData = stuSheet.getDataRange().getValues();
    var cc = cleanText(classCode);
    var payroll = typeof payrollJson === 'string' ? JSON.parse(payrollJson) : (payrollJson || []);
    var today = getTodayStr(), count = 0, rows = [], total = 0, missing = [];
    for (var p = 0; p < payroll.length; p++) {
      var item = payroll[p];
      if (!item || item.studentNo === null || item.studentNo === undefined || String(item.studentNo) === '') continue;
      var sno = cleanText(String(item.studentNo));
      var net = Math.round(Number(item.netPay)||0);
      if (net === 0) continue;
      var stuRowIdx = -1, cardBalance = 0;
      for (var i = 1; i < stuData.length; i++) {
        if (cleanText(stuData[i][0])===cc && cleanText(String(stuData[i][1]))===sno) {
          stuRowIdx=i+1; cardBalance=Number(stuData[i][4])||0; break;
        }
      }
      if (stuRowIdx===-1) { missing.push(sno); continue; }
      var newCard = cardBalance + net;
      stuSheet.getRange(stuRowIdx,5).setValue(newCard);
      stuData[stuRowIdx-1][4] = newCard;   // 같은 학생이 두 번 있어도 누적되게
      rows.push([today, cc, sno, '[스마트월급] 실수령액 '+net+'머니', net>0?net:'', net<0?Math.abs(net):'', newCard, '스마트월급']);
      count++; total += net;
    }
    if (count === 0) {
      return { success: false, msg: missing.length
        ? '학생을 찾지 못했습니다 (번호: ' + missing.join(', ') + '). 국민 관리에서 새로고침 후 다시 시도해 주세요.'
        : '지급할 금액이 없습니다.' };
    }
    for (var w = 0; w < rows.length; w++) tSheet.appendRow(rows[w]);
    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    SpreadsheetApp.flush();
    return { success: true, msg: count+'명에게 총 '+total+'머니 스마트 월급 지급 완료!' + (missing.length ? ' (찾지 못한 번호: '+missing.join(', ')+')' : ''), count: count, total: total };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 학생 일괄 삭제 ──
function bulkDeleteStudents(classCode, studentNos) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateStudentsSheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode);
    var nos = studentNos.map(function(n){ return cleanText(String(n)); });
    var count = 0;
    for (var i = data.length-1; i >= 1; i--) {
      if (cleanText(data[i][0])===cc && nos.indexOf(cleanText(String(data[i][1])))!==-1) {
        sheet.deleteRow(i+1); count++;
      }
    }
    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    return { success: true, msg: count+'명이 삭제되었습니다.' };
  } catch(e) { return { success: false, msg: e.message }; }
}
 
function updateStudentCode(classCode, studentNo, newCode) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateStudentsSheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode), sno = cleanText(String(studentNo));
    var code = cleanText(newCode).toUpperCase();
    if (!code || code.length < 4) return { success: false, msg: '코드는 4자리 이상이어야 합니다.' };
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0])===cc && cleanText(String(data[i][1]))===sno) {
        sheet.getRange(i+1,8).setValue(code);
        try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
        return { success: true, msg: '코드가 변경되었습니다.', code: code };
      }
    }
    return { success: false, msg: '학생을 찾을 수 없습니다.' };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [예금 신용점수] 기간별 신용점수 설정
// DepositCredit: [0]학급코드 [1]1주점수 [2]2주점수 [3]3주점수 [4]4주점수
// ==========================================
function getOrCreateDepositCreditSheet(ss) {
  var sheet = ss.getSheetByName('DepositCredit');
  if (!sheet) {
    sheet = ss.insertSheet('DepositCredit');
    sheet.appendRow(['학급코드','1주점수','2주점수','3주점수','4주점수','1주하락','2주하락','3주하락','4주하락']);
  }
  return sheet;
}

// 중도 해지 때 깎이는 신용점수 [1주,2주,3주,4주]. 아직 저장한 적 없는 칸은 기본값 (0으로 저장하면 하락 없음)
var DEPOSIT_PENALTY_DEFAULTS = [1, 2, 3, 5];
function _depositPenalties(row) {
  return DEPOSIT_PENALTY_DEFAULTS.map(function(def, k) {
    var v = row ? row[5 + k] : '';
    return (v === '' || v === undefined || v === null) ? def : Math.max(0, Number(v) || 0);
  });
}
function getDepositCreditSettings(classCode) {
  try {
    var cached = _getCache('depcredit', classCode);
    if (cached) return cached;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateDepositCreditSheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode);
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) === cc) {
        var result = {
          success: true,
          c1: Number(data[i][1]) || 0,
          c2: Number(data[i][2]) || 0,
          c3: Number(data[i][3]) || 0,
          c4: Number(data[i][4]) || 0,
          penalties: _depositPenalties(data[i])
        };
        _setCache('depcredit', classCode, result, 300);
        return result;
      }
    }
    var def = { success: true, c1: 1, c2: 2, c3: 3, c4: 5, penalties: _depositPenalties(null) };
    _setCache('depcredit', classCode, def, 300);
    return def;
  } catch(e) { return { success: false, msg: e.message }; }
}

function setDepositPenaltySettings(classCode, d1, d2, d3, d4) {
  try {
    var vals = [d1, d2, d3, d4].map(function(v) { return String(v == null ? '' : v).trim() === '' ? NaN : Number(v); });
    if (vals.some(function(v) { return !(v >= 0 && v <= 100) || v % 1 !== 0; }))
      return { success: false, msg: '하락 점수는 0에서 100 사이의 숫자로 적어 주세요.' };
    var sheet = getOrCreateDepositCreditSheet(SpreadsheetApp.getActiveSpreadsheet());
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode), row = -1;
    for (var i = 1; i < data.length; i++) if (cleanText(data[i][0]) === cc) { row = i + 1; break; }
    if (row === -1) sheet.appendRow([cc, 1, 2, 3, 5].concat(vals));
    else sheet.getRange(row, 6, 1, 4).setValues([vals]);
    try { CacheService.getScriptCache().remove('depcredit_'+cc); } catch(e){}
    SpreadsheetApp.flush();
    return { success: true, msg: '예금 해지 신용등급 하락 설정이 저장되었습니다.' };
  } catch(e) { return { success: false, msg: e.message }; }
}
function setDepositCreditSettings(classCode, c1, c2, c3, c4) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateDepositCreditSheet(ss);
    var data = sheet.getDataRange().getValues();
    var cc = cleanText(classCode);
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) === cc) {
        sheet.getRange(i+1,2,1,4).setValues([[Number(c1)||0, Number(c2)||0, Number(c3)||0, Number(c4)||0]]);
        try { CacheService.getScriptCache().remove('depcredit_'+cc); } catch(e){}
        SpreadsheetApp.flush();
        return { success: true, msg: '신용점수 설정이 저장되었습니다.' };
      }
    }
    sheet.appendRow([cc, Number(c1)||0, Number(c2)||0, Number(c3)||0, Number(c4)||0]);
    try { CacheService.getScriptCache().remove('depcredit_'+cc); } catch(e){}
    SpreadsheetApp.flush();
    return { success: true, msg: '신용점수 설정이 저장되었습니다.' };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 예금 가입 시 신용점수 부여 (은행청장 전용) ──
function createDepositByBankerWithCredit(classCode, studentNo, weeks, amount, finalRate, startDate) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    try { CacheService.getScriptCache().removeAll(['students_'+cleanText(classCode)]); } catch(ce){}

    var ss       = SpreadsheetApp.getActiveSpreadsheet();
    var stuSheet = getOrCreateStudentsSheet(ss);
    var depSheet = getOrCreateDepositsSheet(ss);
    var tSheet   = getOrCreateTransSheet(ss);
    var stuData  = stuSheet.getDataRange().getValues();
    var cc   = cleanText(classCode);
    var sno  = cleanText(String(studentNo));
    var amt  = parseInt(amount);
    var wk   = parseInt(weeks);
    var rate = parseFloat(finalRate);

    if (isNaN(amt) || amt <= 0) return { success: false, msg: '금액을 올바르게 입력해 주세요.' };

    // 만기 해지 시 부여될 신용점수 미리 조회 (안내용)
    var creditSettings   = getDepositCreditSettings(classCode);
    var creditMap        = { 1: creditSettings.c1||0, 2: creditSettings.c2||0, 3: creditSettings.c3||0, 4: creditSettings.c4||0 };
    var creditGainPreview = creditMap[wk] || 0;

    var stuRowIdx = -1, cardBalance = 0, bankBalance = 0;
    for (var i = 1; i < stuData.length; i++) {
      if (cleanText(stuData[i][0]) === cc && cleanText(String(stuData[i][1])) === sno) {
        stuRowIdx   = i + 1;
        cardBalance = Number(stuData[i][4]) || 0;
        bankBalance = Number(stuData[i][5]) || 0;
        break;
      }
    }
    if (stuRowIdx === -1) return { success: false, msg: '학생 정보를 찾을 수 없습니다.' };
    if (cardBalance < amt) return { success: false, msg: '카드 잔액이 부족합니다. (보유: ' + cardBalance + ' 머니)' };

    var start     = new Date(startDate);
    var expire    = new Date(start.getTime() + wk * 7 * 24 * 60 * 60 * 1000);
    var expireStr = Utilities.formatDate(expire, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var newCard   = cardBalance - amt;
    var newBank   = bankBalance + amt;

    stuSheet.getRange(stuRowIdx, 5).setValue(newCard);
    stuSheet.getRange(stuRowIdx, 6).setValue(newBank);
    // ★ 신용점수는 여기서 부여하지 않음 → 만기 해지 시 자동 부여

    depSheet.appendRow([cc, sno, wk+'주', amt, rate, startDate, expireStr, '활성']);
    tSheet.appendRow([startDate, cc, sno,
      wk+'주 예금 가입 ('+rate+'%) — 만기 해지 시 신용 +'+creditGainPreview+'점 예정',
      '', amt, newCard, '예금가입']);

    SpreadsheetApp.flush();
    return {
      success: true,
      msg: wk+'주 예금 등록 완료! (만기 해지 시 신용점수 +'+creditGainPreview+'점 자동 부여 예정)',
      creditGainPreview: creditGainPreview
    };

  } catch(e) {
    if (e.message.match(/lock/i)) return { success: false, msg: '🚦 서버가 혼잡합니다. 잠시 후 다시 시도해주세요.' };
    return { success: false, msg: e.message };
  } finally {
    lock.releaseLock();
  }
}

// ── 교사(마스터) 본인 계정: 학생번호 0번, 직업 대통령 ──
// 학급에 들어올 때마다 호출. 없으면 새로 만들고, 있으면 그대로 돌려줌.
function ensureTeacherAccount(classCode, teacherName) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateStudentsSheet(ss);
    var data  = sheet.getDataRange().getValues();
    var cc    = cleanText(classCode);
    var sno   = '0';
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) === cc && cleanText(String(data[i][1])) === sno) {
        return {
          success: true, created: false, studentNo: sno,
          name: data[i][2] || '', job: data[i][3] || '',
          card: Number(data[i][4]) || 0, bank: Number(data[i][5]) || 0,
          credit: Number(data[i][6]) || 0, code: data[i][7] || ''
        };
      }
    }
    var name = String(teacherName || '').trim() || '선생님';
    var code = generateCode();
    sheet.appendRow([cc, sno, name, '대통령', 0, 0, 0, code]);
    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    return { success: true, created: true, studentNo: sno, name: name, job: '대통령', card: 0, bank: 0, credit: 0, code: code };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 교사 테스트 계정 조회 ──
function getTeacherTestStudent(classCode, studentNo) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateStudentsSheet(ss);
    var data  = sheet.getDataRange().getValues();
    var cc    = cleanText(classCode);
    var sno   = cleanText(String(studentNo));
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0])===cc && cleanText(String(data[i][1]))===sno) {
        return {
          success: true,
          found: true,
          studentNo: String(data[i][1]),
          name:      data[i][2]||'',
          job:       data[i][3]||'',
          card:      Number(data[i][4])||0,
          bank:      Number(data[i][5])||0,
          credit:    Number(data[i][6])||0,
          code:      data[i][7]||''
        };
      }
    }
    return { success: true, found: false };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [신용] 신용위원장 보고 시스템
// CreditPending: [0]학급코드 [1]학생번호 [2]이름 [3]변화량 [4]상태(대기/보고/승인/반려) [5]등록일 [6]처리일
// ==========================================
function getOrCreateCreditPendingSheet(ss) {
  var sheet = ss.getSheetByName('CreditPending');
  if (!sheet) {
    sheet = ss.insertSheet('CreditPending');
    sheet.appendRow(['학급코드','학생번호','이름','변화량','상태','등록일','처리일']);
  }
  return sheet;
}

function savePendingCredit(classCode, studentNo, studentName, delta) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateCreditPendingSheet(ss);
    var data  = sheet.getDataRange().getValues();
    var cc    = cleanText(classCode), sno = cleanText(String(studentNo));
    var d     = parseInt(delta);
    if (isNaN(d) || d === 0) return { success: false, msg: '변화량을 입력해 주세요.' };
    // 기존 대기/반려 항목 있으면 업데이트
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0])===cc && cleanText(String(data[i][1]))===sno
          && (data[i][4]==='대기'||data[i][4]==='반려')) {
        sheet.getRange(i+1,3).setValue(studentName||'');
        sheet.getRange(i+1,4).setValue(d);
        sheet.getRange(i+1,5).setValue('대기');
        sheet.getRange(i+1,6).setValue(getTodayStr());
        sheet.getRange(i+1,7).setValue('');
        SpreadsheetApp.flush();
        return { success: true, msg: '저장되었습니다.', delta: d };
      }
    }
    sheet.appendRow([cc, sno, studentName||'', d, '대기', getTodayStr(), '']);
    SpreadsheetApp.flush();
    return { success: true, msg: '저장되었습니다.', delta: d };
  } catch(e) { return { success: false, msg: e.message }; }
}

function submitCreditReport(classCode) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateCreditPendingSheet(ss);
    var data  = sheet.getDataRange().getValues();
    var cc    = cleanText(classCode), count = 0;
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0])===cc && (data[i][4]==='대기'||data[i][4]==='반려')) {
        sheet.getRange(i+1,5).setValue('보고'); count++;
      }
    }
    SpreadsheetApp.flush();
    return { success: true, msg: count+'건이 보고되었습니다.', count: count };
  } catch(e) { return { success: false, msg: e.message }; }
}

function getCreditPendingMap(classCode) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateCreditPendingSheet(ss);
    var data  = sheet.getDataRange().getValues();
    var cc    = cleanText(classCode), map = {};
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0])!==cc) continue;
      var s = String(data[i][4]||'');
      if (s==='대기'||s==='반려') {
        map[String(data[i][1])] = { rowNo: i, delta: Number(data[i][3])||0, status: s };
      }
    }
    return { success: true, map: map };
  } catch(e) { return { success: false, msg: e.message }; }
}

function getPendingCredits(classCode, status) {
  try {
    var ss      = SpreadsheetApp.getActiveSpreadsheet();
    var sheet   = getOrCreateCreditPendingSheet(ss);
    var stuSheet= getOrCreateStudentsSheet(ss);
    var data    = sheet.getDataRange().getValues();
    var stuData = stuSheet.getDataRange().getValues();
    var cc      = cleanText(classCode);
    var creditMap = {};
    for (var j = 1; j < stuData.length; j++) {
      if (cleanText(stuData[j][0])===cc) creditMap[String(stuData[j][1])] = Number(stuData[j][6])||0;
    }
    var list = [];
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0])!==cc) continue;
      if (status && String(data[i][4])!==status) continue;
      var sno = String(data[i][1]);
      var dateVal = data[i][5];
      var dateStr = dateVal instanceof Date ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(dateVal||'');
      list.push({ rowNo: i, studentNo: sno, name: String(data[i][2]||''),
        delta: Number(data[i][3])||0, status: String(data[i][4]||''),
        date: dateStr, currentCredit: creditMap[sno]||0 });
    }
    list.reverse();
    return { success: true, list: list };
  } catch(e) { return { success: false, msg: e.message }; }
}

function approvePendingCredit(classCode, rowNo) {
  try {
    var ss      = SpreadsheetApp.getActiveSpreadsheet();
    var pending = getOrCreateCreditPendingSheet(ss);
    var stuSheet= getOrCreateStudentsSheet(ss);
    var data    = pending.getDataRange().getValues();
    var stuData = stuSheet.getDataRange().getValues();
    var cc      = cleanText(classCode), rn = parseInt(rowNo);
    if (rn<1||rn>=data.length) return { success: false, msg: '항목을 찾을 수 없습니다.' };
    if (cleanText(data[rn][0])!==cc) return { success: false, msg: '접근 권한이 없습니다.' };
    var sno   = cleanText(String(data[rn][1]));
    var delta = Number(data[rn][3])||0;
    for (var i = 1; i < stuData.length; i++) {
      if (cleanText(stuData[i][0])===cc && cleanText(String(stuData[i][1]))===sno) {
        var cur  = Number(stuData[i][6])||0;
        var next = Math.max(0, Math.min(100, cur + delta));
        stuSheet.getRange(i+1,7).setValue(next); break;
      }
    }
    pending.getRange(rn+1,5).setValue('승인');
    pending.getRange(rn+1,7).setValue(getTodayStr());
    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    SpreadsheetApp.flush();
    return { success: true, msg: '승인 완료! 신용점수가 반영되었습니다.' };
  } catch(e) { return { success: false, msg: e.message }; }
}

function rejectPendingCredit(classCode, rowNo) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateCreditPendingSheet(ss);
    var data  = sheet.getDataRange().getValues();
    var cc    = cleanText(classCode), rn = parseInt(rowNo);
    if (rn<1||rn>=data.length) return { success: false, msg: '항목을 찾을 수 없습니다.' };
    if (cleanText(data[rn][0])!==cc) return { success: false, msg: '접근 권한이 없습니다.' };
    sheet.getRange(rn+1,5).setValue('반려');
    sheet.getRange(rn+1,7).setValue(getTodayStr());
    SpreadsheetApp.flush();
    return { success: true, msg: '반려 처리되었습니다. 신용위원장 패널에 다시 표시됩니다.' };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [신용] 등급 급간 설정
// CreditGradeSettings: [0]학급코드 [1]JSON
// ==========================================
function getOrCreateCreditGradeSheet(ss) {
  var sheet = ss.getSheetByName('CreditGradeSettings');
  if (!sheet) {
    sheet = ss.insertSheet('CreditGradeSettings');
    sheet.appendRow(['학급코드','설정JSON']);
  }
  return sheet;
}

function getCreditGradeSettings(classCode) {
  try {
    var cached = _getCache('gradeSettings', classCode);
    if (cached) return cached;
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateCreditGradeSheet(ss);
    var data  = sheet.getDataRange().getValues();
    var cc    = cleanText(classCode);
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) === cc) {
        var result = { success: true, settings: JSON.parse(data[i][1]||'[]') };
        _setCache('gradeSettings', classCode, result, 300);
        return result;
      }
    }
    var def = { success: true, settings: [
      {grade:1,minScore:90,emoji:'👑'},{grade:2,minScore:80,emoji:'💎'},
      {grade:3,minScore:70,emoji:'🏆'},{grade:4,minScore:60,emoji:'⭐'},
      {grade:5,minScore:50,emoji:'🌟'},{grade:6,minScore:40,emoji:'🌿'},
      {grade:7,minScore:30,emoji:'🌱'},{grade:8,minScore:20,emoji:'🍂'},
      {grade:9,minScore:10,emoji:'🌧️'},{grade:10,minScore:0,emoji:'⚡'}
    ]};
    _setCache('gradeSettings', classCode, def, 300);
    return def;
  } catch(e) { return { success: false, msg: e.message }; }
}

function setCreditGradeSettings(classCode, settingsJson) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateCreditGradeSheet(ss);
    var data  = sheet.getDataRange().getValues();
    var cc    = cleanText(classCode);
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) === cc) {
        sheet.getRange(i+1,2).setValue(settingsJson);
        try { CacheService.getScriptCache().remove('gradeSettings_'+cc); } catch(e){}
        SpreadsheetApp.flush();
        return { success: true, msg: '등급 설정이 저장되었습니다.' };
      }
    }
    sheet.appendRow([cc, settingsJson]);
    try { CacheService.getScriptCache().remove('gradeSettings_'+cc); } catch(e){}
    SpreadsheetApp.flush();
    return { success: true, msg: '등급 설정이 저장되었습니다.' };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [과제] 통계청 과제 제출 현황
// Homework: [0]학급코드 [1]과제ID [2]과제명 [3]날짜 [4]보고상태 [5]생성일
// HomeworkStatus: [0]학급코드 [1]과제ID [2]학생번호 [3]상태 [4]수정일
// ==========================================
function getOrCreateHomeworkSheet(ss) {
  var sheet = ss.getSheetByName('Homework');
  if (!sheet) {
    sheet = ss.insertSheet('Homework');
    sheet.appendRow(['학급코드','과제ID','과제명','날짜','보고상태','생성일']);
  }
  return sheet;
}

function getOrCreateHomeworkStatusSheet(ss) {
  var sheet = ss.getSheetByName('HomeworkStatus');
  if (!sheet) {
    sheet = ss.insertSheet('HomeworkStatus');
    sheet.appendRow(['학급코드','과제ID','학생번호','상태','수정일']);
  }
  return sheet;
}

function addHomework(classCode, title, date) {
  try {
    try { CacheService.getScriptCache().removeAll(['homework_'+cleanText(classCode),'hwreport_'+cleanText(classCode)]); } catch(ce){}
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateHomeworkSheet(ss);
    var cc    = cleanText(classCode);
    if (!title || !date) return { success: false, msg: '과제명과 날짜를 입력해 주세요.' };
    var hwId = 'HW_' + new Date().getTime();
    sheet.appendRow([cc, hwId, title, date, '대기', getTodayStr()]);
    SpreadsheetApp.flush();
    return { success: true, msg: '과제가 추가되었습니다.', hwId: hwId };
  } catch(e) { return { success: false, msg: e.message }; }
}

function getHomeworkList(classCode) {
  var cached = _getCache('homework', classCode);
  if(cached) return cached;
  try {
    var ss      = SpreadsheetApp.getActiveSpreadsheet();
    var hwSheet = getOrCreateHomeworkSheet(ss);
    var stSheet = getOrCreateHomeworkStatusSheet(ss);
    var hwData  = hwSheet.getDataRange().getValues();
    var stData  = stSheet.getDataRange().getValues();
    var cc      = cleanText(classCode);
    var statusMap = {};
    for (var i = 1; i < stData.length; i++) {
      if (cleanText(stData[i][0]) !== cc) continue;
      var hwId = String(stData[i][1]);
      var sno  = String(stData[i][2]);
      if (!statusMap[hwId]) statusMap[hwId] = {};
      statusMap[hwId][sno] = String(stData[i][3]);
    }
    var list = [];
    for (var j = 1; j < hwData.length; j++) {
      if (cleanText(hwData[j][0]) !== cc) continue;
      var id      = String(hwData[j][1]);
      var dateVal = hwData[j][3];
      var dateStr = dateVal instanceof Date
        ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(dateVal||'');
      list.push({ hwId: id, title: String(hwData[j][2]||''),
        date: dateStr, reportStatus: String(hwData[j][4]||'대기'),
        statuses: statusMap[id] || {} });
    }
    list.reverse();
    var result = { success: true, list: list };
    _setCache('homework', classCode, result, 30); // ★ 30초 캐싱
    return result;
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 통계청장 패널 초기 데이터 통합 조회 (과제목록 + 학생목록, 통신 1회로 통합) ──
function getStatsOfficeData(classCode) {
  try {
    var hwResult  = getHomeworkList(classCode);   // 내부적으로 30초 캐시 재사용
    var stuResult = getStudentList(classCode);    // 내부적으로 15초 캐시 재사용
    return {
      success: true,
      hwList:  hwResult.success  ? hwResult.list  : [],
      stuList: stuResult.success ? stuResult.list : []
    };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 과제 상태 일괄 저장 (debounce 배치 처리용) ──
function updateHomeworkStatusBatch(classCode, updatesJson) {
  try {
    var ss      = SpreadsheetApp.getActiveSpreadsheet();
    var sheet   = getOrCreateHomeworkStatusSheet(ss);
    var hwSheet = getOrCreateHomeworkSheet(ss);
    var data    = sheet.getDataRange().getValues();
    var hwData  = hwSheet.getDataRange().getValues();
    var cc      = cleanText(classCode);
    var today   = getTodayStr();
    var updates = JSON.parse(updatesJson);

    // ★ 보고/승인 상태(잠긴) 과제 목록 파악
    var lockedHw = {};
    for (var h = 1; h < hwData.length; h++) {
      if (cleanText(hwData[h][0]) !== cc) continue;
      var st = String(hwData[h][4]||'');
      if (st === '보고' || st === '승인') lockedHw[String(hwData[h][1])] = true;
    }

    // ★ 캐시 초기화
    try {
      CacheService.getScriptCache().removeAll(['homework_'+cc, 'hwreport_'+cc]);
    } catch(ce){}

    // 기존 행 인덱스 구성
    var rowIndex = {};
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) !== cc) continue;
      var key = String(data[i][1])+'|'+cleanText(String(data[i][2]));
      rowIndex[key] = i+1;
    }

    var newRows = [];
    var blocked = 0;
    updates.forEach(function(u){
      if (lockedHw[u.hwId]) { blocked++; return; } // ★ 잠긴 과제는 무시
      var sno = cleanText(String(u.studentNo));
      var k   = u.hwId+'|'+sno;
      if (rowIndex[k]) {
        sheet.getRange(rowIndex[k], 4, 1, 2).setValues([[u.status, today]]);
      } else {
        newRows.push([cc, u.hwId, sno, u.status, today]);
      }
    });
    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow()+1, 1, newRows.length, 5).setValues(newRows);
    }

    SpreadsheetApp.flush();
    return { success: true, blocked: blocked };
  } catch(e) { return { success: false, msg: e.message }; }
}

function submitHomeworkReport(classCode, hwId) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateHomeworkSheet(ss);
    var data  = sheet.getDataRange().getValues();
    var cc    = cleanText(classCode);
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0])===cc && String(data[i][1])===hwId) {
        var cur = String(data[i][4]||'대기');
        if (cur === '보고') return { success: false, msg: '이미 대통령에게 보고된 과제입니다.' };
        if (cur === '승인') return { success: false, msg: '이미 결재 완료된 과제는 다시 보고할 수 없습니다.' };
        try { CacheService.getScriptCache().removeAll(['homework_'+cc,'hwreport_'+cc]); } catch(ce){}
        sheet.getRange(i+1,5).setValue('보고');
        SpreadsheetApp.flush();
        return { success: true, msg: '대통령에게 보고되었습니다!' };
      }
    }
    return { success: false, msg: '과제를 찾을 수 없습니다.' };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 과제 보고 결재 완료 (교사) ──
// ── 과제 보고 결재 완료 (교사) — 결재 시 제출 상태별 신용점수 자동 대기 등록 ──
function approveHomeworkReport(classCode, hwId) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateHomeworkSheet(ss);
    var data  = sheet.getDataRange().getValues();
    var cc    = cleanText(classCode);
    var hwRowIdx = -1;
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0])===cc && String(data[i][1])===hwId) {
        if (String(data[i][4]||'') !== '보고') return { success: false, msg: '보고된 과제만 결재할 수 있습니다.' };
        hwRowIdx = i + 1;
        break;
      }
    }
    if (hwRowIdx === -1) return { success: false, msg: '과제를 찾을 수 없습니다.' };

    // ★ 제출/지각/미제출 상태에 따라 신용점수를 신용위원회 "대기" 큐에 자동 등록
    var creditSettings = getHomeworkCreditSettings(cc);
    var scoreMap = { 'O': creditSettings.oScore || 0, '△': creditSettings.dScore || 0, 'X': creditSettings.xScore || 0 };

    var stSheet  = getOrCreateHomeworkStatusSheet(ss);
    var stData   = stSheet.getDataRange().getValues();
    var stuSheet = getOrCreateStudentsSheet(ss);
    var stuData  = stuSheet.getDataRange().getValues();
    var nameMap  = {};
    for (var k = 1; k < stuData.length; k++) {
      if (cleanText(stuData[k][0]) === cc) nameMap[String(stuData[k][1])] = stuData[k][2] || '';
    }

    var affected = 0;
    for (var j = 1; j < stData.length; j++) {
      if (cleanText(stData[j][0]) !== cc) continue;
      if (String(stData[j][1]) !== hwId) continue;
      var sno   = String(stData[j][2]);
      var st    = String(stData[j][3] || '');
      var delta = scoreMap[st];
      if (!delta) continue; // 상태 없음(미기록) 또는 설정 점수가 0이면 스킵
      queuePendingCreditDelta(cc, sno, nameMap[sno] || '', delta);
      affected++;
    }

    sheet.getRange(hwRowIdx, 5).setValue('승인');
    try { CacheService.getScriptCache().removeAll(['homework_'+cc,'hwreport_'+cc]); } catch(ce){}
    SpreadsheetApp.flush();
    return { success: true, msg: '결재 완료되었습니다! '+affected+'명의 신용점수가 대기 등록되었습니다.' };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 과제 보고 반려 (교사) ──
function rejectHomeworkReport(classCode, hwId) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateHomeworkSheet(ss);
    var data  = sheet.getDataRange().getValues();
    var cc    = cleanText(classCode);
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0])===cc && String(data[i][1])===hwId) {
        if (String(data[i][4]||'') !== '보고') return { success: false, msg: '보고된 과제만 반려할 수 있습니다.' };
        sheet.getRange(i+1,5).setValue('반려');
        try { CacheService.getScriptCache().removeAll(['homework_'+cc,'hwreport_'+cc]); } catch(ce){}
        SpreadsheetApp.flush();
        return { success: true, msg: '반려 처리되었습니다. 통계청장이 다시 수정 후 재보고할 수 있습니다.' };
      }
    }
    return { success: false, msg: '과제를 찾을 수 없습니다.' };
  } catch(e) { return { success: false, msg: e.message }; }
}

function deleteHomework(classCode, hwId) {
  try {
    var ss      = SpreadsheetApp.getActiveSpreadsheet();
    var hwSheet = getOrCreateHomeworkSheet(ss);
    var stSheet = getOrCreateHomeworkStatusSheet(ss);
    var hwData  = hwSheet.getDataRange().getValues();
    var stData  = stSheet.getDataRange().getValues();
    var cc      = cleanText(classCode);
    for (var i = hwData.length-1; i >= 1; i--) {
      if (cleanText(hwData[i][0])===cc && String(hwData[i][1])===hwId) {
        var st = String(hwData[i][4]||'');
        if (st === '보고' || st === '승인') {
          return { success: false, msg: '보고 중이거나 결재 완료된 과제는 삭제할 수 없습니다.' };
        }
        try { CacheService.getScriptCache().removeAll(['homework_'+cc,'hwreport_'+cc]); } catch(ce){}
        hwSheet.deleteRow(i+1); break;
      }
    }
    for (var j = stData.length-1; j >= 1; j--) {
      if (cleanText(stData[j][0])===cc && String(stData[j][1])===hwId) {
        stSheet.deleteRow(j+1);
      }
    }
    SpreadsheetApp.flush();
    return { success: true, msg: '삭제되었습니다.' };
  } catch(e) { return { success: false, msg: e.message }; }
}

function getHomeworkReports(classCode) {
  var cached = _getCache('hwreport', classCode);
  if(cached) return cached;
  try {
    var ss       = SpreadsheetApp.getActiveSpreadsheet();
    var hwSheet  = getOrCreateHomeworkSheet(ss);
    var stSheet  = getOrCreateHomeworkStatusSheet(ss);
    var stuSheet = getOrCreateStudentsSheet(ss);
    var hwData   = hwSheet.getDataRange().getValues();
    var stData   = stSheet.getDataRange().getValues();
    var stuData  = stuSheet.getDataRange().getValues();
    var cc       = cleanText(classCode);
    var nameMap  = {};
    for (var k = 1; k < stuData.length; k++) {
      if (cleanText(stuData[k][0])===cc) nameMap[String(stuData[k][1])] = stuData[k][2]||'';
    }
    var statusMap = {};
    for (var i = 1; i < stData.length; i++) {
      if (cleanText(stData[i][0])!==cc) continue;
      var hwId = String(stData[i][1]);
      if (!statusMap[hwId]) statusMap[hwId] = {};
      statusMap[hwId][String(stData[i][2])] = String(stData[i][3]);
    }
    var list = [];
    for (var j = 1; j < hwData.length; j++) {
      if (cleanText(hwData[j][0])!==cc) continue;
      if (String(hwData[j][4])!=='보고') continue;
      var id      = String(hwData[j][1]);
      var dateVal = hwData[j][3];
      var dateStr = dateVal instanceof Date
        ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(dateVal||'');
      var statuses     = statusMap[id] || {};
      var submitCount  = 0, lateCount = 0, missCount = 0;
      for (var sno in statuses) {
        if (statuses[sno]==='O') submitCount++;
        else if (statuses[sno]==='△') lateCount++;
        else if (statuses[sno]==='X') missCount++;
      }
      list.push({ hwId:id, title:String(hwData[j][2]||''), date:dateStr,
        statuses:statuses, submitCount:submitCount, lateCount:lateCount, missCount:missCount });
    }
    list.reverse();
    var result = { success: true, list: list, nameMap: nameMap };
    _setCache('hwreport', classCode, result, 60); // ★ 60초 캐싱
    return result;
  } catch(e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [통계] 과제 제출 상태별 신용점수 설정
// HomeworkCreditSettings: [0]학급코드 [1]제출점수 [2]지각점수 [3]미제출점수
// ==========================================
function getOrCreateHomeworkCreditSheet(ss) {
  var sheet = ss.getSheetByName('HomeworkCreditSettings');
  if (!sheet) {
    sheet = ss.insertSheet('HomeworkCreditSettings');
    sheet.appendRow(['학급코드','제출점수','지각점수','미제출점수']);
  }
  return sheet;
}

function getHomeworkCreditSettings(classCode) {
  try {
    var cached = _getCache('hwcredit', classCode);
    if (cached) return cached;
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateHomeworkCreditSheet(ss);
    var data  = sheet.getDataRange().getValues();
    var cc    = cleanText(classCode);
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) === cc) {
        var result = {
          success: true,
          oScore: Number(data[i][1]) || 0,
          dScore: Number(data[i][2]) || 0,
          xScore: Number(data[i][3]) || 0
        };
        _setCache('hwcredit', classCode, result, 300);
        return result;
      }
    }
    var def = { success: true, oScore: 2, dScore: -1, xScore: -3 };
    _setCache('hwcredit', classCode, def, 300);
    return def;
  } catch(e) { return { success: false, msg: e.message, oScore:0, dScore:0, xScore:0 }; }
}

function setHomeworkCreditSettings(classCode, oScore, dScore, xScore) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateHomeworkCreditSheet(ss);
    var data  = sheet.getDataRange().getValues();
    var cc    = cleanText(classCode);
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) === cc) {
        sheet.getRange(i+1,2,1,3).setValues([[Number(oScore)||0, Number(dScore)||0, Number(xScore)||0]]);
        try { CacheService.getScriptCache().remove('hwcredit_'+cc); } catch(e){}
        SpreadsheetApp.flush();
        return { success: true, msg: '과제 신용점수 설정이 저장되었습니다.' };
      }
    }
    sheet.appendRow([cc, Number(oScore)||0, Number(dScore)||0, Number(xScore)||0]);
    try { CacheService.getScriptCache().remove('hwcredit_'+cc); } catch(e){}
    SpreadsheetApp.flush();
    return { success: true, msg: '과제 신용점수 설정이 저장되었습니다.' };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [도매상] 상품/판매/입고 관리
// ==========================================
function getOrCreateWholesaleItemsSheet(ss) {
  var sheet = ss.getSheetByName('WholesaleItems');
  if (!sheet) {
    sheet = ss.insertSheet('WholesaleItems');
    sheet.appendRow(['학급코드','판매자번호','상품명','가격','재고','판매수']);
  }
  return sheet;
}

function getOrCreateWholesaleSalesSheet(ss) {
  var sheet = ss.getSheetByName('WholesaleSales');
  if (!sheet) {
    sheet = ss.insertSheet('WholesaleSales');
    sheet.appendRow(['학급코드','판매자번호','구매자번호','구매자이름','상품명','단가','수량','총액','결제방법','날짜']);
  }
  return sheet;
}

function getOrCreateWholesaleStockSheet(ss) {
  var sheet = ss.getSheetByName('WholesaleStock');
  if (!sheet) {
    sheet = ss.insertSheet('WholesaleStock');
    sheet.appendRow(['학급코드','요청자번호','상품명','수량','상태','날짜','메모']);
  }
  return sheet;
}

function getWholesaleItems(classCode, studentNo) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateWholesaleItemsSheet(ss);
    var data  = sheet.getDataRange().getValues();
    var cc    = cleanText(classCode), sno = cleanText(String(studentNo));
    var list  = [], newsPct = _newsEffects(cc).price;
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0])===cc && cleanText(String(data[i][1]))===sno) {
        list.push({ rowNo: i, name: String(data[i][2]||''), price: _newsPrice(Number(data[i][3])||0, newsPct), basePrice: Number(data[i][3])||0, stock: Number(data[i][4])||0, sold: Number(data[i][5])||0 });
      }
    }
    return { success: true, list: list };
  } catch(e) { return { success: false, msg: e.message }; }
}

function addWholesaleItemBackend(classCode, studentNo, name, price, stock) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateWholesaleItemsSheet(ss);
    var data  = sheet.getDataRange().getValues();
    var cc    = cleanText(classCode), sno = cleanText(String(studentNo));
    var itemName = String(name||'').trim();
    if (!itemName || isNaN(parseInt(price))) return { success: false, msg: '상품명과 가격을 입력해 주세요.' };
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0])===cc && cleanText(String(data[i][1]))===sno && cleanText(data[i][2])===cleanText(itemName))
        return { success: false, msg: '이미 등록된 상품명입니다.' };
    }
    sheet.appendRow([cc, sno, itemName, Number(price)||0, Number(stock)||0, 0]);
    SpreadsheetApp.flush();
    return { success: true, msg: '상품이 등록되었습니다.' };
  } catch(e) { return { success: false, msg: e.message }; }
}

function updateWholesaleItemStock(classCode, studentNo, rowNo, stock) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateWholesaleItemsSheet(ss);
    sheet.getRange(parseInt(rowNo)+1, 5).setValue(Number(stock)||0);
    SpreadsheetApp.flush();
    return { success: true };
  } catch(e) { return { success: false, msg: e.message }; }
}

function deleteWholesaleItem(classCode, studentNo, rowNo) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateWholesaleItemsSheet(ss);
    sheet.deleteRow(parseInt(rowNo)+1);
    SpreadsheetApp.flush();
    return { success: true, msg: '삭제되었습니다.' };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ★ 도매상 인플레이션: 구매자 카드 잔액이 5,000 이상이면 정가의 1.5배로 판매
//   여러 개를 살 때는 한 개씩 차례로 계산 → 사고 나서 5,000 아래로 내려가면 다음 물건부터 정가
//   예) 카드 5,200 / 300짜리 2개 → 1개째 450(1.5배), 남은 4,750 → 2개째 300(정가) = 750
var WS_INFLATION_LINE = 5000;
var WS_INFLATION_RATE = 1.5;
function calcWholesaleInflation(card, price, qty) {
  var bal = Number(card) || 0, total = 0, inflated = 0;
  for (var u = 0; u < qty; u++) {
    var p = price;
    if (bal >= WS_INFLATION_LINE) { p = Math.round(price * WS_INFLATION_RATE); inflated++; }
    total += p; bal -= p;
  }
  return { total: total, inflated: inflated };
}

function recordWholesaleSale(classCode, sellerNo, buyerNo, itemName, unitPrice, quantity) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    try { CacheService.getScriptCache().removeAll(['students_'+cleanText(classCode)]); } catch(ce){}

    var ss        = SpreadsheetApp.getActiveSpreadsheet();
    var stuSheet  = getOrCreateStudentsSheet(ss);
    var saleSheet = getOrCreateWholesaleSalesSheet(ss);
    var itemSheet = getOrCreateWholesaleItemsSheet(ss);
    var tSheet    = getOrCreateTransSheet(ss);
    var stuData   = stuSheet.getDataRange().getValues();
    var itemData  = itemSheet.getDataRange().getValues();
    var cc        = cleanText(classCode);
    var sellerSno = cleanText(String(sellerNo || ''));
    var buyerSno  = cleanText(String(buyerNo  || ''));
    var qty       = parseInt(quantity);
    var price     = parseInt(unitPrice);
    var total     = qty * price;
    var today     = getTodayStr();

    if (isNaN(qty)   || qty   <= 0) return { success: false, msg: '수량을 올바르게 입력해 주세요.' };
    if (isNaN(price) || price <= 0) return { success: false, msg: '가격이 올바르지 않습니다.' };

    // ★ 판매자 ≠ 구매자 검증
    if (sellerSno && buyerSno && sellerSno === buyerSno)
      return { success: false, msg: '판매자와 구매자가 동일합니다.' };

    // ── 구매자 조회 ──
    var buyerRowIdx = -1, buyerCard = 0, buyerName = '';
    for (var i = 1; i < stuData.length; i++) {
      if (cleanText(stuData[i][0]) === cc &&
          cleanText(String(stuData[i][1])) === buyerSno) {
        buyerRowIdx = i + 1;
        buyerCard   = Number(stuData[i][4]) || 0;
        buyerName   = stuData[i][2] || '';
        break;
      }
    }
    if (buyerRowIdx === -1) return { success: false, msg: '구매자를 찾을 수 없습니다.' };

    // ── 판매자 조회 (학생 판매자일 때만) ──
    var sellerRowIdx = -1, sellerCard = 0;
    var isTeacherSeller = !sellerSno; // sellerSno 없으면 교사 모드
    if (!isTeacherSeller) {
      for (var j = 1; j < stuData.length; j++) {
        if (cleanText(stuData[j][0]) === cc &&
            cleanText(String(stuData[j][1])) === sellerSno) {
          sellerRowIdx = j + 1;
          sellerCard   = Number(stuData[j][4]) || 0;
          break;
        }
      }
      // 학생 번호가 있지만 DB에서 못 찾으면 교사로 처리
      if (sellerRowIdx === -1) isTeacherSeller = true;
    }

    // ★ 판매자·구매자 행이 같으면 중단 (이중 업데이트 방지)
    if (!isTeacherSeller && sellerRowIdx === buyerRowIdx)
      return { success: false, msg: '판매자와 구매자 정보가 충돌합니다. 다시 시도해 주세요.' };

    // ── 재고 확인 및 차감 ──
    var itemRowIdx = -1, itemStock = 0, curSold = 0;
    for (var k = 1; k < itemData.length; k++) {
      if (cleanText(itemData[k][0]) === cc &&
          cleanText(String(itemData[k][2])) === cleanText(String(itemName))) {
        // 학생 판매자면 본인 상품만
        if (!isTeacherSeller &&
            cleanText(String(itemData[k][1])) !== sellerSno) continue;
        itemRowIdx = k + 1;
        itemStock  = Number(itemData[k][4]) || 0;
        curSold    = Number(itemData[k][5]) || 0;
        break;
      }
    }
    if (itemRowIdx !== -1 && itemStock < qty)
      return { success: false, msg: '재고가 부족합니다. (현재 재고: ' + itemStock + '개)' };

    // ★ 뉴스룸 속보 물가: 화면에 남아 있던 옛 가격으로 팔리지 않게 서버 가격과 비교
    if (itemRowIdx !== -1) {
      var nowPrice = _newsPrice(Number(itemData[itemRowIdx - 1][3]) || 0, _newsEffects(cc).price);
      if (nowPrice > 0 && nowPrice !== price)
        return { success: false, msg: '지금 ' + itemName + ' 가격은 ' + nowPrice.toLocaleString() + ' 머니예요. 물건을 다시 골라 주세요.' };
    }

    // ★ 인플레이션 적용 (카드 5,000 이상일 때 1.5배)
    var infl = calcWholesaleInflation(buyerCard, price, qty);
    total = infl.total;
    var inflNote = infl.inflated > 0 ? ' (인플레이션 1.5배 ' + infl.inflated + '개)' : '';

    if (buyerCard < total)  return { success: false, msg: '구매자 카드 잔액이 부족합니다. (보유: ' + buyerCard + ' 머니, 필요: ' + total + ' 머니)' };

    // ── ★ 구매자 카드 차감 먼저 처리 ──
    var newBuyerCard = buyerCard - total;
    stuSheet.getRange(buyerRowIdx, 5).setValue(newBuyerCard);
    tSheet.appendRow([today, cc, buyerSno,
      '[도매상] ' + itemName + ' ' + qty + '개 구매 (통장이체)' + inflNote,
      '', total, newBuyerCard, '도매구매']);

    // ── ★ 판매자 카드 지급 (학생 판매자일 때만, 구매자 업데이트와 별도) ──
    var newSellerCard = sellerCard;
    if (!isTeacherSeller && sellerRowIdx !== -1) {
      newSellerCard = sellerCard + total;
      stuSheet.getRange(sellerRowIdx, 5).setValue(newSellerCard);
      tSheet.appendRow([today, cc, sellerSno,
        '[도매상] ' + itemName + ' ' + qty + '개 판매 (통장이체)' + inflNote,
        total, '', newSellerCard, '도매판매']);
    }

    // ── 재고 업데이트 ──
    if (itemRowIdx !== -1) {
      itemSheet.getRange(itemRowIdx, 5).setValue(itemStock - qty);
      itemSheet.getRange(itemRowIdx, 6).setValue(curSold + qty);
    }

       // ── 판매 기록 저장 ──
    saleSheet.appendRow([
      cc, sellerSno || '교사', buyerSno, buyerName,
      itemName, price, qty, total, '통장이체', today
    ]);

    // ★ 매점 법인세(국고 환수) 10% 자동 적립
    _addWholesaleCorpTaxAccrual(cc, sellerSno || '교사', Math.floor(total * 0.1));

    SpreadsheetApp.flush();
    return {
  success: true,
  msg: buyerName + '님 카드에서 ' + total.toLocaleString() + ' 머니 차감 완료!' + inflNote,
  total: total,
  inflated: infl.inflated,
  newSellerCard: newSellerCard
};

  } catch(e) {
    if (e.message.match(/lock/i))
      return { success: false, msg: '🚦 서버가 혼잡합니다. 잠시 후 다시 시도해주세요.' };
    return { success: false, msg: e.message };
  } finally {
    lock.releaseLock();
  }
}

function getWholesaleSales(classCode, studentNo) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateWholesaleSalesSheet(ss);
    var data  = sheet.getDataRange().getValues();
    var cc    = cleanText(classCode);
    var sno   = cleanText(String(studentNo || ''));

    // ★ 학생번호 없음 = 교사 모드 → '교사'로 조회
    var sellerKey = sno ? sno : '교사';

    var list = [];
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) !== cc) continue;
      if (cleanText(String(data[i][1] || '')) !== sellerKey) continue;
      var dv = data[i][9];
      var ds = dv instanceof Date
        ? Utilities.formatDate(dv, Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(dv || '');
      list.push({
        buyerNo:   String(data[i][2]  || ''),
        buyerName: String(data[i][3]  || ''),
        itemName:  String(data[i][4]  || ''),
        unitPrice: Number(data[i][5]) || 0,
        quantity:  Number(data[i][6]) || 0,
        total:     Number(data[i][7]) || 0,
        payMethod: String(data[i][8]  || ''),
        date:      ds
      });
    }
    list.reverse();
    return { success: true, list: list };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 마스터 대시보드 결재 대기 배지 - 3개를 한 번의 통신으로 가져옴 (속도 개선) ──
function getMasterPendingBadgeCounts(classCode) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cc = cleanText(classCode);

    var tSheet = getOrCreateTreasurySheet(ss);
    var tData  = tSheet.getDataRange().getValues();
    var treasuryPending = 0;
    for (var i = 1; i < tData.length; i++) {
      if (cleanText(tData[i][0]) === cc && String(tData[i][5]||'') === '대기') treasuryPending++;
    }

    var cSheet = getOrCreateCreditPendingSheet(ss);
    var cData  = cSheet.getDataRange().getValues();
    var creditPending = 0;
    for (var j = 1; j < cData.length; j++) {
      if (cleanText(cData[j][0]) === cc && String(cData[j][4]||'') === '보고') creditPending++;
    }

    var hSheet = getOrCreateHomeworkSheet(ss);
    var hData  = hSheet.getDataRange().getValues();
    var hwPending = 0;
    for (var k = 1; k < hData.length; k++) {
      if (cleanText(hData[k][0]) === cc && String(hData[k][4]||'') === '보고') hwPending++;
    }

    var fineSheet = ss.getSheetByName('FineRequests'), finePending = 0;
    if (fineSheet) {
      var fData = fineSheet.getDataRange().getValues();
      for (var f = 1; f < fData.length; f++) if (cleanText(fData[f][0]) === cc && String(fData[f][6] || '') === '대기') finePending++;
    }

    return { success: true, treasury: treasuryPending, credit: creditPending, stats: hwPending, police: finePending };
  } catch(e) { return { success: false, msg: e.message }; }
}

function addStockRequest(classCode, studentNo, itemName, quantity, note) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateWholesaleStockSheet(ss);
    var cc    = cleanText(classCode), sno = cleanText(String(studentNo));
    if (!itemName) return { success: false, msg: '상품명을 입력해 주세요.' };
    sheet.appendRow([cc, sno, cleanText(itemName), Number(quantity)||1, '대기', getTodayStr(), note||'']);
    SpreadsheetApp.flush();
    return { success: true, msg: '입고 신청이 완료되었습니다.' };
  } catch(e) { return { success: false, msg: e.message }; }
}

function getStockRequests(classCode, studentNo) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateWholesaleStockSheet(ss);
    var data  = sheet.getDataRange().getValues();
    var cc    = cleanText(classCode), sno = cleanText(String(studentNo));
    var list  = [];
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0])!==cc || cleanText(String(data[i][1]))!==sno) continue;
      var dv = data[i][5];
      var ds = dv instanceof Date ? Utilities.formatDate(dv, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(dv||'');
      list.push({ rowNo:i, itemName:String(data[i][2]||''), quantity:Number(data[i][3])||0, status:String(data[i][4]||'대기'), date:ds, note:String(data[i][6]||'') });
    }
    list.reverse();
    return { success: true, list: list };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [도매상] 매점 수익 국고 환수(법인세) 시스템
// WholesaleCorpTax: [0]학급코드 [1]판매자번호(또는'교사') [2]누적액
// ==========================================
function getOrCreateWholesaleCorpTaxSheet(ss) {
  var sheet = ss.getSheetByName('WholesaleCorpTax');
  if (!sheet) {
    sheet = ss.insertSheet('WholesaleCorpTax');
    sheet.appendRow(['학급코드','판매자번호','누적액']);
  }
  return sheet;
}

function _findWholesaleCorpTaxRow(sheet, cc, sellerKey) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (cleanText(data[i][0]) === cc && cleanText(String(data[i][1])) === sellerKey) return i + 1;
  }
  return -1;
}

// 판매 성사 시 10% 적립 (recordWholesaleSale 안에서 호출 — 자체 lock 없음, 부모 lock에 편승)
function _addWholesaleCorpTaxAccrual(classCode, sellerKey, amount) {
  try {
    if (!amount) return;
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateWholesaleCorpTaxSheet(ss);
    var cc    = cleanText(classCode);
    var key   = sellerKey || '교사';
    var rowIdx = _findWholesaleCorpTaxRow(sheet, cc, key);
    if (rowIdx === -1) {
      sheet.appendRow([cc, key, amount]);
    } else {
      var cur = Number(sheet.getRange(rowIdx, 3).getValue()) || 0;
      sheet.getRange(rowIdx, 3).setValue(cur + amount);
    }
  } catch(e) {}
}

// 판매 취소 시 적립분 되돌리기 (deleteWholesaleSale 안에서 호출)
function _subWholesaleCorpTaxAccrual(classCode, sellerKey, amount) {
  try {
    if (!amount) return;
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateWholesaleCorpTaxSheet(ss);
    var cc    = cleanText(classCode);
    var key   = sellerKey || '교사';
    var rowIdx = _findWholesaleCorpTaxRow(sheet, cc, key);
    if (rowIdx !== -1) {
      var cur = Number(sheet.getRange(rowIdx, 3).getValue()) || 0;
      sheet.getRange(rowIdx, 3).setValue(Math.max(0, cur - amount));
    }
  } catch(e) {}
}

// ── 현재 적립액 조회 ──
function getWholesaleCorpTax(classCode, studentNo) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrCreateWholesaleCorpTaxSheet(ss);
    var cc    = cleanText(classCode);
    var key   = cleanText(String(studentNo || '')) || '교사';
    var rowIdx = _findWholesaleCorpTaxRow(sheet, cc, key);
    var accrued = rowIdx === -1 ? 0 : (Number(sheet.getRange(rowIdx, 3).getValue()) || 0);
    return { success: true, accrued: accrued };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 납부 완료: 국세청 Treasury에 자동 승인 상태로 등록 + 적립액 0 리셋 ──
function payWholesaleCorpTax(classCode, studentNo) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var ss     = SpreadsheetApp.getActiveSpreadsheet();
    var sheet  = getOrCreateWholesaleCorpTaxSheet(ss);
    var tSheet = getOrCreateTreasurySheet(ss);
    var cc     = cleanText(classCode);
    var key    = cleanText(String(studentNo || '')) || '교사';
    var rowIdx = _findWholesaleCorpTaxRow(sheet, cc, key);
    var accrued = rowIdx === -1 ? 0 : (Number(sheet.getRange(rowIdx, 3).getValue()) || 0);

    if (accrued <= 0) return { success: false, msg: '납부할 환수금이 없습니다.' };

    var today = getTodayStr();
    // ★ 자동 계산된 법인세이므로 교사 승인 없이 즉시 '승인' 상태로 국고에 반영
    tSheet.appendRow([cc, today, '[매점 법인세] 주간 판매 수익 환수금 납부', '수입', accrued, '승인', key, today]);

    if (rowIdx === -1) sheet.appendRow([cc, key, 0]);
    else sheet.getRange(rowIdx, 3).setValue(0);

    SpreadsheetApp.flush();
    return { success: true, msg: accrued.toLocaleString() + ' 머니 납부 완료! 국세청 세금 내역에 반영되었습니다.', amount: accrued };
  } catch(e) {
    if (e.message.match(/lock/i)) return { success: false, msg: '🚦 서버가 혼잡합니다. 잠시 후 다시 시도해주세요.' };
    return { success: false, msg: e.message };
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// [전체 로그] 학급 전체 활동 내역
// ==========================================
function getAllActivityLog(classCode) {
  try {
    var ss       = SpreadsheetApp.getActiveSpreadsheet();
    var tSheet   = getOrCreateTransSheet(ss);
    var stuSheet = getOrCreateStudentsSheet(ss);
    var tData    = tSheet.getDataRange().getValues();
    var stuData  = stuSheet.getDataRange().getValues();
    var cc       = cleanText(classCode);

    // 학생 정보 맵
    var nameMap = {}, jobMap = {};
    var totalCard = 0, totalBank = 0, stuCount = 0;
    for (var k = 1; k < stuData.length; k++) {
      if (cleanText(stuData[k][0]) !== cc) continue;
      var sno = String(stuData[k][1]);
      nameMap[sno] = stuData[k][2] || '';
      jobMap[sno]  = stuData[k][3] || '';
      totalCard   += Number(stuData[k][4]) || 0;
      totalBank   += Number(stuData[k][5]) || 0;
      stuCount++;
    }

    var list = [];
    for (var i = 1; i < tData.length; i++) {
      if (cleanText(tData[i][1]) !== cc) continue;
      var dateVal = tData[i][0];
      var dateStr = dateVal instanceof Date
        ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(dateVal || '');
      var sno2 = String(tData[i][2] || '');
      list.push({
        rowNo:   i,
        date:    dateStr,
        sno:     sno2,
        name:    nameMap[sno2] || '',
        job:     jobMap[sno2]  || '',
        memo:    String(tData[i][3] || ''),
        income:  Number(tData[i][4]) || 0,
        expense: Number(tData[i][5]) || 0,
        balance: Number(tData[i][6]) || 0,
        type:    String(tData[i][7] || '')
      });
    }

    list.reverse();
    return {
      success: true, list: list.slice(0, 300),
      totalCount: list.length,
      totalCard: totalCard, totalBank: totalBank,
      totalAmount: totalCard + totalBank,
      stuCount: stuCount
    };
  } catch(e) { return { success: false, msg: e.message }; }
}

function deleteActivityLog(classCode, rowNo) {
  try {
    var ss      = SpreadsheetApp.getActiveSpreadsheet();
    var tSheet  = getOrCreateTransSheet(ss);
    var stuSheet= getOrCreateStudentsSheet(ss);
    var tData   = tSheet.getDataRange().getValues();
    var stuData = stuSheet.getDataRange().getValues();
    var cc      = cleanText(classCode);
    var rn      = parseInt(rowNo);
    if (rn < 1 || rn >= tData.length) return { success: false, msg: '기록을 찾을 수 없습니다.' };
    if (cleanText(tData[rn][1]) !== cc) return { success: false, msg: '접근 권한이 없습니다.' };

    var sno     = cleanText(String(tData[rn][2]));
    var income  = Number(tData[rn][4]) || 0;
    var expense = Number(tData[rn][5]) || 0;
    var net     = income - expense;

    // 카드 잔액 역산 (거래 취소 효과)
    if (net !== 0) {
      for (var i = 1; i < stuData.length; i++) {
        if (cleanText(stuData[i][0]) === cc && cleanText(String(stuData[i][1])) === sno) {
          var cur = Number(stuData[i][4]) || 0;
          stuSheet.getRange(i+1, 5).setValue(cur - net);
          break;
        }
      }
    }

    tSheet.deleteRow(rn + 1);
    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    SpreadsheetApp.flush();
    return { success: true, msg: '삭제 완료. 카드 잔액이 자동 복원되었습니다.' };
  } catch(e) { return { success: false, msg: e.message }; }
}

function editActivityLogMemo(classCode, rowNo, newMemo) {
  try {
    var ss     = SpreadsheetApp.getActiveSpreadsheet();
    var tSheet = getOrCreateTransSheet(ss);
    var tData  = tSheet.getDataRange().getValues();
    var cc     = cleanText(classCode);
    var rn     = parseInt(rowNo);
    if (rn < 1 || rn >= tData.length) return { success: false, msg: '기록을 찾을 수 없습니다.' };
    if (cleanText(tData[rn][1]) !== cc) return { success: false, msg: '접근 권한이 없습니다.' };
    tSheet.getRange(rn+1, 4).setValue(String(newMemo||''));
    SpreadsheetApp.flush();
    return { success: true, msg: '메모가 수정되었습니다.' };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 전체 로그 초기화 (해당 학급의 거래 내역만 삭제, 다른 학급 데이터/현재 잔액은 유지) ──
function resetActivityLog(classCode) {
  try {
    var ss     = SpreadsheetApp.getActiveSpreadsheet();
    var tSheet = getOrCreateTransSheet(ss);
    var data   = tSheet.getDataRange().getValues();
    var cc     = cleanText(classCode);
    var header = data[0];
    var kept   = [];
    var count  = 0;

    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][1]) === cc) {
        count++; // 이 학급 것만 카운트 (삭제 대상)
      } else {
        kept.push(data[i]); // 다른 학급 데이터는 보존
      }
    }

    tSheet.clearContents();
    tSheet.appendRow(header);
    if (kept.length > 0) {
      tSheet.getRange(2, 1, kept.length, header.length).setValues(kept);
    }

    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    SpreadsheetApp.flush();
    return { success: true, msg: count + '건의 로그가 초기화되었습니다.' };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 공통 헬퍼: 특정 시트에서 classCode가 일치하는 행만 삭제 (다른 학급 데이터는 보존) ──
function _clearSheetForClass(sheetName, classCode, ccColIndex) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return 0;
  var data = sheet.getDataRange().getValues();
  if (data.length < 1) return 0;
  var header = data[0];
  var kept = [];
  var count = 0;
  var cc = cleanText(classCode);
  var col = (typeof ccColIndex === 'number') ? ccColIndex : 0;
  for (var i = 1; i < data.length; i++) {
    if (cleanText(data[i][col]) === cc) count++;
    else kept.push(data[i]);
  }
  if (count === 0) return 0;
  sheet.clearContents();
  sheet.appendRow(header);
  if (kept.length > 0) sheet.getRange(2, 1, kept.length, header.length).setValues(kept);
  return count;
}

// ── 학급 전체 초기화 (잔액·신용점수·모든 거래/기록 초기화. 설정값·학생명단은 유지) ──
function resetClassEconomy(classCode) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cc = cleanText(classCode);

    // 1. 학생 잔액/신용점수 초기화 (이름·직업·접속코드는 유지)
    var stuSheet = getOrCreateStudentsSheet(ss);
    var stuData  = stuSheet.getDataRange().getValues();
    var stuCount = 0;
    for (var i = 1; i < stuData.length; i++) {
      if (cleanText(stuData[i][0]) === cc) {
        stuSheet.getRange(i+1, 5, 1, 3).setValues([[0, 0, 0]]); // 카드,은행,신용
        stuCount++;
      }
    }

    // 2. 거래 로그 초기화 (기존 resetActivityLog 재사용 — Transactions는 학급코드가 2번째 열)
    resetActivityLog(cc);

    // 3. 각종 학급 데이터 시트 초기화 (해당 학급分만, 다른 학급은 보존)
    var depCount   = _clearSheetForClass('Deposits', cc);
    var credCount  = _clearSheetForClass('CreditPending', cc);
    var treCount   = _clearSheetForClass('Treasury', cc);
    var wsItemCnt  = _clearSheetForClass('WholesaleItems', cc);
    var wsSaleCnt  = _clearSheetForClass('WholesaleSales', cc);
    var wsStockCnt = _clearSheetForClass('WholesaleStock', cc);
    var wsTaxCnt   = _clearSheetForClass('WholesaleCorpTax', cc);
    var hwCnt      = _clearSheetForClass('Homework', cc);
    var hwStCnt    = _clearSheetForClass('HomeworkStatus', cc);
    _clearSheetForClass('Newsroom', cc);   // 뉴스룸 속보도 해제

    // 4. 부동산은 매물 정보(이름/가격 등)는 유지, 소유권만 초기화
    var reSheet = ss.getSheetByName('RealEstate');
    var reCount = 0;
    if (reSheet) {
      var reData = reSheet.getDataRange().getValues();
      for (var j = 1; j < reData.length; j++) {
        if (cleanText(reData[j][0]) === cc) {
          reSheet.getRange(j+1, 5).setValue('');      // 소유자학생번호
          reSheet.getRange(j+1, 8).setValue('매물');  // 상태
          reCount++;
        }
      }
    }

    try {
      CacheService.getScriptCache().removeAll(['students_'+cc, 'homework_'+cc, 'hwreport_'+cc]);
    } catch(ce){}

    SpreadsheetApp.flush();
    return {
      success: true,
      msg: '학급이 초기화되었습니다! (학생 '+stuCount+'명 잔액·신용 0으로, 예금 '+depCount+'건·국고 '+treCount+'건·신용대기 '+credCount+'건·도매 '+(wsItemCnt+wsSaleCnt+wsStockCnt+wsTaxCnt)+'건·과제 '+(hwCnt+hwStCnt)+'건 삭제, 부동산 '+reCount+'건 매물 전환)'
    };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 도매 판매 기록 삭제 (잔액 복원) ──
function deleteWholesaleSale(classCode, studentNo, saleIndex) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    try { CacheService.getScriptCache().removeAll(['students_'+cleanText(classCode)]); } catch(ce){}

    var ss        = SpreadsheetApp.getActiveSpreadsheet();
    var saleSheet = getOrCreateWholesaleSalesSheet(ss);
    var stuSheet  = getOrCreateStudentsSheet(ss);
    var itemSheet = getOrCreateWholesaleItemsSheet(ss);
    var tSheet    = getOrCreateTransSheet(ss);
    var saleData  = saleSheet.getDataRange().getValues();
    var stuData   = stuSheet.getDataRange().getValues();
    var itemData  = itemSheet.getDataRange().getValues();
    var cc        = cleanText(classCode);
    var sno       = cleanText(String(studentNo || ''));
    var sellerKey = sno ? sno : '교사';
    var today     = getTodayStr();

    // ★ 해당 판매자의 기록 중 saleIndex 번째 (역순) 찾기
    var matchRows = [];
    for (var i = 1; i < saleData.length; i++) {
      if (cleanText(saleData[i][0]) === cc &&
          cleanText(String(saleData[i][1] || '')) === sellerKey) {
        matchRows.push(i);
      }
    }
    // list.reverse() 했으므로 화면상 idx = matchRows 역순
    matchRows.reverse();
    var idx = parseInt(saleIndex);
    if (idx < 0 || idx >= matchRows.length)
      return { success: false, msg: '삭제할 기록을 찾을 수 없습니다.' };

    var sheetRowIdx = matchRows[idx]; // 0-based data array
    var row         = saleData[sheetRowIdx];
    var buyerSno    = cleanText(String(row[2] || ''));
    var itemName    = String(row[4] || '');
    var unitPrice   = Number(row[5]) || 0;
    var quantity    = Number(row[6]) || 0;
    var total       = Number(row[7]) || 0;

    // ── 구매자 잔액 복원 (환불) ──
    for (var b = 1; b < stuData.length; b++) {
      if (cleanText(stuData[b][0]) === cc &&
          cleanText(String(stuData[b][1])) === buyerSno) {
        var newBuyerCard = (Number(stuData[b][4]) || 0) + total;
        stuSheet.getRange(b + 1, 5).setValue(newBuyerCard);
        tSheet.appendRow([today, cc, buyerSno,
          '[도매상 취소] ' + itemName + ' ' + quantity + '개 구매 취소 (환불)',
          total, '', newBuyerCard, '도매취소']);
        break;
      }
    }

    // ── 판매자가 학생이면 잔액 회수 ──
    if (sno) {
      for (var s = 1; s < stuData.length; s++) {
        if (cleanText(stuData[s][0]) === cc &&
            cleanText(String(stuData[s][1])) === sno) {
          var newSellerCard = (Number(stuData[s][4]) || 0) - total;
          stuSheet.getRange(s + 1, 5).setValue(newSellerCard);
          tSheet.appendRow([today, cc, sno,
            '[도매상 취소] ' + itemName + ' ' + quantity + '개 판매 취소 (회수)',
            '', total, newSellerCard, '도매취소']);
          break;
        }
      }
    }

    // ── 재고 복원 ──
    for (var k = 1; k < itemData.length; k++) {
      if (cleanText(itemData[k][0]) === cc &&
          cleanText(String(itemData[k][2])) === cleanText(itemName)) {
        if (sno && cleanText(String(itemData[k][1])) !== sno) continue;
        var curStock = Number(itemData[k][4]) || 0;
        var curSold  = Number(itemData[k][5]) || 0;
        itemSheet.getRange(k + 1, 5).setValue(curStock + quantity);
        itemSheet.getRange(k + 1, 6).setValue(Math.max(0, curSold - quantity));
        break;
      }
    }

    // ★ 매점 법인세 누적액도 취소분만큼 차감
    _subWholesaleCorpTaxAccrual(cc, sellerKey, Math.floor(total * 0.1));

    // ── 판매 기록 삭제 ──
    saleSheet.deleteRow(sheetRowIdx + 1);
    SpreadsheetApp.flush();
    return { success: true, msg: total.toLocaleString() + ' 머니가 구매자에게 환불되었습니다.' };

  } catch(e) {
    if (e.message.match(/lock/i))
      return { success: false, msg: '🚦 서버가 혼잡합니다. 잠시 후 다시 시도해주세요.' };
    return { success: false, msg: e.message };
  } finally {
    lock.releaseLock();
  }
}

// ── 도매 판매 메모 수정 ──
function editWholesaleSaleMemo(classCode, studentNo, saleIndex, newMemo) {
  try {
    var ss       = SpreadsheetApp.getActiveSpreadsheet();
    var saleSheet= getOrCreateWholesaleSalesSheet(ss);
    var saleData = saleSheet.getDataRange().getValues();
    var cc       = cleanText(classCode);
    var sno      = cleanText(String(studentNo || ''));
    var sellerKey= sno ? sno : '교사';

    var matchRows = [];
    for (var i = 1; i < saleData.length; i++) {
      if (cleanText(saleData[i][0]) === cc &&
          cleanText(String(saleData[i][1] || '')) === sellerKey) {
        matchRows.push(i);
      }
    }
    matchRows.reverse();
    var idx = parseInt(saleIndex);
    if (idx < 0 || idx >= matchRows.length)
      return { success: false, msg: '기록을 찾을 수 없습니다.' };

    // WholesaleSales 시트에 메모 열이 없으므로 상품명 옆(col 11)에 저장
    var sheetRowIdx = matchRows[idx];
    saleSheet.getRange(sheetRowIdx + 1, 11).setValue(String(newMemo || ''));
    SpreadsheetApp.flush();
    return { success: true, msg: '메모가 수정되었습니다.' };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [벌칙 법전] 위반 사유와 벌금 (선생님이 경찰서 → 벌칙 법전 조회에서 적음)
// FineLaw: [0]학급코드 [1]법전(JSON 배열: {name, price, desc})
// 경찰서 벌금 부과의 "위반 사유" 버튼으로 그대로 나옵니다.
// ==========================================
function getFineLaw(classCode) {
  try {
    var cc = cleanText(classCode);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('FineLaw');
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (cleanText(data[i][0]) === cc) {
          var list = [];
          try { list = JSON.parse(String(data[i][1] || '[]')); } catch (pe) { list = []; }
          return { success: true, list: Array.isArray(list) ? list : [] };
        }
      }
    }
    return { success: true, list: [] };
  } catch(e) { return { success: false, msg: e.message }; }
}

function setFineLaw(classCode, lawJson) {
  try {
    var cc = cleanText(classCode);
    if (!cc) return { success: false, msg: "학급 코드가 없습니다. 다시 로그인해 주세요." };
    var raw = typeof lawJson === 'string' ? JSON.parse(lawJson || '[]') : (lawJson || []);
    if (!Array.isArray(raw)) return { success: false, msg: "법전 형식이 올바르지 않습니다." };
    var list = [];
    raw.forEach(function (m) {
      var name = String((m && m.name) || '').trim().slice(0, 40);
      if (!name) return;
      var price = parseInt(m.price);
      list.push({ name: name, price: isNaN(price) || price < 0 ? 0 : price, desc: String(m.desc || '').trim().slice(0, 100) });
    });
    if (list.length > 50) return { success: false, msg: "벌칙 법전은 50개까지 적을 수 있습니다." };
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('FineLaw');
    if (!sheet) { sheet = ss.insertSheet('FineLaw'); sheet.appendRow(['학급코드','법전']); }
    var data = sheet.getDataRange().getValues();
    var json = JSON.stringify(list);
    var msg = "벌칙 법전 " + list.length + "개 조항을 저장했습니다!";
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) === cc) {
        sheet.getRange(i + 1, 2).setValue(json);
        return { success: true, list: list, msg: msg };
      }
    }
    sheet.appendRow([cc, json]);
    return { success: true, list: list, msg: msg };
  } catch(e) { return { success: false, msg: "오류: " + e.message }; }
}

// ── 학급 전체 벌금 내역 조회 (경찰서장용) ──
function getAllFines(classCode) {
  try {
    var ss      = SpreadsheetApp.getActiveSpreadsheet();
    var tSheet  = getOrCreateTransSheet(ss);
    var stuSheet= getOrCreateStudentsSheet(ss);
    var tData   = tSheet.getDataRange().getValues();
    var stuData = stuSheet.getDataRange().getValues();
    var cc      = cleanText(classCode);

    var nameMap = {};
    for (var k = 1; k < stuData.length; k++) {
      if (cleanText(stuData[k][0]) === cc)
        nameMap[String(stuData[k][1])] = stuData[k][2] || '';
    }

    var list = [];
    for (var i = 1; i < tData.length; i++) {
      if (cleanText(tData[i][1]) !== cc) continue;
      // ★ 벌금 타입 체크 — 부분 매칭으로 변경
      var txType = String(tData[i][7] || '');
      if (txType !== '벌금') continue;
      var dateVal = tData[i][0];
      var dateStr = dateVal instanceof Date
        ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(dateVal || '');
      var sno = tData[i][2] == null ? '' : String(tData[i][2]);   // 0번(선생님)도 빈칸이 되지 않게
      var memo = String(tData[i][3] || '');
      // [벌금] 접두사 제거해서 사유만 표시
      var reason = memo.replace(/^\[벌금\]\s*/,'');
      list.push({
        rowNo:   i,           // ★ 시트 행 번호 (삭제/수정에 사용)
        date:    dateStr,
        sno:     sno,
        name:    nameMap[sno] || '',
        memo:    memo,
        reason:  reason,
        expense: Number(tData[i][5]) || 0,
        balance: Number(tData[i][6]) || 0
      });
    }
    list.reverse();
    return { success: true, list: list.slice(0, 50) };
  } catch(e) { return { success: false, msg: e.message }; }
}

// ── 벌금 기록 삭제 (잔액 + 신용점수 복원) ──
function deleteFineRecord(classCode, rowNo) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    try { CacheService.getScriptCache().removeAll(['students_'+cleanText(classCode)]); } catch(ce){}

    var ss      = SpreadsheetApp.getActiveSpreadsheet();
    var tSheet  = getOrCreateTransSheet(ss);
    var stuSheet= getOrCreateStudentsSheet(ss);
    var tData   = tSheet.getDataRange().getValues();
    var stuData = stuSheet.getDataRange().getValues();
    var cc      = cleanText(classCode);
    var rn      = parseInt(rowNo);

    if (rn < 1 || rn >= tData.length)
      return { success: false, msg: '기록을 찾을 수 없습니다.' };
    if (cleanText(tData[rn][1]) !== cc)
      return { success: false, msg: '접근 권한이 없습니다.' };

    var sno     = cleanText(String(tData[rn][2] || ''));
    var expense = Number(tData[rn][5]) || 0;

    // 카드 잔액 복원
    for (var i = 1; i < stuData.length; i++) {
      if (cleanText(stuData[i][0]) === cc &&
          cleanText(String(stuData[i][1])) === sno) {
        var curCard = Number(stuData[i][4]) || 0;
        stuSheet.getRange(i+1, 5).setValue(curCard + expense);
        break;
      }
    }

    // ★ 신용점수 복원: 아직 승인 전(대기/반려/보고) 대기 큐가 있으면 그 안에서 +5로 상쇄,
    //    없으면(이미 승인되어 실제 점수에 반영된 예전 기록) 실제 점수를 +5 복원
    var restoredInQueue = _adjustPendingIfExists(cc, sno, 5);
    if (!restoredInQueue) {
      for (var j = 1; j < stuData.length; j++) {
        if (cleanText(stuData[j][0]) === cc && cleanText(String(stuData[j][1])) === sno) {
          var curCredit = Number(stuData[j][6]) || 0;
          stuSheet.getRange(j+1, 7).setValue(Math.min(100, curCredit + 5));
          break;
        }
      }
    }

    tSheet.deleteRow(rn + 1);
    SpreadsheetApp.flush();
    return { success: true, msg: expense.toLocaleString() + ' 머니 환불 + 신용점수 +5점 복원 완료' };

  } catch(e) {
    if (e.message.match(/lock/i))
      return { success: false, msg: '🚦 서버가 혼잡합니다. 잠시 후 다시 시도해주세요.' };
    return { success: false, msg: e.message };
  } finally { lock.releaseLock(); }
}

// ── 벌금 사유 수정 ──
function editFineReason(classCode, rowNo, newReason) {
  try {
    var ss     = SpreadsheetApp.getActiveSpreadsheet();
    var tSheet = getOrCreateTransSheet(ss);
    var tData  = tSheet.getDataRange().getValues();
    var cc     = cleanText(classCode);
    var rn     = parseInt(rowNo);

    if (rn < 1 || rn >= tData.length)
      return { success: false, msg: '기록을 찾을 수 없습니다.' };
    if (cleanText(tData[rn][1]) !== cc)
      return { success: false, msg: '접근 권한이 없습니다.' };

    tSheet.getRange(rn+1, 4).setValue('[벌금] ' + String(newReason || ''));
    SpreadsheetApp.flush();
    return { success: true, msg: '사유가 수정되었습니다.' };
  } catch(e) { return { success: false, msg: e.message }; }
}

function chargeTax(classCode, studentNo, reason, amount) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stuSheet = getOrCreateStudentsSheet(ss);
    var tSheet   = getOrCreateTransSheet(ss);
    var stuData  = stuSheet.getDataRange().getValues();
    var cc = cleanText(classCode), sno = cleanText(String(studentNo));
    var amt = parseInt(amount);
    if (isNaN(amt)||amt<=0) return { success: false, msg: '금액을 입력해 주세요.' };
    var stuRowIdx=-1, cardBalance=0;
    for (var i = 1; i < stuData.length; i++) {
      if (cleanText(stuData[i][0])===cc && cleanText(String(stuData[i][1]))===sno) {
        stuRowIdx=i+1; cardBalance=Number(stuData[i][4])||0; break;
      }
    }
    if (stuRowIdx===-1) return { success: false, msg: '학생을 찾을 수 없습니다.' };
    if (cardBalance < amt) return { success: false, msg: '잔액 부족 (보유: '+cardBalance+' 머니)' };
    var newCard = cardBalance - amt;
    stuSheet.getRange(stuRowIdx,5).setValue(newCard);
    tSheet.appendRow([getTodayStr(), cc, sno, '[세금] '+(reason||'세금'), '', amt, newCard, '세금']);
    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    SpreadsheetApp.flush();
    return { success: true, msg: '세금 부과 완료! ('+Number(amt).toLocaleString()+' 머니)', newCard: newCard };
  } catch(e) { return { success: false, msg: e.message }; }
}

function chargeTaxBulk(classCode, rate, reason) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stuSheet = getOrCreateStudentsSheet(ss);
    var tSheet   = getOrCreateTransSheet(ss);
    var stuData  = stuSheet.getDataRange().getValues();
    var cc = cleanText(classCode);
    var r = parseFloat(rate);
    if (isNaN(r)||r<=0) return { success: false, msg: '세율을 입력해 주세요.' };
    var count=0, today=getTodayStr(), rows=[];
    for (var i = 1; i < stuData.length; i++) {
      if (cleanText(stuData[i][0])!==cc) continue;
      var card = Number(stuData[i][4])||0;
      var tax  = Math.floor(card * r / 100);
      if (tax <= 0) continue;
      var newCard = card - tax;
      stuSheet.getRange(i+1,5).setValue(newCard);
      rows.push([today, cc, String(stuData[i][1]), '[세금] '+(reason||'일괄세금')+' ('+r+'%)', '', tax, newCard, '세금']);
      count++;
    }
    if (rows.length > 0) tSheet.getRange(tSheet.getLastRow()+1,1,rows.length,8).setValues(rows);
    try { CacheService.getScriptCache().removeAll(['students_'+cc]); } catch(ce){}
    SpreadsheetApp.flush();
    return { success: true, msg: count+'명 세율 '+r+'% 세금 징수 완료!' };
  } catch(e) { return { success: false, msg: e.message }; }
}
// ==========================================
// [사이트] 홈페이지 이름 (사이트 관리자 비밀번호로만 변경)
// SiteSettings: [0]항목키 [1]값   — siteName, adminPassword
// ==========================================
var DEFAULT_SITE_NAME = '쇼미더머니 나라';

function _readSiteSettings(sheet) {
  var map = {};
  if (!sheet) return map;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var k = cleanText(data[i][0]);
    if (k) map[k] = { row: i + 1, value: data[i][1] };
  }
  return map;
}

function _setSiteSetting(sheet, map, key, value) {
  if (map[key]) sheet.getRange(map[key].row, 2).setValue(value);
  else { sheet.appendRow([key, value]); map[key] = { row: sheet.getLastRow(), value: value }; }
}

function getSiteSettings() {
  try {
    var map = _readSiteSettings(SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SiteSettings'));
    var name = map.siteName ? String(map.siteName.value).trim() : '';
    return {
      success: true,
      siteName: name || DEFAULT_SITE_NAME,
      hasPassword: !!(map.adminPassword && cleanText(map.adminPassword.value))
    };
  } catch(e) { return { success: false, msg: e.message }; }
}

function setSiteName(adminPassword, newName) {
  try {
    var pw = cleanText(adminPassword);
    var name = String(newName || '').trim();
    if (!name) return { success: false, msg: "새 홈페이지 이름을 입력해 주세요." };
    if (name.length > 30) return { success: false, msg: "홈페이지 이름은 30자 이내로 입력해 주세요." };
    if (!pw) return { success: false, msg: "사이트 관리자 비밀번호를 입력해 주세요." };

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('SiteSettings');
    if (!sheet) {
      sheet = ss.insertSheet('SiteSettings');
      sheet.appendRow(['항목키','값']);
    }
    var map = _readSiteSettings(sheet);
    var saved = map.adminPassword ? cleanText(map.adminPassword.value) : '';
    var firstTime = !saved;
    if (firstTime) _setSiteSetting(sheet, map, 'adminPassword', pw);       // 처음 입력한 비밀번호가 관리자 비밀번호가 됨
    else if (saved !== pw) return { success: false, msg: "사이트 관리자 비밀번호가 틀렸습니다." };

    _setSiteSetting(sheet, map, 'siteName', name);
    return {
      success: true,
      siteName: name,
      msg: firstTime ? "홈페이지 이름이 바뀌었습니다! 방금 입력한 비밀번호가 사이트 관리자 비밀번호로 정해졌습니다."
                     : "홈페이지 이름이 바뀌었습니다!"
    };
  } catch(e) { return { success: false, msg: "오류: " + e.message }; }
}

// ==========================================
// [화폐] 학급마다 화폐 이름을 정함 (기본: 머니)
// CurrencySettings: [0]학급코드 [1]화폐이름
// ==========================================
var DEFAULT_CURRENCY = '머니';

function getCurrencyName(classCode) {
  try {
    var cc = cleanText(classCode);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CurrencySettings');
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (cleanText(data[i][0]) === cc) {
          var n = String(data[i][1] || '').trim();
          return { success: true, name: n || DEFAULT_CURRENCY };
        }
      }
    }
    return { success: true, name: DEFAULT_CURRENCY };
  } catch(e) { return { success: false, msg: e.message }; }
}

function setCurrencyName(classCode, newName) {
  try {
    var cc = cleanText(classCode);
    var name = String(newName || '').replace(/[<>"'&]/g, '').trim();
    if (!cc) return { success: false, msg: "학급 코드가 없습니다. 다시 로그인해 주세요." };
    if (!name) return { success: false, msg: "새 화폐 이름을 입력해 주세요." };
    if (name.length > 10) return { success: false, msg: "화폐 이름은 10자 이내로 입력해 주세요." };
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('CurrencySettings');
    if (!sheet) { sheet = ss.insertSheet('CurrencySettings'); sheet.appendRow(['학급코드','화폐이름']); }
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) === cc) {
        sheet.getRange(i + 1, 2).setValue(name);
        return { success: true, name: name, msg: "화폐 이름이 '" + name + "'(으)로 바뀌었습니다!" };
      }
    }
    sheet.appendRow([cc, name]);
    return { success: true, name: name, msg: "화폐 이름이 '" + name + "'(으)로 바뀌었습니다!" };
  } catch(e) { return { success: false, msg: "오류: " + e.message }; }
}

// ==========================================
// [아바타] 나의 아바타 꾸미기
// Avatars:      [0]학급코드 [1]학생번호 [2]착용(JSON) [3]보유(JSON 배열)
// AvatarPrices: [0]학급코드 [1]아이템ID [2]가격 [3]판매(Y/N)   ← 선생님이 바꾼 가격만 저장
// 기본 의류(가격 0)는 누구나 무료로 착용. 멋질수록 비쌈.
// ==========================================
var AVATAR_SLOTS = ['bg','skin','hair','top','hat','face','pet'];
var AVATAR_ITEMS = [
  // 배경
  {id:'bg_sky',     slot:'bg',   name:'하늘색 배경',     price:0},
  {id:'bg_mint',    slot:'bg',   name:'민트 배경',       price:0},
  {id:'bg_cream',   slot:'bg',   name:'크림 배경',       price:0},
  {id:'bg_dots',    slot:'bg',   name:'물방울 무늬',     price:50},
  {id:'bg_class',   slot:'bg',   name:'우리 반 칠판',    price:150},
  {id:'bg_night',   slot:'bg',   name:'별이 빛나는 밤',  price:400},
  {id:'bg_rainbow', slot:'bg',   name:'무지개 언덕',     price:800},
  {id:'bg_palace',  slot:'bg',   name:'황금 궁전',       price:2000},
  // 피부색
  {id:'sk_1', slot:'skin', name:'피부색 1', price:0},
  {id:'sk_2', slot:'skin', name:'피부색 2', price:0},
  {id:'sk_3', slot:'skin', name:'피부색 3', price:0},
  {id:'sk_4', slot:'skin', name:'피부색 4', price:0},
  // 머리
  {id:'hr_short',   slot:'hair', name:'기본 짧은 머리',  price:0},
  {id:'hr_bob',     slot:'hair', name:'기본 단발',       price:0},
  {id:'hr_spiky',   slot:'hair', name:'기본 삐죽 머리',  price:0},
  {id:'hr_pony',    slot:'hair', name:'포니테일',        price:80},
  {id:'hr_twin',    slot:'hair', name:'핑크 양갈래',     price:300},
  {id:'hr_gold',    slot:'hair', name:'금발 웨이브',     price:600},
  {id:'hr_rainbow', slot:'hair', name:'무지개 머리',     price:1500},
  // 옷
  {id:'tp_white',   slot:'top',  name:'기본 흰 티셔츠',  price:0},
  {id:'tp_gray',    slot:'top',  name:'기본 회색 맨투맨',price:0},
  {id:'tp_navy',    slot:'top',  name:'기본 남색 티셔츠',price:0},
  {id:'tp_stripe',  slot:'top',  name:'줄무늬 티셔츠',   price:60},
  {id:'tp_hoodie',  slot:'top',  name:'노랑 후드티',     price:120},
  {id:'tp_school',  slot:'top',  name:'교복 셔츠와 넥타이', price:250},
  {id:'tp_soccer',  slot:'top',  name:'축구 유니폼',     price:400},
  {id:'tp_suit',    slot:'top',  name:'정장과 나비넥타이', price:800},
  {id:'tp_space',   slot:'top',  name:'우주복',          price:1200},
  {id:'tp_king',    slot:'top',  name:'왕실 망토',       price:2500},
  {id:'tp_gold',    slot:'top',  name:'황금 턱시도',     price:4000},
  // 모자
  {id:'hat_none',   slot:'hat',  name:'모자 없음',       price:0},
  {id:'hat_cap',    slot:'hat',  name:'빨간 야구모자',   price:50},
  {id:'hat_ribbon', slot:'hat',  name:'리본 머리띠',     price:80},
  {id:'hat_beanie', slot:'hat',  name:'털 비니',         price:100},
  {id:'hat_straw',  slot:'hat',  name:'밀짚모자',        price:200},
  {id:'hat_wizard', slot:'hat',  name:'마법사 모자',     price:500},
  {id:'hat_crown',  slot:'hat',  name:'황금 왕관',       price:3000},
  // 안경·얼굴
  {id:'face_none',  slot:'face', name:'안경 없음',       price:0},
  {id:'face_round', slot:'face', name:'동그란 안경',     price:40},
  {id:'face_sun',   slot:'face', name:'선글라스',        price:150},
  {id:'face_heart', slot:'face', name:'하트 안경',       price:300},
  {id:'face_mono',  slot:'face', name:'신사 외눈 안경',  price:700},
  {id:'face_star',  slot:'face', name:'스타 선글라스',   price:1000},
  // 펫
  {id:'pet_none',   slot:'pet',  name:'펫 없음',         price:0},
  {id:'pet_chick',  slot:'pet',  name:'병아리',          price:200},
  {id:'pet_cat',    slot:'pet',  name:'고양이',          price:500},
  {id:'pet_dog',    slot:'pet',  name:'강아지',          price:500},
  {id:'pet_dragon', slot:'pet',  name:'아기 용',         price:3000}
];
var AVATAR_DEFAULT = {bg:'bg_sky', skin:'sk_1', hair:'hr_short', top:'tp_white', hat:'hat_none', face:'face_none', pet:'pet_none'};

function getOrCreateAvatarsSheet(ss) {
  var sheet = ss.getSheetByName('Avatars');
  if (!sheet) { sheet = ss.insertSheet('Avatars'); sheet.appendRow(['학급코드','학생번호','착용','보유']); }
  return sheet;
}
function getOrCreateAvatarPricesSheet(ss) {
  var sheet = ss.getSheetByName('AvatarPrices');
  if (!sheet) { sheet = ss.insertSheet('AvatarPrices'); sheet.appendRow(['학급코드','아이템ID','가격','판매']); }
  return sheet;
}
function _parseJson(text, fallback) {
  try { var v = JSON.parse(String(text || '')); return v == null ? fallback : v; } catch (e) { return fallback; }
}
// 학급의 실제 판매 목록 (선생님이 바꾼 가격 반영)
function _avatarShopMap(ss, cc) {
  var map = {};
  AVATAR_ITEMS.forEach(function (it) { map[it.id] = { id: it.id, slot: it.slot, name: it.name, basePrice: it.price, price: it.price, onSale: true }; });
  var data = getOrCreateAvatarPricesSheet(ss).getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (cleanText(data[i][0]) !== cc) continue;
    var m = map[String(data[i][1])];
    if (!m) continue;
    var p = parseInt(data[i][2]);
    if (!isNaN(p) && p >= 0) m.price = p;
    m.onSale = String(data[i][3]) !== 'N';
  }
  return map;
}
function _cleanEquipped(eq, owned, shop) {
  var out = {};
  AVATAR_SLOTS.forEach(function (slot) {
    var id = eq && eq[slot], it = id && shop[id];
    var ok = it && it.slot === slot && (it.price === 0 || owned.indexOf(id) >= 0);
    out[slot] = ok ? id : AVATAR_DEFAULT[slot];
  });
  return out;
}
function _findAvatarRow(data, cc, sno) {
  for (var i = 1; i < data.length; i++) {
    if (cleanText(data[i][0]) === cc && cleanText(String(data[i][1])) === sno) return i;
  }
  return -1;
}

function getAvatarShop(classCode) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var map = _avatarShopMap(ss, cleanText(classCode));
    return { success: true, slots: AVATAR_SLOTS, items: AVATAR_ITEMS.map(function (it) { return map[it.id]; }), defaults: AVATAR_DEFAULT };
  } catch (e) { return { success: false, msg: e.message }; }
}

function getMyAvatar(classCode, studentNo) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cc = cleanText(classCode), sno = cleanText(String(studentNo));
    var shop = _avatarShopMap(ss, cc);
    var data = getOrCreateAvatarsSheet(ss).getDataRange().getValues();
    var r = _findAvatarRow(data, cc, sno);
    var owned = r >= 0 ? _parseJson(data[r][3], []) : [];
    var eq = _cleanEquipped(r >= 0 ? _parseJson(data[r][2], {}) : {}, owned, shop);
    var card = 0, name = '';
    var stu = getOrCreateStudentsSheet(ss).getDataRange().getValues();
    for (var i = 1; i < stu.length; i++) {
      if (cleanText(stu[i][0]) === cc && cleanText(String(stu[i][1])) === sno) { card = Number(stu[i][4]) || 0; name = stu[i][2] || ''; break; }
    }
    return { success: true, equipped: eq, owned: owned, card: card, name: name };
  } catch (e) { return { success: false, msg: e.message }; }
}

function getClassAvatars(classCode) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cc = cleanText(classCode);
    var shop = _avatarShopMap(ss, cc);
    var data = getOrCreateAvatarsSheet(ss).getDataRange().getValues();
    var map = {};
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) !== cc) continue;
      map[String(data[i][1])] = _cleanEquipped(_parseJson(data[i][2], {}), _parseJson(data[i][3], []), shop);
    }
    return { success: true, map: map, defaults: AVATAR_DEFAULT };
  } catch (e) { return { success: false, msg: e.message }; }
}

function buyAvatarItem(classCode, studentNo, itemId) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cc = cleanText(classCode), sno = cleanText(String(studentNo));
    var it = _avatarShopMap(ss, cc)[String(itemId)];
    if (!it) return { success: false, msg: '없는 아이템입니다.' };
    if (!it.onSale) return { success: false, msg: '지금은 판매하지 않는 아이템입니다.' };
    if (it.price <= 0) return { success: false, msg: '무료 아이템은 사지 않아도 바로 입을 수 있어요.' };

    var avSheet = getOrCreateAvatarsSheet(ss);
    var avData = avSheet.getDataRange().getValues();
    var r = _findAvatarRow(avData, cc, sno);
    var owned = r >= 0 ? _parseJson(avData[r][3], []) : [];
    if (owned.indexOf(it.id) >= 0) return { success: false, msg: '이미 가지고 있는 아이템입니다.' };

    var stuSheet = getOrCreateStudentsSheet(ss);
    var stu = stuSheet.getDataRange().getValues();
    var row = -1, card = 0;
    for (var i = 1; i < stu.length; i++) {
      if (cleanText(stu[i][0]) === cc && cleanText(String(stu[i][1])) === sno) { row = i + 1; card = Number(stu[i][4]) || 0; break; }
    }
    if (row === -1) return { success: false, msg: '학생 정보를 찾을 수 없습니다.' };
    if (card < it.price) return { success: false, msg: '카드 잔액이 부족해요. (필요: ' + it.price + ' 머니 / 보유: ' + card + ' 머니)' };

    var newCard = card - it.price;
    stuSheet.getRange(row, 5).setValue(newCard);
    getOrCreateTransSheet(ss).appendRow([getTodayStr(), cc, sno, '[아바타] ' + it.name, '', it.price, newCard, '아바타']);
    owned.push(it.id);
    if (r >= 0) avSheet.getRange(r + 1, 4).setValue(JSON.stringify(owned));
    else avSheet.appendRow([cc, sno, JSON.stringify(AVATAR_DEFAULT), JSON.stringify(owned)]);
    try { CacheService.getScriptCache().removeAll(['students_' + cc]); } catch (ce) {}
    SpreadsheetApp.flush();
    return { success: true, msg: it.name + ' 구매 완료!', newCard: newCard, owned: owned };
  } catch (e) {
    if (e.message.match(/lock/i)) return { success: false, msg: '🚦 현재 처리량이 많습니다. 2~3초 뒤에 다시 시도해주세요.' };
    return { success: false, msg: e.message };
  } finally { lock.releaseLock(); }
}

function saveAvatar(classCode, studentNo, equippedJson) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cc = cleanText(classCode), sno = cleanText(String(studentNo));
    var shop = _avatarShopMap(ss, cc);
    var want = typeof equippedJson === 'string' ? _parseJson(equippedJson, {}) : (equippedJson || {});
    var avSheet = getOrCreateAvatarsSheet(ss);
    var avData = avSheet.getDataRange().getValues();
    var r = _findAvatarRow(avData, cc, sno);
    var owned = r >= 0 ? _parseJson(avData[r][3], []) : [];
    var bad = [];
    AVATAR_SLOTS.forEach(function (slot) {
      var it = shop[want[slot]];
      if (it && it.slot === slot && it.price > 0 && owned.indexOf(it.id) < 0) bad.push(it.name);
    });
    if (bad.length) return { success: false, msg: '아직 사지 않은 아이템이 있어요: ' + bad.join(', ') };
    var eq = _cleanEquipped(want, owned, shop);
    if (r >= 0) avSheet.getRange(r + 1, 3).setValue(JSON.stringify(eq));
    else avSheet.appendRow([cc, sno, JSON.stringify(eq), '[]']);
    return { success: true, msg: '아바타를 저장했어요!', equipped: eq };
  } catch (e) { return { success: false, msg: e.message }; }
}

// 선생님: 아이템 가격·판매 여부 바꾸기  changesJson = [{id, price, onSale}]
function setAvatarPrices(classCode, changesJson) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cc = cleanText(classCode);
    var changes = typeof changesJson === 'string' ? _parseJson(changesJson, []) : (changesJson || []);
    var valid = {};
    AVATAR_ITEMS.forEach(function (it) { valid[it.id] = it; });
    var sheet = getOrCreateAvatarPricesSheet(ss);
    var data = sheet.getDataRange().getValues();
    var rowOf = {};
    for (var i = 1; i < data.length; i++) if (cleanText(data[i][0]) === cc) rowOf[String(data[i][1])] = i + 1;
    var n = 0;
    changes.forEach(function (c) {
      var base = valid[c.id];
      if (!base) return;
      var p = parseInt(c.price);
      if (isNaN(p) || p < 0) p = base.price;
      var sale = c.onSale === false ? 'N' : 'Y';
      if (rowOf[c.id]) sheet.getRange(rowOf[c.id], 3, 1, 2).setValues([[p, sale]]);
      else sheet.appendRow([cc, c.id, p, sale]);
      n++;
    });
    return { success: true, msg: n + '개 아이템 설정을 저장했어요.' };
  } catch (e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [국민 용돈기입장 탭] 매점 시세표 · 간식 신청
// ==========================================

// ── 매점 시세표: 우리 반 도매상인들이 파는 모든 상품 + 내가 지금 사면 얼마인지(인플레이션) ──
function getStorePriceBoard(classCode, studentNo) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cc = cleanText(classCode), sno = cleanText(String(studentNo == null ? '' : studentNo));
    var stuData = getOrCreateStudentsSheet(ss).getDataRange().getValues();
    var nameMap = {}, card = 0;
    for (var k = 1; k < stuData.length; k++) {
      if (cleanText(stuData[k][0]) !== cc) continue;
      var no = cleanText(String(stuData[k][1]));
      nameMap[no] = String(stuData[k][2] || '');
      if (no === sno) card = Number(stuData[k][4]) || 0;
    }
    var data = getOrCreateWholesaleItemsSheet(ss).getDataRange().getValues();
    var list = [], newsPct = _newsEffects(cc).price;
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) !== cc) continue;
      var seller = cleanText(String(data[i][1]));
      var price = _newsPrice(Number(data[i][3]) || 0, newsPct);
      list.push({ seller: seller, sellerName: nameMap[seller] || '', name: String(data[i][2] || ''), price: price,
                  stock: Number(data[i][4]) || 0, sold: Number(data[i][5]) || 0,
                  myPrice: card >= WS_INFLATION_LINE ? Math.round(price * WS_INFLATION_RATE) : price });
    }
    list.sort(function (a, b) { return a.price - b.price; });
    return { success: true, list: list, card: card, inflated: sno !== '' && card >= WS_INFLATION_LINE,
             line: WS_INFLATION_LINE, rate: WS_INFLATION_RATE, newsPct: newsPct };
  } catch (e) { return { success: false, msg: e.message }; }
}

// ── 간식 신청 ──
// SnackMenu:     [0]학급코드 [1]메뉴(JSON 배열: {name, price, desc})
// SnackRequests: [0]학급코드 [1]신청ID [2]학생번호 [3]이름 [4]간식 [5]단가 [6]수량 [7]총액 [8]메모 [9]상태(대기/승인/반려/취소) [10]신청일 [11]처리일 [12]처리메모
// 학생이 신청 → 선생님이 승인하면 그때 카드에서 돈이 빠지고 용돈기입장에 "[간식] 이름 N개"로 남습니다.
function _snackMenuSheet(ss, create) {
  var sheet = ss.getSheetByName('SnackMenu');
  if (!sheet && create) { sheet = ss.insertSheet('SnackMenu'); sheet.appendRow(['학급코드', '메뉴']); }
  return sheet;
}
function _snackReqSheet(ss) {
  var sheet = ss.getSheetByName('SnackRequests');
  if (!sheet) {
    sheet = ss.insertSheet('SnackRequests');
    sheet.appendRow(['학급코드','신청ID','학생번호','이름','간식','단가','수량','총액','메모','상태','신청일','처리일','처리메모']);
  }
  return sheet;
}
function _snackMenuOf(cc) {
  var sheet = _snackMenuSheet(SpreadsheetApp.getActiveSpreadsheet(), false);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (cleanText(data[i][0]) === cc) {
      try { var l = JSON.parse(String(data[i][1] || '[]')); return Array.isArray(l) ? l : []; } catch (pe) { return []; }
    }
  }
  return [];
}

function getSnackMenu(classCode) {
  try { return { success: true, list: _snackMenuOf(cleanText(classCode)) }; }
  catch (e) { return { success: false, msg: e.message }; }
}

function setSnackMenu(classCode, menuJson) {
  try {
    var cc = cleanText(classCode);
    if (!cc) return { success: false, msg: '학급 코드가 없습니다. 다시 로그인해 주세요.' };
    var raw = typeof menuJson === 'string' ? JSON.parse(menuJson || '[]') : (menuJson || []);
    if (!Array.isArray(raw)) return { success: false, msg: '메뉴 형식이 올바르지 않습니다.' };
    var list = [], seen = {};
    for (var r = 0; r < raw.length; r++) {
      var m = raw[r] || {};
      var name = String(m.name || '').trim().slice(0, 30);
      if (!name) continue;
      if (seen[name]) return { success: false, msg: '"' + name + '" 간식이 두 번 적혀 있어요.' };
      seen[name] = 1;
      var price = parseInt(m.price);
      list.push({ name: name, price: isNaN(price) || price < 0 ? 0 : price, desc: String(m.desc || '').trim().slice(0, 60) });
    }
    if (list.length > 50) return { success: false, msg: '간식 메뉴는 50개까지 적을 수 있습니다.' };
    var sheet = _snackMenuSheet(SpreadsheetApp.getActiveSpreadsheet(), true);
    var data = sheet.getDataRange().getValues(), json = JSON.stringify(list);
    var msg = '간식 메뉴 ' + list.length + '개를 저장했습니다!';
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) === cc) { sheet.getRange(i + 1, 2).setValue(json); return { success: true, list: list, msg: msg }; }
    }
    sheet.appendRow([cc, json]);
    return { success: true, list: list, msg: msg };
  } catch (e) { return { success: false, msg: e.message }; }
}

// studentNo를 비우면(선생님) 반 전체 신청을 돌려줍니다.
function getSnackRequests(classCode, studentNo) {
  try {
    var cc = cleanText(classCode), sno = cleanText(String(studentNo == null ? '' : studentNo));
    var data = _snackReqSheet(SpreadsheetApp.getActiveSpreadsheet()).getDataRange().getValues();
    var list = [], pending = 0;
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) !== cc) continue;
      var who = cleanText(String(data[i][2]));
      if (sno !== '' && who !== sno) continue;
      var st = String(data[i][9] || '대기');
      if (st === '대기') pending++;
      var d = data[i][10];
      list.push({ id: String(data[i][1]), studentNo: who, name: String(data[i][3] || ''), item: String(data[i][4] || ''),
                  price: Number(data[i][5]) || 0, qty: Number(data[i][6]) || 0, total: Number(data[i][7]) || 0,
                  memo: String(data[i][8] || ''), status: st,
                  date: d instanceof Date ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(d || ''),
                  note: String(data[i][12] || ''), custom: String(data[i][13] || '') === 'Y' });
    }
    list.reverse();
    return { success: true, list: list.slice(0, 200), pending: pending };
  } catch (e) { return { success: false, msg: e.message }; }
}

// isCustom이 true면 메뉴에 없는 간식을 직접 적어 신청 (customPrice: 1개 가격, 모르면 0 → 선생님이 승인할 때 정함)
function requestSnack(classCode, studentNo, itemName, qty, memo, customPrice, isCustom) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cc = cleanText(classCode), sno = cleanText(String(studentNo == null ? '' : studentNo));
    if (!cc || sno === '') return { success: false, msg: '로그인 정보가 없습니다. 다시 로그인해 주세요.' };
    var n = parseInt(qty);
    if (isNaN(n) || n < 1 || n > 20) return { success: false, msg: '수량은 1개에서 20개 사이로 적어 주세요.' };
    var name = String(itemName == null ? '' : itemName).trim();
    var item = null, custom = isCustom === true;
    if (custom) {
      if (!name) return { success: false, msg: '신청할 간식 이름을 적어 주세요.' };
      if (name.length > 30) return { success: false, msg: '간식 이름은 30자 이내로 적어 주세요.' };
      var cp = customPrice === '' || customPrice == null ? 0 : parseInt(customPrice);
      if (isNaN(cp) || cp < 0) return { success: false, msg: '가격은 0 이상의 숫자로 적어 주세요. 모르면 비워 두세요.' };
      item = { name: name, price: cp };
    } else {
      _snackMenuOf(cc).forEach(function (m) { if (m.name === name) item = m; });
      if (!item) return { success: false, msg: '간식 메뉴에 없는 간식입니다. 화면을 새로고침해 주세요.' };
    }
    var stuData = getOrCreateStudentsSheet(ss).getDataRange().getValues();
    var stuName = null, card = 0;
    for (var k = 1; k < stuData.length; k++) {
      if (cleanText(stuData[k][0]) === cc && cleanText(String(stuData[k][1])) === sno) { stuName = String(stuData[k][2] || ''); card = Number(stuData[k][4]) || 0; break; }
    }
    if (stuName === null) return { success: false, msg: '학생 정보를 찾을 수 없습니다.' };
    var total = item.price * n;
    var sheet = _snackReqSheet(ss), data = sheet.getDataRange().getValues(), waiting = 0;
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) === cc && cleanText(String(data[i][2])) === sno && String(data[i][9]) === '대기') waiting += Number(data[i][7]) || 0;
    }
    if (card < waiting + total) return { success: false, msg: '카드 잔액이 부족해요.\n카드: ' + card.toLocaleString() + ' 머니\n이번 신청: ' + total.toLocaleString() + ' 머니' + (waiting ? '\n이미 기다리는 신청: ' + waiting.toLocaleString() + ' 머니' : '') };
    var id = 'SN_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);
    sheet.appendRow([cc, id, sno, stuName, item.name, item.price, n, total, String(memo || '').trim().slice(0, 60), '대기', getTodayStr(), '', '', custom ? 'Y' : '']);
    if (custom && !total) return { success: true, msg: item.name + ' ' + n + '개를 신청했어요! 가격은 선생님이 승인할 때 정해요.' };
    return { success: true, msg: item.name + ' ' + n + '개를 신청했어요! 선생님이 승인하면 카드에서 ' + total.toLocaleString() + ' 머니가 빠져요.' };
  } catch (e) { return { success: false, msg: e.message }; }
}

function _snackFind(sheet, cc, reqId) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) if (cleanText(data[i][0]) === cc && String(data[i][1]) === String(reqId)) return { row: i + 1, v: data[i] };
  return null;
}

function cancelSnackRequest(classCode, studentNo, reqId) {
  try {
    var cc = cleanText(classCode), sno = cleanText(String(studentNo == null ? '' : studentNo));
    var sheet = _snackReqSheet(SpreadsheetApp.getActiveSpreadsheet()), f = _snackFind(sheet, cc, reqId);
    if (!f) return { success: false, msg: '신청을 찾을 수 없습니다.' };
    if (cleanText(String(f.v[2])) !== sno) return { success: false, msg: '내 신청만 취소할 수 있어요.' };
    if (String(f.v[9]) !== '대기') return { success: false, msg: '이미 ' + f.v[9] + '된 신청은 취소할 수 없어요.' };
    sheet.getRange(f.row, 10).setValue('취소'); sheet.getRange(f.row, 12).setValue(getTodayStr());
    return { success: true, msg: f.v[4] + ' 신청을 취소했어요.' };
  } catch (e) { return { success: false, msg: e.message }; }
}

// 선생님 승인: 이때 카드에서 돈이 빠짐
// unitPrice: 직접 적어 신청한 간식일 때 선생님이 정한 1개 가격 (메뉴 간식은 무시)
function approveSnackRequest(classCode, reqId, unitPrice) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var ss = SpreadsheetApp.getActiveSpreadsheet(), cc = cleanText(classCode);
    var sheet = _snackReqSheet(ss), f = _snackFind(sheet, cc, reqId);
    if (!f) return { success: false, msg: '신청을 찾을 수 없습니다.' };
    if (String(f.v[9]) !== '대기') return { success: false, msg: '이미 ' + f.v[9] + '된 신청입니다.' };
    var sno = cleanText(String(f.v[2])), total = Number(f.v[7]) || 0;
    if (String(f.v[13] || '') === 'Y' && unitPrice !== undefined && unitPrice !== null && unitPrice !== '') {
      var up = parseInt(unitPrice);
      if (isNaN(up) || up < 0) return { success: false, msg: '가격은 0 이상의 숫자로 적어 주세요.' };
      total = up * (Number(f.v[6]) || 0);
      sheet.getRange(f.row, 6).setValue(up); sheet.getRange(f.row, 8).setValue(total);
    }
    var stuSheet = getOrCreateStudentsSheet(ss), stuData = stuSheet.getDataRange().getValues(), row = -1, card = 0;
    for (var k = 1; k < stuData.length; k++) {
      if (cleanText(stuData[k][0]) === cc && cleanText(String(stuData[k][1])) === sno) { row = k + 1; card = Number(stuData[k][4]) || 0; break; }
    }
    if (row === -1) return { success: false, msg: sno + '번 학생을 찾을 수 없습니다.' };
    if (card < total) return { success: false, msg: sno + '번 ' + f.v[3] + '의 카드 잔액이 부족해요. (카드 ' + card.toLocaleString() + ' / 필요 ' + total.toLocaleString() + ' 머니)' };
    var newCard = card - total;
    stuSheet.getRange(row, 5).setValue(newCard);
    getOrCreateTransSheet(ss).appendRow([getTodayStr(), cc, sno, '[간식] ' + f.v[4] + ' ' + f.v[6] + '개', '', total, newCard, '간식']);
    sheet.getRange(f.row, 10).setValue('승인'); sheet.getRange(f.row, 12).setValue(getTodayStr());
    try { CacheService.getScriptCache().removeAll(['students_' + cc]); } catch (ce) {}
    return { success: true, msg: sno + '번 ' + f.v[3] + ' · ' + f.v[4] + ' ' + f.v[6] + '개 승인! 카드에서 ' + total.toLocaleString() + ' 머니를 뺐어요.', newCard: newCard };
  } catch (e) { return { success: false, msg: e.message }; }
  finally { lock.releaseLock(); }
}

function rejectSnackRequest(classCode, reqId, reason) {
  try {
    var cc = cleanText(classCode);
    var sheet = _snackReqSheet(SpreadsheetApp.getActiveSpreadsheet()), f = _snackFind(sheet, cc, reqId);
    if (!f) return { success: false, msg: '신청을 찾을 수 없습니다.' };
    if (String(f.v[9]) !== '대기') return { success: false, msg: '이미 ' + f.v[9] + '된 신청입니다.' };
    sheet.getRange(f.row, 10).setValue('반려'); sheet.getRange(f.row, 12, 1, 2).setValues([[getTodayStr(), String(reason || '').trim().slice(0, 60)]]);
    return { success: true, msg: f.v[3] + '의 ' + f.v[4] + ' 신청을 반려했어요.' };
  } catch (e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [학생 순서] 스마트 월급 표 등에서 선생님이 끌어서 정한 순서
// StudentOrder: [0]학급코드 [1]학생번호 순서(JSON 배열). 0번(선생님)은 항상 맨 아래라 저장하지 않음
// ==========================================
function getStudentOrder(classCode) {
  try {
    var cc = cleanText(classCode);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('StudentOrder');
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (cleanText(data[i][0]) === cc) {
          var l = []; try { l = JSON.parse(String(data[i][1] || '[]')); } catch (pe) { l = []; }
          return { success: true, order: Array.isArray(l) ? l.map(String) : [] };
        }
      }
    }
    return { success: true, order: [] };
  } catch (e) { return { success: false, msg: e.message }; }
}

function setStudentOrder(classCode, orderJson) {
  try {
    var cc = cleanText(classCode);
    if (!cc) return { success: false, msg: '학급 코드가 없습니다.' };
    var raw = typeof orderJson === 'string' ? JSON.parse(orderJson || '[]') : (orderJson || []);
    if (!Array.isArray(raw)) return { success: false, msg: '순서 형식이 올바르지 않습니다.' };
    var seen = {}, list = [];
    raw.forEach(function (s) { s = cleanText(String(s)); if (s !== '' && s !== '0' && !seen[s]) { seen[s] = 1; list.push(s); } });
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('StudentOrder');
    if (!sheet) { sheet = ss.insertSheet('StudentOrder'); sheet.appendRow(['학급코드', '순서']); }
    var data = sheet.getDataRange().getValues(), json = JSON.stringify(list);
    for (var i = 1; i < data.length; i++) {
      if (cleanText(data[i][0]) === cc) { sheet.getRange(i + 1, 2).setValue(json); return { success: true, msg: '학생 순서를 저장했어요.' }; }
    }
    sheet.appendRow([cc, json]);
    return { success: true, msg: '학생 순서를 저장했어요.' };
  } catch (e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [교사] 학생 용돈기입장 기록 수정·삭제, 자산(카드·은행) 직접 수정
//  - 기록을 고치거나 지우면 그 차이만큼 카드 잔액을 고치고,
//    그 기록과 그 뒤 기록들의 "누적 잔액"도 같은 만큼 옮겨서 표가 맞게 보이도록 함
//  - rowNo는 getTransactions가 준 번호. 혹시 그사이 기록이 바뀌었으면 학생 번호가 달라 거절됨
// ==========================================
function _txShiftBalances(tSheet, tData, cc, sno, fromRow, diff) {
  if (!diff) return;
  for (var j = fromRow; j < tData.length; j++) {
    if (cleanText(tData[j][1]) === cc && cleanText(String(tData[j][2])) === sno) {
      tSheet.getRange(j + 1, 7).setValue((Number(tData[j][6]) || 0) + diff);
    }
  }
}
function _stuRowOf(stuData, cc, sno) {
  for (var i = 1; i < stuData.length; i++) if (cleanText(stuData[i][0]) === cc && cleanText(String(stuData[i][1])) === sno) return i;
  return -1;
}

function editStudentTx(classCode, rowNo, studentNo, memo, income, expense) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tSheet = getOrCreateTransSheet(ss), tData = tSheet.getDataRange().getValues();
    var stuSheet = getOrCreateStudentsSheet(ss), stuData = stuSheet.getDataRange().getValues();
    var cc = cleanText(classCode), sno = cleanText(String(studentNo)), rn = parseInt(rowNo);
    if (!(rn >= 1 && rn < tData.length) || cleanText(tData[rn][1]) !== cc || cleanText(String(tData[rn][2])) !== sno)
      return { success: false, msg: '기록을 찾을 수 없어요. 화면을 새로고침한 뒤 다시 해 주세요.' };
    var m = String(memo == null ? '' : memo).trim();
    if (!m) return { success: false, msg: '내역을 적어 주세요.' };
    var inc = income === '' || income == null ? 0 : parseInt(income), exp = expense === '' || expense == null ? 0 : parseInt(expense);
    if (isNaN(inc) || isNaN(exp) || inc < 0 || exp < 0) return { success: false, msg: '수입·지출은 0 이상의 숫자로 적어 주세요.' };
    var oldNet = (Number(tData[rn][4]) || 0) - (Number(tData[rn][5]) || 0), diff = (inc - exp) - oldNet;
    var si = _stuRowOf(stuData, cc, sno);
    if (si === -1) return { success: false, msg: sno + '번 학생을 찾을 수 없어요.' };
    var newCard = (Number(stuData[si][4]) || 0) + diff;
    tSheet.getRange(rn + 1, 4, 1, 3).setValues([[m, inc || '', exp || '']]);
    _txShiftBalances(tSheet, tData, cc, sno, rn, diff);
    if (diff) stuSheet.getRange(si + 1, 5).setValue(newCard);
    try { CacheService.getScriptCache().removeAll(['students_' + cc]); } catch (ce) {}
    return { success: true, newCard: newCard, msg: '기록을 고쳤어요.' + (diff ? ' 카드 잔액이 ' + (diff > 0 ? '+' : '') + diff.toLocaleString() + ' 머니 바뀌었어요. (지금 ' + newCard.toLocaleString() + ' 머니)' : '') };
  } catch (e) { return { success: false, msg: e.message }; }
  finally { lock.releaseLock(); }
}

function deleteStudentTx(classCode, rowNo, studentNo) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tSheet = getOrCreateTransSheet(ss), tData = tSheet.getDataRange().getValues();
    var stuSheet = getOrCreateStudentsSheet(ss), stuData = stuSheet.getDataRange().getValues();
    var cc = cleanText(classCode), sno = cleanText(String(studentNo)), rn = parseInt(rowNo);
    if (!(rn >= 1 && rn < tData.length) || cleanText(tData[rn][1]) !== cc || cleanText(String(tData[rn][2])) !== sno)
      return { success: false, msg: '기록을 찾을 수 없어요. 화면을 새로고침한 뒤 다시 해 주세요.' };
    var net = (Number(tData[rn][4]) || 0) - (Number(tData[rn][5]) || 0);
    var si = _stuRowOf(stuData, cc, sno);
    var newCard = si === -1 ? null : (Number(stuData[si][4]) || 0) - net;
    _txShiftBalances(tSheet, tData, cc, sno, rn + 1, -net);
    if (si !== -1 && net) stuSheet.getRange(si + 1, 5).setValue(newCard);
    tSheet.deleteRow(rn + 1);
    try { CacheService.getScriptCache().removeAll(['students_' + cc]); } catch (ce) {}
    return { success: true, newCard: newCard, msg: '기록을 지웠어요.' + (net ? ' 카드 잔액이 ' + (-net > 0 ? '+' : '') + (-net).toLocaleString() + ' 머니 바뀌었어요.' : '') };
  } catch (e) { return { success: false, msg: e.message }; }
  finally { lock.releaseLock(); }
}

// 카드·은행 잔액을 선생님이 직접 정함. 카드가 바뀌면 용돈기입장에 "[교사 조정]" 기록을 남김
function setStudentAssets(classCode, studentNo, card, bank, reason) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var stuSheet = getOrCreateStudentsSheet(ss), stuData = stuSheet.getDataRange().getValues();
    var cc = cleanText(classCode), sno = cleanText(String(studentNo));
    var si = _stuRowOf(stuData, cc, sno);
    if (si === -1) return { success: false, msg: sno + '번 학생을 찾을 수 없어요.' };
    var c = parseInt(card), b = parseInt(bank);
    if (isNaN(c) || isNaN(b)) return { success: false, msg: '카드·은행 잔액을 숫자로 적어 주세요.' };
    if (c < 0 || b < 0) return { success: false, msg: '잔액은 0 이상이어야 해요.' };
    var oldC = Number(stuData[si][4]) || 0, oldB = Number(stuData[si][5]) || 0;
    if (c === oldC && b === oldB) return { success: false, msg: '바뀐 금액이 없어요.' };
    var why = String(reason == null ? '' : reason).trim().slice(0, 40);
    stuSheet.getRange(si + 1, 5, 1, 2).setValues([[c, b]]);
    var tSheet = getOrCreateTransSheet(ss), today = getTodayStr();
    if (c !== oldC) {
      var d = c - oldC;
      tSheet.appendRow([today, cc, sno, '[교사 조정] 카드 잔액 ' + oldC.toLocaleString() + ' → ' + c.toLocaleString() + (why ? ' (' + why + ')' : ''), d > 0 ? d : '', d < 0 ? -d : '', c, '교사조정']);
    }
    if (b !== oldB) {
      tSheet.appendRow([today, cc, sno, '[교사 조정] 은행 잔액 ' + oldB.toLocaleString() + ' → ' + b.toLocaleString() + (why ? ' (' + why + ')' : ''), '', '', c, '교사조정']);
    }
    try { CacheService.getScriptCache().removeAll(['students_' + cc]); } catch (ce) {}
    return { success: true, card: c, bank: b, msg: sno + '번 ' + (stuData[si][2] || '') + '의 자산을 고쳤어요.\n카드 ' + oldC.toLocaleString() + ' → ' + c.toLocaleString() + ' / 은행 ' + oldB.toLocaleString() + ' → ' + b.toLocaleString() };
  } catch (e) { return { success: false, msg: e.message }; }
  finally { lock.releaseLock(); }
}

// ==========================================
// [경찰서] 벌금 결재 청구 → 대통령(선생님) 승인 후 부과
// FineRequests: [0]학급코드 [1]청구ID [2]학생번호 [3]이름 [4]사유 [5]금액 [6]상태(대기/승인/반려/취소) [7]청구일 [8]처리일 [9]청구자 [10]반려이유
//  - 경찰서장이 "벌금 부과"를 누르면 청구만 올라감 (돈·신용은 그대로)
//  - 선생님이 승인하면: 카드에서 벌금을 빼고, 용돈기입장에 [벌금] 기록, 신용점수 -5점을 바로 반영
//  - 선생님이 경찰서에서 직접 부과하면(autoApprove) 청구와 동시에 승인
// ==========================================
var FINE_CREDIT_PENALTY = -5;
function _fineReqSheet(ss) {
  var sheet = ss.getSheetByName('FineRequests');
  if (!sheet) {
    sheet = ss.insertSheet('FineRequests');
    sheet.appendRow(['학급코드','청구ID','학생번호','이름','사유','금액','상태','청구일','처리일','청구자','반려이유']);
  }
  return sheet;
}
function _fineReqFind(sheet, cc, id) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) if (cleanText(data[i][0]) === cc && String(data[i][1]) === String(id)) return { row: i + 1, v: data[i] };
  return null;
}

function requestFine(classCode, studentNo, reason, amount, requester, autoApprove) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cc = cleanText(classCode), sno = cleanText(String(studentNo == null ? '' : studentNo));
    var amt = parseInt(amount), why = String(reason == null ? '' : reason).trim().slice(0, 60);
    if (!cc) return { success: false, msg: '학급 코드가 없습니다. 다시 로그인해 주세요.' };
    if (sno === '') return { success: false, msg: '학생을 선택해 주세요.' };
    if (!why) return { success: false, msg: '위반 사유를 적어 주세요.' };
    if (isNaN(amt) || amt <= 0) return { success: false, msg: '벌금 금액을 입력해 주세요.' };
    var stuData = getOrCreateStudentsSheet(ss).getDataRange().getValues(), name = null;
    for (var k = 1; k < stuData.length; k++) if (cleanText(stuData[k][0]) === cc && cleanText(String(stuData[k][1])) === sno) { name = String(stuData[k][2] || ''); break; }
    if (name === null) return { success: false, msg: '학생 정보를 찾을 수 없습니다.' };
    var id = 'FN_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);
    _fineReqSheet(ss).appendRow([cc, id, sno, name, why, amt, '대기', getTodayStr(), '', String(requester == null ? '' : requester), '']);
    if (autoApprove === true) {
      var r = approveFineRequest(cc, id);
      if (!r.success) { cancelFineRequest(cc, id, null, true); return r; }
      return r;
    }
    return { success: true, id: id, msg: sno + '번 ' + name + ' · ' + why + ' ' + amt.toLocaleString() + ' 머니\n대통령(선생님)에게 결재를 청구했어요. 승인되면 벌금과 신용점수 ' + FINE_CREDIT_PENALTY + '점이 반영돼요.' };
  } catch (e) { return { success: false, msg: e.message }; }
}

// status를 비우면 전부. 최근 것이 위로
function getFineRequests(classCode, status) {
  try {
    var cc = cleanText(classCode), want = String(status == null ? '' : status);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('FineRequests');
    var list = [], pending = 0;
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (cleanText(data[i][0]) !== cc) continue;
        var st = String(data[i][6] || '대기');
        if (st === '대기') pending++;
        if (want && st !== want) continue;
        var d = data[i][7];
        list.push({ id: String(data[i][1]), studentNo: data[i][2] == null ? '' : String(data[i][2]), name: String(data[i][3] || ''),
                    reason: String(data[i][4] || ''), amount: Number(data[i][5]) || 0, status: st,
                    date: d instanceof Date ? Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(d || ''),
                    doneDate: String(data[i][8] || ''), requester: String(data[i][9] || ''), note: String(data[i][10] || '') });
      }
    }
    list.reverse();
    return { success: true, list: list.slice(0, 200), pending: pending };
  } catch (e) { return { success: false, msg: e.message }; }
}

function approveFineRequest(classCode, id) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var ss = SpreadsheetApp.getActiveSpreadsheet(), cc = cleanText(classCode);
    var sheet = _fineReqSheet(ss), f = _fineReqFind(sheet, cc, id);
    if (!f) return { success: false, msg: '청구를 찾을 수 없습니다.' };
    if (String(f.v[6]) !== '대기') return { success: false, msg: '이미 ' + f.v[6] + '된 청구입니다.' };
    var sno = cleanText(String(f.v[2])), amt = Number(f.v[5]) || 0, why = String(f.v[4] || '규정위반');
    var stuSheet = getOrCreateStudentsSheet(ss), stuData = stuSheet.getDataRange().getValues(), si = -1;
    for (var k = 1; k < stuData.length; k++) if (cleanText(stuData[k][0]) === cc && cleanText(String(stuData[k][1])) === sno) { si = k; break; }
    if (si === -1) return { success: false, msg: sno + '번 학생을 찾을 수 없습니다.' };
    var card = Number(stuData[si][4]) || 0;
    if (card < amt) return { success: false, msg: sno + '번 ' + (stuData[si][2] || '') + '의 카드 잔액이 부족해요. (카드 ' + card.toLocaleString() + ' / 벌금 ' + amt.toLocaleString() + ' 머니)\n반려하거나 금액을 확인해 주세요.' };
    var newCard = card - amt;
    var oldCredit = Number(stuData[si][6]) || 0, newCredit = Math.max(0, Math.min(100, oldCredit + FINE_CREDIT_PENALTY));
    stuSheet.getRange(si + 1, 5).setValue(newCard);
    stuSheet.getRange(si + 1, 7).setValue(newCredit);
    getOrCreateTransSheet(ss).appendRow([getTodayStr(), cc, sno, '[벌금] ' + why, '', amt, newCard, '벌금']);
    sheet.getRange(f.row, 7).setValue('승인'); sheet.getRange(f.row, 9).setValue(getTodayStr());
    try { CacheService.getScriptCache().removeAll(['students_' + cc]); } catch (ce) {}
    return { success: true, newCard: newCard, newCredit: newCredit,
             msg: sno + '번 ' + (stuData[si][2] || '') + ' · ' + why + '\n벌금 ' + amt.toLocaleString() + ' 머니 부과 완료! (카드 ' + newCard.toLocaleString() + ' 머니)\n신용점수 ' + oldCredit + ' → ' + newCredit + '점' };
  } catch (e) { return { success: false, msg: e.message }; }
  finally { lock.releaseLock(); }
}

function rejectFineRequest(classCode, id, reason) {
  try {
    var cc = cleanText(classCode);
    var sheet = _fineReqSheet(SpreadsheetApp.getActiveSpreadsheet()), f = _fineReqFind(sheet, cc, id);
    if (!f) return { success: false, msg: '청구를 찾을 수 없습니다.' };
    if (String(f.v[6]) !== '대기') return { success: false, msg: '이미 ' + f.v[6] + '된 청구입니다.' };
    sheet.getRange(f.row, 7).setValue('반려'); sheet.getRange(f.row, 9).setValue(getTodayStr());
    sheet.getRange(f.row, 11).setValue(String(reason == null ? '' : reason).trim().slice(0, 60));
    return { success: true, msg: f.v[2] + '번 ' + f.v[3] + '의 벌금 청구(' + f.v[4] + ')를 반려했어요. 돈과 신용점수는 그대로예요.' };
  } catch (e) { return { success: false, msg: e.message }; }
}

// 경찰서장이 결재 전에 청구를 취소 (silent: 자동 승인 실패 때 안에서 쓰는 용도)
function cancelFineRequest(classCode, id, requester, silent) {
  try {
    var cc = cleanText(classCode);
    var sheet = _fineReqSheet(SpreadsheetApp.getActiveSpreadsheet()), f = _fineReqFind(sheet, cc, id);
    if (!f) return { success: false, msg: '청구를 찾을 수 없습니다.' };
    if (String(f.v[6]) !== '대기') return { success: false, msg: '이미 ' + f.v[6] + '된 청구는 취소할 수 없어요.' };
    sheet.getRange(f.row, 7).setValue('취소'); sheet.getRange(f.row, 9).setValue(getTodayStr());
    return { success: true, msg: silent ? '' : f.v[3] + '의 벌금 청구를 취소했어요.' };
  } catch (e) { return { success: false, msg: e.message }; }
}

// ==========================================
// [증권] 처음으로 초기화 (선생님) — 모든 종목 가격을 STOCK_START_PRICE(100)로
//  - 학생들이 가진 주식은 초기화 직전 가격으로 모두 팔아 카드로 돌려줌 (용돈기입장에 [주식 초기화] 매도 기록)
//  - 종목 이름·업종·변동 폭·% 고정·자동 돌리기 설정은 그대로, 가격 기록·뉴스·변동 횟수는 처음부터
// ==========================================
var STOCK_START_PRICE = 100;
function resetStockMarket(classCode, by) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var ss = SpreadsheetApp.getActiveSpreadsheet(), cc = cleanText(classCode);
    if (!cc) return { success: false, msg: '학급 코드가 없습니다.' };
    var state = _stockLoad(cc), byId = {};
    state.stocks.forEach(function (s) { byId[s.id] = s; });

    // 1) 가진 주식을 지금 가격으로 팔아 카드로
    var hSheet = getOrCreateStockHoldingsSheet(ss), hData = hSheet.getDataRange().getValues();
    var stuSheet = getOrCreateStudentsSheet(ss), stuData = stuSheet.getDataRange().getValues();
    var tSheet = getOrCreateTransSheet(ss), today = getTodayStr();
    var rowOf = {}, cardOf = {};
    for (var k = 1; k < stuData.length; k++) if (cleanText(stuData[k][0]) === cc) { var no = cleanText(String(stuData[k][1])); rowOf[no] = k + 1; cardOf[no] = Number(stuData[k][4]) || 0; }
    var paidTo = {}, total = 0, delRows = [];
    for (var i = 1; i < hData.length; i++) {
      if (cleanText(hData[i][0]) !== cc) continue;
      delRows.push(i + 1);
      var sno = cleanText(String(hData[i][1])), qty = Number(hData[i][3]) || 0, s = byId[String(hData[i][2])];
      if (qty <= 0 || !s || !rowOf[sno]) continue;
      var value = qty * s.price;
      cardOf[sno] += value; total += value; paidTo[sno] = (paidTo[sno] || 0) + value;
      tSheet.appendRow([today, cc, sno, '[주식 초기화] ' + s.emoji + ' ' + s.name + ' ' + qty + '주 매도 (1주 ' + s.price.toLocaleString() + ')', value, '', cardOf[sno], '주식매도']);
    }
    Object.keys(paidTo).forEach(function (no) { stuSheet.getRange(rowOf[no], 5).setValue(cardOf[no]); });
    for (var d = delRows.length - 1; d >= 0; d--) hSheet.deleteRow(delRows[d]);

    // 2) 가격을 처음으로
    var now = Date.now();
    state.stocks.forEach(function (s) { s.price = STOCK_START_PRICE; s.history = [STOCK_START_PRICE]; s.historyAt = [now]; s.lastPct = 0; });
    state.news = []; state.round = 0; state.lastRunAt = now; state.lastRunBy = '초기화' + (by ? ' (' + by + ')' : '');
    if (state.auto) state.nextAutoAt = _stockNextAutoAt(now);
    _stockSave(cc, state);
    try { CacheService.getScriptCache().removeAll(['students_' + cc]); } catch (ce) {}

    var n = Object.keys(paidTo).length;
    return { success: true, refunded: n, total: total,
             msg: '증권회사를 처음으로 초기화했어요! 모든 종목이 ' + STOCK_START_PRICE + ' 머니에서 다시 시작해요.' +
                  (n ? '\n가지고 있던 주식은 ' + n + '명에게 모두 팔아 카드로 ' + total.toLocaleString() + ' 머니를 돌려줬어요.' : '\n주식을 가진 학생은 없었어요.') };
  } catch (e) { return { success: false, msg: e.message }; }
  finally { lock.releaseLock(); }
}

// ==========================================
// [전체 로그] 체크한 기록 한 번에 삭제 (선생님)
//  items: [{rowNo, sno, memo}] — 그사이 기록이 바뀌어 번호가 어긋나면 그 기록은 건너뜀
//  하나씩 지울 때(deleteActivityLog)처럼 그 거래만큼 카드 잔액을 되돌림
// ==========================================
function bulkDeleteActivityLogs(classCode, itemsJson) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    var items = typeof itemsJson === 'string' ? JSON.parse(itemsJson || '[]') : (itemsJson || []);
    if (!Array.isArray(items) || !items.length) return { success: false, msg: '지울 기록을 골라 주세요.' };
    var ss = SpreadsheetApp.getActiveSpreadsheet(), cc = cleanText(classCode);
    var tSheet = getOrCreateTransSheet(ss), tData = tSheet.getDataRange().getValues();
    var stuSheet = getOrCreateStudentsSheet(ss), stuData = stuSheet.getDataRange().getValues();
    var stuRow = {}, card = {};
    for (var k = 1; k < stuData.length; k++) if (cleanText(stuData[k][0]) === cc) { var no = cleanText(String(stuData[k][1])); stuRow[no] = k + 1; card[no] = Number(stuData[k][4]) || 0; }
    var rows = [], skipped = 0, seen = {}, changed = {};
    items.forEach(function (it) {
      var rn = parseInt(it && it.rowNo);
      if (!(rn >= 1 && rn < tData.length) || seen[rn]) { skipped++; return; }
      var row = tData[rn];
      if (cleanText(row[1]) !== cc || cleanText(String(row[2])) !== cleanText(String(it.sno)) || String(row[3] || '') !== String(it.memo == null ? '' : it.memo)) { skipped++; return; }
      seen[rn] = 1; rows.push(rn);
      var sno = cleanText(String(row[2])), net = (Number(row[4]) || 0) - (Number(row[5]) || 0);
      if (net && stuRow[sno]) { card[sno] -= net; changed[sno] = 1; }
    });
    if (!rows.length) return { success: false, msg: '지울 수 있는 기록이 없어요. 새로고침한 뒤 다시 골라 주세요.' };
    Object.keys(changed).forEach(function (no) { stuSheet.getRange(stuRow[no], 5).setValue(card[no]); });
    rows.sort(function (a, b) { return b - a; }).forEach(function (rn) { tSheet.deleteRow(rn + 1); });
    try { CacheService.getScriptCache().removeAll(['students_' + cc]); } catch (ce) {}
    return { success: true, deleted: rows.length, skipped: skipped,
             msg: rows.length + '개 기록을 지웠어요.' + (Object.keys(changed).length ? ' 학생 ' + Object.keys(changed).length + '명의 카드 잔액을 되돌렸어요.' : '') +
                  (skipped ? '\n(' + skipped + '개는 그사이 바뀌어 건너뛰었어요.)' : '') };
  } catch (e) { return { success: false, msg: e.message }; }
  finally { lock.releaseLock(); }
}

// ==========================================
// [국민 관리] 체크한 학생들의 이름·직업·접속코드를 한 번에 저장
//  items: [{sno, name, job, code}]  (code가 비었으면 코드는 그대로)
// ==========================================
function bulkUpdateStudents(classCode, itemsJson) {
  try {
    var items = typeof itemsJson === 'string' ? JSON.parse(itemsJson || '[]') : (itemsJson || []);
    if (!Array.isArray(items) || !items.length) return { success: false, msg: '저장할 학생을 골라 주세요.' };
    var ss = SpreadsheetApp.getActiveSpreadsheet(), cc = cleanText(classCode);
    var sheet = getOrCreateStudentsSheet(ss), data = sheet.getDataRange().getValues();
    var rowOf = {};
    for (var i = 1; i < data.length; i++) if (cleanText(data[i][0]) === cc) rowOf[cleanText(String(data[i][1]))] = i;
    var saved = 0, bad = [];
    items.forEach(function (it) {
      var sno = cleanText(String(it && it.sno)), r = rowOf[sno];
      if (r === undefined) { bad.push(sno + '번(학생 없음)'); return; }
      var code = cleanText(String(it.code || '')).toUpperCase();
      if (code && code.length < 4) { bad.push(sno + '번(코드는 4자리 이상)'); return; }
      sheet.getRange(r + 1, 3, 1, 2).setValues([[String(it.name || ''), String(it.job || '')]]);
      if (code) sheet.getRange(r + 1, 8).setValue(code);
      saved++;
    });
    try { CacheService.getScriptCache().removeAll(['students_' + cc]); } catch (ce) {}
    if (!saved) return { success: false, msg: '저장하지 못했어요.\n' + bad.join(', ') };
    return { success: true, saved: saved, msg: saved + '명의 정보를 저장했어요.' + (bad.length ? '\n저장하지 못한 학생: ' + bad.join(', ') : '') };
  } catch (e) { return { success: false, msg: e.message }; }
}

// ==========================================
// 📰 학급 경제 뉴스룸 (마스터 → 뉴스룸)
// 학급의 돈·예금·매점·투자 상태를 보고 사이트 안의 계산 규칙("AI 뉴스 엔진")이 매주 뉴스를 만듦 (외부 AI 사용 안 함)
// Newsroom: [0]학급코드 [1]상태JSON { issue, draft(이번 주에 만든 다음 주 전망), announced(공표한 전망), active(지금 적용 중), snaps(주별 기록), history }
// 공표하면 고른 적용 날짜(기본: 다음 주 월요일) 0시에 active가 됨. 원래 값은 그대로 두고 active.effects(%)를 덮어씌워 계산함 → 해제하면 원래 값으로 돌아감
// ==========================================
function _newsLoad(classCode) {
  var cc = cleanText(classCode), sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Newsroom'), state = null;
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) if (cleanText(data[i][0]) === cc) { try { state = JSON.parse(String(data[i][1] || '')); } catch (e) { state = null; } break; }
  }
  state = state || { issue: 0, draft: null, active: null, snaps: [], history: [] };
  // 공표한 전망은 적용일 0시(기본: 다음 주 월요일)가 되면 저절로 실현됨 (저장은 다음에 상태를 저장할 때 함께)
  if (state.announced && Date.now() >= state.announced.effectiveAt) { state.active = state.announced; state.announced = null; }
  return state;
}
function _newsSave(classCode, state) {
  var cc = cleanText(classCode), ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = ss.getSheetByName('Newsroom');
  if (!sheet) { sheet = ss.insertSheet('Newsroom'); sheet.appendRow(['학급코드', '상태JSON']); }
  var data = sheet.getDataRange().getValues(), json = JSON.stringify(state);
  for (var i = 1; i < data.length; i++) if (cleanText(data[i][0]) === cc) { sheet.getRange(i + 1, 2).setValue(json); return; }
  sheet.appendRow([cc, json]);
}
// 지금 적용 중인 소식의 변동 % (없으면 모두 0)
var NEWS_MAX_PCT = 5;                                   // 뉴스 한 번에 바뀌는 폭: -5% ~ +5% (학급 운영이 흔들리지 않게)
function _newsCap(v) { v = Number(v) || 0; return Math.max(-NEWS_MAX_PCT, Math.min(NEWS_MAX_PCT, v)); }
function _newsEffects(classCode) {
  var a = _newsLoad(classCode).active, e = (a && a.effects) || {};
  return { rate: _newsCap(e.rate), price: _newsCap(e.price), rent: _newsCap(e.rent), estate: _newsCap(e.estate) };
}
function _newsPrice(base, pct) { return (pct && base > 0) ? Math.max(1, Math.round(base * (1 + pct / 100))) : base; }
function _newsRate(base, pct) { return (pct && base > 0) ? Math.max(0.1, Math.round(base * (100 + pct) / 10) / 10) : base; }
// 은행 이자율에 적용 중인 소식을 덮어씌움. 원래 이자율은 base에 남김
function _newsBankRates(classCode, r) {
  var pct = _newsEffects(classCode).rate;
  r.base = { r1: r.r1, r2: r.r2, r3: r.r3, r4: r.r4 };
  r.newsPct = pct;
  ['r1', 'r2', 'r3', 'r4'].forEach(function (k) { r[k] = _newsRate(r[k], pct); });
  return r;
}

function _newsYmd(v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd') : String(v || '').slice(0, 10); }
function _newsDay(offset) { return Utilities.formatDate(new Date(Date.now() + offset * 86400000), 'Asia/Seoul', 'yyyy-MM-dd'); }
function _newsNextMonday() {                            // 다음 주 월요일 0시 (한국 시간)
  var p = _newsWeek().split('-');
  return Date.UTC(+p[0], +p[1] - 1, +p[2] + 7) - KST_MS;
}
function _newsWeek() {                                  // 이번 주 월요일 (한국 시간)
  var k = new Date(Date.now() + KST_MS);
  return _newsDay(-((k.getUTCDay() + 6) % 7));
}

// 학급 경제 상태 모으기 (선생님 0번 계정은 빼고 학생만)
function _newsStats(classCode) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), cc = cleanText(classCode);
  var st = { count: 0, card: 0, bank: 0, stock: 0, rich: 0 };
  var stockMap = _stockValueMap(cc), students = {};
  getOrCreateStudentsSheet(ss).getDataRange().getValues().forEach(function (r, i) {
    var sno = cleanText(String(r[1]));
    if (!i || cleanText(r[0]) !== cc || sno === '0') return;
    students[sno] = true;
    st.count++; st.card += Number(r[4]) || 0; st.bank += Number(r[5]) || 0; st.stock += stockMap[sno] || 0;
    if ((Number(r[4]) || 0) >= WS_INFLATION_LINE) st.rich++;
  });
  st.total = st.card + st.bank + st.stock;
  st.avg = st.count ? Math.round(st.total / st.count) : 0;

  var from = _newsDay(-6), before = _newsDay(-13);      // 최근 7일 / 그 앞 7일
  st.newDep = 0; st.newDepAmt = 0; st.early = 0; st.buyAmt = 0; st.sellAmt = 0;
  getOrCreateTransSheet(ss).getDataRange().getValues().forEach(function (r, i) {
    if (!i || cleanText(r[1]) !== cc || !students[cleanText(String(r[2]))] || _newsYmd(r[0]) < from) return;
    var type = String(r[7]);
    if (type === '예금가입') { st.newDep++; st.newDepAmt += Number(r[5]) || 0; }
    else if (type === '예금중도해지') st.early++;
    else if (type === '주식매수') st.buyAmt += Number(r[5]) || 0;
    else if (type === '주식매도') st.sellAmt += Number(r[4]) || 0;
  });
  st.activeDep = 0;
  getOrCreateDepositsSheet(ss).getDataRange().getValues().forEach(function (r, i) {
    if (i && cleanText(r[0]) === cc && cleanText(r[7]) === '활성') st.activeDep++;
  });

  st.sold = 0; st.soldAmt = 0; st.soldBefore = 0;
  var by = {};
  getOrCreateWholesaleSalesSheet(ss).getDataRange().getValues().forEach(function (r, i) {
    if (!i || cleanText(r[0]) !== cc) return;
    var d = _newsYmd(r[9]), q = Number(r[6]) || 0;
    if (d >= from) { st.sold += q; st.soldAmt += Number(r[7]) || 0; by[String(r[4])] = (by[String(r[4])] || 0) + q; }
    else if (d >= before) st.soldBefore += q;
  });
  st.top = Object.keys(by).map(function (n) { return { name: n, qty: by[n] }; }).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 3);
  var prices = [], out = 0;
  getOrCreateWholesaleItemsSheet(ss).getDataRange().getValues().forEach(function (r, i) {
    if (!i || cleanText(r[0]) !== cc) return;
    prices.push(Number(r[3]) || 0); if ((Number(r[4]) || 0) <= 0) out++;
  });
  st.items = prices.length; st.soldOut = out;
  st.avgPrice = prices.length ? Math.round(prices.reduce(function (a, b) { return a + b; }, 0) / prices.length) : 0;

  st.estates = 0;
  getOrCreateRealEstateSheet(ss).getDataRange().getValues().forEach(function (r, i) { if (i && cleanText(r[0]) === cc) st.estates++; });

  var weekAgo = Date.now() - 7 * 86400000, pcts = [];
  st.stocks = _stockLoad(cc).stocks.map(function (s) {
    var h = s.history || [s.price], t = _stockTimesOf(s), k = h.length - 1;
    while (k > 0 && t[k] && t[k] > weekAgo) k--;        // 7일 전 가격
    var pct = h[k] ? Math.round((s.price - h[k]) / h[k] * 1000) / 10 : 0;
    pcts.push(pct);
    return { name: s.name, emoji: s.emoji, price: s.price, pct: pct };
  });
  st.stockPct = pcts.length ? Math.round(pcts.reduce(function (a, b) { return a + b; }, 0) / pcts.length * 10) / 10 : 0;
  return st;
}

function _newsClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(v))); }
function _newsPick(list, avoid) {
  var l = list.filter(function (x) { return x !== avoid; });
  if (!l.length) l = list;
  return l[Math.floor(Math.random() * l.length)];
}
function _newsFill(text, map) { return text.replace(/\{(\w+)\}/g, function (m, k) { return map[k] !== undefined ? map[k] : m; }); }

// 상태 → 점수 (-2 아주 적음 ~ +2 아주 많음)
function _newsScores(st, prev) {
  var z = { M: 0, B: 0, S: 0, I: 0 };
  if (!st.total) return z;
  var cash = st.card / st.total, bank = st.bank / st.total, inv = st.stock / st.total;
  if (prev && prev.avg > 0) {
    var g = (st.avg - prev.avg) / prev.avg * 100;
    st.growth = Math.round(g * 10) / 10;
    z.M += g >= 25 ? 2 : g >= 10 ? 1 : g <= -25 ? -2 : g <= -10 ? -1 : 0;
  }
  if (st.avgPrice) { var power = st.card / st.count / st.avgPrice; z.M += power >= 20 ? 1 : power <= 3 ? -1 : 0; }
  if (st.rich / st.count >= 0.3) z.M += 1;
  z.M += cash >= 0.7 ? 1 : cash <= 0.25 ? -1 : 0;
  z.B = bank >= 0.5 ? 2 : bank >= 0.35 ? 1 : bank <= 0.05 ? -2 : bank <= 0.15 ? -1 : 0;
  if (st.soldBefore > 0) {
    var s = (st.sold - st.soldBefore) / st.soldBefore * 100;
    z.S = s >= 80 ? 2 : s >= 30 ? 1 : s <= -80 ? -2 : s <= -30 ? -1 : 0;
  } else if (st.items) { var per = st.sold / st.count; z.S = per >= 2 ? 2 : per >= 1 ? 1 : st.sold === 0 ? -2 : per < 0.3 ? -1 : 0; }
  z.I = inv >= 0.4 ? 2 : inv >= 0.25 ? 1 : inv <= 0.03 ? -1 : 0;
  z.M = _newsClamp(z.M, -2, 2);
  return z;
}

var NEWS_CATS = {
  money: { emoji: '💸', tag: '돈이 넘쳐요', titles: ['주머니 두둑! 우리 반에 돈이 넘친다', '돈이 많아진 교실, 물건값이 들썩들썩', '“사고 싶은 건 많은데…” 넘치는 돈, 커지는 물가 걱정'],
    leads: ['요즘 우리 반 친구들의 손에 돈이 많아졌어요. 돈이 흔해지면 물건을 사려는 사람이 늘고, 물건값이 오르기 쉬워요.', '친구들이 가진 돈이 많아졌습니다. 같은 물건을 사려는 사람이 많아지면 값이 오를 수 있어요.'],
    world: '실제 사회에서도 시중에 돈이 많이 풀리면 물건값이 전체적으로 오르는데, 이것을 “인플레이션”이라고 해요. 이럴 때 한국은행은 기준금리를 올려 사람들이 돈을 쓰기보다 저축하게 만듭니다.',
    tips: ['꼭 필요한 물건과 갖고 싶은 물건을 나눠서 적어 봐요.', '값이 더 오르기 전이라고 서둘러 사지 말고, 정말 필요한지 하루만 더 생각해요.'] },
  tight: { emoji: '🪙', tag: '돈이 귀해요', titles: ['지갑이 얇아졌다! 아껴 쓰기 나선 우리 반', '돈이 귀해진 교실, 알뜰 소비가 대세', '“한 번 더 생각하고 사자” 조용해진 교실 경제'],
    leads: ['우리 반 친구들이 가진 돈이 줄었어요. 돈이 귀해지면 물건을 덜 사게 되고, 가게는 값을 내려서라도 팔고 싶어 해요.', '쓸 수 있는 돈이 넉넉하지 않은 한 주입니다. 모두가 지갑을 닫으면 가게도 어려워질 수 있어요.'],
    world: '실제 사회에서 사람들이 돈을 쓰지 않아 물건이 안 팔리고 값이 내려가는 것을 “경기 침체”라고 해요. 이럴 때 한국은행은 기준금리를 내려서 돈이 다시 돌게 합니다.',
    tips: ['일자리(직업)와 과제에 집중해서 수입을 늘려 봐요.', '이번 주에 꼭 써야 할 돈부터 순서를 정해요.'] },
  saving: { emoji: '🏦', tag: '저축 열풍', titles: ['은행이 꽉 찼다! 저축 열풍 부는 우리 반', '너도나도 예금, 은행 금고가 빵빵', '“맡길 사람은 많은데…” 은행의 행복한 고민'],
    leads: ['은행에 돈을 맡긴 친구들이 아주 많아졌어요. 맡기려는 돈이 넘치면 은행은 이자를 많이 주지 않아도 됩니다.', '예금이 크게 늘었습니다. 은행은 이미 돈이 충분해서 이자를 높게 줄 필요가 줄었어요.'],
    world: '실제 사회에서도 은행에 돈이 많이 몰리면 예금 이자가 내려가요. 사람들이 저축만 하고 돈을 쓰지 않으면 가게와 회사가 어려워져서, 이자를 내려 소비와 투자를 돕기도 합니다.',
    tips: ['이자가 내려갔다면 예금 기간을 어떻게 고를지 다시 계산해 봐요.', '저축, 소비, 투자를 골고루 나누는 것도 좋은 방법이에요.'] },
  nosave: { emoji: '🐷', tag: '저축이 필요해요', titles: ['은행 금고가 텅텅! 예금 손님을 찾습니다', '저축을 잊은 교실, 은행이 나섰다', '“이자 더 드려요” 예금 손님 모시기 경쟁'],
    leads: ['은행에 맡긴 돈이 아주 적어요. 은행은 손님을 모으려고 이자를 더 주겠다고 합니다.', '우리 반 돈이 대부분 은행 밖에 있습니다. 은행은 더 좋은 이자로 친구들을 부르고 있어요.'],
    world: '실제 은행도 맡긴 돈이 부족하면 “특판 예금”처럼 이자를 높인 상품을 내놓아요. 은행은 그 돈을 필요한 사람과 회사에 빌려주기 때문에 예금이 꼭 필요합니다.',
    tips: ['당장 쓰지 않을 돈은 예금하면 이자를 받을 수 있어요.', '만기까지 기다릴 수 있는 금액만 맡겨요. 중도 해지하면 신용점수가 내려가요.'] },
  boom: { emoji: '🛒', tag: '매점이 북적북적', titles: ['매점에 줄이 길다! 소비 열기 후끈', '없어서 못 판다! 매점 대박 행진', '장바구니가 꽉꽉, 우리 반 소비 폭발'],
    leads: ['이번 주 매점이 아주 바빴어요. 찾는 사람이 많은데 물건 수는 정해져 있으면 값이 오르게 됩니다.', '매점 물건이 빠르게 팔리고 있습니다. 인기가 많은 물건은 값이 오르기 쉬워요.'],
    world: '실제 시장에서도 사려는 양(수요)이 팔려는 양(공급)보다 많으면 값이 올라요. 인기 장난감이나 명절 과일값이 오르는 것도 같은 까닭이에요.',
    tips: ['사기 전에 매점 시세표에서 값을 견주어 봐요.', '친구들이 산다고 따라 사지 않아도 괜찮아요.'] },
  slump: { emoji: '🍂', tag: '매점이 한산해요', titles: ['썰렁한 매점, 손님을 기다립니다', '“값을 내려야 하나…” 고민에 빠진 매점', '소비가 꽁꽁! 조용해진 매점 골목'],
    leads: ['이번 주에는 매점을 찾는 친구가 줄었어요. 물건이 안 팔리면 가게는 값을 내려 손님을 부르려고 합니다.', '매점 판매가 눈에 띄게 줄었습니다. 돈이 돌지 않으면 물건을 파는 친구들의 수입도 줄어요.'],
    world: '실제 가게도 손님이 줄면 할인 행사를 해요. 나라에서는 소비 쿠폰을 나눠 주거나 금리를 내려서 사람들이 다시 돈을 쓰도록 돕기도 합니다.',
    tips: ['필요했던 물건이 있다면 값이 내린 지금이 좋은 기회예요.', '도매상인이라면 친구들이 좋아할 새 상품을 찾아봐요.'] },
  invest: { emoji: '📈', tag: '투자 열풍', titles: ['너도나도 주식! 투자 열풍 부는 교실', '증권회사에 몰린 돈, 괜찮을까?', '“오를까 내릴까” 온 교실이 주식 이야기'],
    leads: ['우리 반 돈이 주식으로 많이 몰렸어요. 투자는 이익을 볼 수도 있지만 손해를 볼 수도 있습니다.', '주식에 들어간 돈이 크게 늘었습니다. 한쪽으로 돈이 몰리면 값이 실제 가치보다 부풀 수 있어요.'],
    world: '실제 사회에서도 투자에 돈이 너무 몰려 값이 부풀어 오르는 것을 “거품(버블)”이라고 해요. 그래서 전문가들은 한 곳에 모두 넣지 말고 나눠서 투자하라고 말합니다.',
    tips: ['한 종목에 모두 넣지 말고 나눠서 투자해요.', '잃어도 괜찮은 만큼만 투자하고 나머지는 예금해요.'] },
  stable: { emoji: '⚖️', tag: '안정된 한 주', titles: ['고르게 돌아가는 우리 반 경제', '저축도 소비도 알맞게! 균형 잡힌 한 주', '큰 바람 없이 잔잔한 교실 경제'],
    leads: ['이번 주 우리 반 경제는 크게 치우치지 않았어요. 돈이 저축과 소비, 투자로 알맞게 나뉘어 있습니다.', '큰 변화 없이 안정된 한 주입니다. 이런 때일수록 다음 목표를 세우기 좋아요.'],
    world: '실제 사회에서도 물가가 천천히, 조금씩 움직이는 것이 가장 건강한 경제예요. 한국은행은 물가가 1년에 2% 정도 오르는 것을 목표로 삼고 있습니다.',
    tips: ['한 달 뒤에 하고 싶은 일을 정하고 저축 계획을 세워요.', '수입과 지출을 적어 보고 줄일 수 있는 곳을 찾아봐요.'] }
};
// 실제 사회의 계절 소식 (1월~12월): 매점 물가에 아주 조금 반영
var NEWS_SEASONS = [
  ['새해가 되면 세뱃돈과 새 다짐으로 저축하는 사람이 늘어요.', 0], ['졸업과 설 무렵에는 꽃과 선물을 찾는 사람이 많아져요.', 2], ['새 학기가 시작되면 학용품을 사는 사람이 늘어 값이 오르기 쉬워요.', 2],
  ['봄나들이 철에는 간식과 도시락 재료가 잘 팔려요.', 1], ['가정의 달 5월에는 선물을 사는 사람이 많아요.', 2], ['초여름에는 햇과일과 채소가 많이 나와 값이 안정돼요.', -1],
  ['여름 휴가철에는 얼음과 아이스크림, 숙박 값이 올라요.', 2], ['무더위에는 전기를 많이 써서 생활비가 늘어요.', 1], ['추석 무렵에는 과일과 선물 값이 올라요.', 2],
  ['가을걷이 철에는 쌀과 과일이 많이 나와 값이 내려가요.', -2], ['김장철에는 배추와 무를 찾는 집이 늘어 채솟값이 움직여요.', 1], ['연말에는 선물과 모임으로 소비가 늘어요.', 2]
];
var NEWS_WHY = {
  rate: { 'M+': '친구들 손에 돈이 많아서, 저축하도록 이자를 올릴 예정이에요.', 'M-': '돈이 잘 돌지 않아서, 쓰고 투자하도록 이자를 내릴 예정이에요.', 'B-': '은행에 돈이 너무 많이 모여서 이자를 내릴 예정이에요.', 'B+': '은행에 맡긴 돈이 적어서, 손님을 모으려고 이자를 올릴 예정이에요.',
    'S+': '소비가 너무 뜨거워서, 식히려고 이자를 올릴 예정이에요.', 'S-': '매점이 한산해서, 돈을 쓰도록 이자를 내릴 예정이에요.', 'I+': '투자로 돈이 몰려서, 은행도 손님을 붙잡으려고 이자를 올릴 예정이에요.', 'I-': '투자가 조용해서 은행도 이자를 조금 내릴 예정이에요.' },
  price: { 'M+': '쓸 돈이 많아져서 물건값이 오를 예정이에요.', 'M-': '쓸 돈이 줄어서 물건값이 내릴 예정이에요.', 'B-': '돈이 은행에 묶여 있어서 물건값이 내릴 예정이에요.', 'B+': '저축보다 소비에 돈이 몰려서 물건값이 오를 예정이에요.',
    'S+': '찾는 사람이 많아서 물건값이 오를 예정이에요.', 'S-': '물건이 잘 안 팔려서 값을 내릴 예정이에요.', 'N+': '계절 영향으로 물건값이 조금 오를 예정이에요.', 'N-': '계절 영향으로 물건값이 조금 내릴 예정이에요.' },
  estate: { 'M+': '돈이 많아져서 자리를 사려는 친구가 늘어날 거예요.', 'M-': '돈이 귀해져서 자리를 사려는 친구가 줄어들 거예요.', 'I+': '투자 열기가 부동산까지 번질 거예요.', 'I-': '투자가 조용해서 자리 값도 내려갈 거예요.', 'R-': '이자가 오르면 자리보다 예금을 고르는 친구가 늘어날 거예요.', 'R+': '이자가 내리면 예금 대신 자리를 사려는 친구가 늘어날 거예요.' }
};
function _newsSum(kind, parts, lo, hi) {                // 영향들을 더하고, 가장 큰 이유 한 가지를 고름
  var sum = 0; Object.keys(parts).forEach(function (k) { sum += parts[k]; });
  var v = _newsClamp(sum, lo, hi), best = '', size = 0;
  Object.keys(parts).forEach(function (k) {
    if (v !== 0 && parts[k] * v > 0 && Math.abs(parts[k]) > size && NEWS_WHY[kind][k + (v > 0 ? '+' : '-')]) { size = Math.abs(parts[k]); best = NEWS_WHY[kind][k + (v > 0 ? '+' : '-')]; }
  });
  return { v: v, why: v === 0 ? '큰 변화가 없어서 지금처럼 둘 예정이에요.' : (best || '시장 분위기에 따라 조금 움직일 예정이에요.') };
}
// "12월 1일(월)부터 예금 이자율은 20% 오르고, 매점 물가는 12% 오를 예정이에요."
function _newsDayLabel(ms) {                            // "11월 30일(월)" (한국 시간)
  var k = new Date(ms + KST_MS);
  return (k.getUTCMonth() + 1) + '월 ' + k.getUTCDate() + '일(' + '일월화수목금토'.charAt(k.getUTCDay()) + ')';
}
// 뉴스의 변동 %로 전망 문장 만들기 (적용 날짜를 바꾸면 다시 만듦)
function _newsForecastOf(n, ms) {
  var e = n.effects || {};
  return _newsForecast(new Date(ms + KST_MS), [['예금 이자율은', e.rate], ['매점 물가는', e.price]].concat(n.estates ? [['자리 매매가는', e.estate], ['자리 임대료는', e.rent]] : []));
}
function _newsForecast(next, list) {
  var when = _newsDayLabel(next.getTime() - KST_MS) + '부터 ';
  var moves = list.filter(function (x) { return x[1]; });
  if (!moves.length) return '그래서 ' + when + '예금 이자율과 물가는 지금처럼 그대로일 예정이에요.';
  return '그래서 ' + when + moves.map(function (x, i) {
    var up = x[1] > 0, last = i === moves.length - 1;
    return x[0] + ' ' + Math.abs(x[1]) + '% ' + (last ? (up ? '오를 예정이에요.' : '내릴 예정이에요.') : (up ? '오르고' : '내리고'));
  }).join(', ');
}

function _newsBuild(classCode, state) {
  var st = _newsStats(classCode), week = _newsWeek();
  var prev = null;
  (state.snaps || []).forEach(function (s) { if (s.week < week) prev = s; });
  var z = _newsScores(st, prev);
  var nextAt = _newsNextMonday(), next = new Date(nextAt + KST_MS);
  var season = NEWS_SEASONS[next.getUTCMonth()], live = st.total > 0;   // 다음 주의 계절
  // 영향 계산: 돈이 많으면 이자↑ 물가↑, 예금이 너무 많으면 이자↓, 이자가 오르면 집값↓
  // 모든 변동은 -5% ~ +5% 안에서만 (NEWS_MAX_PCT)
  var X = NEWS_MAX_PCT;
  var rate = _newsSum('rate', { M: 1.25 * z.M, B: -1.5 * z.B, S: 0.5 * z.S, I: 0.4 * z.I, X: live ? Math.random() - 0.5 : 0 }, -X, X);
  var price = _newsSum('price', { M: 1.2 * z.M, B: -0.5 * z.B, S: 0.9 * z.S, N: live ? season[1] * 0.5 : 0, X: live ? Math.random() * 0.6 - 0.3 : 0 }, -X, X);
  var estate = _newsSum('estate', { M: 0.8 * z.M, I: 0.6 * z.I, R: -0.25 * rate.v }, -X, X);
  var rent = _newsClamp(price.v * 0.6, -X, X);

  var weight = [['money', z.M * 1.1], ['tight', -z.M], ['saving', z.B * 1.2], ['nosave', -z.B * 0.9], ['boom', z.S], ['slump', -z.S * 0.95], ['invest', z.I * 1.15]]
    .sort(function (a, b) { return b[1] - a[1]; })[0];
  var key = weight[1] >= 0.9 ? weight[0] : 'stable', cat = NEWS_CATS[key];
  var last = state.draft && state.draft.title;
  var won = function (n) { return Math.round(n).toLocaleString() + ' 머니'; };
  var ratio = function (n) { return st.total ? Math.round(n / st.total * 100) : 0; };
  var word = function (n, names) { return names[n + 2]; };

  var signals = [
    { key: 'M', icon: '💰', name: '학급 총 자산', value: won(st.total), sub: '한 사람 평균 ' + won(st.avg) + (st.growth !== undefined ? ' · 지난번보다 ' + (st.growth > 0 ? '+' : '') + st.growth + '%' : ''), score: z.M, word: word(z.M, ['돈이 아주 귀함', '돈이 귀함', '알맞음', '돈이 많음', '돈이 아주 많음']) },
    { key: 'B', icon: '🏦', name: '은행 예금', value: won(st.bank), sub: '전체의 ' + ratio(st.bank) + '% · 최근 7일 새 예금 ' + st.newDep + '건', score: z.B, word: word(z.B, ['아주 적음', '적음', '알맞음', '많음', '너무 많음']) },
    { key: 'S', icon: '🛒', name: '매점 구매', value: st.sold + '개', sub: '최근 7일 ' + won(st.soldAmt) + ' · 그 전 7일 ' + st.soldBefore + '개', score: z.S, word: word(z.S, ['꽁꽁 얼었음', '한산함', '알맞음', '북적임', '아주 뜨거움']) },
    { key: 'I', icon: '📈', name: '투자(주식)', value: won(st.stock), sub: '전체의 ' + ratio(st.stock) + '% · 평균 주가 ' + (st.stockPct > 0 ? '+' : '') + st.stockPct + '%', score: z.I, word: word(z.I, ['아주 조용함', '조용함', '알맞음', '활발함', '열풍']) }
  ];
  var top = st.top.length ? '가장 인기 있는 물건은 ' + st.top[0].name + '(' + st.top[0].qty + '개)였어요.' : '';
  var best = st.stocks.slice().sort(function (a, b) { return b.pct - a.pct; })[0];
  var articles = [
    { icon: '💰', title: '이번 주 우리 반 살림', text: '친구 ' + st.count + '명이 가진 돈은 모두 ' + won(st.total) + '예요. 한 사람 평균은 ' + won(st.avg) + (st.growth === undefined ? '입니다.' : '로, 지난번보다 ' + (st.growth > 0 ? st.growth + '% 늘었어요.' : st.growth < 0 ? Math.abs(st.growth) + '% 줄었어요.' : '그대로예요.')) },
    { icon: '🏦', title: '이번 주 은행', text: '은행에는 ' + won(st.bank) + '가 들어 있어요(전체의 ' + ratio(st.bank) + '%). 최근 7일 동안 새 예금 ' + st.newDep + '건, 중도 해지 ' + st.early + '건이 있었어요.' },
    { icon: '🛒', title: '이번 주 매점', text: st.items ? '최근 7일 동안 물건 ' + st.sold + '개가 팔렸어요. ' + top + (st.soldOut ? ' 다 팔린 물건도 ' + st.soldOut + '가지 있어요.' : '') : '아직 매점에 등록된 물건이 없어요.' },
    { icon: '📈', title: '이번 주 증권', text: '친구들이 가진 주식은 ' + won(st.stock) + '어치예요. ' + (best && best.pct !== 0 ? '최근 7일 동안 ' + best.emoji + ' ' + best.name + ' 주가가 ' + (best.pct > 0 ? best.pct + '% 올랐어요.' : Math.abs(best.pct) + '% 내렸어요.') : '최근 7일 동안 주가는 크게 움직이지 않았어요.') }
  ];
  var b = getBankSettings(classCode);
  if (!b.success) throw new Error(b.msg);
  return {
    id: 'NW_' + Date.now() + '_' + Math.floor(Math.random() * 1000), week: week, createdAt: Date.now(), issue: state.issue || 1,
    category: key, emoji: cat.emoji, tag: cat.tag, title: _newsPick(cat.titles, last), lead: _newsPick(cat.leads),
    articles: articles, world: cat.world, season: season[0], tips: cat.tips, signals: signals,
    effects: { rate: rate.v, price: price.v, rent: rent, estate: estate.v },
    forecast: _newsForecast(next, [['예금 이자율은', rate.v], ['매점 물가는', price.v]].concat(st.estates ? [['자리 매매가는', estate.v], ['자리 임대료는', rent]] : [])),
    effectiveAt: nextAt,
    why: { rate: rate.why, price: price.why, rent: rent === 0 ? '큰 변화가 없어서 지금처럼 둘 예정이에요.' : '물가를 따라 자리 임대료도 함께 ' + (rent > 0 ? '오를 예정이에요.' : '내릴 예정이에요.'), estate: estate.why },
    baseRates: b.base, share: { card: ratio(st.card), bank: ratio(st.bank), stock: st.total ? 100 - ratio(st.card) - ratio(st.bank) : 0 },
    top: st.top, stocks: st.stocks, estates: st.estates, snap: { week: week, avg: st.avg, total: st.total }
  };
}
function _newsMakeDraft(classCode, state) {
  var week = _newsWeek();
  if (!state.draft || state.draft.week !== week) state.issue = (state.issue || 0) + 1;
  var d = _newsBuild(classCode, state);
  state.draft = d;
  state.snaps = (state.snaps || []).filter(function (s) { return s.week !== week; }).concat([d.snap]).slice(-12);
  _newsSave(classCode, state);
}
function _newsView(classCode, state, msg) {
  var cc = cleanText(classCode), name = '';
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Classes');
  if (sheet) sheet.getDataRange().getValues().forEach(function (r, i) { if (i && cleanText(r[1]) === cc) name = String(r[0] || ''); });
  // 이자율 그림은 지금의 원래 이자율로 (선생님이 그사이 바꿨을 수 있음)
  var b = getBankSettings(classCode);
  [state.draft, state.announced, state.active].forEach(function (n) { if (n && b.success) n.baseRates = b.base; });
  // 적용 날짜가 생기기 전(2026-11-26 이전)에 만든 뉴스는 날짜와 전망 문장을 채워 줌
  [state.draft, state.announced, state.active].concat(state.history || []).forEach(function (n) {
    if (!n) return;
    if (!n.effectiveAt) n.effectiveAt = n.appliedAt || _newsNextMonday();
    // 폭을 줄이기 전(±40%)에 만든 뉴스도 -5% ~ +5%로 맞춰 보여 줌 (실제 적용도 _newsEffects에서 같은 폭)
    var e = n.effects || {}, big = ['rate', 'price', 'rent', 'estate'].some(function (k) { return Math.abs(Number(e[k]) || 0) > NEWS_MAX_PCT; });
    if (big) { ['rate', 'price', 'rent', 'estate'].forEach(function (k) { if (k in e) e[k] = _newsCap(e[k]); }); n.forecast = _newsForecastOf(n, n.effectiveAt); }
    if (!n.forecast) n.forecast = _newsForecastOf(n, n.effectiveAt);
    if (!n.announcedAt) n.announcedAt = n.appliedAt || n.createdAt;
  });
  return { success: true, msg: msg || '', className: name, draft: state.draft, announced: state.announced || null, active: state.active, history: state.history || [] };
}

// 학생 화면용 — 공표한 전망과 지금 적용 중인 소식만 돌려줌 (공표 전 뉴스는 보여 주지 않음)
function getActiveNews(classCode) {
  try {
    var v = _newsView(classCode, _newsLoad(classCode));
    return { success: true, className: v.className, announced: v.announced, active: v.active };
  } catch (e) { return { success: false, msg: e.message }; }
}
// 뉴스룸 열기 — 이번 주 뉴스가 아직 없으면 자동으로 만듦
function getNewsroom(classCode) {
  try {
    var state = _newsLoad(classCode);
    if (!state.draft || state.draft.week !== _newsWeek()) _newsMakeDraft(classCode, state);
    return _newsView(classCode, state);
  } catch (e) { return { success: false, msg: e.message }; }
}
function generateNews(classCode) {
  try {
    var state = _newsLoad(classCode);
    _newsMakeDraft(classCode, state);
    return _newsView(classCode, state, 'AI가 지금 학급 상태로 새 뉴스를 만들었어요.');
  } catch (e) { return { success: false, msg: e.message }; }
}
// 다음 주 전망 공표 — 다음 주 월요일 0시에 저절로 적용됨 (_newsLoad)
// ymd: 적용할 날짜 'yyyy-MM-dd' (그날 0시, 한국 시간). 비우면 다음 주 월요일
function announceNews(classCode, newsId, ymd) {
  try {
    var state = _newsLoad(classCode);
    if (!state.draft || state.draft.id !== newsId) return { success: false, msg: '그사이 뉴스가 새로 만들어졌어요. 화면을 다시 열어 확인해 주세요.' };
    var at = _newsNextMonday(), m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
    if (m) at = Date.UTC(+m[1], +m[2] - 1, +m[3]) - KST_MS;
    else if (ymd) return { success: false, msg: '적용 날짜를 달력에서 골라 주세요.' };
    if (at <= Date.now()) return { success: false, msg: '적용 날짜는 내일부터 고를 수 있어요. (미리 알려 주는 전망이라서요)' };
    if (at > Date.now() + 90 * 86400000) return { success: false, msg: '적용 날짜는 90일 안으로 골라 주세요.' };
    state.draft.announcedAt = Date.now();
    state.draft.effectiveAt = at;
    state.draft.forecast = _newsForecastOf(state.draft, at);
    state.announced = state.draft;
    state.history = [state.draft].concat((state.history || []).filter(function (h) { return h.id !== newsId; })).slice(0, 10);
    _newsSave(classCode, state);
    return _newsView(classCode, state, '경제 전망을 공표했어요! ' + _newsDayLabel(at) + ' 0시부터 저절로 적용돼요.');
  } catch (e) { return { success: false, msg: e.message }; }
}
function cancelAnnouncement(classCode) {
  try {
    var state = _newsLoad(classCode);
    if (!state.announced) return { success: false, msg: '공표해 둔 전망이 없어요. (이미 적용됐다면 "현재 소식 해제"를 눌러 주세요.)' };
    var id = state.announced.id;
    state.announced = null;
    state.history = (state.history || []).filter(function (h) { return h.id !== id; });
    _newsSave(classCode, state);
    return _newsView(classCode, state, '공표를 취소했어요. 다음 주에도 지금 값 그대로예요.');
  } catch (e) { return { success: false, msg: e.message }; }
}
function resetNews(classCode) {
  try {
    var state = _newsLoad(classCode);
    if (!state.active) return { success: false, msg: '지금 적용 중인 경제 소식이 없어요.' };
    state.active = null;
    _newsSave(classCode, state);
    return _newsView(classCode, state, '적용 중인 소식을 해제했어요. 이자율과 물가가 원래대로 돌아왔습니다.');
  } catch (e) { return { success: false, msg: e.message }; }
}


// ==========================================
// [부동산] 학급 자리 배치도 — 부동산 중개소 → 매물 등록
//  - 종류가 '자리'인 매물이 교실 그림의 책상으로 보이고, 누르면 혜택·가격·소유자가 나옴
//  - 선생님만 책상·칠판·교탁 등을 옮기고, 자리 혜택을 씀 (byTeacher)
// SeatMap: [0]학급코드 [1]배치JSON {seats:{자산번호:{x,y,perk}}, items:[{id,kind,x,y}]}
//  x, y는 교실 그림 안의 위치(%, 0~100). 위치가 없는 자리는 화면이 빈 곳에 줄 맞춰 놓음
// ==========================================
var SEAT_PERK_MAX = 120;
var SEAT_KINDS = ['board', 'tdesk', 'door', 'window', 'locker', 'plant', 'tv'];
function _seatDefault() {
  return { seats: {}, items: [
    { id: 'board', kind: 'board', x: 50, y: 7 }, { id: 'tdesk', kind: 'tdesk', x: 50, y: 17 },
    { id: 'door', kind: 'door', x: 96, y: 93 }, { id: 'win1', kind: 'window', x: 2, y: 35 }, { id: 'win2', kind: 'window', x: 2, y: 72 }
  ] };
}
function _seatLoad(classCode) {
  var cc = cleanText(classCode), sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('SeatMap'), m = null;
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) if (cleanText(data[i][0]) === cc) { try { m = JSON.parse(String(data[i][1] || '')); } catch (e) { m = null; } break; }
  }
  m = m || _seatDefault();
  m.seats = m.seats || {}; m.items = m.items || [];
  return m;
}
function _seatSave(classCode, m) {
  var cc = cleanText(classCode), ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = ss.getSheetByName('SeatMap');
  if (!sheet) { sheet = ss.insertSheet('SeatMap'); sheet.appendRow(['학급코드', '배치JSON']); }
  var data = sheet.getDataRange().getValues(), json = JSON.stringify(m);
  for (var i = 1; i < data.length; i++) if (cleanText(data[i][0]) === cc) { sheet.getRange(i + 1, 2).setValue(json); return; }
  sheet.appendRow([cc, json]);
}
function _seatPos(v) { v = Number(v); return isFinite(v) ? Math.max(2, Math.min(98, Math.round(v * 10) / 10)) : null; }

// 자리 배치도: 자리 매물(이름·가격·소유자·혜택·위치) + 칠판 같은 가구
function getSeatMap(classCode) {
  try {
    var r = getRealEstateList(classCode);
    if (!r.success) return r;
    var m = _seatLoad(classCode);
    var seats = r.list.filter(function (x) { return String(x.type).trim() === '자리'; }).map(function (x) {
      var s = m.seats[String(x.assetNo).trim()] || {};
      return { assetNo: String(x.assetNo).trim(), name: x.name, price: x.price, rent: x.rent, basePrice: x.basePrice, status: String(x.status || ''),
        ownerNo: x.ownerNo, ownerName: String(x.status) === '매물' ? '' : x.ownerName, x: s.x == null ? null : s.x, y: s.y == null ? null : s.y, perk: s.perk || '' };
    });
    return { success: true, seats: seats, items: m.items };
  } catch (e) { return { success: false, msg: e.message }; }
}

// 선생님이 옮긴 위치 저장. layout = {seats:{자산번호:{x,y}}, items:[{id,kind,x,y}]}
function saveSeatLayout(classCode, layout, byTeacher) {
  try {
    if (byTeacher !== true) return { success: false, msg: '자리 배치는 선생님만 바꿀 수 있어요.' };
    var m = _seatLoad(classCode), L = layout || {}, items = [];
    Object.keys(L.seats || {}).slice(0, 100).forEach(function (no) {
      var p = L.seats[no] || {}, x = _seatPos(p.x), y = _seatPos(p.y);
      if (x === null || y === null) return;
      no = String(no).trim().slice(0, 30);
      m.seats[no] = m.seats[no] || {}; m.seats[no].x = x; m.seats[no].y = y;
    });
    (L.items || []).slice(0, 40).forEach(function (it, i) {
      var x = _seatPos(it && it.x), y = _seatPos(it && it.y);
      if (!it || SEAT_KINDS.indexOf(it.kind) < 0 || x === null || y === null) return;
      items.push({ id: String(it.id || it.kind + i).replace(/[^\w-]/g, '').slice(0, 30) || (it.kind + i), kind: it.kind, x: x, y: y });
    });
    m.items = items;
    _seatSave(classCode, m);
    var r = getSeatMap(classCode); r.msg = '자리 배치를 저장했어요.';
    return r;
  } catch (e) { return { success: false, msg: e.message }; }
}

// 선생님이 자리 혜택 쓰기 (빈칸이면 혜택 지움)
function setSeatPerk(classCode, assetNo, perk, byTeacher) {
  try {
    if (byTeacher !== true) return { success: false, msg: '자리 혜택은 선생님만 쓸 수 있어요.' };
    var no = String(assetNo || '').trim();
    if (!no) return { success: false, msg: '자리를 골라 주세요.' };
    var m = _seatLoad(classCode);
    m.seats[no] = m.seats[no] || {};
    m.seats[no].perk = String(perk || '').trim().slice(0, SEAT_PERK_MAX);
    _seatSave(classCode, m);
    var r = getSeatMap(classCode); r.msg = m.seats[no].perk ? '자리 혜택을 저장했어요.' : '자리 혜택을 지웠어요.';
    return r;
  } catch (e) { return { success: false, msg: e.message }; }
}
