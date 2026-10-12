/**
 * ศึกจานเผ็ด: ตัวเก็บสถิติรวมของผู้เล่นทุกคน (Google Apps Script)
 *
 * เมนูกับรูปอยู่บน GitHub ส่วนไฟล์นี้ทำหน้าที่เดียวคือ "นับว่าทุกคนเลือกจานไหน"
 * เก็บใน Google Sheet ของคุณเอง วิธีตั้งค่าอยู่ใน docs/STATS.th.md
 *
 * ความเสถียร
 *  - เขียนข้อมูลทุกครั้งภายใต้ lock คนจบเกมพร้อมกันก็ไม่ทับกัน
 *  - การอ่านสถิติใช้แคช 15 วินาที เปิดดูพร้อมกันทั้งห้องก็ไม่ช้า
 *  - ทุกเกมมี id ส่งซ้ำ (เน็ตสะดุดแล้วลองใหม่) นับครั้งเดียว
 *  - ตรวจลำดับการดวลของแต่ละเกมก่อนนับ ข้อมูลมั่วจะถูกปฏิเสธ
 */

var MAX_DISHES = 16;
var MAX_ROWS = 300;        // จำนวนจานสูงสุดที่เก็บสถิติ (กันข้อมูลขยะ)
var STATS_TTL = 15;        // วินาทีที่แคชสถิติ
var RATE_PER_MIN = 150;    // เกมที่รับต่อนาที
var LOCK_WAIT_MS = 20000;
var MAX_BODY = 20000;
var LOG_MAX = 6000;
var LOG_TRIM = 1000;

/* ====================================================================
 * ตั้งค่าครั้งแรก (รันจาก editor)
 * ==================================================================== */

function setup() {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) ss = SpreadsheetApp.create('ศึกจานเผ็ด สถิติ');
  props.setProperty('SHEET_ID', ss.getId());
  ensureSheet_(ss, 'Stats', ['id', 'name', 'picks', 'duels', 'finals']);
  ensureSheet_(ss, 'Settings', ['key', 'value']);
  ensureSheet_(ss, 'Log', ['time', 'gameId', 'final pick', 'duels', 'picks (json)']);
  withLock_(function () {
    var st = readSettings_();
    if (st.games === undefined || st.games === '') writeSettings_({ games: 0 });
  });
  var msg = 'ตั้งค่าเสร็จแล้ว Sheet: ' + ss.getUrl();
  Logger.log(msg);
  return msg;
}

/** ล้างสถิติทั้งหมด (รันจาก editor เมื่ออยากเริ่มนับใหม่) */
function resetStats() {
  withLock_(function () {
    var ss = getSS_(), sh = ss.getSheetByName('Stats'), n = sh.getLastRow();
    if (n > 1) sh.getRange(2, 1, n - 1, 5).clearContent();
    var log = ss.getSheetByName('Log'), m = log.getLastRow();
    if (m > 1) log.deleteRows(2, m - 1);
    writeSettings_({ games: 0 });
    SpreadsheetApp.flush();
  });
  CacheService.getScriptCache().remove('stats');
  Logger.log('ล้างสถิติแล้ว');
}

/* ====================================================================
 * Web app
 * ==================================================================== */

function doGet(e) { return handle_('GET', e); }
function doPost(e) { return handle_('POST', e); }

function handle_(method, e) {
  var out;
  try {
    out = route_(method, parseRequest_(method, e));
  } catch (err) {
    if (err && err.code) {
      out = { ok: false, error: err.code, message: String(err.message || err.code) };
    } else {
      console.error(err && err.stack ? err.stack : err);
      out = { ok: false, error: 'server_error', message: 'เซิร์ฟเวอร์ขัดข้อง ลองใหม่อีกครั้ง' };
    }
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function parseRequest_(method, e) {
  if (method === 'GET') return (e && e.parameter) || {};
  var raw = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
  if (raw.length > MAX_BODY) throw fail_('too_large', 'ข้อมูลใหญ่เกินไป');
  try {
    var obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch (x) {
    throw fail_('bad_request', 'ข้อมูลที่ส่งมาไม่ถูกต้อง');
  }
}

function route_(method, p) {
  var a = String(p.action || '');
  if (method === 'GET') {
    if (a === 'stats') return readStats_();
    if (a === '' || a === 'ping') return { ok: true, service: 'spice-showdown-stats', time: Date.now() };
  } else if (a === 'play') {
    return recordPlay_(p);
  }
  throw fail_('bad_action', 'ไม่รู้จักคำสั่งนี้');
}

/* ====================================================================
 * ตัวช่วย
 * ==================================================================== */

function fail_(code, message) {
  var e = new Error(message || code);
  e.code = code;
  return e;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) throw fail_('busy', 'เซิร์ฟเวอร์กำลังยุ่ง ลองใหม่อีกครั้ง');
  try { return fn(); } finally { lock.releaseLock(); }
}

function getSS_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  var ss = null;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) props.setProperty('SHEET_ID', ss.getId());
  }
  if (!ss) throw fail_('not_setup', 'ยังไม่ได้รัน setup() ใน Apps Script');
  return ss;
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sh;
}

/** ตั้งคอลัมน์เป็นข้อความล้วน กัน Sheets แปลง "3-2" เป็นวันที่ */
function fmtText_(sh, nRows, cols) {
  if (!nRows) return;
  cols.forEach(function (c) { sh.getRange(2, c, nRows, 1).setNumberFormat('@'); });
}

/** ข้อความที่ขึ้นต้นด้วย = + - @ จะถูกมองเป็นสูตร จึงเติมช่องว่างหน้า (อ่านกลับด้วย trim) */
function cellSafe_(v) {
  var s = String(v == null ? '' : v);
  return /^[=+\-@]/.test(s) ? ' ' + s : s;
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}

function readSettings_() {
  var sh = getSS_().getSheetByName('Settings');
  var n = sh.getLastRow();
  var out = {};
  if (n > 1) {
    sh.getRange(2, 1, n - 1, 2).getValues().forEach(function (r) {
      var k = String(r[0]).trim();
      if (k) out[k] = r[1];
    });
  }
  return out;
}

function writeSettings_(obj) {
  var sh = getSS_().getSheetByName('Settings');
  var n = sh.getLastRow();
  var rows = n > 1 ? sh.getRange(2, 1, n - 1, 2).getValues() : [];
  Object.keys(obj).forEach(function (k) {
    var hit = -1, i;
    for (i = 0; i < rows.length; i++) if (String(rows[i][0]).trim() === k) { hit = i; break; }
    if (hit >= 0) rows[hit][1] = obj[k]; else rows.push([k, obj[k]]);
  });
  sh.getRange(2, 1, rows.length, 2).setNumberFormat('@');
  sh.getRange(2, 1, rows.length, 2).setValues(rows);
}

/* ====================================================================
 * สถิติ
 * ==================================================================== */

function readStatsRows_() {
  var sh = getSS_().getSheetByName('Stats');
  var n = sh.getLastRow();
  return { sh: sh, rows: n > 1 ? sh.getRange(2, 1, n - 1, 5).getValues() : [] };
}

function readStats_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('stats');
  if (hit) { try { return JSON.parse(hit); } catch (x) { /* สร้างใหม่ */ } }
  var s = readStatsRows_();
  var out = {
    ok: true,
    games: Number(readSettings_().games) || 0,
    updatedAt: Date.now(),
    rows: s.rows.map(function (r) {
      return {
        id: String(r[0]).trim(),
        name: String(r[1]).trim(),
        picks: Number(r[2]) || 0,
        duels: Number(r[3]) || 0,
        finals: Number(r[4]) || 0
      };
    }).filter(function (r) { return r.id; })
  };
  cache.put('stats', JSON.stringify(out), STATS_TTL);
  return out;
}

/**
 * p.rounds = [[ผู้ชนะ, ผู้แพ้], ...] เป็น id ของจาน, p.names = { id: ชื่อ }
 * ผู้ชนะของรอบก่อนต้องอยู่ในรอบถัดไป และตัวท้าชิงต้องเป็นจานใหม่
 */
function recordPlay_(p) {
  var gameId = String(p.gameId || '');
  if (!/^[A-Za-z0-9]{8,40}$/.test(gameId)) throw fail_('bad_game', 'รหัสเกมไม่ถูกต้อง');
  var cache = CacheService.getScriptCache();
  if (cache.get('g:' + gameId)) return { ok: true, duplicate: true };

  var rounds = Array.isArray(p.rounds) ? p.rounds : [];
  var names = p.names && typeof p.names === 'object' ? p.names : {};
  if (rounds.length < 1 || rounds.length > MAX_DISHES - 1) throw fail_('bad_game', 'จำนวนรอบไม่ถูกต้อง');

  var picks = Object.create(null), duels = Object.create(null), seen = Object.create(null), nm = Object.create(null);
  var prev = null, champ = null, i;
  function idOk(x) { return typeof x === 'string' && /^[A-Za-z0-9_-]{1,60}$/.test(x); }
  for (i = 0; i < rounds.length; i++) {
    var r = rounds[i];
    if (!Array.isArray(r) || r.length !== 2 || !idOk(r[0]) || !idOk(r[1])) throw fail_('bad_game', 'ข้อมูลรอบไม่ถูกต้อง');
    var w = r[0], l = r[1];
    if (w === l) throw fail_('bad_game', 'ข้อมูลรอบไม่ถูกต้อง');
    if (i === 0) {
      seen[w] = 1; seen[l] = 1;
    } else {
      if (prev !== w && prev !== l) throw fail_('bad_game', 'ลำดับการดวลไม่ต่อเนื่อง');
      var other = prev === w ? l : w;
      if (seen[other]) throw fail_('bad_game', 'ลำดับการดวลไม่ต่อเนื่อง');
      seen[other] = 1;
    }
    picks[w] = (picks[w] || 0) + 1;
    duels[w] = (duels[w] || 0) + 1;
    duels[l] = (duels[l] || 0) + 1;
    prev = w; champ = w;
  }
  Object.keys(seen).forEach(function (id) {
    var n = clean_(names[id], 40);
    if (!n) throw fail_('bad_game', 'ไม่มีชื่อจาน');
    nm[id] = n;
  });

  var bucket = 'r:' + Math.floor(Date.now() / 60000);
  var used = Number(cache.get(bucket) || 0);
  if (used >= RATE_PER_MIN) throw fail_('busy', 'มีคนจบเกมพร้อมกันมาก ลองใหม่อีกครั้ง');
  cache.put(bucket, String(used + 1), 120);

  var dup = withLock_(function () {
    var ss = getSS_(), log = ss.getSheetByName('Log'), n = log.getLastRow();
    if (n > 1) {
      var from = Math.max(2, n - 199);
      var ids = log.getRange(from, 2, n - from + 1, 1).getValues();
      for (var k = 0; k < ids.length; k++) if (String(ids[k][0]) === gameId) return true;
    }
    var s = readStatsRows_(), rows = s.rows, idx = Object.create(null);
    rows.forEach(function (row, j) { idx[String(row[0]).trim()] = j; });
    Object.keys(duels).forEach(function (id) {
      if (!(id in idx)) {
        if (rows.length >= MAX_ROWS) return;
        rows.push([cellSafe_(id), cellSafe_(nm[id]), 0, 0, 0]);
        idx[id] = rows.length - 1;
      }
      var row = rows[idx[id]];
      row[1] = cellSafe_(nm[id]);
      row[2] = (Number(row[2]) || 0) + (picks[id] || 0);
      row[3] = (Number(row[3]) || 0) + duels[id];
      if (id === champ) row[4] = (Number(row[4]) || 0) + 1;
    });
    fmtText_(s.sh, rows.length, [1, 2]);
    s.sh.getRange(2, 1, rows.length, 5).setValues(rows);
    writeSettings_({ games: (Number(readSettings_().games) || 0) + 1 });
    var named = {};
    Object.keys(picks).forEach(function (id) { named[nm[id]] = picks[id]; });
    log.appendRow([new Date(), gameId, cellSafe_(nm[champ]), rounds.length, JSON.stringify(named)]);
    if (log.getLastRow() > LOG_MAX) log.deleteRows(2, LOG_TRIM);
    SpreadsheetApp.flush();
    return false;
  });
  cache.put('g:' + gameId, '1', 21600);
  cache.remove('stats');
  return dup ? { ok: true, duplicate: true } : { ok: true, final: nm[champ] };
}
