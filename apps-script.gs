/**
 * HIRING DASHBOARD — Apps Script proxy
 * --------------------------------------------------------------
 * Lets the dashboard read a PRIVATE Google Sheet without publishing it.
 * The script runs as YOU, reads your sheet, and returns CSV.
 * The dashboard fetches that URL — your sheet stays private.
 *
 * SETUP (one-time, ~2 minutes):
 *   1. Open your hiring Google Sheet.
 *   2. Extensions → Apps Script. A new tab opens with a code editor.
 *   3. Delete the default `function myFunction()` placeholder.
 *   4. Paste this entire file into Code.gs and click Save (disk icon or Ctrl+S).
 *   5. Click "Deploy" (top-right) → "New deployment".
 *   6. Click the gear icon next to "Select type" → choose "Web app".
 *   7. Configure:
 *        Description:    Hiring Dashboard proxy
 *        Execute as:     Me (your-email@gmail.com)
 *        Who has access: Anyone
 *      Click "Deploy".
 *   8. Authorize when prompted: Continue → choose your account →
 *      "Advanced" → "Go to ... (unsafe)" → Allow.
 *      (The "unsafe" warning shows because Google doesn't review personal
 *       scripts — the script only reads the sheet you wrote it for.)
 *   9. Copy the "Web app URL" (ends with /exec). Paste it into the
 *      dashboard's Connect field.
 *
 * UPDATING THE SCRIPT LATER:
 *   If you change this code, click Deploy → Manage deployments → pencil icon →
 *   Version: New version → Deploy. Same URL keeps working.
 *
 * READING A SPECIFIC TAB:
 *   By default this returns the first sheet. To read a specific tab,
 *   append `?sheet=TabName` to the web app URL when connecting.
 */

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var sheetName = params.sheet;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = sheetName ? ss.getSheetByName(sheetName) : ss.getSheets()[0];
    if (!sheet) {
      return out_('Type\nERROR,sheet "' + sheetName + '" not found');
    }
    var data = sheet.getDataRange().getValues();
    var tz = Session.getScriptTimeZone();
    var csv = data.map(function (row) {
      return row.map(function (cell) {
        var v;
        if (cell === null || cell === undefined || cell === '') v = '';
        else if (cell instanceof Date) v = Utilities.formatDate(cell, tz, 'yyyy-MM-dd');
        else v = String(cell);
        return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\r\n');
    return out_(csv);
  } catch (err) {
    return out_('Type\nERROR,' + err.message);
  }
}

function out_(text) {
  return ContentService
    .createTextOutput(text)
    .setMimeType(ContentService.MimeType.CSV);
}
