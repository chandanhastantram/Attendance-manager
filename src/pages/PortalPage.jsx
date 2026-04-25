import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Copy, Check, ClipboardPaste, AlertCircle, RefreshCw, Zap } from 'lucide-react';
import { LINWAYS_CONSOLE_SCRIPT, parsePortalJSON, applyPortalData } from '../utils/portalImport.js';
import useSubjectStore from '../stores/useSubjectStore.js';
import useToastStore from '../stores/useToastStore.js';

const STEPS = ['script', 'paste', 'preview', 'done'];

export default function PortalPage() {
  const subjects    = useSubjectStore(s => s.subjects);
  const loadSubjects = useSubjectStore(s => s.loadSubjects);
  const addToast    = useToastStore(s => s.addToast);

  const [step, setStep]         = useState('script');
  const [copied, setCopied]     = useState(false);
  const [pasted, setPasted]     = useState('');
  const [preview, setPreview]   = useState(null);
  const [parseErr, setParseErr] = useState('');
  const [applying, setApplying] = useState(false);
  const [result, setResult]     = useState(null);

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(LINWAYS_CONSOLE_SCRIPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback: show the text
    }
  };

  const handleParse = () => {
    const res = parsePortalJSON(pasted);
    if (!res.valid) {
      setParseErr(res.error);
      setPreview(null);
    } else {
      setParseErr('');
      setPreview(res.data);
      setStep('preview');
    }
  };

  const handleApply = async () => {
    if (!preview) return;
    setApplying(true);
    try {
      const res = await applyPortalData(preview, subjects);
      await loadSubjects();
      setResult(res);
      setStep('done');
      addToast(`Synced ${preview.length} subjects from portal ✅`, 'success');
    } catch (err) {
      addToast('Import failed: ' + err.message, 'error');
    }
    setApplying(false);
  };

  const reset = () => {
    setStep('script');
    setPasted('');
    setPreview(null);
    setParseErr('');
    setResult(null);
  };

  const pctColor = (pct) => {
    if (pct >= 75) return 'var(--green)';
    if (pct >= 60) return 'var(--orange)';
    return 'var(--red)';
  };

  return (
    <div className="page" style={{ paddingTop: 0 }}>
      <div className="page-top">
        <div>
          <h1 className="page-title">Portal Sync</h1>
          <p className="page-sub">Import from Linways ERP</p>
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: 'var(--radius-m)',
          background: 'var(--primary-bg)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: 'var(--primary)'
        }}>
          <Globe size={20} />
        </div>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {['Get Script', 'Paste Data', 'Preview', 'Done'].map((label, i) => {
          const stepId = STEPS[i];
          const isCurrent = step === stepId;
          const isPast = STEPS.indexOf(step) > i;
          return (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                height: 3, borderRadius: 99,
                background: isCurrent ? 'var(--primary)' : isPast ? 'var(--primary-dim)' : 'var(--border)',
                marginBottom: 5, transition: 'background 0.3s'
              }} />
              <span style={{
                fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                color: isCurrent ? 'var(--primary)' : isPast ? 'var(--primary-dim)' : 'var(--text-3)',
                transition: 'color 0.3s'
              }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">

        {/* ── STEP 1: Copy Script ── */}
        {step === 'script' && (
          <motion.div key="script" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            <div className="card-raised" style={{ marginBottom: 14, borderLeft: '3px solid var(--accent)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.9375rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={16} color="var(--accent)" /> How This Works
              </div>
              <ol style={{ fontSize: '0.8125rem', color: 'var(--text-2)', lineHeight: 1.9, paddingLeft: 18 }}>
                <li>Log into your Presidency Linways portal</li>
                <li>Go to <b>Attendance → Consolidated Attendance Report</b></li>
                <li>Press <kbd style={{ background: 'var(--bg-alt)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.75rem', border: '1px solid var(--border)' }}>F12</kbd> to open Developer Tools</li>
                <li>Click the <b>Console</b> tab</li>
                <li>Paste the script below and press <kbd style={{ background: 'var(--bg-alt)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: '0.75rem', border: '1px solid var(--border)' }}>Enter</kbd></li>
                <li>Come back here and paste the copied JSON</li>
              </ol>
            </div>

            {/* Script block */}
            <div style={{
              background: '#141210', borderRadius: 'var(--radius-l)', overflow: 'hidden',
              border: '1px solid #2C2822', marginBottom: 14
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderBottom: '1px solid #2C2822'
              }}>
                <span style={{ fontSize: '0.75rem', color: '#6E6055', fontWeight: 600 }}>console script · JavaScript</span>
                <button
                  onClick={handleCopyScript}
                  id="copy-script-btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 'var(--radius-s)',
                    background: copied ? '#1A3E2D' : '#231F1B',
                    color: copied ? '#52B788' : '#A8998A',
                    fontSize: '0.75rem', fontWeight: 700, border: '1px solid',
                    borderColor: copied ? '#52B788' : '#383028',
                    transition: 'all 0.2s'
                  }}
                >
                  {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy Script</>}
                </button>
              </div>
              <pre style={{
                margin: 0, padding: '12px 14px',
                fontSize: '0.6875rem', color: '#95D5B2',
                fontFamily: "'Fira Code', 'Consolas', monospace",
                overflowX: 'auto', maxHeight: 180, lineHeight: 1.6,
                whiteSpace: 'pre-wrap', wordBreak: 'break-all'
              }}>
                {LINWAYS_CONSOLE_SCRIPT.substring(0, 300)}
                <span style={{ color: '#6E6055' }}>...{LINWAYS_CONSOLE_SCRIPT.length - 300} more chars (copy to see full script)</span>
              </pre>
            </div>

            <button className="btn btn-primary w-full" onClick={() => setStep('paste')} id="next-to-paste-btn">
              I ran the script — Next →
            </button>
          </motion.div>
        )}

        {/* ── STEP 2: Paste JSON ── */}
        {step === 'paste' && (
          <motion.div key="paste" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="card-raised" style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClipboardPaste size={16} color="var(--primary)" /> Paste Extracted Data
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', marginBottom: 12, lineHeight: 1.6 }}>
                After running the script, your attendance data was copied automatically. Paste it below with <kbd style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>Ctrl+V</kbd>
              </p>
              <textarea
                id="portal-json-input"
                className="input"
                placeholder={'[\n  {\n    "name": "Physics",\n    "total": 26,\n    "attended": 24,\n    "duty": 2\n  }\n]'}
                value={pasted}
                onChange={e => { setPasted(e.target.value); setParseErr(''); }}
                style={{
                  minHeight: 180, resize: 'vertical', fontFamily: "'Consolas', monospace",
                  fontSize: '0.8125rem', lineHeight: 1.6
                }}
              />
              {parseErr && (
                <div style={{
                  marginTop: 10, display: 'flex', alignItems: 'flex-start', gap: 8,
                  background: 'var(--red-bg)', padding: '10px 12px', borderRadius: 'var(--radius-m)',
                  fontSize: '0.8125rem', color: 'var(--red-text)'
                }}>
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <b>Parse error:</b> {parseErr}
                    <br /><span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Make sure you copied the full output from the console.</span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setStep('script')} style={{ flex: 1 }}>← Back</button>
              <button
                className="btn btn-primary"
                onClick={handleParse}
                disabled={!pasted.trim()}
                style={{ flex: 2 }}
                id="parse-portal-btn"
              >
                Parse & Preview →
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 3: Preview ── */}
        {step === 'preview' && preview && (
          <motion.div key="preview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="card-raised" style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Preview — {preview.length} subjects</span>
                <span className="badge badge-green">{preview.length} ready</span>
              </div>

              {/* Header row */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 48px 48px 52px',
                gap: 4, padding: '6px 10px',
                background: 'var(--bg-alt)', borderRadius: 'var(--radius-s)',
                marginBottom: 6
              }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Subject</span>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-3)', textAlign: 'center' }}>Total</span>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-3)', textAlign: 'center' }}>Attended</span>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-3)', textAlign: 'center' }}>%</span>
              </div>

              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {preview.map((item, i) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '1fr 48px 48px 52px',
                    gap: 4, padding: '10px 10px',
                    borderBottom: i < preview.length - 1 ? '1px solid var(--border-2)' : 'none',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }} className="truncate">{item.name}</div>
                      {item.duty > 0 && (
                        <span className="badge badge-od" style={{ marginTop: 2 }}>+{item.duty} DL</span>
                      )}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-2)' }}>{item.total}</div>
                    <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-2)' }}>{item.attended}</div>
                    <div style={{
                      textAlign: 'center', fontWeight: 800, fontSize: '0.875rem',
                      color: pctColor(item.pct)
                    }}>
                      {item.pct}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              background: 'var(--accent-bg)', borderRadius: 'var(--radius-m)', padding: '10px 14px',
              fontSize: '0.8125rem', color: 'var(--orange)', fontWeight: 500, marginBottom: 14, lineHeight: 1.6
            }}>
              ℹ️ New subjects will be created automatically. For existing subjects, missing records will be added to match the portal counts.
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setStep('paste')} style={{ flex: 1 }} disabled={applying}>← Back</button>
              <button
                className="btn btn-primary"
                onClick={handleApply}
                disabled={applying}
                style={{ flex: 2 }}
                id="apply-portal-btn"
              >
                {applying ? <><RefreshCw size={14} className="spin" /> Applying...</> : <><Check size={14} /> Apply All</>}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 4: Done ── */}
        {step === 'done' && result && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <div className="card-raised" style={{ textAlign: 'center', padding: '32px 20px', marginBottom: 14 }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
              <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)', marginBottom: 6 }}>
                Sync Complete!
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.7 }}>
                Your Linways attendance data has been imported into Vorn.
              </div>

              <div className="stats-row" style={{ justifyContent: 'center' }}>
                <div className="stat-box">
                  <div className="stat-num" style={{ color: 'var(--primary)' }}>{result.created}</div>
                  <div className="stat-lbl">Subjects Created</div>
                </div>
                <div className="stat-box">
                  <div className="stat-num" style={{ color: 'var(--orange)' }}>{result.updated}</div>
                  <div className="stat-lbl">Subjects Updated</div>
                </div>
                {result.skipped > 0 && (
                  <div className="stat-box">
                    <div className="stat-num" style={{ color: 'var(--gray)' }}>{result.skipped}</div>
                    <div className="stat-lbl">Skipped</div>
                  </div>
                )}
              </div>
            </div>

            <button className="btn btn-secondary w-full" onClick={reset} id="portal-sync-again-btn">
              <RefreshCw size={15} /> Sync Again
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
