import React from 'react';
import { motion } from 'framer-motion';
import { Check, X, Minus, Clock } from 'lucide-react';
import { fmt12 as formatTime12h } from '../../utils/attendance.js';

export default function AttendanceCard({ subject, slot, status, onMark }) {
  return (
    <motion.div
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
        borderLeft: `4px solid ${subject?.color || 'var(--primary)'}`,
        padding: '14px 16px',
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      layout
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 600,
          fontSize: '0.9375rem',
          color: 'var(--text)',
          marginBottom: 2
        }} className="truncate">
          {subject?.name || 'Unknown Subject'}
        </div>
        {slot && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.75rem',
            color: 'var(--text-secondary)'
          }}>
            <Clock size={12} />
            <span>{formatTime12h(slot.startTime)} – {formatTime12h(slot.endTime)}</span>
            {slot.room && <span>• {slot.room}</span>}
          </div>
        )}
      </div>

      <div className="mark-btn-group">
        <motion.button
          className={`mark-btn ${status === 'attended' ? 'attended' : ''}`}
          onClick={() => onMark('attended')}
          whileTap={{ scale: 0.85 }}
          title="Present"
          id={`mark-attended-${subject?.id}`}
        >
          <Check size={16} strokeWidth={2.5} />
        </motion.button>
        <motion.button
          className={`mark-btn ${status === 'missed' ? 'missed' : ''}`}
          onClick={() => onMark('missed')}
          whileTap={{ scale: 0.85 }}
          title="Absent"
          id={`mark-missed-${subject?.id}`}
        >
          <X size={16} strokeWidth={2.5} />
        </motion.button>
        <motion.button
          className={`mark-btn ${status === 'off' ? 'off' : ''}`}
          onClick={() => onMark('off')}
          whileTap={{ scale: 0.85 }}
          title="Cancelled/Off"
          id={`mark-off-${subject?.id}`}
        >
          <Minus size={16} strokeWidth={2.5} />
        </motion.button>
      </div>
    </motion.div>
  );
}
