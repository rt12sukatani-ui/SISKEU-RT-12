export const APPS_SCRIPT_BRIDGE_CODE = `/**
 * SISKEU RT 12 / RW 20 SUKATANI — Google Spreadsheet Database Bridge
 * Pasang kode ini di Google Spreadsheet: Ekstensi -> Apps Script
 * Lalu Terapkan -> Deployment baru -> Jenis: Aplikasi web
 * Jalankan sebagai: Saya (Me) | Yang memiliki akses: Siapa saja (Anyone)
 */

function doGet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return jsonOut_({
    ok: true,
    status: 'ready',
    spreadsheetId: ss.getId(),
    spreadsheetTitle: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
  });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var req = JSON.parse(raw);
    var action = req.action || '';
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'ensureSchema') {
      return jsonOut_(handleEnsureSchema_(ss, req));
    }
    if (action === 'fetchAll') {
      return jsonOut_(handleFetchAll_(ss, req.tabs));
    }
    if (action === 'append') {
      return jsonOut_(handleAppend_(ss, req.tab, req.rows || []));
    }
    if (action === 'upsert') {
      return jsonOut_(handleUpsert_(ss, req.tab, req.rows || [], req.legacySettingsKey));
    }
    if (action === 'delete') {
      return jsonOut_(handleDelete_(ss, req.tab, req.keys || []));
    }

    return jsonOut_({ ok: false, error: 'Aksi tidak dikenal: ' + action });
  } catch (err) {
    return jsonOut_({
      ok: false,
      error: err && err.message ? err.message : String(err),
    });
  } finally {
    lock.releaseLock();
  }
}

function jsonOut_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleEnsureSchema_(ss, req) {
  var tabs = req.tabs || [];
  var headersMap = req.headers || {};
  var legacyMap = req.legacyMap || {};
  var defaultSettingsRow = req.defaultSettingsRow || null;

  for (var legacyName in legacyMap) {
    if (!Object.prototype.hasOwnProperty.call(legacyMap, legacyName)) continue;
    var targetName = legacyMap[legacyName];
    var legacySheet = ss.getSheetByName(legacyName);
    if (legacySheet && !ss.getSheetByName(targetName)) {
      legacySheet.setName(targetName);
    }
  }

  for (var i = 0; i < tabs.length; i++) {
    var tabName = tabs[i];
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
    }
    sheet.setFrozenRows(1);

    var targetHeaders = headersMap[tabName] || [];
    if (targetHeaders.length === 0) continue;

    var lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      writeTextRows_(sheet, 1, [targetHeaders]);
      if (tabName === 'pengaturan' && defaultSettingsRow) {
        writeTextRows_(sheet, 2, [defaultSettingsRow]);
      }
    } else {
      var firstRow = sheet.getRange(1, 1, 1, targetHeaders.length).getDisplayValues()[0];
      var matches = true;
      for (var c = 0; c < targetHeaders.length; c++) {
        if ((firstRow[c] || '') !== targetHeaders[c]) {
          matches = false;
          break;
        }
      }
      if (!matches) {
        writeTextRows_(sheet, 1, [targetHeaders]);
      }
    }
  }

  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
  }

  return {
    ok: true,
    spreadsheetId: ss.getId(),
    spreadsheetTitle: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
  };
}

function handleFetchAll_(ss, tabs) {
  var tabList = Array.isArray(tabs) && tabs.length > 0
    ? tabs
    : [
        'pengaturan',
        'database_warga',
        'akun_pengguna',
        'profil_warga',
        'pengurus_admin',
        'data_pribadi',
        'transaksi_kas',
        'pengumuman',
        'darurat_sos',
        'notifikasi',
        'foto_kegiatan',
      ];

  var tables = {};
  for (var i = 0; i < tabList.length; i++) {
    var name = tabList[i];
    var sheet = ss.getSheetByName(name);
    if (!sheet || sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
      tables[name] = [];
    } else {
      tables[name] = sheet
        .getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn())
        .getDisplayValues();
    }
  }

  return {
    ok: true,
    spreadsheetId: ss.getId(),
    spreadsheetTitle: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
    tables: tables,
  };
}

function handleAppend_(ss, tabName, rows) {
  if (!rows || rows.length === 0) return { ok: true };
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) throw new Error('Tab "' + tabName + '" tidak ditemukan di Spreadsheet.');
  var startRow = Math.max(2, sheet.getLastRow() + 1);
  writeTextRows_(sheet, startRow, rows);
  return { ok: true };
}

function handleUpsert_(ss, tabName, rows, legacySettingsKey) {
  if (!rows || rows.length === 0) return { ok: true };
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) throw new Error('Tab "' + tabName + '" tidak ditemukan di Spreadsheet.');

  var lastRow = sheet.getLastRow();
  var keyMap = {};
  if (lastRow >= 2) {
    var colA = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    for (var i = 0; i < colA.length; i++) {
      var k = String(colA[i][0] || '').trim();
      if (k) keyMap[k] = i + 2;
    }
  }

  var toAppend = [];
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    var key = String(row[0] || '').trim();
    var existingRow = key ? keyMap[key] : null;
    if (!existingRow && legacySettingsKey && key === 'konfigurasi_rt') {
      existingRow = keyMap[legacySettingsKey] || null;
    }
    if (existingRow) {
      writeTextRows_(sheet, existingRow, [row]);
    } else {
      toAppend.push(row);
    }
  }

  if (toAppend.length > 0) {
    var nextRow = Math.max(2, sheet.getLastRow() + 1);
    writeTextRows_(sheet, nextRow, toAppend);
  }

  return { ok: true };
}

function handleDelete_(ss, tabName, keys) {
  if (!keys || keys.length === 0) return { ok: true };
  var sheet = ss.getSheetByName(tabName);
  if (!sheet || sheet.getLastRow() < 2) return { ok: true };

  var keySet = {};
  for (var i = 0; i < keys.length; i++) {
    var trimmed = String(keys[i] || '').trim();
    if (trimmed) keySet[trimmed] = true;
  }

  var lastRow = sheet.getLastRow();
  var colA = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  var rowsToDelete = [];
  for (var r = 0; r < colA.length; r++) {
    var k = String(colA[r][0] || '').trim();
    if (k && keySet[k]) {
      rowsToDelete.push(r + 2);
    }
  }

  rowsToDelete.sort(function (a, b) {
    return b - a;
  });
  for (var d = 0; d < rowsToDelete.length; d++) {
    sheet.deleteRow(rowsToDelete[d]);
  }

  return { ok: true };
}

function writeTextRows_(sheet, startRow, rows) {
  if (!rows || rows.length === 0) return;
  var maxCols = 0;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].length > maxCols) maxCols = rows[i].length;
  }
  if (maxCols === 0) return;

  var normalized = [];
  for (var r = 0; r < rows.length; r++) {
    var rowCopy = [];
    for (var c = 0; c < maxCols; c++) {
      var val = rows[r][c];
      rowCopy.push(val === undefined || val === null ? '' : String(val));
    }
    normalized.push(rowCopy);
  }

  var range = sheet.getRange(startRow, 1, normalized.length, maxCols);
  range.setNumberFormat('@');
  range.setValues(normalized);
}
`;
