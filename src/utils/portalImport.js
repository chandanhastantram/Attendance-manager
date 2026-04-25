import db, { SUBJECT_COLORS } from '../db/database.js';

/**
 * The console script to paste in the Linways portal.
 * Reads the attendance table rows and copies JSON to clipboard.
 */
export const LINWAYS_CONSOLE_SCRIPT = `
(function() {
  const results = [];

  // Try consolidated table view first (all subjects in a table)
  const tables = document.querySelectorAll('table');
  let found = false;

  for (const table of tables) {
    const headers = [...table.querySelectorAll('th')].map(th => th.innerText.trim().toLowerCase());
    // Look for a table that has subject/course and attendance columns
    const hasSubject = headers.some(h => h.includes('subject') || h.includes('course') || h.includes('paper'));
    const hasHeld    = headers.some(h => h.includes('total') || h.includes('held') || h.includes('th'));
    const hasAttend  = headers.some(h => h.includes('attend') || h.includes('ah'));

    if (hasSubject && (hasHeld || hasAttend)) {
      const rows = [...table.querySelectorAll('tbody tr')];
      for (const row of rows) {
        const cells = [...row.querySelectorAll('td')].map(td => td.innerText.trim());
        if (cells.length < 2) continue;

        // Detect column indices based on headers
        const subjectIdx = headers.findIndex(h => h.includes('subject') || h.includes('course') || h.includes('paper'));
        const totalIdx   = headers.findIndex(h => h.includes('total') || h.includes('held') || h.match(/\\bth\\b/));
        const attendIdx  = headers.findIndex(h => h.match(/\\bah\\b/) || (h.includes('attend') && !h.includes('%')));
        const dutyIdx    = headers.findIndex(h => h.includes('duty') || h.includes('dl'));

        const name     = cells[subjectIdx] || cells[0];
        const total    = parseInt(cells[totalIdx]   || cells[1]) || 0;
        const attended = parseInt(cells[attendIdx]  || cells[2]) || 0;
        const duty     = parseInt(cells[dutyIdx]    || '0')       || 0;

        if (name && name.length > 1) {
          results.push({ name, total, attended, duty });
        }
      }
      if (results.length > 0) { found = true; break; }
    }
  }

  // Fallback: card/list view (detail page for one course at a time)
  if (!found) {
    // Linways detail view — look for labeled rows
    const labelEls = document.querySelectorAll('.col-md-4, .col-sm-4, td:first-child, th');
    let current = {};
    labelEls.forEach(el => {
      const text = el.innerText.trim();
      if (text === 'Course' || text === 'Subject') {
        current = {};
        const val = el.nextElementSibling || el.parentElement?.querySelector('td:last-child');
        if (val) current.name = val.innerText.trim();
      }
      if (text === 'Total Hour' || text === 'TH') {
        const val = el.nextElementSibling || el.parentElement?.querySelector('td:last-child');
        if (val) current.total = parseInt(val.innerText) || 0;
      }
      if ((text === 'Attended Hour' || text === 'AH') && !text.includes('%')) {
        const val = el.nextElementSibling || el.parentElement?.querySelector('td:last-child');
        if (val) current.attended = parseInt(val.innerText) || 0;
      }
      if (text === 'Duty Leave' || text === 'DL') {
        const val = el.nextElementSibling || el.parentElement?.querySelector('td:last-child');
        if (val) current.duty = parseInt(val.innerText) || 0;
      }
      if (current.name && current.total !== undefined && current.attended !== undefined) {
        results.push({ ...current });
        current = {};
      }
    });
  }

  if (results.length === 0) {
    alert('❌ Could not extract attendance data. Make sure you are on the consolidated attendance report page and the data is visible.');
    return;
  }

  const json = JSON.stringify(results, null, 2);
  navigator.clipboard.writeText(json)
    .then(() => alert('✅ Copied ' + results.length + ' subject(s) to clipboard!\\nPaste this in Vorn Attendance Manager → Portal Sync.'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = json;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('✅ Copied ' + results.length + ' subject(s) to clipboard!\\nPaste this in Vorn Attendance Manager → Portal Sync.');
    });
})();
`.trim();


/**
 * Parse and validate the JSON pasted from the console script.
 * Returns { valid: true, data: [...] } or { valid: false, error: '...' }
 */
export function parsePortalJSON(text) {
  try {
    const raw = JSON.parse(text.trim());
    if (!Array.isArray(raw)) throw new Error('Expected an array of subjects');
    if (raw.length === 0) throw new Error('Array is empty');

    const data = raw.map((item, i) => {
      if (!item.name || typeof item.name !== 'string') throw new Error(`Item ${i}: missing "name"`);
      const total    = parseInt(item.total)    || 0;
      const attended = parseInt(item.attended) || 0;
      const duty     = parseInt(item.duty)     || 0;
      const pct      = total > 0 ? Math.round((attended / total) * 100) : 0;
      const pctWithDL = total > 0 ? Math.round(((attended + duty) / total) * 100) : 0;
      return {
        name: item.name.trim(),
        total,
        attended,
        duty,
        pct,
        pctWithDL
      };
    });
    return { valid: true, data };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Apply parsed portal data to the database.
 * Creates subjects if they don't exist, then writes attendance summary records.
 * Uses a special "bulk" source tag so they can be distinguished from manual entries.
 *
 * Strategy: for each subject, we create N "attended" records and M "missed" records
 * going back from today, filling in the history to match the portal counts.
 */
export async function applyPortalData(parsedData, existingSubjects) {
  const today = new Date();
  const results = { created: 0, updated: 0, skipped: 0 };

  for (const item of parsedData) {
    if (item.total <= 0) { results.skipped++; continue; }

    // Find or create subject
    let subject = existingSubjects.find(s =>
      s.name.toLowerCase().trim() === item.name.toLowerCase().trim()
    );

    let subjectId;
    if (subject) {
      subjectId = subject.id;
      results.updated++;
    } else {
      const count = await db.subjects.count();
      subjectId = await db.subjects.add({
        name: item.name,
        shortName: item.name.substring(0, 3).toUpperCase(),
        color: SUBJECT_COLORS[count % SUBJECT_COLORS.length],
        criteria: null,
        order: count,
        createdAt: new Date().toISOString(),
      });
      results.created++;
    }

    // Check existing records to avoid full duplication
    const existing = await db.attendanceRecords
      .where('subjectId').equals(subjectId).toArray();
    const existingAttended = existing.filter(r => r.status === 'attended').length;
    const existingMissed   = existing.filter(r => r.status === 'missed').length;

    const toAddAttended = Math.max(0, item.attended - existingAttended);
    const toAddMissed   = Math.max(0, (item.total - item.attended - item.duty) - existingMissed);
    const toAddDuty     = item.duty > 0 ? item.duty : 0;

    // Write new records as synthetic backdated entries
    let dayOffset = existing.length;
    const addRecord = async (status) => {
      const d = new Date(today);
      d.setDate(d.getDate() - dayOffset);
      const dateStr = d.toISOString().slice(0, 10);
      // Only add if no record for this subject+date exists
      const dup = await db.attendanceRecords
        .where('[subjectId+date]').equals([subjectId, dateStr]).first();
      if (!dup) {
        await db.attendanceRecords.add({ subjectId, date: dateStr, status, source: 'portal' });
      }
      dayOffset++;
    };

    for (let i = 0; i < toAddAttended; i++) await addRecord('attended');
    for (let i = 0; i < toAddMissed;   i++) await addRecord('missed');
    for (let i = 0; i < toAddDuty;     i++) await addRecord('od');
  }

  return results;
}
