// ==========================================================================
// [기존 데이터 옮기기 1단계] 구글 시트의 모든 데이터를 파일 하나로 내보내기
//
// 사용법 (설치가이드 8단계 참고)
//  1. 기존 앱스 스크립트 편집기에서 왼쪽 [파일 +] → [스크립트] → 이름: Export
//  2. 이 파일 내용을 전부 붙여넣고 저장(Ctrl+S)
//  3. 위쪽 함수 선택 칸에서 exportForFirebase 선택 → [실행]
//  4. 권한 요청이 뜨면 허용 (내 구글 드라이브에 파일을 만들기 위해 필요)
//  5. 아래 [실행 로그]에 나오는 주소로 들어가 파일을 다운로드
// ==========================================================================
function exportForFirebase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = Session.getScriptTimeZone();
  var out = { exportedAt: new Date().toISOString(), sheets: {} };

  ss.getSheets().forEach(function (sheet) {
    var values = sheet.getDataRange().getValues();
    out.sheets[sheet.getName()] = values.map(function (row) {
      return row.map(function (v) {
        if (v instanceof Date) {
          var hasTime = v.getHours() || v.getMinutes() || v.getSeconds();
          return Utilities.formatDate(v, tz, hasTime ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd');
        }
        return v;
      });
    });
  });

  var name = '쇼미더머니_데이터_' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmm') + '.json';
  var file = DriveApp.createFile(name, JSON.stringify(out), 'application/json');
  Logger.log('✅ 내보내기 완료! 아래 주소로 들어가서 파일을 다운로드하세요:');
  Logger.log(file.getUrl());
}
