import React from 'react';
import { colors } from '../../constants/colors';

function StatCard({ title, value, change, icon: Icon, color = 'accent' }) {
  const colorMap = {
    accent: { bg: colors.accentSoft, text: colors.accent },
    success: { bg: colors.successSoft, text: colors.success },
    warning: { bg: colors.warningSoft, text: colors.warning },
    error: { bg: colors.errorSoft, text: colors.error }
  };

  const c = colorMap[color] || colorMap.accent;

  return (
    <div 
      data-testid={`stat-${title?.toLowerCase().replace(/\s+/g, '-')}`}
      className="bg-white rounded-2xl border p-6 transition-all hover:shadow-lg"
      style={{ borderColor: colors.border }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium mb-1" style={{ color: colors.textSecondary }}>
            {title}
          </p>
          <p className="text-3xl font-bold" style={{ color: colors.text }}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {change !== undefined && (
            <p 
              className="text-sm mt-2 font-medium"
              style={{ color: change >= 0 ? colors.success : colors.error }}
            >
              {change >= 0 ? '+' : ''}{change}%
            </p>
          )}
        </div>
        {Icon && (
          <div 
            className="p-3 rounded-xl"
            style={{ backgroundColor: c.bg }}
          >
            <Icon size={24} style={{ color: c.text }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(StatCard);
