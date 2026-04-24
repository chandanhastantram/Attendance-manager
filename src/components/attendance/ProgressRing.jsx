import React from 'react';

export default function ProgressRing({ percentage, size = 56, strokeWidth = 5, color }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const ringColor = color || (
    percentage >= 75 ? 'var(--success)' :
    percentage >= 50 ? 'var(--warning)' :
    'var(--error)'
  );

  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-light)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="progress-ring-text" style={{ fontSize: size * 0.22 }}>
        {percentage}%
      </span>
    </div>
  );
}
