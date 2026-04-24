import React, { useState, useEffect } from 'react';
import useTimetableStore from '../../stores/useTimetableStore.js';
import useSubjectStore from '../../stores/useSubjectStore.js';
import useToastStore from '../../stores/useToastStore.js';
import { DAYS } from '../../db/database.js';

export default function TimetableForm({ slot, day, onClose }) {
  const [subjectId, setSubjectId] = useState('');
  const [selectedDay, setSelectedDay] = useState(day ?? 0);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [room, setRoom] = useState('');

  const subjects = useSubjectStore(s => s.subjects);
  const addSlot = useTimetableStore(s => s.addSlot);
  const updateSlot = useTimetableStore(s => s.updateSlot);
  const addToast = useToastStore(s => s.addToast);

  useEffect(() => {
    if (slot) {
      setSubjectId(slot.subjectId);
      setSelectedDay(slot.day);
      setStartTime(slot.startTime);
      setEndTime(slot.endTime);
      setRoom(slot.room || '');
    }
  }, [slot]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subjectId) return;

    const data = {
      subjectId: parseInt(subjectId),
      day: selectedDay,
      startTime,
      endTime,
      room: room.trim()
    };

    if (slot) {
      await updateSlot(slot.id, data);
      addToast('Slot updated', 'success');
    } else {
      await addSlot(data);
      addToast('Slot added', 'success');
    }
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label className="label">Subject</label>
        <select
          className="select"
          value={subjectId}
          onChange={e => setSubjectId(e.target.value)}
          required
          id="slot-subject-select"
        >
          <option value="">Select a subject</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Day</label>
        <select
          className="select"
          value={selectedDay}
          onChange={e => setSelectedDay(parseInt(e.target.value))}
          id="slot-day-select"
        >
          {DAYS.map((d, i) => (
            <option key={i} value={i}>{d}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="label">Start Time</label>
          <input className="input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} id="slot-start-time" />
        </div>
        <div style={{ flex: 1 }}>
          <label className="label">End Time</label>
          <input className="input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} id="slot-end-time" />
        </div>
      </div>

      <div>
        <label className="label">Room (optional)</label>
        <input className="input" type="text" value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. Room 101" id="slot-room-input" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
        <button type="submit" className="btn btn-primary" style={{ flex: 1 }} id="save-slot-btn">
          {slot ? 'Update' : 'Add Slot'}
        </button>
      </div>
    </form>
  );
}
