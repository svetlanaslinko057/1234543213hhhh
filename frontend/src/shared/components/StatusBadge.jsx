import React from 'react';
import { colors } from '../constants';

// System Status Badge
export function StatusBadge({ status }) {
  const statusStyles = {
    running: { bg: colors.successSoft, color: colors.success, label: 'Running' },
    healthy: { bg: colors.successSoft, color: colors.success, label: 'Healthy' },
    active: { bg: colors.successSoft, color: colors.success, label: 'Active' },
    idle: { bg: colors.warningSoft, color: colors.warning, label: 'Idle' },
    pending: { bg: colors.warningSoft, color: colors.warning, label: 'Pending' },
    stale: { bg: colors.warningSoft, color: colors.warning, label: 'Stale' },
    error: { bg: colors.errorSoft, color: colors.error, label: 'Error' },
    failed: { bg: colors.errorSoft, color: colors.error, label: 'Failed' },
    offline: { bg: colors.surface, color: colors.textMuted, label: 'Offline' }
  };
  const s = statusStyles[status] || statusStyles.offline;

  return (
    <span 
      className="px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
      {s.label}
    </span>
  );
}
