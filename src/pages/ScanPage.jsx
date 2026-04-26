import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, X, Check, RefreshCw, FileText, BookOpen, Calendar, ChevronRight } from 'lucide-react';
import useSubjectStore from '../stores/useSubjectStore.js';
import useTimetableStore from '../stores/useTimetableStore.js';
import useAttendanceStore from '../stores/useAttendanceStore.js';
import useToastStore from '../stores/useToastStore.js';
import useSettingsStore from '../stores/useSettingsStore.js';
import Modal from '../components/common/Modal.jsx';
import { DAYS, SUBJECT_COLORS } from '../db/database.js';
import { format } from 'date-fns';

import { parseWithGroq } from '../utils/groqVision.js';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

/* ── Main Scan Page ─────────────────────────────────────────── */
export default function ScanPage() {
  const subjects      = useSubjectStore(s => s.subjects);
  const loadSubjects  = useSubjectStore(s => s.loadSubjects);
  const addSubject    = useSubjectStore(s => s.addSubject);
  const addSlot       = useTimetableStore(s => s.addSlot);
  const loadSlots     = useTimetableStore(s => s.loadSlots);
  const markAttendance = useAttendanceStore(s => s.markAttendance);
  const addToast      = useToastStore(s => s.addToast);
  const settings      = useSettingsStore(s => s.settings);

  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const fileRef     = useRef(null);
  const streamRef   = useRef(null);

  const [mode, setMode] = useState('choose'); // choose | camera | processing | results
  const [scanType, setScanType]     = useState('timetable'); // timetable | attendance | subjects
  const [capturedImg, setCapturedImg] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [selected, setSelected]     = useState({});
  const [applying, setApplying]     = useState(false);
  const [ocring, setOcring]         = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [editRow, setEditRow]       = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => { loadSubjects(); }, []);
  useEffect(() => () => stopCamera(), []);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setMode('camera');
    } catch (err) {
      setCameraError('Camera access denied. Please allow camera permissions or use file upload.');
      setMode('choose');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const capture = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    stopCamera();
    setCapturedImg(dataUrl);
    runOCR(dataUrl);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCapturedImg(ev.target.result);
      runOCR(ev.target.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const runOCR = async (imageData) => {
    if (!settings.groqApiKey) {
      addToast('Please enter your Groq API Key in Settings first.', 'error');
      return;
    }

    setMode('processing');
    setOcring(true);
    try {
      const data = await parseWithGroq(imageData, subjects, settings.groqApiKey, scanType);
      
      setParsedData(data);
      // Pre-select all items
      const sel = {};
      data.forEach((_, i) => { sel[i] = true; });
      setSelected(sel);
      setMode('results');
    } catch (err) {
      addToast('Scan failed: ' + err.message, 'error');
      setMode('choose');
    }
    setOcring(false);
  };

  const applyResults = async () => {
    setApplying(true);
    let count = 0;
    const selectedItems = parsedData.filter((_, i) => selected[i]);

    try {
      if (scanType === 'timetable') {
        for (const item of selectedItems) {
          if (item.day !== null && item.startTime) {
            let subId;
            const existing = subjects.find(s => s.name.toLowerCase() === item.subjectName.toLowerCase());
            if (existing) {
              subId = existing.id;
            } else {
              subId = await addSubject({ name: item.subjectName });
            }
            await addSlot({ subjectId: subId, day: item.day, startTime: item.startTime, endTime: item.endTime || addHour(item.startTime) });
            count++;
          }
        }
        await loadSubjects();
        await loadSlots();
        addToast(`Added ${count} timetable slots`, 'success');
      } else if (scanType === 'attendance') {
        const today = format(new Date(), 'yyyy-MM-dd');
        for (const item of selectedItems) {
          let sub = subjects.find(s => s.name.toLowerCase() === item.subjectName.toLowerCase());
          if (!sub) {
            const id = await addSubject({ name: item.subjectName });
            sub = { id };
          }
          // Mark attended classes
          for (let i = 0; i < item.attended; i++) {
            await markAttendance(sub.id, today, 'attended');
          }
          count++;
        }
        addToast(`Updated attendance for ${count} subjects`, 'success');
      } else if (scanType === 'subjects') {
        for (const item of selectedItems) {
          const existing = subjects.find(s => s.name.toLowerCase() === item.subjectName.toLowerCase());
          if (!existing) {
            await addSubject({ name: item.subjectName });
            count++;
          }
        }
        await loadSubjects();
        addToast(`Added ${count} subjects`, 'success');
      }
    } catch (err) {
      addToast('Error applying data: ' + err.message, 'error');
    }

    setApplying(false);
    reset();
  };

  const reset = () => {
    setCapturedImg(null);
    setParsedData([]);
    setSelected({});
    setMode('choose');
  };

  const addHour = (t) => {
    const [h, m] = t.split(':').map(Number);
    return `${String((h+1)%24).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  };

  const scanTypes = [
    { id: 'timetable',  icon: Calendar,  label: 'Timetable',   desc: 'Scan weekly schedule / class routine' },
    { id: 'attendance', icon: Check,      label: 'Attendance',  desc: 'Scan attendance sheet or markbook' },
    { id: 'subjects',   icon: BookOpen,   label: 'Subjects',    desc: 'Scan subject list or course list' },
  ];

  return (
    <div className="page">
      <div className="page-top">
        <div>
          <h1 className="page-title">Scan & Fill</h1>
          <p className="page-sub">Auto-fill data from photos</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ── CHOOSE MODE ── */}
        {mode === 'choose' && (
          <motion.div key="choose" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            {cameraError && (
              <div style={{ background:'var(--red-bg)', color:'var(--red-text)', padding:'10px 12px', borderRadius:'var(--radius-m)', marginBottom:12, fontSize:'0.8125rem' }}>
                {cameraError}
              </div>
            )}

            {/* Scan type selector */}
            <div className="card-raised" style={{ marginBottom:14 }}>
              <p style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--text-2)', marginBottom:10 }}>WHAT ARE YOU SCANNING?</p>
              {scanTypes.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    className="w-full"
                    style={{
                      display:'flex', alignItems:'center', gap:12,
                      padding:'12px', borderRadius:'var(--radius-m)',
                      marginBottom:6, textAlign:'left',
                      background: scanType === t.id ? 'var(--primary-bg)' : 'var(--bg-alt)',
                      border: `2px solid ${scanType === t.id ? 'var(--primary)' : 'transparent'}`,
                      transition:'all .15s'
                    }}
                    onClick={() => setScanType(t.id)}
                    id={`scan-type-${t.id}`}
                  >
                    <div style={{
                      width:40, height:40, borderRadius:'var(--radius-m)',
                      background: scanType === t.id ? 'var(--primary)' : 'var(--surface)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      color: scanType === t.id ? 'white' : 'var(--text-2)',
                      flexShrink:0
                    }}>
                      <Icon size={20}/>
                    </div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:'0.9375rem' }}>{t.label}</div>
                      <div style={{ fontSize:'0.75rem', color:'var(--text-2)' }}>{t.desc}</div>
                    </div>
                    {scanType === t.id && <ChevronRight size={16} style={{ marginLeft:'auto', color:'var(--primary)' }}/>}
                  </button>
                );
              })}
            </div>

            {/* Action buttons */}
            <button className="btn btn-primary w-full" style={{ marginBottom:10 }} onClick={startCamera} id="open-camera-btn">
              <Camera size={18}/> Open Camera
            </button>
            <label className="btn btn-secondary w-full" id="upload-file-btn" style={{ cursor:'pointer' }}>
              <Upload size={18}/> Upload Image / PDF
              <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFileUpload} style={{ display:'none' }}/>
            </label>

            <div style={{ marginTop:20, padding:'14px', background:'var(--bg-alt)', borderRadius:'var(--radius-l)' }}>
              <p style={{ fontSize:'0.8125rem', fontWeight:700, marginBottom:6 }}>💡 Tips for best results</p>
              <ul style={{ fontSize:'0.75rem', color:'var(--text-2)', lineHeight:1.7 }}>
                <li>• Good lighting — avoid shadows</li>
                <li>• Hold camera steady, document flat</li>
                <li>• Make sure text is fully visible</li>
                <li>• Printed text works better than handwriting</li>
              </ul>
            </div>
          </motion.div>
        )}

        {/* ── CAMERA MODE ── */}
        {mode === 'camera' && (
          <motion.div key="camera" initial={{ opacity:0, scale:0.97 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}>
            <div className="scan-area" style={{ marginBottom:14 }}>
              <video ref={videoRef} style={{ width:'100%', height:'100%', objectFit:'cover' }} playsInline muted/>
              <div className="scan-overlay">
                <div className="scan-frame">
                  <div className="scan-corner tl"/><div className="scan-corner tr"/>
                  <div className="scan-corner bl"/><div className="scan-corner br"/>
                  <div className="scan-line"/>
                </div>
              </div>
            </div>
            <canvas ref={canvasRef} style={{ display:'none' }}/>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => { stopCamera(); setMode('choose'); }} id="cancel-camera">
                <X size={16}/> Cancel
              </button>
              <button className="btn btn-primary" style={{ flex:2 }} onClick={capture} id="capture-btn">
                <Camera size={18}/> Capture
              </button>
            </div>
            <p style={{ textAlign:'center', fontSize:'0.75rem', color:'var(--text-3)', marginTop:10 }}>
              Align document within the frame
            </p>
          </motion.div>
        )}

        {/* ── PROCESSING ── */}
        {mode === 'processing' && (
          <motion.div key="processing" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            {capturedImg && (
              <img src={capturedImg} alt="Captured" style={{ width:'100%', borderRadius:'var(--radius-l)', marginBottom:16 }}/>
            )}
            <div style={{ textAlign:'center', padding:'32px 0' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
              <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:6 }}>Reading text...</div>
              <div style={{ fontSize:'0.8125rem', color:'var(--text-2)' }}>
                OCR is scanning your image. This may take 15–30 seconds.
              </div>
              <div style={{ marginTop:20, display:'flex', gap:6, justifyContent:'center' }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width:8, height:8, borderRadius:'50%', background:'var(--primary)', animation:`spin 1s ease ${i*0.2}s infinite` }}/>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── RESULTS ── */}
        {mode === 'results' && (
          <motion.div key="results" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
            {capturedImg && (
              <img src={capturedImg} alt="Scanned" style={{ width:'100%', borderRadius:'var(--radius-l)', marginBottom:12, maxHeight:200, objectFit:'cover' }}/>
            )}

            <div className="card-raised" style={{ marginBottom:12 }}>
              <div className="flex items-center justify-between" style={{ marginBottom:10 }}>
                <div style={{ fontWeight:700, fontSize:'0.9375rem' }}>
                  {parsedData.length} items found
                </div>
                <span className="badge badge-green">{Object.values(selected).filter(Boolean).length} selected</span>
              </div>

              {parsedData.length === 0 ? (
                <div style={{ padding:'20px 0', textAlign:'center' }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>😕</div>
                  <div style={{ fontWeight:600, marginBottom:4 }}>Couldn't extract data</div>
                  <div style={{ fontSize:'0.8125rem', color:'var(--text-2)' }}>
                    The text may be unclear. Try better lighting or manual entry.
                  </div>
                </div>
              ) : (
                parsedData.map((item, i) => (
                  <div key={i} style={{
                    display:'flex', alignItems:'flex-start', gap:10,
                    padding:'10px 0',
                    borderBottom: i < parsedData.length-1 ? '1px solid var(--border-2)' : 'none'
                  }}>
                    <button
                      className="toggle"
                      style={{ marginTop:2 }}
                      onClick={() => setSelected(s => ({ ...s, [i]: !s[i] }))}
                      id={`select-item-${i}`}
                    >
                      <div className={`toggle ${selected[i] ? 'on' : ''}`} onClick={() => setSelected(s => ({ ...s, [i]: !s[i] }))}/>
                    </button>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:'0.9rem' }} className="truncate">{item.subjectName}</div>
                      {scanType === 'timetable' && (
                        <div style={{ fontSize:'0.75rem', color:'var(--text-2)', marginTop:2 }}>
                          {item.day !== null ? DAYS[item.day] : '?'} · {item.startTime || '?'} – {item.endTime || '?'}
                        </div>
                      )}
                      {scanType === 'attendance' && (
                        <div style={{ fontSize:'0.75rem', color:'var(--text-2)', marginTop:2 }}>
                          {item.attended}/{item.held} attended ({item.pct}%)
                        </div>
                      )}
                      {item.isKnown && <span className="badge badge-green" style={{ marginTop:3 }}>Known subject</span>}
                    </div>
                    <button
                      className="btn-icon"
                      style={{ flexShrink:0 }}
                      onClick={() => { setEditRow({ ...item, index:i }); setShowEditModal(true); }}
                    >
                      <FileText size={14}/>
                    </button>
                  </div>
                ))
              )}
            </div>



            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={reset} id="scan-retry-btn">
                <RefreshCw size={15}/> Retry
              </button>
              <button
                className="btn btn-primary"
                style={{ flex:2 }}
                onClick={applyResults}
                disabled={applying || Object.values(selected).every(v => !v)}
                id="apply-scan-btn"
              >
                {applying ? <RefreshCw size={15} className="spin"/> : <Check size={15}/>}
                {applying ? 'Applying...' : `Apply ${Object.values(selected).filter(Boolean).length} Items`}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit row modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Entry">
        {editRow && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div className="field">
              <label className="label">Subject Name</label>
              <input className="input" value={editRow.subjectName}
                onChange={e => setEditRow(r => ({ ...r, subjectName:e.target.value }))}/>
            </div>
            {scanType === 'timetable' && (
              <>
                <div className="field">
                  <label className="label">Day</label>
                  <select className="select" value={editRow.day ?? ''} onChange={e => setEditRow(r => ({ ...r, day: parseInt(e.target.value) }))}>
                    <option value="">Unknown</option>
                    {DAYS.map((d,i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <div className="field" style={{ flex:1 }}>
                    <label className="label">Start</label>
                    <input className="input" type="time" value={editRow.startTime||''} onChange={e => setEditRow(r => ({ ...r, startTime:e.target.value }))}/>
                  </div>
                  <div className="field" style={{ flex:1 }}>
                    <label className="label">End</label>
                    <input className="input" type="time" value={editRow.endTime||''} onChange={e => setEditRow(r => ({ ...r, endTime:e.target.value }))}/>
                  </div>
                </div>
              </>
            )}
            {scanType === 'attendance' && (
              <div style={{ display:'flex', gap:8 }}>
                <div className="field" style={{ flex:1 }}>
                  <label className="label">Total Held</label>
                  <input className="input" type="number" value={editRow.held||''} onChange={e => setEditRow(r => ({ ...r, held:parseInt(e.target.value) }))}/>
                </div>
                <div className="field" style={{ flex:1 }}>
                  <label className="label">Attended</label>
                  <input className="input" type="number" value={editRow.attended||''} onChange={e => setEditRow(r => ({ ...r, attended:parseInt(e.target.value) }))}/>
                </div>
              </div>
            )}
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={() => {
                setParsedData(d => d.map((item, i) => i === editRow.index ? { ...editRow } : item));
                setShowEditModal(false);
              }} id="save-edit-btn">Save</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
