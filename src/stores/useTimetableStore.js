import { create } from 'zustand';
import db from '../db/database.js';

const useTimetableStore = create((set, get) => ({
  slots: [],
  loading: true,

  loadSlots: async () => {
    const slots = await db.timetableSlots.toArray();
    set({ slots, loading: false });
  },

  addSlot: async (data) => {
    const id = await db.timetableSlots.add({
      subjectId: data.subjectId,
      day: data.day,
      startTime: data.startTime,
      endTime: data.endTime,
      room: data.room || ''
    });
    await get().loadSlots();
    return id;
  },

  updateSlot: async (id, data) => {
    await db.timetableSlots.update(id, data);
    await get().loadSlots();
  },

  deleteSlot: async (id) => {
    await db.timetableSlots.delete(id);
    await get().loadSlots();
  },

  getTodaySlots: () => {
    const today = new Date().getDay();
    // Convert JS day (0=Sun) to our format (0=Mon)
    const dayIndex = today === 0 ? 6 : today - 1;
    return get().slots
      .filter(s => s.day === dayIndex)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  },

  getSlotsForDay: (dayIndex) => {
    return get().slots
      .filter(s => s.day === dayIndex)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
}));

export default useTimetableStore;
