/* ==========================================================================
 * gas-bridge.js — 구글 앱스 스크립트(GAS) → Firebase 변환 다리
 *
 * 하는 일
 *  1) 화면 코드(app.js)가 쓰던 google.script.run 을 그대로 쓸 수 있게 해 줍니다.
 *  2) Code.gs 파일을 브라우저에서 그대로 실행합니다.
 *  3) Code.gs가 쓰던 SpreadsheetApp(구글 시트)을 흉내 내고,
 *     실제 데이터는 Firebase Firestore에 저장합니다.
 *
 * 이 파일은 고칠 필요가 없습니다. Code.gs를 수정하면 그 파일만 바꿔서 올리면 됩니다.
 * ========================================================================== */
(function () {
  'use strict';

  var TZ = 'Asia/Seoul';                                  // Session.getScriptTimeZone()
  var GLOBAL_SHEETS = { Teachers: 1, Classes: 1 };        // 모든 학급이 함께 쓰는 시트
  var NO_CLASS_FNS = { registerTeacher: 1, loginTeacher: 1, createClass: 1 }; // 첫 인자가 학급코드가 아닌 함수
  var CHUNK_CHARS = 200000;                               // 문서 1개에 담는 최대 글자 수(1MB 제한 대비)
  var HINT_KEY = 'ssm_sheet_hint_v1';

  // ------------------------------------------------------------------
  // 1. 저장소(백엔드) — Firebase 또는 로컬 테스트 모드
  // ------------------------------------------------------------------
  var cfg = window.FIREBASE_CONFIG || {};
  var useFirebase = !!(cfg.apiKey && String(cfg.apiKey).indexOf('여기에') < 0);
  var backend = useFirebase ? makeFirebaseBackend(cfg) : makeLocalBackend();
  window.__SSM_MODE__ = useFirebase ? 'firebase' : 'local';

  function makeFirebaseBackend(config) {
    firebase.initializeApp(config);
    var db = firebase.firestore();
    var ready = firebase.auth().signInAnonymously().catch(function (e) {
      throw new Error('Firebase 로그인 실패: 익명 로그인(Anonymous)이 켜져 있는지 확인하세요. (' + e.message + ')');
    });
    return {
      ready: ready,
      run: function (work) {
        return db.runTransaction(function (t) {
          return work({
            get: function (p) {
              return t.get(db.doc(p)).then(function (s) {
                return { exists: s.exists, data: s.exists ? s.data() : null };
              });
            },
            set: function (p, d) { t.set(db.doc(p), d); },
            del: function (p) { t.delete(db.doc(p)); }
          });
        });
      }
    };
  }

  // Firebase 설정 전에 내 컴퓨터에서 미리 써 볼 수 있는 모드 (이 브라우저에만 저장됨)
  function makeLocalBackend() {
    var KEY = 'ssm_local_db_v1';
    var mem = {};
    try { mem = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { mem = {}; }
    var chain = Promise.resolve();
    function persist() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {} }
    return {
      ready: Promise.resolve(),
      run: function (work) {
        var job = chain.then(function () {
          var writes = [];
          var tx = {
            get: function (p) {
              return Promise.resolve(mem.hasOwnProperty(p)
                ? { exists: true, data: JSON.parse(JSON.stringify(mem[p])) }
                : { exists: false, data: null });
            },
            set: function (p, d) { writes.push([p, d]); },
            del: function (p) { writes.push([p, null]); }
          };
          return Promise.resolve(work(tx)).then(function (res) {
            writes.forEach(function (w) { if (w[1] === null) delete mem[w[0]]; else mem[w[0]] = w[1]; });
            if (writes.length) persist();
            return res;
          });
        });
        chain = job.catch(function () {});
        return job;
      }
    };
  }

  // ------------------------------------------------------------------
  // 2. 시트 저장 형식
  //    spaces/global/sheets/Teachers          ← 전체 공용 시트
  //    spaces/c_<학급코드>/sheets/Students     ← 학급별 시트 (그 학급 데이터만)
  //    한 시트가 너무 커지면 Students~1, Students~2 ... 로 나눠 저장
  // ------------------------------------------------------------------
  function normCC(cc) {
    var s = String(cc == null ? '' : cc).replace(/[\s﻿\xA0]/g, '');
    if (/^\d+$/.test(s)) s = String(Number(s));           // 시트처럼 '0301' 과 301 을 같은 학급으로 취급
    return s;
  }
  function keyOf(name, cc) {
    if (GLOBAL_SHEETS[name]) return 'global|' + name;
    if (!cc) return null;
    return 'c_' + encodeURIComponent(cc) + '|' + name;
  }
  function pathOf(key) {
    var i = key.indexOf('|');
    return 'spaces/' + key.slice(0, i) + '/sheets/' + key.slice(i + 1);
  }

  function encCell(v) { return (v instanceof Date) ? { $d: v.getTime() } : v; }
  function decCell(v) { return (v && typeof v === 'object' && '$d' in v) ? new Date(v.$d) : v; }

  function loadOne(tx, store, key) {
    var p = pathOf(key);
    return tx.get(p).then(function (main) {
      if (!main.exists) { store[key] = { exists: false, chunks: [] }; return; }
      var n = Number(main.data.n) || 1, gets = [];
      for (var k = 1; k < n; k++) gets.push(tx.get(p + '~' + k));
      return Promise.all(gets).then(function (rs) {
        var chunks = [main.data.rows || '[]'];
        rs.forEach(function (r) { chunks.push(r.exists ? (r.data.rows || '[]') : '[]'); });
        store[key] = { exists: true, chunks: chunks };
      });
    });
  }
  function loadMany(tx, store, keys) {
    var todo = [], seen = {};
    keys.forEach(function (k) { if (k && !store[k] && !seen[k]) { seen[k] = 1; todo.push(k); } });
    return Promise.all(todo.map(function (k) { return loadOne(tx, store, k); }));
  }
  function rowsFromEntry(entry) {
    var rows = [];
    entry.chunks.forEach(function (c) {
      JSON.parse(c).forEach(function (r) { rows.push(r.map(decCell)); });
    });
    return rows;
  }
  function packRows(rows) {
    var chunks = [], cur = [], len = 0;
    rows.forEach(function (r) {
      var t = r.slice();
      while (t.length && t[t.length - 1] === '') t.pop();   // 행 끝의 빈칸 제거(용량 절약)
      var s = JSON.stringify(t.map(encCell));
      if (cur.length && len + s.length > CHUNK_CHARS) { chunks.push('[' + cur.join(',') + ']'); cur = []; len = 0; }
      cur.push(s); len += s.length + 1;
    });
    chunks.push('[' + cur.join(',') + ']');
    return chunks;
  }
  function writeDirty(tx, store, ctx) {
    Object.keys(ctx.sheets).forEach(function (key) {
      var sh = ctx.sheets[key];
      if (!sh._dirty) return;
      var p = pathOf(key), old = store[key] || { exists: false, chunks: [] };
      var chunks = packRows(sh._rows), oldN = old.exists ? old.chunks.length : 0;
      if (!old.exists || chunks.length !== oldN || chunks[0] !== old.chunks[0]) {
        tx.set(p, { n: chunks.length, rows: chunks[0], updated: Date.now() });
      }
      for (var k = 1; k < chunks.length; k++) {
        if (chunks[k] !== old.chunks[k]) tx.set(p + '~' + k, { rows: chunks[k] });
      }
      for (var j = Math.max(1, chunks.length); j < oldN; j++) tx.del(p + '~' + j);
    });
  }

  // ------------------------------------------------------------------
  // 3. 구글 시트 흉내 (SpreadsheetApp / Sheet / Range)
  // ------------------------------------------------------------------
  var CUR = null;                     // 지금 실행 중인 서버 함수의 상태
  function NeedSheet() { this.message = '__SSM_NEED_SHEET__'; }

  // 시트에 값이 들어갈 때 구글 시트처럼 숫자 모양 글자는 숫자로 바꿔 줌
  function normIn(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') {
      var t = v.trim();
      if (/^-?\d+(\.\d+)?$/.test(t) && t.replace(/[-.]/g, '').length <= 15) return Number(t);
      return v;
    }
    if (typeof v === 'number') return isFinite(v) ? v : '#NUM!';
    if (typeof v === 'boolean' || v instanceof Date) return v;
    return String(v);
  }
  function cloneVal(v) { return (v instanceof Date) ? new Date(v.getTime()) : v; }

  function Sheet(name, rows) { this._name = name; this._rows = rows; this._dirty = false; }
  Sheet.prototype = {
    _touch: function () {
      this._dirty = true;
      var r = this._rows;
      while (r.length && r[r.length - 1].every(function (c) { return c === '' || c === undefined; })) r.pop();
    },
    getName: function () { return this._name; },
    getLastRow: function () { return this._rows.length; },
    getLastColumn: function () {
      var m = 0;
      this._rows.forEach(function (r) {
        for (var j = r.length - 1; j >= 0; j--) if (r[j] !== '' && r[j] !== undefined) { if (j + 1 > m) m = j + 1; break; }
      });
      return m;
    },
    getMaxRows: function () { return Math.max(1000, this._rows.length); },
    getMaxColumns: function () { return Math.max(26, this.getLastColumn()); },
    getDataRange: function () {
      return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn()));
    },
    getRange: function (row, col, nr, nc) {
      if (typeof row === 'string') throw new Error('getRange("A1") 형식은 지원하지 않습니다: ' + row);
      return new Range(this, row, col == null ? 1 : col, nr == null ? 1 : nr, nc == null ? 1 : nc);
    },
    appendRow: function (arr) { this._rows.push((arr || []).map(normIn)); this._touch(); return this; },
    deleteRow: function (r) { return this.deleteRows(r, 1); },
    deleteRows: function (r, n) {
      if (r < 1) throw new Error('잘못된 행 번호입니다: ' + r);
      this._rows.splice(r - 1, n || 1); this._touch(); return this;
    },
    insertRowAfter: function (r) { this._rows.splice(r, 0, []); this._dirty = true; return this; },
    insertRowBefore: function (r) { this._rows.splice(r - 1, 0, []); this._dirty = true; return this; },
    clearContents: function () { this._rows = []; this._touch(); return this; },
    clear: function () { return this.clearContents(); },
    setFrozenRows: function () { return this; },
    getSheetId: function () { return 0; },
    getParent: function () { return SpreadsheetApp.getActiveSpreadsheet(); }
  };

  function Range(sh, r, c, nr, nc) {
    if (!(r >= 1) || !(c >= 1) || !(nr >= 1) || !(nc >= 1)) throw new Error('범위 좌표가 올바르지 않습니다.');
    this._s = sh; this._r = r; this._c = c; this._nr = nr; this._nc = nc;
  }
  Range.prototype = {
    _set: function (i, j, v) {
      var rows = this._s._rows, ri = this._r - 1 + i, ci = this._c - 1 + j;
      while (rows.length <= ri) rows.push([]);
      var row = rows[ri];
      while (row.length < ci) row.push('');
      row[ci] = v;
    },
    getValues: function () {
      var out = [];
      for (var i = 0; i < this._nr; i++) {
        var src = this._s._rows[this._r - 1 + i] || [], row = [];
        for (var j = 0; j < this._nc; j++) {
          var v = src[this._c - 1 + j];
          row.push(v === undefined ? '' : cloneVal(v));
        }
        out.push(row);
      }
      return out;
    },
    getValue: function () { return this.getValues()[0][0]; },
    getDisplayValues: function () {
      return this.getValues().map(function (r) {
        return r.map(function (v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v); });
      });
    },
    getDisplayValue: function () { return this.getDisplayValues()[0][0]; },
    setValue: function (v) {
      v = normIn(v);
      for (var i = 0; i < this._nr; i++) for (var j = 0; j < this._nc; j++) this._set(i, j, v);
      this._s._touch(); return this;
    },
    setValues: function (vals) {
      if (!vals || vals.length !== this._nr) throw new Error('데이터의 행 수(' + (vals ? vals.length : 0) + ')가 범위의 행 수(' + this._nr + ')와 다릅니다.');
      for (var i = 0; i < vals.length; i++) {
        if (vals[i].length !== this._nc) throw new Error('데이터의 열 수(' + vals[i].length + ')가 범위의 열 수(' + this._nc + ')와 다릅니다.');
        for (var j = 0; j < vals[i].length; j++) this._set(i, j, normIn(vals[i][j]));
      }
      this._s._touch(); return this;
    },
    clearContent: function () { return this.setValue(''); },
    getRow: function () { return this._r; },
    getColumn: function () { return this._c; },
    getNumRows: function () { return this._nr; },
    getNumColumns: function () { return this._nc; },
    getLastRow: function () { return this._r + this._nr - 1; },
    getLastColumn: function () { return this._c + this._nc - 1; },
    setNumberFormat: function () { return this; },
    setBackground: function () { return this; },
    setFontWeight: function () { return this; }
  };

  function Ctx(store, cc) {
    this.store = store; this.cc = cc; this.sheets = {}; this.missing = []; this.used = {};
  }
  var Spreadsheet = {
    getSheetByName: function (name) {
      var ctx = CUR; name = String(name);
      var key = keyOf(name, ctx.cc);
      if (!key) throw new Error('학급 코드 없이 학급 데이터(' + name + ')에 접근할 수 없습니다.');
      ctx.used[name] = 1;
      if (ctx.sheets[key]) return ctx.sheets[key];
      var entry = ctx.store[key];
      if (!entry) { ctx.missing.push(key); throw new NeedSheet(); }  // 아직 안 불러온 시트 → 불러온 뒤 다시 실행
      if (!entry.exists) return null;
      return (ctx.sheets[key] = new Sheet(name, rowsFromEntry(entry)));
    },
    insertSheet: function (name) {
      var ctx = CUR; name = String(name);
      if (this.getSheetByName(name)) throw new Error('"' + name + '" 시트가 이미 있습니다.');
      var sh = new Sheet(name, []); sh._dirty = true;
      return (ctx.sheets[keyOf(name, ctx.cc)] = sh);
    },
    getName: function () { return '쇼미더머니 나라'; },
    getId: function () { return 'firebase'; },
    getSpreadsheetTimeZone: function () { return TZ; }
  };

  var SpreadsheetApp = {
    getActiveSpreadsheet: function () { return Spreadsheet; },
    getActive: function () { return Spreadsheet; },
    flush: function () {}
  };
  // 캐시는 쓰지 않음(항상 최신 데이터를 읽도록)
  var noCache = { get: function () { return null; }, put: function () {}, remove: function () {}, removeAll: function () {}, getAll: function () { return {}; }, putAll: function () {} };
  var CacheService = { getScriptCache: function () { return noCache; }, getUserCache: function () { return noCache; }, getDocumentCache: function () { return noCache; } };
  // 동시 접속 충돌은 Firestore 트랜잭션이 알아서 막아 줌 → 잠금은 형식만
  var lockObj = { waitLock: function () {}, tryLock: function () { return true; }, releaseLock: function () {}, hasLock: function () { return true; } };
  var LockService = { getScriptLock: function () { return lockObj; }, getUserLock: function () { return lockObj; }, getDocumentLock: function () { return lockObj; } };
  var Session = {
    getScriptTimeZone: function () { return TZ; },
    getActiveUser: function () { return { getEmail: function () { return ''; } }; },
    getEffectiveUser: function () { return { getEmail: function () { return ''; } }; }
  };
  var Utilities = {
    formatDate: function (date, tz, fmt) {
      var d = (date instanceof Date) ? date : new Date(date);
      if (isNaN(d.getTime())) throw new Error('날짜 형식이 올바르지 않습니다: ' + date);
      var parts = {};
      new Intl.DateTimeFormat('en-US', {
        timeZone: tz || TZ, year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23', weekday: 'short'
      }).formatToParts(d).forEach(function (p) { parts[p.type] = p.value; });
      function pad(n, w) { n = String(Number(n)); while (n.length < w) n = '0' + n; return n; }
      var H = Number(parts.hour) % 24;
      var map = {
        yyyy: parts.year, yy: String(parts.year).slice(-2), MM: pad(parts.month, 2), M: String(Number(parts.month)),
        dd: pad(parts.day, 2), d: String(Number(parts.day)), HH: pad(H, 2), H: String(H),
        hh: pad(H % 12 || 12, 2), h: String(H % 12 || 12), mm: pad(parts.minute, 2), m: String(Number(parts.minute)),
        ss: pad(parts.second, 2), s: String(Number(parts.second)), a: H < 12 ? 'AM' : 'PM', EEE: parts.weekday, E: parts.weekday
      };
      return String(fmt).replace(/'([^']*)'|yyyy|yy|MM|M|dd|d|HH|H|hh|h|mm|m|ss|s|EEE|E|a/g, function (t, lit) {
        return lit !== undefined ? lit : map[t];
      });
    },
    getUuid: function () {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
      });
    },
    sleep: function () {}
  };
  var Logger = { log: function () { console.log.apply(console, arguments); } };
  var HtmlService = {
    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL', DEFAULT: 'DEFAULT' },
    createTemplateFromFile: function () { throw new Error('HtmlService는 이 사이트에서 사용하지 않습니다.'); },
    createHtmlOutputFromFile: function () { throw new Error('HtmlService는 이 사이트에서 사용하지 않습니다.'); }
  };
  var PropertiesService = (function () {
    function store(prefix) {
      return {
        getProperty: function (k) { try { return localStorage.getItem(prefix + k); } catch (e) { return null; } },
        setProperty: function (k, v) { try { localStorage.setItem(prefix + k, String(v)); } catch (e) {} return this; },
        deleteProperty: function (k) { try { localStorage.removeItem(prefix + k); } catch (e) {} return this; }
      };
    }
    return { getScriptProperties: function () { return store('ssm_prop_'); }, getUserProperties: function () { return store('ssm_uprop_'); } };
  })();

  // ------------------------------------------------------------------
  // 4. Code.gs 불러오기 (파일을 그대로 읽어서 실행)
  // ------------------------------------------------------------------
  var codeReady = fetch('Code.gs', { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error('Code.gs 파일을 찾을 수 없습니다. (' + r.status + ')');
      return r.text();
    })
    .then(function (src) {
      var factory = new Function(
        'SpreadsheetApp', 'CacheService', 'LockService', 'Session', 'Utilities', 'Logger', 'HtmlService', 'PropertiesService',
        src + '\n;return function (__n) { return eval(__n); };'
      );
      return factory(SpreadsheetApp, CacheService, LockService, Session, Utilities, Logger, HtmlService, PropertiesService);
    });

  function resolveFn(resolver, name) {
    if (!/^[A-Za-z$][\w$]*$/.test(name) || /_$/.test(name)) throw new Error('호출할 수 없는 함수입니다: ' + name);
    var f;
    try { f = resolver(name); } catch (e) { f = undefined; }
    if (typeof f !== 'function') throw new Error('Code.gs에서 함수를 찾을 수 없습니다: ' + name);
    return f;
  }

  // ------------------------------------------------------------------
  // 5. 비밀번호는 그대로 저장하지 않고 암호화(SHA-256)해서 저장
  // ------------------------------------------------------------------
  function sha256(text) {
    var clean = String(text == null ? '' : text).replace(/[\s﻿\xA0]/g, '');
    if (!clean || clean.indexOf('sha256-') === 0) return Promise.resolve(clean);
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode('smtm:' + clean)).then(function (buf) {
      return 'sha256-' + Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }
  window.__ssmHashPassword = sha256;   // import.html 에서도 사용
  function hashArgs(name, args) {
    var f = args[0];
    if ((name === 'registerTeacher' || name === 'loginTeacher') && f && typeof f === 'object') {
      return Promise.all([sha256(f.password), sha256(f.loginPw)]).then(function (h) {
        if (f.password) f.password = h[0];
        if (f.loginPw) f.loginPw = h[1];
        return args;
      });
    }
    if (name === 'createClass' && f && typeof f === 'object') {
      return sha256(f.adminPassword).then(function (h) { f.adminPassword = h; return args; });
    }
    if (name === 'loginClassAdmin') {
      return sha256(args[1]).then(function (h) { args[1] = h; return args; });
    }
    return Promise.resolve(args);
  }

  // ------------------------------------------------------------------
  // 6. 서버 함수 실행
  // ------------------------------------------------------------------
  function getHint(name) {
    try { var h = JSON.parse(localStorage.getItem(HINT_KEY) || '{}'); return h[name] || []; } catch (e) { return []; }
  }
  function saveHint(name, used) {
    try {
      var h = JSON.parse(localStorage.getItem(HINT_KEY) || '{}');
      h[name] = Object.keys(used);
      localStorage.setItem(HINT_KEY, JSON.stringify(h));
    } catch (e) {}
  }
  function plain(v) {
    if (v === undefined) return undefined;
    return JSON.parse(JSON.stringify(v));
  }

  function callServer(name, rawArgs) {
    return Promise.all([backend.ready, codeReady]).then(function (r) {
      var fn = resolveFn(r[1], name);
      var args = rawArgs.map(function (a) { return a === undefined ? null : plain(a); });
      return hashArgs(name, args).then(function (args) {
        var cc = NO_CLASS_FNS[name] ? '' : normCC(args[0]);
        var hint = getHint(name).map(function (n) { return keyOf(n, cc); });
        return backend.run(function (tx) {
          var store = {};
          var attempt = 0;
          function step() {
            if (++attempt > 40) throw new Error('시트를 불러오는 데 실패했습니다.');
            var ctx = new Ctx(store, cc), result, err = null;
            CUR = ctx;
            try { result = fn.apply(null, plain(args)); }
            catch (e) { err = e; }
            finally { CUR = null; }
            if (ctx.missing.length) return loadMany(tx, store, ctx.missing).then(step);
            if (err) throw err;
            writeDirty(tx, store, ctx);
            saveHint(name, ctx.used);
            return plain(result);
          }
          return loadMany(tx, store, hint).then(step);
        });
      });
    });
  }

  function friendlyError(e) {
    var msg = (e && e.message) || String(e);
    if (/permission|insufficient/i.test(msg)) msg = 'Firebase 권한 오류입니다. Firestore 보안 규칙과 익명 로그인 설정을 확인하세요. (' + msg + ')';
    else if (/offline|unavailable|network|Failed to fetch/i.test(msg)) msg = '인터넷 연결이 불안정합니다. 잠시 후 다시 시도해 주세요. (' + msg + ')';
    else if (/aborted|contention|too much/i.test(msg)) msg = '🚦 현재 처리량이 많습니다. 2~3초 뒤에 다시 시도해주세요.';
    var err = new Error(msg); err.original = e; return err;
  }

  // ------------------------------------------------------------------
  // 7. google.script.run 흉내
  // ------------------------------------------------------------------
  function makeRunner(onOk, onFail, userObj) {
    return new Proxy({}, {
      get: function (_, prop) {
        if (prop === 'withSuccessHandler') return function (h) { return makeRunner(h, onFail, userObj); };
        if (prop === 'withFailureHandler') return function (h) { return makeRunner(onOk, h, userObj); };
        if (prop === 'withUserObject') return function (o) { return makeRunner(onOk, onFail, o); };
        if (typeof prop !== 'string' || prop === 'then') return undefined;
        return function () {
          var args = Array.prototype.slice.call(arguments);
          callServer(prop, args).then(function (res) {
            if (onOk) onOk(res, userObj);
          }, function (e) {
            var err = friendlyError(e);
            console.error('[서버 함수 ' + prop + ' 오류]', e);
            if (onFail) onFail(err, userObj);
            else {
              if (typeof window.hideLoading === 'function') { try { window.hideLoading(); } catch (x) {} }
              alert('오류: ' + err.message);
            }
          });
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = makeRunner(null, null, undefined);
  window.google.script.host = { close: function () {}, setHeight: function () {}, setWidth: function () {} };

  // 개발자 도구에서 직접 호출할 때 사용: await ssmCall('getStudentList', '학급코드')
  window.ssmCall = function (name) { return callServer(name, Array.prototype.slice.call(arguments, 1)); };
  window.ssmBackend = backend;
  window.ssmPathOf = pathOf; window.ssmKeyOf = keyOf; window.ssmPackRows = packRows; window.ssmNormCC = normCC;

  // 로컬 테스트 모드 안내 띠
  if (!useFirebase) {
    document.addEventListener('DOMContentLoaded', function () {
      var bar = document.createElement('div');
      bar.textContent = '🧪 로컬 테스트 모드 — firebase-config.js 를 아직 설정하지 않아 이 브라우저에만 저장됩니다.';
      bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99998;background:#FEF3C7;color:#92400E;font:600 12px/1.4 sans-serif;padding:6px 12px;text-align:center';
      document.body.appendChild(bar);
    });
  }
})();
