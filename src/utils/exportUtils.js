import db from '../db/database.js';
import Papa from 'papaparse';

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
