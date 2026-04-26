import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Monitor, Trash2, Upload, FileSpreadsheet, Loader } from 'lucide-react';
import useSettingsStore from '../stores/useSettingsStore.js';
import useSubjectStore from '../stores/useSubjectStore.js';
import useToastStore from '../stores/useToastStore.js';
import { exportJSON, importJSON, exportCSV, importAttendanceMultiFormat } from '../utils/exportUtils.js';
import db from '../db/database.js';

export default function SettingsPage() {
  const settings      = useSettingsStore(s => s.settings);
  const updateSettings = useSettingsStore(s => s.updateSettings);
  const loadSettings  = useSettingsStore(s => s.loadSettings);
  const loadSubjects  = useSubjectStore(s => s.loadSubjects);
  const addToast      = useToastStore(s => s.addToast);
  const [importing, setImporting] = useState(false);
  const multiImportRef = useRef(null);

  useEffect(() => { loadSettings(); }, []);

  const handleMultiFormatImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await importAttendanceMultiFormat(file);
      loadSubjects();
      let msg = `✅ Imported ${result.imported} records`;
      if (result.skipped > 0) msg += `, skipped ${result.skipped}`;
      if (result.createdSubjects && result.createdSubjects.length > 0) {
        msg += `. ✨ Added subjects: ${result.createdSubjects.join(', ')}`;
      } else if (result.missingSubjects && result.missingSubjects.length > 0) {
        msg += `. ⚠️ Subjects not found: ${result.missingSubjects.join(', ')}`;
      }
      addToast(msg, result.imported > 0 ? 'success' : 'warning');
    } catch (err) {
      addToast('Import failed: ' + err.message, 'error');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

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

      <Section title="AI Integrations" delay={0.08}>
        <div className="input-group">
          <label>Groq API Key (Timetable Scanner)</label>
          <input 
            type="password" 
            className="input" 
            value={settings.groqApiKey || ''}
            onChange={(e) => updateSettings({ groqApiKey: e.target.value })}
            placeholder="gsk_..."
          />
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginTop: 4 }}>
            Required for AI Timetable scanning. Get a free key at <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{color:'var(--primary)'}}>console.groq.com</a>.
          </div>
        </div>
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
            Import Backup (JSON)
            <input type="file" accept=".json" style={{ display:'none' }} onChange={async e => {
              const f = e.target.files[0]; if(!f) return;
              try { const r = await importJSON(f); loadSubjects(); addToast(`Imported ${r.counts.subjects} subjects`,'success'); }
              catch(err){ addToast('Import failed: '+err.message,'error'); }
              e.target.value='';
            }}/>
          </label>
        </div>
      </Section>

      {/* ── UPLOAD ATTENDANCE ── Multi-format ──────────────────── */}
      <Section title="📤 Upload Attendance" delay={0.12} accent>
        <p style={{ fontSize:'0.75rem', color:'var(--text-2)', marginBottom:12, lineHeight:1.6 }}>
          Upload your attendance data from <b>any format</b> — CSV, Excel (.xlsx / .xls), or JSON.
          Each row should have columns: <code style={{ background:'var(--accent-bg)', borderRadius:4, padding:'1px 5px' }}>Date, Subject, Status, Extra</code>
        </p>

        {/* Format hints */}
        <div style={{
          display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:12
        }}>
          {[
            { fmt:'CSV', icon:'📄', hint:'.csv' },
            { fmt:'Excel', icon:'📊', hint:'.xlsx/.xls' },
            { fmt:'JSON', icon:'🗂️', hint:'.json' },
          ].map(({ fmt, icon, hint }) => (
            <div key={fmt} style={{
              background:'var(--accent-bg)', borderRadius:10, padding:'8px 10px',
              textAlign:'center', fontSize:'0.6875rem', color:'var(--text-2)'
            }}>
              <div style={{ fontSize:18, marginBottom:2 }}>{icon}</div>
              <div style={{ fontWeight:700, color:'var(--text-1)' }}>{fmt}</div>
              <div style={{ color:'var(--text-3)' }}>{hint}</div>
            </div>
          ))}
        </div>

        {/* Upload button */}
        <label
          className="btn w-full"
          style={{
            cursor: importing ? 'not-allowed' : 'pointer',
            opacity: importing ? 0.7 : 1,
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            background:'var(--primary)', color:'#fff',
          }}
          id="multi-import-label"
        >
          {importing
            ? <><Loader size={16} style={{ animation:'spin 1s linear infinite' }}/> Importing…</>
            : <><FileSpreadsheet size={16}/> Choose Attendance File</>
          }
          <input
            ref={multiImportRef}
            type="file"
            accept=".csv,.xlsx,.xls,.json"
            style={{ display:'none' }}
            disabled={importing}
            onChange={handleMultiFormatImport}
          />
        </label>

        <div style={{ fontSize:'0.6875rem', color:'var(--text-3)', marginTop:8 }}>
          💡 Subject names in the file must match exactly with subjects added in this app.
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
