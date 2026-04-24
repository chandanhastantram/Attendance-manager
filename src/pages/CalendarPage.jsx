import React, { useEffect, useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays,
  isSameMonth, isSameDay, addMonths, subMonths, getDaysInMonth, isToday as dateFnsIsToday } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, X, Minus } from 'lucide-react';
import useAttendanceStore from '../stores/useAttendanceStore.js';
import useSubjectStore from '../stores/useSubjectStore.js';
import useTimetableStore from '../stores/useTimetableStore.js';
import Modal from '../components/common/Modal.jsx';
import useToastStore from '../stores/useToastStore.js';
import db from '../db/database.js';
import { DAY_SHORT } from '../db/database.js';

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate]  = useState(null);
  const [monthRecords, setMonthRecords]  = useState([]);
  const [dayRecords,   setDayRecords]    = useState([]);
  const subjects   = useSubjectStore(s => s.subjects);
  const loadSubjects = useSubjectStore(s => s.loadSubjects);
  const slots      = useTimetableStore(s => s.slots);
  const loadSlots  = useTimetableStore(s => s.loadSlots);
  const markAttendance = useAttendanceStore(s => s.markAttendance);
  const addToast   = useToastStore(s => s.addToast);

  useEffect(() => { loadSubjects(); loadSlots(); }, []);

  const loadMonthData = async () => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth() + 1;
    const pad = n => String(n).padStart(2,'0');
    const recs = await db.attendanceRecords
      .where('date').between(`${y}-${pad(m)}-01`, `${y}-${pad(m)}-31`, true, true)
      .toArray();
    setMonthRecords(recs);
  };

  useEffect(() => { loadMonthData(); }, [currentMonth]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn:1 });
    const end   = endOfWeek(endOfMonth(currentMonth), { weekStartsOn:1 });
    const days = [];
    let d = start;
    while (d <= end) { days.push(d); d = addDays(d, 1); }
    return days;
  }, [currentMonth]);

  const dateStatusMap = useMemo(() => {
    const map = {};
    for (const r of monthRecords) {
      if (!map[r.date]) map[r.date] = { green:false, red:false, teal:false, gray:false, count:0 };
      if (r.status === 'attended') map[r.date].green = true;
      if (r.status === 'missed')   map[r.date].red   = true;
      if (r.status === 'od')       map[r.date].teal  = true;
      if (r.status === 'off')      map[r.date].gray  = true;
      map[r.date].count++;
    }
    return map;
  }, [monthRecords]);

  // ── Month summary stats ──────────────────────────────────────────────────
  const monthStats = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
    let notMarked = 0, off = 0, missed = 0, attended = 0, mixed = 0;
    let totalOff = 0, totalMissed = 0, totalAttended = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(y, m, day);
      const jsDay = date.getDay();
      const ourDay = jsDay === 0 ? 6 : jsDay - 1;
      const daySlots = slots.filter(s => s.day === ourDay);
      if (daySlots.length === 0) continue; // no class this day

      const dateStr = format(date, 'yyyy-MM-dd');
      const st = dateStatusMap[dateStr];

      if (!st) { notMarked++; continue; }

      // Determine if this is a timetable day
      const statuses = monthRecords.filter(r => r.date === dateStr).map(r => r.status);
      const unique = new Set(statuses.filter(s => s !== 'off'));
      totalOff     += statuses.filter(s => s === 'off').length;
      totalMissed  += statuses.filter(s => s === 'missed').length;
      totalAttended += statuses.filter(s => s === 'attended' || s === 'od').length;

      if (statuses.every(s => s === 'off')) { off++; }
      else if (statuses.every(s => s === 'missed')) { missed++; }
      else if (statuses.every(s => s === 'attended' || s === 'od')) { attended++; }
      else if (statuses.length > 0 && unique.size > 1) { mixed++; }
      else { notMarked++; }
    }

    return { notMarked, off, missed, attended, mixed, totalOff, totalMissed, totalAttended };
  }, [currentMonth, monthRecords, slots, dateStatusMap]);

  const openDay = async (date) => {
    const str = format(date, 'yyyy-MM-dd');
    const recs = await db.attendanceRecords.where('date').equals(str).toArray();
    setDayRecords(recs);
    setSelectedDate(date);
  };

  const handleMark = async (subjectId, status) => {
    const str = format(selectedDate, 'yyyy-MM-dd');
    await markAttendance(subjectId, str, status);
    const recs = await db.attendanceRecords.where('date').equals(str).toArray();
    setDayRecords(recs);
    await loadMonthData();
    addToast(`Marked ${status}`, status === 'attended' ? 'success' : status === 'missed' ? 'error' : 'info');
  };

  const dayRecMap = useMemo(() => Object.fromEntries(dayRecords.map(r => [r.subjectId, r.status])), [dayRecords]);
  const today = new Date();
  const HEADS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  return (
    <div className="page" style={{ paddingTop: 0 }}>
      <div className="page-top">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-sub">Tap any date to mark attendance</p>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between" style={{ marginBottom:14 }}>
        <button className="btn-icon" onClick={() => setCurrentMonth(subMonths(currentMonth,1))} id="prev-month">
          <ChevronLeft size={20}/>
        </button>
        <span style={{ fontWeight:800, fontSize:'1rem' }}>{format(currentMonth,'MMMM yyyy')}</span>
        <button className="btn-icon" onClick={() => setCurrentMonth(addMonths(currentMonth,1))} id="next-month">
          <ChevronRight size={20}/>
        </button>
      </div>

      {/* Calendar grid */}
      <div className="card-raised" style={{ padding:10, marginBottom:10 }}>
        <div className="cal-grid">
          {HEADS.map(h => <div key={h} className="cal-header">{h}</div>)}
          {calendarDays.map((day,i) => {
            const str = format(day,'yyyy-MM-dd');
            const st  = dateStatusMap[str] || {};
            const isToday   = isSameDay(day, today);
            const isCurr    = isSameMonth(day, currentMonth);
            return (
              <motion.button
                key={i}
                className={`cal-day ${isToday?'today':''} ${!isCurr?'other':''}`}
                onClick={() => isCurr && openDay(day)}
                whileTap={{ scale:0.85 }}
              >
                <span style={{ fontSize:'0.8125rem' }}>{format(day,'d')}</span>
                {isCurr && (st.green || st.red || st.gray || st.teal) && (
                  <div className="dots">
                    {st.green && <span className="dot dot-green"/>}
                    {st.teal  && <span className="dot dot-teal"/>}
                    {st.red   && <span className="dot dot-red"/>}
                    {st.gray  && <span className="dot dot-gray"/>}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-between" style={{ padding:'0 4px', marginBottom:12 }}>
        {[['dot-green','Attended'],['dot-teal','On Duty'],['dot-red','Missed'],['dot-gray','Off']].map(([cls,label]) => (
          <span key={cls} style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.625rem', color:'var(--text-2)' }}>
            <span className={`dot ${cls}`} style={{ width:7, height:7 }}/> {label}
          </span>
        ))}
      </div>

      {/* ── MONTH SUMMARY STATS (Ajack-style) ── */}
      <motion.div className="card-raised" style={{ marginBottom:12 }} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.05 }}>
        <div style={{ fontWeight:700, fontSize:'0.875rem', marginBottom:10 }}>
          {format(currentMonth,'MMMM')} Summary
        </div>

        {/* Day-level breakdown */}
        <div style={{ display:'flex', justifyContent:'space-around', marginBottom:12 }}>
          {[
            { val: monthStats.notMarked, label: 'Not marked', color: 'var(--text-3)' },
            { val: monthStats.off,       label: 'Off',        color: 'var(--gray)'   },
            { val: monthStats.missed,    label: 'Missed',     color: 'var(--red)'    },
            { val: monthStats.attended,  label: 'Attended',   color: 'var(--green)'  },
            { val: monthStats.mixed,     label: 'Mixed',      color: 'var(--orange)' },
          ].map(item => (
            <div key={item.label} style={{ textAlign:'center' }}>
              <div style={{ fontWeight:800, fontSize:'1.375rem', color: item.color, lineHeight:1 }}>
                {item.val}
              </div>
              <div style={{
                width:7, height:7, borderRadius:'50%', background: item.color,
                margin:'3px auto 3px'
              }}/>
              <div style={{ fontSize:'0.5625rem', color:'var(--text-2)', fontWeight:600 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Button to select "Days" breakdown */}
        <div style={{
          background:'var(--bg-alt)', borderRadius:8, padding:'8px 12px',
          display:'flex', justifyContent:'space-around', fontSize:'0.75rem', color:'var(--text-2)'
        }}>
          <span><b style={{ color:'var(--text)' }}>{monthStats.totalOff}</b> Off</span>
          <span><b style={{ color:'var(--red)' }}>{monthStats.totalMissed}</b> Missed</span>
          <span><b style={{ color:'var(--green)' }}>{monthStats.totalAttended}</b> Present</span>
          <span><b style={{ color:'var(--text)' }}>{monthStats.totalAttended + monthStats.totalMissed}</b> Total</span>
          <span><b style={{ color:'var(--primary)' }}>
            {(monthStats.totalAttended + monthStats.totalMissed) > 0
              ? ((monthStats.totalAttended / (monthStats.totalAttended + monthStats.totalMissed))*100).toFixed(1)
              : '0.0'}%
          </b></span>
        </div>
      </motion.div>

      {/* Day detail modal */}
      <Modal isOpen={!!selectedDate} onClose={() => setSelectedDate(null)}
        title={selectedDate ? format(selectedDate,'EEEE, MMMM d') : ''}>
        {selectedDate && (
          <div>
            {subjects.length > 0 ? subjects.map((sub, i) => (
              <div key={sub.id} style={{
                display:'flex', alignItems:'center', gap:10, padding:'11px 0',
                borderBottom: i < subjects.length-1 ? '1px solid var(--border-2)' : 'none'
              }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:sub.color, flexShrink:0 }}/>
                <span style={{ flex:1, fontWeight:600, fontSize:'0.875rem' }}>{sub.name}</span>
                {dayRecMap[sub.id] && (
                  <span className={`badge ${
                    dayRecMap[sub.id]==='attended' ? 'badge-green'
                    : dayRecMap[sub.id]==='od'     ? 'badge-od'
                    : dayRecMap[sub.id]==='missed' ? 'badge-red'
                    : 'badge-gray'
                  }`}>
                    {dayRecMap[sub.id]==='attended' ? '✓'
                      : dayRecMap[sub.id]==='od'   ? 'OD'
                      : dayRecMap[sub.id]==='missed' ? '✗' : '—'}
                  </span>
                )}
                <div className="mark-group">
                  <button className={`mark-btn ${dayRecMap[sub.id]==='attended'?'attended':''}`}
                    onClick={() => handleMark(sub.id,'attended')} title="Present">
                    <Check size={13} strokeWidth={2.5}/>
                  </button>
                  <button className={`mark-btn ${dayRecMap[sub.id]==='od'?'od':''}`}
                    onClick={() => handleMark(sub.id,'od')} title="On Duty"
                    style={{ fontSize:'0.5625rem', fontWeight:800 }}>
                    OD
                  </button>
                  <button className={`mark-btn ${dayRecMap[sub.id]==='missed'?'missed':''}`}
                    onClick={() => handleMark(sub.id,'missed')} title="Absent">
                    <X size={13} strokeWidth={2.5}/>
                  </button>
                  <button className={`mark-btn ${dayRecMap[sub.id]==='off'?'off':''}`}
                    onClick={() => handleMark(sub.id,'off')} title="Cancelled">
                    <Minus size={13} strokeWidth={2.5}/>
                  </button>
                </div>
              </div>
            )) : (
              <p style={{ textAlign:'center', color:'var(--text-2)', padding:20, fontSize:'0.875rem' }}>
                No subjects added yet
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
