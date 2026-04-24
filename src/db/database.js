import Dexie from 'dexie';

const db = new Dexie('VornAttendanceDB');

db.version(1).stores({
  subjects: '++id, name, order',
  timetableSlots: '++id, subjectId, day',
  attendanceRecords: '++id, subjectId, date, [subjectId+date]',
  settings: 'id',
  scanHistory: '++id, scanType, createdAt'
});

// v2: add semesterEndDate + semesterStartDate to settings
db.version(2).stores({
  subjects: '++id, name, order',
  timetableSlots: '++id, subjectId, day',
  attendanceRecords: '++id, subjectId, date, [subjectId+date]',
  settings: 'id',
  scanHistory: '++id, scanType, createdAt'
}).upgrade(async tx => {
  const s = await tx.table('settings').get('user');
  if (s && !s.semesterEndDate) {
    await tx.table('settings').update('user', {
      semesterEndDate: null,
      semesterStartDate: null,
    });
  }
});

// Seed default settings
db.on('populate', () => {
  db.settings.add({
    id: 'user',
    globalCriteria: 75,
    theme: 'system',
    accentColor: '#2D6A4F',
    weekStartDay: 1,
    onboardingDone: false,
    language: 'en',
    semesterStartDate: null,
    semesterEndDate: null,
  });
});

export default db;

// Subject colors palette (warm, no blue/purple)
export const SUBJECT_COLORS = [
  '#2D6A4F', '#E07B39', '#C1292E', '#D4A03C', '#7B8D50',
  '#8B635C', '#5E8C61', '#B56357', '#6B7F5F', '#9E7C4A',
  '#3D8B6E', '#CC7044', '#A0522D', '#708238', '#B5835A'
];

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_IDX = { 0: 'Mon', 1: 'Tue', 2: 'Wed', 3: 'Thu', 4: 'Fri', 5: 'Sat', 6: 'Sun' };
