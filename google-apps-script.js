// ============================================
// วาง Code นี้ใน Google Apps Script
// (Extensions → Apps Script ใน Google Sheet)
// แล้ว Deploy → Manage deployments → แก้ deployment เดิม → New version
// ============================================
//
// ความปลอดภัย (v2):
//   ทุก action (read/add/update/delete) ต้องแนบ Google access token
//   เซิร์ฟเวอร์จะ verify token กับ Google แล้วเช็คว่าอีเมลนั้นเป็น
//   owner/editor ของ Sheet จริงก่อน ถึงจะให้เข้าถึงข้อมูล
//   → ใครรู้ URL เฉยๆ แต่ไม่มี token ที่ถูกต้อง อ่าน/แก้ข้อมูลไม่ได้
// ============================================

const SHEET_NAME = "Sheet1";

// ── verify Google access token → ต้องเป็น owner/editor ของ Sheet ──
function verifyEditor(token) {
  if (!token) return { ok: false, reason: "no token" };

  // cache ผลลัพธ์ token ที่ผ่านแล้ว 5 นาที ลดการเรียก Google ทุก 15 วิ
  const cache = CacheService.getScriptCache();
  const cacheKey = "tok_" + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)
  );
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  try {
    const resp = UrlFetchApp.fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: "Bearer " + token }, muteHttpExceptions: true }
    );
    if (resp.getResponseCode() !== 200) return { ok: false, reason: "invalid token" };

    const info = JSON.parse(resp.getContentText());
    const email = (info.email || "").toLowerCase();
    if (!email) return { ok: false, reason: "no email in token" };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const owner = ss.getOwner();
    const isOwner = owner && owner.getEmail().toLowerCase() === email;
    const isEditor = isOwner || ss.getEditors().some(e => e.getEmail().toLowerCase() === email);
    if (!isEditor) return { ok: false, reason: "not an editor" };

    const result = { ok: true, email: email, role: isOwner ? "owner" : "editor" };
    cache.put(cacheKey, JSON.stringify(result), 300); // 5 นาที
    return result;
  } catch (err) {
    return { ok: false, reason: "verify error" };
  }
}

function doGet(e) {
  const action = e.parameter.action;
  if (action === "ping") return jsonResp({ ok: true });

  const auth = verifyEditor(e.parameter.token);

  if (action === "authAndRead") {
    if (!auth.ok) return jsonResp({ authorized: false, reason: auth.reason });
    return jsonResp({ authorized: true, role: auth.role, data: readRows() });
  }
  if (action === "read") {
    if (!auth.ok) return jsonResp({ authorized: false, reason: auth.reason });
    return jsonResp(readRows()); // plain array (เข้ากันได้กับ client เดิม)
  }
  if (action === "checkAuth") {
    return jsonResp({ authorized: auth.ok, role: auth.ok ? auth.role : "none", reason: auth.reason });
  }
  return jsonResp({ error: "unknown action" });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return jsonResp({ success: false, error: "bad body" }); }

  const auth = verifyEditor(body.token);
  if (!auth.ok) return jsonResp({ success: false, authorized: false, reason: auth.reason });

  const action = body.action;
  if (action === "add") return addRow(body);
  if (action === "update") return updateRow(body);
  if (action === "delete") return deleteRow(body);
  return jsonResp({ success: false, error: "unknown action" });
}

// ── READ rows ──
function readRows() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).filter(r => r[0] !== "").map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    obj.id = Number(obj.id);
    obj.amount = Number(obj.amount);
    if (obj.date instanceof Date) {
      obj.date = Utilities.formatDate(obj.date, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    return obj;
  });
}

// ── ADD ──
function addRow(body) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newId = getNextId(sheet);
  const row = headers.map(h => {
    if (h === "id") return newId;
    return body[h] !== undefined ? body[h] : "";
  });
  sheet.appendRow(row);
  return jsonResp({ success: true, id: newId });
}

// ── UPDATE ──
function updateRow(body) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf("id");

  for (let i = 1; i < data.length; i++) {
    if (Number(data[i][idCol]) === Number(body.id)) {
      headers.forEach((h, j) => {
        if (h !== "id" && body[h] !== undefined) {
          sheet.getRange(i + 1, j + 1).setValue(body[h]);
        }
      });
      return jsonResp({ success: true });
    }
  }
  return jsonResp({ success: false, error: "not found" });
}

// ── DELETE ──
function deleteRow(body) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const idCol = data[0].indexOf("id");

  for (let i = data.length - 1; i >= 1; i--) {
    if (Number(data[i][idCol]) === Number(body.id)) {
      sheet.deleteRow(i + 1);
      return jsonResp({ success: true });
    }
  }
  return jsonResp({ success: false, error: "not found" });
}

// ── HELPERS ──
function getNextId(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return 1;
  const ids = data.slice(1).map(r => Number(r[0])).filter(n => !isNaN(n));
  return ids.length ? Math.max(...ids) + 1 : 1;
}

function jsonResp(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
