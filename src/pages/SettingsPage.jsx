import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Monitor, Trash2, Calendar, Info } from 'lucide-react';
import useSettingsStore from '../stores/useSettingsStore.js';
import useSubjectStore from '../stores/useSubjectStore.js';
import useToastStore from '../stores/useToastStore.js';
import { exportJSON, importJSON, exportCSV } from '../utils/exportUtils.js';
import db from '../db/database.js';

export default function SettingsPage() {
  const settings      = useSettingsStore(s => s.settings);
  const updateSettings = useSettingsStore(s => s.updateSettings);
  const loadSettings  = useSettingsStore(s => s.loadSettings);
  const loadSubjects  = useSubjectStore(s => s.loadSubjects);
  const addToast      = useToastStore(s => s.addToast);

  useEffect(() => { loadSettings(); }, []);

  const handleReset = async () => {
    if (!confirm('Delete ALL data? This cannot be undone.')) return;
    await db.transaction('rw', db.subjects, db.timetableSlots, db.attendanceRecords, async () => {
      await db.subjects.clear();
      await db.timetableSlots.clear();
      await db.attendanceRecords.clear();
    });
    loadSubjects();
    addToast('All data cleared', 'info');
  };

  const themeOptions = [
    { v:'light',  icon:Sun,     label:'Light'  },
    { v:'dark',   icon:Moon,    label:'Dark'   },
    { v:'system', icon:Monitor, label:'System' },
  ];

  const Section = ({ title, children, delay=0, accent=false }) => (
    <motion.div
      className="card-raised"
      style={{ marginBottom:12, ...(accent ? { borderLeft:'3px solid var(--accent)' } : {}) }}
      initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay }}
    >
      <div style={{ fontWeight:700, fontSize:'0.875rem', marginBottom:12 }}>{title}</div>
      {children}
    </motion.div>
  );

  return (
    <div className="page" style={{ paddingTop: 0 }}>
      <div className="page-top">
        <div>
          <h1 className="page-title">Settings</h1>
        </div>
      </div>

      {/* Theme */}
      <Section title="Appearance" delay={0}>
        <div className="tabs">
          {themeOptions.map(opt => {
            const Icon = opt.icon;
            return (
              <button key={opt.v} className={`tab ${settings.theme===opt.v?'active':''}`}
                onClick={() => updateSettings({ theme:opt.v })} id={`theme-${opt.v}`}>
                <Icon size={13} style={{ marginRight:4, verticalAlign:'middle' }}/>{opt.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Attendance Criteria */}
      <Section title="Attendance Criteria" delay={0.04}>
        <p style={{ fontSize:'0.75rem', color:'var(--text-2)', marginBottom:12 }}>
          Minimum % required to pass attendance
        </p>
        <div className="flex items-center gap-3">
          <input type="range" min={50} max={100}
            value={settings.globalCriteria}
            onChange={e => updateSettings({ globalCriteria:parseInt(e.target.value) })}
            style={{ flex:1, accentColor:'var(--primary)', height:4 }}
            id="criteria-slider"
          />
          <span style={{ fontWeight:800, fontSize:'1.375rem', color:'var(--primary)', minWidth:52, textAlign:'right' }}>
            {settings.globalCriteria}%
          </span>
        </div>
        <div style={{ fontSize:'0.6875rem', color:'var(--text-3)', marginTop:8 }}>
          Most colleges require 75%. You can override per subject.
        </div>
      </Section>

      {/* ── SEMESTER DATES ── New feature ──────────────────── */}
      <Section title="📅 Semester Dates" delay={0.07} accent>
        <p style={{ fontSize:'0.75rem', color:'var(--text-2)', marginBottom:12, lineHeight:1.6 }}>
          Set your semester start and end dates to unlock <b>Future Projections</b> — see exactly how many classes you can skip and must attend for the rest of the semester.
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div className="field">
            <label className="label">Semester Start Date</label>
            <input
              type="date"
              className="input"
              value={settings.semesterStartDate || ''}
              onChange={e => updateSettings({ semesterStartDate: e.target.value || null })}
              id="semester-start"
            />
          </div>
          <div className="field">
            <label className="label">Semester End Date</label>
            <input
              type="date"
              className="input"
              value={settings.semesterEndDate || ''}
              onChange={e => updateSettings({ semesterEndDate: e.target.value || null })}
              id="semester-end"
            />
          </div>
        </div>
        {settings.semesterEndDate && (
          <div style={{
            marginTop:10, background:'var(--accent-bg)', borderRadius:10, padding:'8px 12px',
            fontSize:'0.75rem', color:'var(--orange)', fontWeight:600
          }}>
            ✓ Projections active — check Subjects page for your skip/attend counts!
          </div>
        )}
      </Section>

      {/* Export / Backup */}
      <Section title="Data & Backup" delay={0.1}>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <button className="btn btn-secondary w-full"
            onClick={async()=>{ await exportJSON(); addToast('Backup exported','success'); }} id="export-json">
            Export Backup (JSON)
          </button>
          <button className="btn btn-secondary w-full"
            onClick={async()=>{ await exportCSV(); addToast('CSV exported','success'); }} id="export-csv">
            Export Report (CSV)
          </button>
          <label className="btn btn-secondary w-full" style={{ cursor:'pointer' }} id="import-label">
            Import Backup
            <input type="file" accept=".json" style={{ display:'none' }} onChange={async e => {
              const f = e.target.files[0]; if(!f) return;
              try { const r = await importJSON(f); loadSubjects(); addToast(`Imported ${r.counts.subjects} subjects`,'success'); }
              catch(err){ addToast('Import failed: '+err.message,'error'); }
              e.target.value='';
            }}/>
          </label>
        </div>
      </Section>

      {/* Danger Zone */}
      <motion.div className="card-raised" style={{ marginBottom:12, borderLeft:'4px solid var(--red)' }}
        initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.14 }}>
        <div style={{ fontWeight:700, fontSize:'0.875rem', color:'var(--red)', marginBottom:8 }}>⚠️ Danger Zone</div>
        <button className="btn btn-danger w-full" onClick={handleReset} id="reset-data-btn">
          <Trash2 size={16}/> Reset All Data
        </button>
      </motion.div>

      {/* About */}
      <motion.div className="card-raised" style={{ textAlign:'center', marginBottom:32 }}
        initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.17 }}>
        <div style={{ fontSize:28, marginBottom:6 }}>📚</div>
        <div style={{ fontWeight:800, fontSize:'1.0625rem', color:'var(--primary)' }}>Vorn</div>
        <div style={{ fontSize:'0.75rem', color:'var(--text-2)', marginTop:2 }}>Attendance Manager v1.0</div>
        <div style={{ fontSize:'0.6875rem', color:'var(--text-3)', marginTop:2 }}>Made with care for students 💚</div>
      </motion.div>
    </div>
  );
}
