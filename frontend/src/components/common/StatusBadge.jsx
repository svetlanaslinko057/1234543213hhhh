import React from 'react';
import { colors } from '../../constants/colors';

const statusConfig = {
  active: { bg: colors.successSoft, text: colors.success, label: 'Active' },
  healthy: { bg: colors.successSoft, text: colors.success, label: 'Healthy' },
  online: { bg: colors.successSoft, text: colors.success, label: 'Online' },
  running: { bg: colors.successSoft, text: colors.success, label: 'Running' },
  success: { bg: colors.successSoft, text: colors.success, label: 'Success' },
  pending: { bg: colors.warningSoft, text: colors.warning, label: 'Pending' },
  warning: { bg: colors.warningSoft, text: colors.warning, label: 'Warning' },
  offline: { bg: colors.errorSoft, text: colors.error, label: 'Offline' },
  error: { bg: colors.errorSoft, text: colors.error, label: 'Error' },
  failed: { bg: colors.errorSoft, text: colors.error, label: 'Failed' }
};

function StatusBadge({ status, label }) {
  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span
      data-testid={`status-${status}`}
      className="px-2.5 py-1 text-xs font-medium rounded-full"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {label || config.label}
    </span>
  );
}

export default React.memo(StatusBadge);
