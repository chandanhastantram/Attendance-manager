import db, { SUBJECT_COLORS } from '../db/database.js';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

/**
 * Export all data as JSON
 */
export async function exportJSON() {
  const subjects = await db.subjects.toArray();
  const timetableSlots = await db.timetableSlots.toArray();
  const attendanceRecords = await db.attendanceRecords.toArray();
  const settings = await db.settings.toArray();

  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'Vorn Attendance Manager',
    subjects,
    timetableSlots,
    attendanceRecords,
    settings
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `vorn-backup-${formatDate(new Date())}.json`);
}

/**
 * Import data from JSON
 */
export async function importJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.app || data.app !== 'Vorn Attendance Manager') {
          throw new Error('Invalid backup file');
        }

        await db.transaction('rw', db.subjects, db.timetableSlots, db.attendanceRecords, db.settings, async () => {
          await db.subjects.clear();
          await db.timetableSlots.clear();
          await db.attendanceRecords.clear();

          if (data.subjects) await db.subjects.bulkAdd(data.subjects);
          if (data.timetableSlots) await db.timetableSlots.bulkAdd(data.timetableSlots);
          if (data.attendanceRecords) await db.attendanceRecords.bulkAdd(data.attendanceRecords);
          if (data.settings) {
            for (const s of data.settings) await db.settings.put(s);
          }
        });
        resolve({ success: true, counts: {
          subjects: data.subjects?.length || 0,
          records: data.attendanceRecords?.length || 0
        }});
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}

/**
 * Export attendance as CSV
 */
export async function exportCSV(subjectId = null) {
  const subjects = await db.subjects.toArray();
  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s.name]));

  let records;
  if (subjectId) {
    records = await db.attendanceRecords.where('subjectId').equals(subjectId).toArray();
  } else {
    records = await db.attendanceRecords.toArray();
  }

  const csvData = records.map(r => ({
    Date: r.date,
    Subject: subjectMap[r.subjectId] || 'Unknown',
    Status: r.status,
    Extra: r.isExtra ? 'Yes' : 'No'
  }));

  const csv = Papa.unparse(csvData);
  const blob = new Blob([csv], { type: 'text/csv' });
  const name = subjectId ? subjectMap[subjectId] || 'subject' : 'all-subjects';
  downloadBlob(blob, `vorn-${name}-${formatDate(new Date())}.csv`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

/**
 * Import attendance records from CSV, Excel (.xlsx/.xls), or JSON file.
 * Expected columns: Date, Subject, Status, Extra (optional)
 * - Date: YYYY-MM-DD
 * - Subject: name string (must match an existing subject)
 * - Status: "present" | "absent" | "holiday"
 * - Extra: "Yes" | "No" (optional)
 *
 * Returns { imported, skipped, subjects: Set<string> }
 */
export async function importAttendanceMultiFormat(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  let rows = [];

  if (ext === 'json') {
    rows = await parseJSONAttendance(file);
  } else if (ext === 'csv') {
    rows = await parseCSVAttendance(file);
  } else if (ext === 'xlsx' || ext === 'xls') {
    rows = await parseExcelAttendance(file);
  } else {
    throw new Error(`Unsupported file format: .${ext}. Please use CSV, Excel (.xlsx/.xls), or JSON.`);
  }

  if (!rows.length) throw new Error('No valid rows found in file.');

  // Load all subjects to match by name
  const allSubjects = await db.subjects.toArray();
  const subjectByName = {};
  for (const s of allSubjects) {
    subjectByName[s.name.trim().toLowerCase()] = s;
  }

  let imported = 0;
  let skipped = 0;
  const missingSubjects = new Set();
  const createdSubjects = new Set();

  for (const row of rows) {
    // Normalize row keys
    const normRow = {};
    for (const k in row) {
      if (Object.prototype.hasOwnProperty.call(row, k)) {
        normRow[k.trim().toLowerCase()] = row[k];
      }
    }

    const dateRaw  = (normRow['date'] || '').toString().trim();
    const nameRaw  = (normRow['subject'] || '').toString().trim();
    const statusRaw = (normRow['status'] || 'present').toString().trim().toLowerCase();
    const extraRaw  = (normRow['extra'] || 'no').toString().trim().toLowerCase();

    if (!dateRaw || !nameRaw) { skipped++; continue; }

    // Normalize the date (handle Excel serial numbers)
    let date = dateRaw;
    if (/^\d{5}$/.test(dateRaw)) {
      // Excel date serial
      const d = XLSX.SSF.parse_date_code(parseInt(dateRaw));
      date = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
      // Try to parse other date formats
      let parsed = new Date(dateRaw);
      // If still invalid, try parsing DD/MM/YYYY or DD-MM-YYYY
      if (isNaN(parsed.getTime())) {
        const parts = dateRaw.split(/[-/]/);
        if (parts.length === 3) {
          // Assume DD/MM/YYYY
          parsed = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
      }
      if (isNaN(parsed.getTime())) { skipped++; continue; }
      date = formatDate(parsed);
    }

    const validStatuses = ['present', 'absent', 'holiday'];
    const status = validStatuses.includes(statusRaw) ? statusRaw : 'present';
    const isExtra = extraRaw === 'yes' || extraRaw === 'true' || extraRaw === '1';

    let subject = subjectByName[nameRaw.toLowerCase()];
    if (!subject) { 
      // Auto-create missing subject
      const newColor = SUBJECT_COLORS[Object.keys(subjectByName).length % SUBJECT_COLORS.length] || SUBJECT_COLORS[0];
      subject = {
        name: nameRaw,
        shortName: nameRaw.substring(0, 4).toUpperCase(),
        color: newColor,
        isArchived: false,
        order: Object.keys(subjectByName).length
      };
      const id = await db.subjects.add(subject);
      subject.id = id;
      subjectByName[nameRaw.toLowerCase()] = subject;
      createdSubjects.add(nameRaw);
    }

    // Upsert: check if a record exists for this subject+date, then update or add
    try {
      const existing = await db.attendanceRecords
        .where('[subjectId+date]')
        .equals([subject.id, date])
        .first();
      if (existing) {
        await db.attendanceRecords.update(existing.id, { status, isExtra });
      } else {
        await db.attendanceRecords.add({ date, subjectId: subject.id, status, isExtra });
      }
      imported++;
    } catch (e) {
      skipped++;
    }
  }

  return { imported, skipped, missingSubjects: [...missingSubjects], createdSubjects: [...createdSubjects] };
}

function parseCSVAttendance(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (err) => reject(new Error('CSV parse error: ' + err.message)),
    });
  });
}

function parseExcelAttendance(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        resolve(data);
      } catch (err) {
        reject(new Error('Excel parse error: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsArrayBuffer(file);
  });
}

function parseJSONAttendance(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        // Accept flat array of records
        if (Array.isArray(data)) return resolve(data);
        // Accept { records: [...] } shape
        if (Array.isArray(data.records)) return resolve(data.records);
        // Accept vorn backup shape — attendance records already inside
        if (Array.isArray(data.attendanceRecords)) return resolve(
          data.attendanceRecords.map(r => ({ ...r, Date: r.date, Subject: r.subjectName || '', Status: r.status }))
        );
        reject(new Error('JSON must be an array of attendance records.'));
      } catch (err) {
        reject(new Error('JSON parse error: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsText(file);
  });
}
