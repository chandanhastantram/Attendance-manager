import React, { useEffect, useState, useMemo } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, X, Minus, BookOpen, ShieldCheck, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import useSubjectStore from '../stores/useSubjectStore.js';
import useTimetableStore from '../stores/useTimetableStore.js';
import useAttendanceStore from '../stores/useAttendanceStore.js';
import useSettingsStore from '../stores/useSettingsStore.js';
import useToastStore from '../stores/useToastStore.js';
import Modal from '../components/common/Modal.jsx';
import SubjectForm from '../components/subject/SubjectForm.jsx';
import TimetableForm from '../components/timetable/TimetableForm.jsx';
import { greeting, fmt12, todayDayIndex, calcInsight, calcFutureProjection } from '../utils/attendance.js';
import db from '../db/database.js';

function OverallRing({ pct, criteria }) {
  const size = 72, sw = 6;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= criteria ? 'var(--green)' : pct >= criteria - 15 ? 'var(--orange)' : 'var(--red)';
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border-2)" strokeWidth={sw}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.23,1,.32,1)' }}/>
      </svg>
      <div className="ring-label" style={{ fontSize: 13, fontWeight: 800 }}>
        <div>{pct}%</div>
        <div style={{ fontSize: 8, fontWeight: 600, color: 'var(--text-2)', marginTop: -1 }}>overall</div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const subjects      = useSubjectStore(s => s.subjects);
  const loadSubjects  = useSubjectStore(s => s.loadSubjects);
  const slots         = useTimetableStore(s => s.slots);
  const loadSlots     = useTimetableStore(s => s.loadSlots);
  const todayRecords  = useAttendanceStore(s => s.todayRecords);
  const loadToday     = useAttendanceStore(s => s.loadTodayRecords);
  const markAttendance = useAttendanceStore(s => s.markAttendance);
  const settings      = useSettingsStore(s => s.settings);
  const addToast      = useToastStore(s => s.addToast);

  const [showAddSubject, setShowAddSubject] = useState(false);
  const [showAddSlot,    setShowAddSlot]    = useState(false);
  const [overall, setOverall] = useState({ attended: 0, od: 0, missed: 0, effectiveAtt: 0, pct: 0 });
  const [allRecords, setAllRecords] = useState([]);
  const [dayStatus, setDayStatus] = useState('Not marked'); // 'Not marked' | 'attended' | 'missed' | 'od' | 'off' | 'Mixed'

  const today    = format(new Date(), 'yyyy-MM-dd');
  const dayIndex = todayDayIndex();

  useEffect(() => { loadSubjects(); loadSlots(); loadToday(); }, []);

  useEffect(() => {
    const calc = async () => {
      const all = await db.attendanceRecords.toArray();
      setAllRecords(all);
      const att  = all.filter(r => r.status === 'attended').length;
      const od   = all.filter(r => r.status === 'od').length;
      const mis  = all.filter(r => r.status === 'missed').length;
      const effectiveAtt = att + od;
      const total = effectiveAtt + mis;
      setOverall({ attended: att, od, missed: mis, effectiveAtt, pct: total > 0 ? Math.round((effectiveAtt/total)*100) : 0 });
    };
    calc();
  }, [todayRecords]);

  const todaySlots = useMemo(() =>
    slots.filter(s => s.day === dayIndex).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [slots, dayIndex]
  );
  const subMap  = useMemo(() => Object.fromEntries(subjects.map(s => [s.id, s])), [subjects]);
  const recMap  = useMemo(() => Object.fromEntries(todayRecords.map(r => [r.subjectId, r.status])), [todayRecords]);

  // Compute day status
  useEffect(() => {
    if (todaySlots.length === 0) { setDayStatus('Not marked'); return; }
    const marked = todaySlots.map(s => recMap[s.subjectId]).filter(Boolean);
    if (marked.length === 0) { setDayStatus('Not marked'); return; }
    const statuses = new Set(marked);
    if (statuses.size === 1) setDayStatus([...statuses][0]);
    else setDayStatus('Mixed');
  }, [todaySlots, recMap]);

  // Future projections
  const futureProjections = useMemo(() => {
    if (!settings.semesterEndDate) return {};
    return calcFutureProjection(subjects, slots, allRecords, settings.semesterEndDate, settings.globalCriteria);
  }, [subjects, slots, allRecords, settings.semesterEndDate, settings.globalCriteria]);

  const hasFuture = Object.keys(futureProjections).length > 0;

  const handleMark = async (subjectId, status) => {
    await markAttendance(subjectId, today, status);
    const sub = subMap[subjectId];
    const labels = { attended: '✓ Present', missed: '✗ Absent', od: '🏫 On Duty', off: '— Cancelled' };
    const types  = { attended: 'success', missed: 'error', od: 'info', off: 'info' };
    addToast(`${sub?.name}: ${labels[status]}`, types[status]);
  };

  const handleMarkFullDay = async (status) => {
    for (const slot of todaySlots) {
      await markAttendance(slot.subjectId, today, status, false);
    }
    addToast(`All ${todaySlots.length} classes → ${status}`, status === 'attended' ? 'success' : 'info');
  };

  const criteriaOk = overall.pct >= settings.globalCriteria;
  const ins = calcInsight(overall.attended, overall.od, overall.missed, settings.globalCriteria);

  const dayStatusColor = dayStatus === 'attended' ? 'var(--green)' : dayStatus === 'missed' ? 'var(--red)'
    : dayStatus === 'od' ? '#0E7490' : dayStatus === 'Mixed' ? 'var(--orange)' : 'var(--text-3)';

  return (
    <div className="page" style={{ paddingTop: 0 }}>
      {/* ── HEADER ── */}
      <motion.div className="page-top" initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}>
        <div>
          <div style={{ fontSize:'0.8125rem', color:'var(--text-2)', fontWeight:500 }}>{greeting()} 👋</div>
          <h1 className="page-title">{format(new Date(),'EEE, d MMM')}</h1>
          <p className="page-sub">{format(new Date(),'yyyy')}</p>
        </div>
        {overall.pct > 0 && <OverallRing pct={overall.pct} criteria={settings.globalCriteria} />}
      </motion.div>

      {/* ── OVERALL INSIGHT BAR ── */}
      {overall.effectiveAtt + overall.missed > 0 && (
        <motion.div className="card-raised mb-3" initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.05 }}>
          <div className="flex items-center justify-between">
            <div style={{ fontSize:'0.8125rem', fontWeight:600 }}>Overall</div>
            <span className={`badge ${criteriaOk ? 'badge-green' : 'badge-red'}`}>
              {criteriaOk
                ? ins.canBunk > 0 ? `Can miss ${ins.canBunk} more` : '✓ On track'
                : `Need ${ins.needAttend} more`}
            </span>
          </div>
          <div className="pbar-wrap" style={{ marginTop:8 }}>
            <div className="pbar-fill" style={{
              width: `${ins.percentage}%`,
              background: criteriaOk ? 'var(--green)' : ins.status === 'warning' ? 'var(--orange)' : 'var(--red)'
            }}/>
          </div>
          <div className="flex justify-between" style={{ marginTop:5, fontSize:'0.6875rem', color:'var(--text-2)' }}>
            <span>
              {overall.effectiveAtt} present{overall.od > 0 ? ` (${overall.od} OD)` : ''} · {overall.missed} missed
            </span>
            <span style={{ fontWeight:700 }}>{ins.percentage}%</span>
          </div>
        </motion.div>
      )}

      {/* ── DAY STATUS BAR (Ajack-style) ── */}
      {todaySlots.length > 0 && (
        <motion.div
          className="card-raised mb-3"
          style={{ padding: '12px 14px' }}
          initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.08 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div style={{ fontSize:'0.6875rem', color:'var(--text-2)', fontWeight:600, marginBottom:2 }}>Day status</div>
              <div style={{ fontWeight:700, fontSize:'0.875rem', color: dayStatusColor }}>
                {dayStatus === 'attended' ? '✓ All Present'
                  : dayStatus === 'missed' ? '✗ All Absent'
                  : dayStatus === 'od'     ? '🏫 All On Duty'
                  : dayStatus === 'off'    ? '— All Cancelled'
                  : dayStatus === 'Mixed'  ? '◑ Partial'
                  : 'Not marked'}
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button
                className="mark-btn" onClick={() => handleMarkFullDay('off')}
                title="Mark all cancelled" style={{ width:36, height:36 }}
              >
                <Minus size={14}/>
              </button>
              <button
                className={`mark-btn ${dayStatus==='missed'?'missed':''}`}
                onClick={() => handleMarkFullDay('missed')}
                title="All absent" style={{ width:36, height:36 }}
              >
                <X size={14}/>
              </button>
              <button
                className={`mark-btn ${dayStatus==='od'?'od':''}`}
                onClick={() => handleMarkFullDay('od')}
                title="All on duty" style={{ width:36, height:36, fontSize:'0.5625rem', fontWeight:800 }}
              >
                OD
              </button>
              <button
                className={`mark-btn ${dayStatus==='attended'?'attended':''}`}
                onClick={() => handleMarkFullDay('attended')}
                title="All present" style={{ width:36, height:36 }}
              >
                <Check size={14}/>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── TODAY'S LECTURES HEADER ── */}
      <div className="flex items-center justify-between mb-2">
        <h2 style={{ fontSize:'0.9375rem', fontWeight:700 }}>
          Today's Classes <span style={{ color:'var(--text-3)', fontWeight:500, fontSize:'0.8125rem' }}>({todaySlots.length})</span>
        </h2>
      </div>

      {/* ── LECTURE CARDS ── */}
      <AnimatePresence>
        {todaySlots.length > 0 ? (
          todaySlots.map((slot, i) => {
            const sub    = subMap[slot.subjectId];
            const status = recMap[slot.subjectId] || null;
            const subRecs = allRecords.filter(r => r.subjectId === slot.subjectId);
            const att  = subRecs.filter(r => r.status === 'attended').length;
            const od   = subRecs.filter(r => r.status === 'od').length;
            const mis  = subRecs.filter(r => r.status === 'missed').length;
            const subCriteria = sub?.criteria || settings.globalCriteria;
            const subIns = calcInsight(att, od, mis, subCriteria);

            return (
              <motion.div
                key={slot.id}
                className="card"
                style={{
                  marginBottom: 10,
                  borderLeft: `4px solid ${sub?.color || 'var(--primary)'}`,
                  padding: '0',
                  overflow: 'hidden',
                }}
                initial={{ opacity:0, x:-10 }}
                animate={{ opacity:1, x:0 }}
                transition={{ delay: i*0.04 }}
                layout
              >
                {/* Top row */}
                <div style={{ padding: '12px 14px 8px', display:'flex', alignItems:'center', gap:12 }}>
                  {/* Left: percentage block like Ajack */}
                  <div style={{
                    minWidth: 44, textAlign:'center',
                    background: 'var(--bg-alt)', borderRadius: 10, padding: '6px 8px'
                  }}>
                    <div style={{
                      fontWeight:800, fontSize:'1rem', lineHeight:1,
                      color: subIns.status === 'safe' || subIns.status === 'ok' ? 'var(--green)'
                        : subIns.status === 'warning' ? 'var(--orange)' : subIns.total === 0 ? 'var(--text-2)' : 'var(--red)'
                    }}>
                      {subIns.percentage}
                    </div>
                    <div style={{ width:'100%', height:1, background:'var(--border)', margin:'3px 0' }}/>
                    <div style={{ fontWeight:600, fontSize:'0.625rem', color:'var(--text-3)' }}>{subCriteria}</div>
                  </div>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:'0.9375rem' }} className="truncate">
                      {sub?.name || 'Unknown'}
                    </div>
                    <div style={{ fontSize:'0.6875rem', color:'var(--text-2)', marginTop:2 }}>
                      {fmt12(slot.startTime)} – {fmt12(slot.endTime)}{slot.room ? ` · ${slot.room}` : ''}
                    </div>
                    {subIns.total > 0 && (
                      <div style={{ fontSize:'0.6875rem', color:'var(--text-3)', marginTop:2 }}>
                        {subIns.status === 'safe' || subIns.status === 'ok'
                          ? `can miss ${subIns.canBunk} more`
                          : `must attend ${subIns.needAttend} more`}
                      </div>
                    )}
                  </div>

                  {status && (
                    <span className={`badge ${
                      status === 'attended' ? 'badge-green'
                      : status === 'od'     ? 'badge-od'
                      : status === 'missed' ? 'badge-red'
                      : 'badge-gray'
                    }`} style={{ flexShrink: 0 }}>
                      {status === 'attended' ? '✓' : status === 'od' ? 'OD' : status === 'missed' ? '✗' : '—'}
                    </span>
                  )}
                </div>

                {/* Mark buttons row */}
                <div style={{
                  display:'flex', justifyContent:'flex-end', gap:6,
                  padding: '0 14px 12px', borderTop:'1px solid var(--border-2)', paddingTop: 8
                }}>
                  <motion.button className={`mark-btn ${status === 'attended' ? 'attended' : ''}`}
                    onClick={() => handleMark(slot.subjectId, 'attended')}
                    whileTap={{ scale:0.82 }} title="Present" id={`att-${slot.id}`}>
                    <Check size={15} strokeWidth={2.5}/>
                  </motion.button>
                  <motion.button className={`mark-btn ${status === 'od' ? 'od' : ''}`}
                    onClick={() => handleMark(slot.subjectId, 'od')}
                    whileTap={{ scale:0.82 }} title="On Duty" id={`od-${slot.id}`}
                    style={{ fontSize:'0.5625rem', fontWeight:800 }}>
                    OD
                  </motion.button>
                  <motion.button className={`mark-btn ${status === 'missed' ? 'missed' : ''}`}
                    onClick={() => handleMark(slot.subjectId, 'missed')}
                    whileTap={{ scale:0.82 }} title="Absent" id={`miss-${slot.id}`}>
                    <X size={15} strokeWidth={2.5}/>
                  </motion.button>
                  <motion.button className={`mark-btn ${status === 'off' ? 'off' : ''}`}
                    onClick={() => handleMark(slot.subjectId, 'off')}
                    whileTap={{ scale:0.82 }} title="Cancelled" id={`off-${slot.id}`}>
                    <Minus size={14} strokeWidth={2.5}/>
                  </motion.button>
                </div>
              </motion.div>
            );
          })
        ) : subjects.length === 0 ? (
          <motion.div className="empty" initial={{ opacity:0 }} animate={{ opacity:1 }}>
            <div className="empty-icon"><BookOpen size={32}/></div>
            <div className="empty-title">Welcome to Vorn!</div>
            <div className="empty-desc">Add your subjects then set up your timetable to start tracking.</div>
            <button className="btn btn-primary" style={{ marginTop:18 }} onClick={() => setShowAddSubject(true)}>
              <Plus size={16}/> Add First Subject
            </button>
          </motion.div>
        ) : slots.length === 0 ? (
          <motion.div className="empty" initial={{ opacity:0 }} animate={{ opacity:1 }}>
            <div className="empty-icon" style={{ background:'var(--primary-bg)', color:'var(--primary)', fontSize:32 }}>📅</div>
            <div className="empty-title">Set up your timetable</div>
            <div className="empty-desc">Go to Timetable tab to import or add your weekly schedule.</div>
          </motion.div>
        ) : (
          <motion.div className="empty" initial={{ opacity:0 }} animate={{ opacity:1 }}>
            <div className="empty-icon" style={{ fontSize:36 }}>🎉</div>
            <div className="empty-title">No classes today!</div>
            <div className="empty-desc">Enjoy your free day.</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FUTURE PROJECTION CARD ── */}
      {hasFuture && subjects.length > 0 && (
        <motion.div
          className="card-raised"
          style={{ marginTop: 14, borderTop: '3px solid var(--accent)' }}
          initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
        >
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <Calendar size={16} color="var(--accent)" />
            <div style={{ fontWeight:700, fontSize:'0.9375rem' }}>Semester Forecast</div>
            <span style={{ fontSize:'0.6875rem', color:'var(--text-2)' }}>
              until {settings.semesterEndDate}
            </span>
          </div>
          {subjects.map(sub => {
            const fp = futureProjections[sub.id];
            if (!fp || fp.remaining === 0) return null;
            return (
              <div key={sub.id} style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'9px 0', borderBottom:'1px solid var(--border-2)'
              }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:sub.color, flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:'0.8125rem' }} className="truncate">{sub.name}</div>
                  <div style={{ fontSize:'0.6875rem', color:'var(--text-2)' }}>
                    {fp.remaining} classes remaining
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  {fp.isAchievable ? (
                    <>
                      <div style={{ color:'var(--green)', fontSize:'0.75rem', fontWeight:700 }}>
                        Can skip {fp.canSkip}
                      </div>
                      <div style={{ color:'var(--text-3)', fontSize:'0.625rem' }}>
                        Must attend {fp.mustAttend}
                      </div>
                    </>
                  ) : (
                    <div style={{ color:'var(--red)', fontSize:'0.75rem', fontWeight:700 }}>
                      ⚠️ Criteria unreachable
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {!settings.semesterEndDate && (
            <div style={{ fontSize:'0.75rem', color:'var(--text-2)', textAlign:'center', padding:'8px 0' }}>
              Set semester end date in Settings to see forecasts.
            </div>
          )}
        </motion.div>
      )}

      {/* ── ADD EXTRA CLASS ── */}
      {subjects.length > 0 && (
        <button className="btn btn-secondary w-full" style={{ marginTop:14, marginBottom:8 }}
          onClick={() => setShowAddSlot(true)} id="add-extra-btn">
          <Plus size={15}/> Add Extra / Make-up Class Today
        </button>
      )}

      {/* ── FAB ── */}
      {subjects.length > 0 && (
        <motion.button className="fab" onClick={() => setShowAddSubject(true)} whileTap={{ scale:0.9 }} id="fab-subject">
          <Plus size={24}/>
        </motion.button>
      )}

      <Modal isOpen={showAddSubject} onClose={() => setShowAddSubject(false)} title="Add Subject">
        <SubjectForm onClose={() => setShowAddSubject(false)}/>
      </Modal>
      <Modal isOpen={showAddSlot} onClose={() => setShowAddSlot(false)} title="Add Class Slot">
        <TimetableForm onClose={() => setShowAddSlot(false)}/>
      </Modal>
    </div>
  );
}
