import { create } from 'zustand';
import db, { SUBJECT_COLORS } from '../db/database.js';

const useSubjectStore = create((set, get) => ({
  subjects: [],
  loading: true,

  loadSubjects: async () => {
    const subjects = await db.subjects.orderBy('order').toArray();
    set({ subjects, loading: false });
  },

  addSubject: async (data) => {
    const count = await db.subjects.count();
    const id = await db.subjects.add({
      name: data.name,
      shortName: data.shortName || data.name.substring(0, 3).toUpperCase(),
      color: data.color || SUBJECT_COLORS[count % SUBJECT_COLORS.length],
      criteria: data.criteria || null,
      order: count,
      createdAt: new Date().toISOString()
    });
    await get().loadSubjects();
    return id;
  },

  updateSubject: async (id, data) => {
    await db.subjects.update(id, data);
    await get().loadSubjects();
  },

  deleteSubject: async (id) => {
    await db.transaction('rw', db.subjects, db.timetableSlots, db.attendanceRecords, async () => {
      await db.subjects.delete(id);
      await db.timetableSlots.where('subjectId').equals(id).delete();
      await db.attendanceRecords.where('subjectId').equals(id).delete();
    });
    await get().loadSubjects();
  },

  reorderSubjects: async (orderedIds) => {
    await db.transaction('rw', db.subjects, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.subjects.update(orderedIds[i], { order: i });
      }
    });
    await get().loadSubjects();
  },

  getSubjectStats: async (subjectId) => {
    const records = await db.attendanceRecords.where('subjectId').equals(subjectId).toArray();
    const attended = records.filter(r => r.status === 'attended').length;
    const missed = records.filter(r => r.status === 'missed').length;
    const off = records.filter(r => r.status === 'off').length;
    const total = attended + missed;
    const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;
    return { attended, missed, off, total, percentage };
  }
}));

export default useSubjectStore;
