/**
 * Novelty Library - NL Engagement sheet backend.
 * 1. Create a NEW Google Sheet (e.g. "NL Engagement").
 * 2. Extensions -> Apps Script -> paste this file -> set TOKEN below.
 * 3. Deploy -> New deployment -> Web app -> Execute as: Me, Who has access: Anyone.
 * 4. Copy the /exec URL into the Supabase secret ENGAGEMENT_SHEET_WEBHOOK_URL
 *    and the same TOKEN into ENGAGEMENT_SHEET_TOKEN.
 * Tabs "NL Summary" and "NL Feedback" are created automatically.
 */
const TOKEN = 'CHANGE_ME_TO_A_LONG_RANDOM_STRING';

const SUMMARY_HEADERS = ['Review No.', 'Title', 'Author', 'R/W Rating', 'Likes', 'Ratings', 'Reviews', 'NL Rating', 'Updated At'];
const FEEDBACK_HEADERS = ['Review No.', 'Title', 'User ID', 'User Name', 'Rating (1-10)', 'Review', 'Tags', 'Created At', 'Updated At'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.token !== TOKEN) return out({ ok: false, error: 'unauthorized' });
    if (body.action !== 'sync_review') return out({ ok: false, error: 'unknown action' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const summary = sheet(ss, 'NL Summary', SUMMARY_HEADERS);
    const feedback = sheet(ss, 'NL Feedback', FEEDBACK_HEADERS);
    const s = body.summary;

    // Summary: one row per review number (upsert)
    const sRow = [s.review_no, s.title, s.author, s.rw_rating, s.likes, s.ratings, s.reviews, s.nl_rating, s.updated_at];
    const sKeys = summary.getRange(2, 1, Math.max(summary.getLastRow() - 1, 1), 1).getValues().map(r => String(r[0]));
    const at = sKeys.indexOf(String(s.review_no));
    if (at >= 0 && summary.getLastRow() > 1) summary.getRange(at + 2, 1, 1, sRow.length).setValues([sRow]);
    else summary.appendRow(sRow);

    // Feedback: replace every row for this review with the current list
    for (let r = feedback.getLastRow(); r >= 2; r--) {
      if (String(feedback.getRange(r, 1).getValue()) === String(s.review_no)) feedback.deleteRow(r);
    }
    const rows = (body.feedback || []).map(f => [f.review_no, f.title, f.user_id, f.user_name, f.rating, f.review, f.tags, f.created_at, f.updated_at]);
    if (rows.length) feedback.getRange(feedback.getLastRow() + 1, 1, rows.length, FEEDBACK_HEADERS.length).setValues(rows);

    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function sheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sh;
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
