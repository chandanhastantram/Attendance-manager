import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { FileJson, FileSpreadsheet, Upload, BarChart3 } from 'lucide-react';
import useSubjectStore from '../stores/useSubjectStore.js';
import useSettingsStore from '../stores/useSettingsStore.js';
import useToastStore from '../stores/useToastStore.js';
import { calcInsight } from '../utils/attendance.js';
import { exportJSON, importJSON, exportCSV } from '../utils/exportUtils.js';
import db from '../db/database.js';

function OverallRing({ pct, size=80, sw=7 }) {
  const r = (size-sw)/2, circ = 2*Math.PI*r;
  const offset = circ - (pct/100)*circ;
  const color = pct >= 75 ? 'var(--green)' : pct >= 60 ? 'var(--orange)' : 'var(--red)';
  return (
    <div className="ring-wrap" style={{ width:size, height:size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border-2)" strokeWidth={sw}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition:'stroke-dashoffset .7s cubic-bezier(.23,1,.32,1)' }}/>
      </svg>
      <div className="ring-label" style={{ fontSize:16, fontWeight:800 }}>{pct}%</div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px', fontSize:12, boxShadow:'var(--shadow-m)' }}>
      <div style={{ fontWeight:700, marginBottom:4 }}>{d.fullName}</div>
      <div style={{ color:'var(--green)' }}>Attended: {d.attended}</div>
      <div style={{ color:'var(--red)' }}>Missed: {d.missed}</div>
      <div style={{ fontWeight:700, marginTop:4 }}>{d.pct}%</div>
    </div>
  );
};

export default function ReportsPage() {
  const subjects    = useSubjectStore(s => s.subjects);
  const loadSubjects = useSubjectStore(s => s.loadSubjects);
  const settings    = useSettingsStore(s => s.settings);
  const addToast    = useToastStore(s => s.addToast);

  const [subStats, setSubStats]   = useState([]);
  const [overall, setOverall]     = useState({ att:0, mis:0, off:0, pct:0 });

  useEffect(() => { loadSubjects(); }, []);

  useEffect(() => {
    const calc = async () => {
      const allRec = await db.attendanceRecords.toArray();
      let ta=0,tod=0,tm=0,toff=0;
      const stats = subjects.map(sub => {
        const recs = allRec.filter(r => r.subjectId===sub.id);
        const att  = recs.filter(r => r.status==='attended').length;
        const od   = recs.filter(r => r.status==='od').length;
        const mis  = recs.filter(r => r.status==='missed').length;
        const off  = recs.filter(r => r.status==='off').length;
        const criteria = sub.criteria || settings.globalCriteria;
        const ins  = calcInsight(att, od, mis, criteria);
        ta+=att; tod+=od; tm+=mis; toff+=off;
        return { name:sub.shortName||sub.name.substring(0,5), fullName:sub.name, attended:att, od, missed:mis, off, pct:ins.percentage, color:sub.color, ...ins, criteria };
      });
      setSubStats(stats);
      const t=ta+tod+tm;
      setOverall({ att:ta, od:tod, mis:tm, off:toff, pct:t>0?Math.round(((ta+tod)/t)*100):0 });
    };
    if (subjects.length) calc();
  }, [subjects, settings.globalCriteria]);

  const dangerous = subStats.filter(s => s.status==='danger' || s.status==='warning');

  return (
    <div className="page">
      <div className="page-top">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-sub">Attendance analytics</p>
        </div>
      </div>

      {/* Overall card */}
      <motion.div className="card-raised" style={{ marginBottom:12, textAlign:'center' }} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }}>
        <div style={{ display:'flex', justifyContent:'center', marginBottom:10 }}>
          <OverallRing pct={overall.pct}/>
        </div>
        <div style={{ fontWeight:800, fontSize:'0.9375rem' }}>Overall Attendance</div>
        <div className="stats-row" style={{ marginTop:10 }}>
          <div className="stat-box"><div className="stat-num" style={{ color:'var(--green)' }}>{overall.att}</div><div className="stat-lbl">Present</div></div>
          {overall.od > 0 && (
            <div className="stat-box"><div className="stat-num" style={{ color:'#0E7490' }}>{overall.od}</div><div className="stat-lbl">On Duty</div></div>
          )}
          <div className="stat-box"><div className="stat-num" style={{ color:'var(--red)' }}>{overall.mis}</div><div className="stat-lbl">Missed</div></div>
          <div className="stat-box"><div className="stat-num" style={{ color:'var(--gray)' }}>{overall.off}</div><div className="stat-lbl">Off</div></div>
          <div className="stat-box"><div className="stat-num">{overall.att+(overall.od||0)+overall.mis}</div><div className="stat-lbl">Total</div></div>
        </div>
      </motion.div>

      {/* ── SUBJECT-WISE INSIGHTS (most important section) ── */}
      {subStats.length > 0 && (
        <motion.div className="card-raised" style={{ marginBottom:12 }} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.05 }}>
          <div style={{ fontWeight:700, fontSize:'0.9375rem', marginBottom:12 }}>Per Subject Summary</div>
          {subStats.map((s, i) => (
            <div key={i} style={{ marginBottom:14 }}>
              <div className="flex items-center justify-between" style={{ marginBottom:5 }}>
                <div className="flex items-center gap-2">
                  <div style={{ width:9, height:9, borderRadius:'50%', background:s.color }}/>
                  <span style={{ fontWeight:600, fontSize:'0.875rem' }}>{s.fullName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={{ fontWeight:700, fontSize:'0.875rem' }}>{s.pct}%</span>
                  <span className={`badge ${s.status==='safe'||s.status==='ok'?'badge-green':s.status==='warning'?'badge-orange':'badge-red'}`}>
                    {s.status==='safe'||s.status==='ok'
                      ? s.canBunk>0 ? `Skip ${s.canBunk}` : 'OK'
                      : `Need ${s.needAttend}`}
                  </span>
                </div>
              </div>
              <div className="pbar-wrap" style={{ height:6 }}>
                <div className="pbar-fill" style={{
                  width:`${s.pct}%`,
                  background: s.status==='safe'||s.status==='ok' ? 'var(--green)' : s.status==='warning' ? 'var(--orange)' : 'var(--red)'
                }}/>
              </div>
              <div className="flex justify-between" style={{ marginTop:3, fontSize:'0.625rem', color:'var(--text-3)' }}>
                <span>{s.attended} present · {s.missed} absent</span>
                <span>{s.criteria}% required</span>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Bar chart */}
      {subStats.length > 0 && (
        <motion.div className="card-raised" style={{ marginBottom:12, padding:'14px 4px' }} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.1 }}>
          <div style={{ fontWeight:700, fontSize:'0.875rem', marginBottom:10, paddingLeft:10 }}>Attendance Bar Chart</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={subStats} barCategoryGap="25%">
              <XAxis dataKey="name" tick={{ fontSize:10, fill:'var(--text-2)' }} axisLine={false} tickLine={false}/>
              <YAxis domain={[0,100]} tick={{ fontSize:10, fill:'var(--text-3)' }} axisLine={false} tickLine={false} width={28}/>
              <ReferenceLine y={settings.globalCriteria} stroke="var(--red)" strokeDasharray="4 4" label={{ value:`${settings.globalCriteria}%`, fill:'var(--red)', fontSize:10, position:'right' }}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="pct" radius={[5,5,0,0]}>
                {subStats.map((e,i) => <Cell key={i} fill={e.color}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* At risk */}
      {dangerous.length > 0 && (
        <motion.div className="card-raised" style={{ marginBottom:12, borderLeft:'4px solid var(--red)' }} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.15 }}>
          <div style={{ fontWeight:700, fontSize:'0.875rem', color:'var(--red)', marginBottom:8 }}>⚠️ Action Required</div>
          {dangerous.map((s,i) => (
            <div key={i} style={{ padding:'6px 0', borderBottom:i<dangerous.length-1?'1px solid var(--border-2)':'' }}>
              <div style={{ fontWeight:600, fontSize:'0.875rem' }}>{s.fullName}</div>
              <div style={{ fontSize:'0.75rem', color:'var(--text-2)' }}>
                {s.pct}% · {s.status==='warning' ? `⚡ Attend ${s.needAttend} more to be safe` : `🚨 Must attend ${s.needAttend} urgently to reach ${s.criteria}%`}
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Export */}
      <motion.div className="card-raised" style={{ marginBottom:12 }} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.2 }}>
        <div style={{ fontWeight:700, fontSize:'0.875rem', marginBottom:10 }}>Export & Backup</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <button className="btn btn-secondary w-full" onClick={async()=>{ await exportJSON(); addToast('Backup exported','success'); }} id="export-json">
            <FileJson size={16}/> Export Backup (JSON)
          </button>
          <button className="btn btn-secondary w-full" onClick={async()=>{ await exportCSV(); addToast('CSV exported','success'); }} id="export-csv">
            <FileSpreadsheet size={16}/> Export Report (CSV)
          </button>
          <label className="btn btn-secondary w-full" style={{ cursor:'pointer' }} id="import-label">
            <Upload size={16}/> Import Backup
            <input type="file" accept=".json" style={{ display:'none' }} onChange={async e => {
              const f = e.target.files[0]; if(!f) return;
              try { const r = await importJSON(f); loadSubjects(); addToast(`Imported ${r.counts.subjects} subjects`,'success'); }
              catch(err){ addToast('Import failed: '+err.message,'error'); }
              e.target.value='';
            }}/>
          </label>
        </div>
      </motion.div>

      {subjects.length === 0 && (
        <div className="empty">
          <div className="empty-icon"><BarChart3 size={32}/></div>
          <div className="empty-title">No data yet</div>
          <div className="empty-desc">Add subjects and mark attendance to see your reports here</div>
        </div>
      )}
    </div>
  );
}
