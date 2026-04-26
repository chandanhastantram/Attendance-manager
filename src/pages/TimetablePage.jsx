import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Plus, Trash2, Image, Loader, Check, X, LayoutGrid, FileText } from 'lucide-react';
import Tesseract from 'tesseract.js';
import useSubjectStore from '../stores/useSubjectStore.js';
import useTimetableStore from '../stores/useTimetableStore.js';
import useSettingsStore from '../stores/useSettingsStore.js';
import useToastStore from '../stores/useToastStore.js';
import Modal from '../components/common/Modal.jsx';
import TimetableForm from '../components/timetable/TimetableForm.jsx';
import { fmt12 } from '../utils/attendance.js';
import { DAY_SHORT, DAYS } from '../db/database.js';
import db from '../db/database.js';

// ── OCR TEXT PARSER ────────────────────────────────────────────────────────
function parseTimetableFromOCR(text, subjects) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const subjectNames = subjects.map(s => s.name.toLowerCase());
  const results = [];

  // Try to find subject names mentioned alongside day abbreviations
  const DAY_PATTERNS = {
    0: /\bmon(day)?\b/i,
    1: /\btue(sday)?\b/i,
    2: /\bwed(nesday)?\b/i,
    3: /\bthu(rsday)?\b/i,
    4: /\bfri(day)?\b/i,
    5: /\bsat(urday)?\b/i,
  };

  const TIME_RE = /\b(\d{1,2})[:\.](\d{2})\s*(am|pm)?\b/gi;

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Find subject
    let matchedSubject = null;
    for (const sub of subjects) {
      if (lowerLine.includes(sub.name.toLowerCase().substring(0, 5))) {
        matchedSubject = sub;
        break;
      }
    }
    if (!matchedSubject) continue;

    // Find day
    let dayIndex = null;
    for (const [idx, pattern] of Object.entries(DAY_PATTERNS)) {
      if (pattern.test(line)) { dayIndex = parseInt(idx); break; }
    }

    // Find times
    const times = [...line.matchAll(TIME_RE)];
    let startTime = null, endTime = null;
    if (times.length >= 2) {
      startTime = formatTimeStr(times[0]);
      endTime   = formatTimeStr(times[1]);
    } else if (times.length === 1) {
      startTime = formatTimeStr(times[0]);
    }

    if (matchedSubject && dayIndex !== null && startTime) {
      results.push({
        id: `ocr-${Date.now()}-${Math.random()}`,
        subjectId: matchedSubject.id,
        subjectName: matchedSubject.name,
        subjectColor: matchedSubject.color,
        day: dayIndex,
        dayName: DAY_SHORT[dayIndex],
        startTime,
        endTime: endTime || incrementHour(startTime),
        room: '',
        confirmed: true,
      });
    }
  }
  return results;
}

function formatTimeStr(match) {
  let h = parseInt(match[1]);
  const m = parseInt(match[2]) || 0;
  const period = (match[3] || '').toLowerCase();
  if (period === 'pm' && h !== 12) h += 12;
  if (period === 'am' && h === 12) h = 0;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function incrementHour(t) {
  const [h, m] = t.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

// ── WEEKLY GRID VIEW ───────────────────────────────────────────────────────
function WeeklyGrid({ slots, subjects, onDeleteSlot }) {
  const subMap = useMemo(() => Object.fromEntries(subjects.map(s => [s.id, s])), [subjects]);
  const COLS = [0, 1, 2, 3, 4, 5]; // Mon–Sat

  const slotsByDay = useMemo(() => {
    const map = {};
    COLS.forEach(d => { map[d] = []; });
    slots.forEach(slot => { if (map[slot.day] !== undefined) map[slot.day].push(slot); });
    COLS.forEach(d => map[d].sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return map;
  }, [slots]);

  const maxRows = Math.max(...COLS.map(d => slotsByDay[d].length), 1);

  return (
    <div style={{ overflowX: 'auto', marginBottom: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(6, minmax(52px, 1fr))`, gap: 3, minWidth: 320 }}>
        {/* Header row */}
        {DAY_SHORT.slice(0, 6).map((d, i) => (
          <div key={d} style={{
            textAlign: 'center', fontSize: '0.625rem', fontWeight: 800,
            color: 'var(--text-2)', padding: '4px 0', textTransform: 'uppercase', letterSpacing: '0.05em'
          }}>{d}</div>
        ))}

        {/* Slot cells */}
        {Array.from({ length: maxRows }, (_, row) =>
          COLS.map(col => {
            const slot = slotsByDay[col][row];
            const sub = slot ? subMap[slot.subjectId] : null;
            return (
              <div key={`${col}-${row}`} style={{ minHeight: 72 }}>
                {slot && sub ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                      background: sub.color + '22',
                      border: `1.5px solid ${sub.color}55`,
                      borderLeft: `3px solid ${sub.color}`,
                      borderRadius: 8,
                      padding: '5px 6px',
                      fontSize: '0.5625rem',
                      lineHeight: 1.3,
                      minHeight: 70,
                      position: 'relative',
                      cursor: 'pointer',
                    }}
                    title={`${sub.name} · ${fmt12(slot.startTime)}`}
                  >
                    <div style={{ fontWeight: 700, color: sub.color, marginBottom: 2, wordBreak: 'break-word' }}>
                      {sub.shortName || sub.name.substring(0, 10)}
                    </div>
                    <div style={{ color: 'var(--text-2)', fontSize: '0.5rem' }}>
                      {fmt12(slot.startTime)}
                    </div>
                    {slot.room && (
                      <div style={{ color: 'var(--text-3)', fontSize: '0.5rem' }}>{slot.room}</div>
                    )}
                    <button
                      onClick={() => onDeleteSlot(slot.id)}
                      style={{
                        position: 'absolute', top: 2, right: 2,
                        background: 'var(--red-bg)', border: 'none', borderRadius: 4,
                        width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', opacity: 0.7
                      }}
                    >
                      <X size={8} color="var(--red)" />
                    </button>
                  </motion.div>
                ) : (
                  <div style={{ minHeight: 70 }} />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── UPLOAD MODAL ───────────────────────────────────────────────────────────
function UploadModal({ isOpen, onClose, subjects, onApply }) {
  const [phase, setPhase] = useState('select'); // select | scanning | review | manual
  const [imageUrl, setImageUrl] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('Initializing...');
  const [parsedSlots, setParsedSlots] = useState([]);
  const [ocrText, setOcrText] = useState('');
  const fileRef = useRef(null);
  const addToast = useToastStore(s => s.addToast);

  const reset = () => {
    setPhase('select');
    setImageUrl(null);
    setOcrProgress(0);
    setParsedSlots([]);
    setOcrText('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setPhase('scanning');

    try {
      const result = await Tesseract.recognize(url, 'eng', {
        logger: m => {
          // m.status can be "loading tesseract core", "initializing tesseract", "downloading eng.traineddata", "recognizing text"
          setOcrStatusText(m.status.charAt(0).toUpperCase() + m.status.slice(1));
          if (m.progress) {
            setOcrProgress(Math.round(m.progress * 100));
          }
        }
      });
      const text = result.data.text;
      setOcrText(text);
      const slots = parseTimetableFromOCR(text, subjects);
      setParsedSlots(slots);
      setPhase(slots.length > 0 ? 'review' : 'manual');
      if (slots.length === 0) addToast('Could not auto-detect classes. Please add manually.', 'info');
    } catch (err) {
      addToast('Scan failed: ' + err.message, 'error');
      setPhase('select');
    }
  };

  const removeSlot = (id) => setParsedSlots(prev => prev.filter(s => s.id !== id));

  const handleApply = async () => {
    await onApply(parsedSlots.filter(s => s.confirmed));
    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Timetable">
      {phase === 'select' && (
        <div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
            📸 Take a photo of your printed timetable or upload a screenshot. Vorn will read the subject names and schedule automatically.
          </p>

          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: '2px dashed var(--border)', borderRadius: 14,
              padding: '32px 16px', textAlign: 'center', cursor: 'pointer',
              background: 'var(--bg-alt)', marginBottom: 12, transition: 'border-color .15s'
            }}
          >
            <Image size={36} color="var(--text-3)" style={{ margin: '0 auto 10px' }} />
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 4 }}>Tap to upload image</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>JPG, PNG, WEBP or PDF screenshot</div>
            <input
              ref={fileRef} type="file" accept="image/*,.pdf"
              style={{ display: 'none' }} onChange={handleFile}
              capture="environment"
            />
          </div>

          <button className="btn btn-secondary w-full" onClick={() => setPhase('manual')}>
            <Plus size={16} /> Add slots manually instead
          </button>
        </div>
      )}

      {phase === 'scanning' && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          {imageUrl && (
            <img src={imageUrl} alt="Timetable preview"
              style={{ width: '100%', borderRadius: 12, marginBottom: 20, maxHeight: 200, objectFit: 'contain' }} />
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
            <Loader size={20} className="spin" color="var(--primary)" />
            <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{ocrStatusText}…</span>
          </div>
          <div className="pbar-wrap" style={{ margin: '0 auto', maxWidth: 240 }}>
            <div className="pbar-fill" style={{ width: `${ocrProgress}%`, background: 'var(--primary)' }} />
          </div>
          <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-2)' }}>{ocrProgress}%</div>
          <div style={{ marginTop: 12, fontSize: '0.6875rem', color: 'var(--text-3)' }}>
            First time scan downloads ~25MB of offline language data.
          </div>
        </div>
      )}

      {phase === 'review' && (
        <div>
          <div style={{
            background: 'var(--green-bg)', borderRadius: 10, padding: '10px 12px',
            fontSize: '0.8125rem', color: 'var(--green-text)', marginBottom: 14, fontWeight: 600
          }}>
            ✓ Found {parsedSlots.length} class slot{parsedSlots.length !== 1 ? 's' : ''}! Review and confirm below.
          </div>

          {parsedSlots.map((slot, i) => (
            <div key={slot.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--bg-alt)', borderRadius: 10, padding: '10px 12px',
              marginBottom: 6, opacity: slot.confirmed ? 1 : 0.4,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: slot.subjectColor, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.8125rem' }} className="truncate">{slot.subjectName}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-2)' }}>
                  {slot.dayName} · {fmt12(slot.startTime)} – {fmt12(slot.endTime)}
                </div>
              </div>
              <button
                onClick={() => setParsedSlots(prev => prev.map(s => s.id === slot.id ? { ...s, confirmed: !s.confirmed } : s))}
                style={{
                  width: 28, height: 28, borderRadius: '50%', border: '2px solid',
                  borderColor: slot.confirmed ? 'var(--green)' : 'var(--border)',
                  background: slot.confirmed ? 'var(--green)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                {slot.confirmed && <Check size={14} color="white" />}
              </button>
              <button onClick={() => removeSlot(slot.id)} style={{ color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPhase('select')}>
              Re-scan
            </button>
            <button
              className="btn btn-primary" style={{ flex: 1 }}
              onClick={handleApply}
              disabled={!parsedSlots.some(s => s.confirmed)}
            >
              Add {parsedSlots.filter(s => s.confirmed).length} Slots
            </button>
          </div>
        </div>
      )}

      {phase === 'manual' && (
        <div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-2)', marginBottom: 14 }}>
            Use the form to add individual class slots to your weekly timetable.
          </p>
          <TimetableForm onClose={handleClose} />
        </div>
      )}
    </Modal>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────
export default function TimetablePage() {
  const subjects    = useSubjectStore(s => s.subjects);
  const loadSubjects = useSubjectStore(s => s.loadSubjects);
  const slots       = useTimetableStore(s => s.slots);
  const loadSlots   = useTimetableStore(s => s.loadSlots);
  const deleteSlot  = useTimetableStore(s => s.deleteSlot);
  const addToast    = useToastStore(s => s.addToast);

  const [showUpload, setShowUpload] = useState(false);
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [view, setView] = useState('grid'); // 'grid' | 'list'

  useEffect(() => { loadSubjects(); loadSlots(); }, []);

  const subMap = useMemo(() => Object.fromEntries(subjects.map(s => [s.id, s])), [subjects]);

  const handleDeleteSlot = async (id) => {
    await deleteSlot(id);
    addToast('Slot removed', 'info');
  };

  const handleOCRApply = async (parsedSlots) => {
    let count = 0;
    for (const slot of parsedSlots) {
      try {
        await db.timetableSlots.add({
          subjectId: slot.subjectId,
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: slot.room || '',
          createdAt: new Date().toISOString(),
        });
        count++;
      } catch (e) { /* skip duplicates */ }
    }
    await loadSlots();
    addToast(`Added ${count} timetable slot${count !== 1 ? 's' : ''}!`, 'success');
  };

  // Count per-day slots
  const dayStats = DAY_SHORT.slice(0, 6).map((d, i) => ({
    label: d, index: i, count: slots.filter(s => s.day === i).length
  }));

  const filteredSlots = selectedDay !== null ? slots.filter(s => s.day === selectedDay) : slots;

  return (
    <div className="page" style={{ paddingTop: 0 }}>
      {/* ── Header ── */}
      <div className="page-top">
        <div>
          <h1 className="page-title">Timetable</h1>
          <p className="page-sub">{slots.length} class{slots.length !== 1 ? 'es' : ''} configured</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowUpload(true)}
            id="upload-timetable-btn"
          >
            <Upload size={14} /> Import
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowAddSlot(true)}
            id="add-slot-btn"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {/* ── View Toggle ── */}
      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}>
          <LayoutGrid size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Grid
        </button>
        <button className={`tab ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>
          <FileText size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> List
        </button>
      </div>

      {slots.length === 0 ? (
        <motion.div className="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="empty-icon" style={{ fontSize: 36 }}>📅</div>
          <div className="empty-title">No timetable yet</div>
          <div className="empty-desc">
            Import a photo of your timetable or add slots manually
          </div>
          <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => setShowUpload(true)}>
            <Upload size={16} /> Import Timetable
          </button>
        </motion.div>
      ) : view === 'grid' ? (
        <motion.div className="card-raised" style={{ padding: 10 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <WeeklyGrid slots={slots} subjects={subjects} onDeleteSlot={handleDeleteSlot} />
        </motion.div>
      ) : (
        /* ── LIST VIEW ── */
        <div>
          {/* Day filter chips */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 2 }}>
            <button
              style={{
                padding: '6px 12px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700,
                flexShrink: 0, cursor: 'pointer', border: 'none',
                background: selectedDay === null ? 'var(--primary)' : 'var(--bg-alt)',
                color: selectedDay === null ? 'white' : 'var(--text-2)',
              }}
              onClick={() => setSelectedDay(null)}
            >
              All
            </button>
            {dayStats.map(d => (
              <button
                key={d.index}
                style={{
                  padding: '6px 12px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700,
                  flexShrink: 0, cursor: 'pointer', border: 'none', position: 'relative',
                  background: selectedDay === d.index ? 'var(--primary)' : 'var(--bg-alt)',
                  color: selectedDay === d.index ? 'white' : d.count === 0 ? 'var(--text-3)' : 'var(--text-2)',
                }}
                onClick={() => setSelectedDay(selectedDay === d.index ? null : d.index)}
              >
                {d.label} {d.count > 0 && <span style={{ opacity: 0.7 }}>({d.count})</span>}
              </button>
            ))}
          </div>

          <AnimatePresence>
            {filteredSlots
              .sort((a, b) => a.day - b.day || a.startTime.localeCompare(b.startTime))
              .map((slot, i) => {
                const sub = subMap[slot.subjectId];
                return (
                  <motion.div
                    key={slot.id}
                    className="slot-row"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: sub?.color || 'var(--primary)', flexShrink: 0 }} />
                    <div style={{ minWidth: 42, textAlign: 'center' }}>
                      <div style={{ fontSize: '0.625rem', fontWeight: 800, color: 'var(--primary)' }}>
                        {DAY_SHORT[slot.day]}
                      </div>
                      <div className="slot-time">{fmt12(slot.startTime)}</div>
                      <div style={{ fontSize: '0.5rem', color: 'var(--text-3)' }}>{fmt12(slot.endTime)}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }} className="truncate">
                        {sub?.name || '?'}
                      </div>
                      {slot.room && <div style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>{slot.room}</div>}
                    </div>
                    <button className="btn-icon" style={{ color: 'var(--red)' }} onClick={() => handleDeleteSlot(slot.id)}>
                      <Trash2 size={15} />
                    </button>
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </div>
      )}

      <UploadModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        subjects={subjects}
        onApply={handleOCRApply}
      />

      <Modal isOpen={showAddSlot} onClose={() => setShowAddSlot(false)} title="Add Class Slot">
        <TimetableForm onClose={() => { setShowAddSlot(false); loadSlots(); }} />
      </Modal>
    </div>
  );
}
