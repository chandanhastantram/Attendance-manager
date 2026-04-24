import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit3, MoreVertical, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import useSubjectStore from '../stores/useSubjectStore.js';
import useSettingsStore from '../stores/useSettingsStore.js';
import useTimetableStore from '../stores/useTimetableStore.js';
import useToastStore from '../stores/useToastStore.js';
import Modal from '../components/common/Modal.jsx';
import SubjectForm from '../components/subject/SubjectForm.jsx';
import { calcInsight, calcFutureProjection } from '../utils/attendance.js';
import db from '../db/database.js';

export default function SubjectsPage() {
  const subjects     = useSubjectStore(s => s.subjects);
  const loadSubjects = useSubjectStore(s => s.loadSubjects);
  const deleteSubject = useSubjectStore(s => s.deleteSubject);
  const slots        = useTimetableStore(s => s.slots);
  const loadSlots    = useTimetableStore(s => s.loadSlots);
  const settings     = useSettingsStore(s => s.settings);
  const addToast     = useToastStore(s => s.addToast);

  const [showForm,    setShowForm]    = useState(false);
  const [editSubject, setEditSubject] = useState(null);
  const [stats,       setStats]       = useState({});
  const [menuOpen,    setMenuOpen]    = useState(null);
  const [expanded,    setExpanded]    = useState(null);
  const [allRecords,  setAllRecords]  = useState([]);

  useEffect(() => { loadSubjects(); loadSlots(); }, []);

  useEffect(() => {
    const loadStats = async () => {
      const allRec = await db.attendanceRecords.toArray();
      setAllRecords(allRec);
      const map = {};
      for (const s of subjects) {
        const recs     = allRec.filter(r => r.subjectId === s.id);
        const attended = recs.filter(r => r.status === 'attended').length;
        const od       = recs.filter(r => r.status === 'od').length;
        const missed   = recs.filter(r => r.status === 'missed').length;
        const off      = recs.filter(r => r.status === 'off').length;
        const criteria = s.criteria || settings.globalCriteria;
        map[s.id] = { ...calcInsight(attended, od, missed, criteria), off, criteria };
      }
      setStats(map);
    };
    if (subjects.length) loadStats();
    else setStats({});
  }, [subjects, settings.globalCriteria]);

  // Future projections
  const futureProjections = useMemo(() => {
    if (!settings.semesterEndDate || subjects.length === 0) return {};
    return calcFutureProjection(subjects, slots, allRecords, settings.semesterEndDate, settings.globalCriteria);
  }, [subjects, slots, allRecords, settings.semesterEndDate, settings.globalCriteria]);

  // Overall stats
  const overall = useMemo(() => {
    const vals = Object.values(stats);
    if (!vals.length) return null;
    const totAtt = vals.reduce((a, s) => a + (s.effectiveAttended || 0), 0);
    const totMis = vals.reduce((a, s) => a + (s.missed || 0), 0);
    const total  = totAtt + totMis;
    const pct    = total > 0 ? ((totAtt / total) * 100).toFixed(2) : '0.00';
    const criteria = settings.globalCriteria;
    const canBunk  = vals.reduce((a, s) => a + (s.canBunk || 0), 0);
    const needAttend = vals.reduce((a, s) => a + (s.needAttend || 0), 0);
    return { pct, totAtt, totMis, total, canBunk, needAttend, criteria };
  }, [stats, settings.globalCriteria]);

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}" and all its records? This cannot be undone.`)) return;
    await deleteSubject(id);
    addToast(`${name} deleted`, 'info');
    setMenuOpen(null);
  };

  return (
    <div className="page" style={{ paddingTop: 0 }}>
      <div className="page-top">
        <div>
          <h1 className="page-title">Subjects</h1>
          <p className="page-sub">{subjects.length} subject{subjects.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* ── OVERALL SUMMARY (Ajack style) ── */}
      {overall && (
        <motion.div className="card-raised mb-3" initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}>
          {/* Big pill: overall% | criteria */}
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{
              background: parseFloat(overall.pct) >= overall.criteria ? 'var(--green-bg)' : 'var(--red-bg)',
              borderRadius: 12, padding: '10px 16px', textAlign:'center', flexShrink:0
            }}>
              <div style={{
                fontWeight:800, fontSize:'1.5rem', lineHeight:1,
                color: parseFloat(overall.pct) >= overall.criteria ? 'var(--green)' : 'var(--red)'
              }}>{overall.pct}</div>
              <div style={{ width:'100%', height:1, background:'var(--border)', margin:'4px 0' }}/>
              <div style={{ fontWeight:700, fontSize:'0.75rem', color:'var(--text-2)' }}>{overall.criteria}</div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:'0.9375rem', marginBottom:2 }}>Overall</div>
              <div style={{ fontSize:'0.75rem', color:'var(--text-2)' }}>
                {parseFloat(overall.pct) >= overall.criteria
                  ? `can miss ${overall.canBunk} more lectures`
                  : `attend ${overall.needAttend} more to recover`}
              </div>
              <div style={{ fontSize:'0.6875rem', color:'var(--text-3)', marginTop:3 }}>
                Att: {overall.totAtt} &nbsp;Miss: {overall.totMis} &nbsp;Tot: {overall.total}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── SUBJECT CARDS ── */}
      <AnimatePresence>
        {subjects.length > 0 ? subjects.map((sub, i) => {
          const s = stats[sub.id] || {};
          const fp = futureProjections[sub.id];
          const isExpanded = expanded === sub.id;
          const pctColor = s.status === 'safe' || s.status === 'ok' ? 'var(--green)'
            : s.status === 'warning' ? 'var(--orange)' : s.total === 0 ? 'var(--text-3)' : 'var(--red)';

          return (
            <motion.div
              key={sub.id}
              className="subject-card mb-3"
              initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
              transition={{ delay: i * 0.04 }} layout
            >
              {/* Color accent bar */}
              <div className="subject-accent-bar" style={{ background: sub.color }}/>

              <div className="subject-body">
                {/* ── Main row (Ajack-style) ── */}
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  {/* Percentage / Criteria block */}
                  <div style={{
                    minWidth: 52, textAlign:'center',
                    background: 'var(--bg-alt)', borderRadius: 12, padding: '8px 10px',
                    border: `1.5px solid ${sub.color}44`
                  }}>
                    <div style={{ fontWeight:800, fontSize:'1.125rem', lineHeight:1, color: pctColor }}>
                      {(s.percentage || 0).toFixed ? (s.percentage || 0) : 0}
                    </div>
                    <div style={{ width:'100%', height:1, background:'var(--border)', margin:'3px 0' }}/>
                    <div style={{ fontWeight:700, fontSize:'0.625rem', color:'var(--text-3)' }}>
                      {s.criteria || settings.globalCriteria}
                    </div>
                  </div>

                  {/* Name + insight + stats */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:'0.9375rem' }} className="truncate">{sub.name}</div>
                    {s.total > 0 ? (
                      <>
                        <div style={{ fontSize:'0.75rem', color: pctColor, fontWeight:600, marginTop:1 }}>
                          {s.status === 'safe' || s.status === 'ok'
                            ? `can miss ${s.canBunk} lecture${s.canBunk !== 1 ? 's' : ''}`
                            : s.status === 'warning'
                            ? `attend ${s.needAttend} more to be safe`
                            : `🚨 attend ${s.needAttend} urgently!`}
                        </div>
                        <div style={{ fontSize:'0.6875rem', color:'var(--text-3)', marginTop:2 }}>
                          Att: {s.attended}{s.od > 0 ? `+${s.od}OD` : ''} &nbsp;
                          Miss: {s.missed} &nbsp;
                          Off: {s.off || 0} &nbsp;
                          Tot: {s.total}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize:'0.75rem', color:'var(--text-3)', marginTop:2 }}>
                        No attendance marked yet
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display:'flex', gap:2, flexShrink:0 }}>
                    <button className="btn-icon" onClick={() => setExpanded(isExpanded ? null : sub.id)}>
                      {isExpanded ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}
                    </button>
                    <div style={{ position:'relative' }}>
                      <button className="btn-icon" onClick={() => setMenuOpen(menuOpen === sub.id ? null : sub.id)}>
                        <MoreVertical size={17}/>
                      </button>
                      {menuOpen === sub.id && (
                        <>
                          <div style={{ position:'fixed', inset:0, zIndex:9 }} onClick={() => setMenuOpen(null)}/>
                          <motion.div
                            initial={{ opacity:0, scale:0.9, y:-4 }} animate={{ opacity:1, scale:1, y:0 }}
                            style={{
                              position:'absolute', right:0, top:'100%', zIndex:10,
                              background:'var(--surface)', borderRadius:'var(--radius-m)',
                              boxShadow:'var(--shadow-l)', border:'1px solid var(--border)',
                              overflow:'hidden', minWidth:130
                            }}
                          >
                            <button style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', width:'100%', fontSize:'0.8125rem', color:'var(--text)' }}
                              onClick={() => { setEditSubject(sub); setShowForm(true); setMenuOpen(null); }}>
                              <Edit3 size={14}/> Edit
                            </button>
                            <button style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', width:'100%', fontSize:'0.8125rem', color:'var(--red)' }}
                              onClick={() => handleDelete(sub.id, sub.name)}>
                              <Trash2 size={14}/> Delete
                            </button>
                          </motion.div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                {s.total > 0 && (
                  <div className="pbar-wrap" style={{ marginTop:10, height:5 }}>
                    <div className="pbar-fill" style={{ width:`${s.percentage}%`, background: sub.color }}/>
                  </div>
                )}

                {/* ── EXPANDED DETAIL ── */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }}
                      exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }}
                      style={{ overflow:'hidden' }}
                    >
                      <div className="divider" style={{ marginTop:10 }}/>

                      {/* Stats grid */}
                      <div className="stats-row" style={{ marginTop:8 }}>
                        <div className="stat-box">
                          <div className="stat-num" style={{ color:'var(--green)' }}>{s.attended || 0}</div>
                          <div className="stat-lbl">Present</div>
                        </div>
                        {(s.od || 0) > 0 && (
                          <div className="stat-box">
                            <div className="stat-num" style={{ color:'#0E7490' }}>{s.od}</div>
                            <div className="stat-lbl">On Duty</div>
                          </div>
                        )}
                        <div className="stat-box">
                          <div className="stat-num" style={{ color:'var(--red)' }}>{s.missed || 0}</div>
                          <div className="stat-lbl">Missed</div>
                        </div>
                        <div className="stat-box">
                          <div className="stat-num" style={{ color:'var(--gray)' }}>{s.off || 0}</div>
                          <div className="stat-lbl">Off</div>
                        </div>
                        <div className="stat-box">
                          <div className="stat-num">{s.percentage || 0}%</div>
                          <div className="stat-lbl">Score</div>
                        </div>
                      </div>

                      {/* Future Projection */}
                      {fp && fp.remaining > 0 && (
                        <div style={{
                          marginTop:10, background:'var(--bg-alt)', borderRadius:10, padding:'10px 12px'
                        }}>
                          <div style={{ fontWeight:700, fontSize:'0.8125rem', marginBottom:6, color:'var(--accent)' }}>
                            📅 Semester Forecast
                          </div>
                          <div style={{ display:'flex', gap:8 }}>
                            <div className="stat-box" style={{ flex:1 }}>
                              <div className="stat-num">{fp.remaining}</div>
                              <div className="stat-lbl">Remaining</div>
                            </div>
                            <div className="stat-box" style={{ flex:1 }}>
                              <div className="stat-num" style={{ color:'var(--red)' }}>{fp.mustAttend}</div>
                              <div className="stat-lbl">Must Attend</div>
                            </div>
                            <div className="stat-box" style={{ flex:1 }}>
                              <div className="stat-num" style={{ color:'var(--green)' }}>{fp.canSkip}</div>
                              <div className="stat-lbl">Can Skip</div>
                            </div>
                          </div>
                          {!fp.isAchievable && (
                            <div style={{ marginTop:8, fontSize:'0.75rem', color:'var(--red)', fontWeight:600 }}>
                              ⚠️ Even attending all remaining classes, {settings.globalCriteria}% may not be reachable.
                            </div>
                          )}
                        </div>
                      )}
                      {!settings.semesterEndDate && (
                        <div style={{ fontSize:'0.6875rem', color:'var(--text-3)', textAlign:'center', marginTop:8 }}>
                          Set semester end date in Settings to see forecasts
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        }) : (
          <div className="empty">
            <div className="empty-icon"><BookOpen size={32}/></div>
            <div className="empty-title">No subjects yet</div>
            <div className="empty-desc">Tap the + button to add your first subject and start tracking</div>
          </div>
        )}
      </AnimatePresence>

      <motion.button className="fab" onClick={() => { setEditSubject(null); setShowForm(true); }}
        whileTap={{ scale:0.9 }} id="fab-add-subject">
        <Plus size={24}/>
      </motion.button>

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditSubject(null); }}
        title={editSubject ? 'Edit Subject' : 'New Subject'}>
        <SubjectForm subject={editSubject} onClose={() => { setShowForm(false); setEditSubject(null); }}/>
      </Modal>
    </div>
  );
}
