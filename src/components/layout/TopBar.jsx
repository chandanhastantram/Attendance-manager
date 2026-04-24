import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import useAttendanceStore from '../../stores/useAttendanceStore.js';
import useSettingsStore from '../../stores/useSettingsStore.js';
import db from '../../db/database.js';

export default function TopBar() {
  const settings = useSettingsStore(s => s.settings);
  const todayRecords = useAttendanceStore(s => s.todayRecords);
  const [overallPct, setOverallPct] = useState(null);

  useEffect(() => {
    const calc = async () => {
      const all = await db.attendanceRecords.toArray();
      const att = all.filter(r => r.status === 'attended').length;
      const od  = all.filter(r => r.status === 'od').length;
      const mis = all.filter(r => r.status === 'missed').length;
      const eff = att + od;
      const total = eff + mis;
      setOverallPct(total > 0 ? ((eff / total) * 100).toFixed(2) : null);
    };
    calc();
  }, [todayRecords]);

  const pct = parseFloat(overallPct);
  const criteria = settings.globalCriteria;
  const pillColor = overallPct === null ? 'var(--border-2)'
    : pct >= criteria ? 'var(--green)' : pct >= criteria - 15 ? 'var(--orange)' : 'var(--red)';

  return (
    <div className="top-bar" id="top-bar">
      <span className="top-bar-title">Vorn</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {overallPct !== null && (
          <div className="top-bar-pill" style={{ borderColor: pillColor, color: pillColor }} id="overall-pill">
            <span style={{ fontWeight: 800 }}>{overallPct}</span>
            <span style={{ opacity: 0.55, margin: '0 3px' }}>|</span>
            <span style={{ fontWeight: 600 }}>{criteria}</span>
          </div>
        )}
        <Link to="/settings" className="btn-icon" id="top-settings-btn" style={{ color: 'var(--text-2)' }}>
          <Settings size={20} />
        </Link>
      </div>
    </div>
  );
}
