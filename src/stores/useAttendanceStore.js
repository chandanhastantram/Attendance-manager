import { create } from 'zustand';
import db from '../db/database.js';
import { format } from 'date-fns';

const useAttendanceStore = create((set, get) => ({
  todayRecords: [],
  loading: true,

  loadTodayRecords: async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const records = await db.attendanceRecords.where('date').equals(today).toArray();
    set({ todayRecords: records, loading: false });
  },

  /**
   * Mark attendance for a subject on a date.
   * status: 'attended' | 'missed' | 'od' | 'off'
   * Tapping the same status again removes the record (toggle).
   */
  markAttendance: async (subjectId, date, status, isExtra = false) => {
    const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
    const existing = await db.attendanceRecords
      .where('[subjectId+date]').equals([subjectId, dateStr]).first();

    if (existing) {
      if (existing.status === status) {
        // Toggle off — remove record
        await db.attendanceRecords.delete(existing.id);
      } else {
        await db.attendanceRecords.update(existing.id, { status, isExtra });
      }
    } else {
      await db.attendanceRecords.add({
        subjectId,
        date: dateStr,
        status,
        isExtra,
        createdAt: new Date().toISOString()
      });
    }
    await get().loadTodayRecords();
  },

  getRecordsForDate: async (date) => {
    const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
    return await db.attendanceRecords.where('date').equals(dateStr).toArray();
  },

  getMonthRecords: async (year, month) => {
    const pad = n => String(n).padStart(2, '0');
    const m = month + 1;
    return await db.attendanceRecords
      .where('date')
      .between(`${year}-${pad(m)}-01`, `${year}-${pad(m)}-31`, true, true)
      .toArray();
  },

  bulkMark: async (subjectId, dates, status) => {
    await db.transaction('rw', db.attendanceRecords, async () => {
      for (const date of dates) {
        const dateStr = format(date, 'yyyy-MM-dd');
        const existing = await db.attendanceRecords
          .where('[subjectId+date]').equals([subjectId, dateStr]).first();
        if (existing) {
          await db.attendanceRecords.update(existing.id, { status });
        } else {
          await db.attendanceRecords.add({ subjectId, date: dateStr, status, isExtra: false, createdAt: new Date().toISOString() });
        }
      }
    });
    await get().loadTodayRecords();
  }
}));

export default useAttendanceStore;
