import React, { useState, useEffect } from 'react';
import { SUBJECT_COLORS } from '../../db/database.js';
import useSubjectStore from '../../stores/useSubjectStore.js';
import useToastStore from '../../stores/useToastStore.js';

export default function SubjectForm({ subject, onClose }) {
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [color, setColor] = useState(SUBJECT_COLORS[0]);
  const [criteria, setCriteria] = useState('');

  const addSubject = useSubjectStore(s => s.addSubject);
  const updateSubject = useSubjectStore(s => s.updateSubject);
  const addToast = useToastStore(s => s.addToast);

  useEffect(() => {
    if (subject) {
      setName(subject.name);
      setShortName(subject.shortName || '');
      setColor(subject.color);
      setCriteria(subject.criteria ? String(subject.criteria) : '');
    }
  }, [subject]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const data = {
      name: name.trim(),
      shortName: shortName.trim() || name.trim().substring(0, 3).toUpperCase(),
      color,
      criteria: criteria ? parseInt(criteria) : null
    };

    if (subject) {
      await updateSubject(subject.id, data);
      addToast('Subject updated', 'success');
    } else {
      await addSubject(data);
      addToast('Subject added', 'success');
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label className="label">Subject Name</label>
        <input
          className="input"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Physics"
          required
          id="subject-name-input"
          autoFocus
        />
      </div>

      <div>
        <label className="label">Short Name</label>
        <input
          className="input"
          type="text"
          value={shortName}
          onChange={e => setShortName(e.target.value)}
          placeholder="e.g. PHY"
          maxLength={5}
          id="subject-short-name-input"
        />
      </div>

      <div>
        <label className="label">Custom Attendance Criteria (%)</label>
        <input
          className="input"
          type="number"
          value={criteria}
          onChange={e => setCriteria(e.target.value)}
          placeholder="Leave empty to use global (75%)"
          min={1}
          max={100}
          id="subject-criteria-input"
        />
      </div>

      <div>
        <label className="label">Color</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {SUBJECT_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: c,
                border: color === c ? '3px solid var(--text)' : '3px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                outline: color === c ? '2px solid var(--bg)' : 'none',
                outlineOffset: -3
              }}
              id={`color-${c.replace('#', '')}`}
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" style={{ flex: 1 }} id="save-subject-btn">
          {subject ? 'Update' : 'Add Subject'}
        </button>
      </div>
    </form>
  );
}
