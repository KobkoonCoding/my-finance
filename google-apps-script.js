// ============================================
// วาง Code นี้ใน Google Apps Script
// (Extensions → Apps Script ใน Google Sheet)
// ============================================
//
// สิทธิ์การเข้าใช้เว็บ = สิทธิ์ Editor ของ Google Sheet
// จัดการผ่านปุ่ม "แชร์" ใน Google Sheet ได้เลย
// เจ้าของ Sheet มีสิทธิ์อัตโนมัติ
// ============================================

const SHEET_NAME = "Sheet1";

function doGet(e) {
  const action = e.parameter.action;
  if (action === "ping") return jsonResp({ ok: true });
  if (action === "read") return readData();
  if (action === "checkAuth") return checkAuth(e.parameter.email);
  if (action === "authAndRead") return authAndRead(e.parameter.email);
  return jsonResp({ error: "unknown action" });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const action = body.action;

  if (action === "add") return addRow(body);
  if (action === "update") return updateRow(body);
  if (action === "delete") return deleteRow(body);

  return jsonResp({ error: "unknown action" });
}

// ── AUTH + READ ในครั้งเดียว (เร็วกว่าเรียกแยก) ──
function authAndRead(email) {
  if (!email) return jsonResp({ authorized: false, reason: "no email" });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const emailLower = email.toLowerCase();

  // เช็คสิทธิ์: owner หรือ editor
  const owner = ss.getOwner();
  const isOwner = owner && owner.getEmail().toLowerCase() === emailLower;
  const isEditor = !isOwner && ss.getEditors().some(e => e.getEmail().toLowerCase() === emailLower);

  if (!isOwner && !isEditor) {
    return jsonResp({ authorized: false, reason: "not an editor" });
  }

  // อ่านข้อมูลเลย
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1).filter(r => r[0] !== "").map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    obj.id = Number(obj.id);
    obj.amount = Number(obj.amount);
    if (obj.date instanceof Date) {
      obj.date = Utilities.formatDate(obj.date, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    return obj;
  });

  return jsonResp({
    authorized: true,
    role: isOwner ? "owner" : "editor",
    data: rows
  });
}

// ── CHECK AUTH ──
function checkAuth(email) {
  if (!email) return jsonResp({ authorized: false, reason: "no email" });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const emailLower = email.toLowerCase();

  const owner = ss.getOwner();
  if (owner && owner.getEmail().toLowerCase() === emailLower) {
    return jsonResp({ authorized: true, role: "owner" });
  }

  const isEditor = ss.getEditors().some(e => e.getEmail().toLowerCase() === emailLower);
  return jsonResp({ authorized: isEditor, role: isEditor ? "editor" : "none" });
}

// ── READ ──
function readData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1).filter(r => r[0] !== "").map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    obj.id = Number(obj.id);
    obj.amount = Number(obj.amount);
    if (obj.date instanceof Date) {
      obj.date = Utilities.formatDate(obj.date, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    return obj;
  });
  return jsonResp(rows);
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
