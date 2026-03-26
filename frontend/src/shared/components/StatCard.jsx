import React from 'react';
import { colors } from '../constants';

// Stat Card Component
export function StatCard({ title, value, change, icon: Icon, color = 'accent' }) {
  const isPositive = change && change > 0;
  const colorMap = {
    accent: { bg: colors.accentSoft, icon: colors.accent },
    success: { bg: colors.successSoft, icon: colors.success },
    warning: { bg: colors.warningSoft, icon: colors.warning },
    error: { bg: colors.errorSoft, icon: colors.error }
  };
  const c = colorMap[color] || colorMap.accent;

  return (
    <div 
      data-testid={`stat-card-${title.toLowerCase().replace(/\s/g, '-')}`}
      className="bg-white rounded-2xl p-6 border transition-all hover:shadow-lg hover:-translate-y-0.5"
      style={{ borderColor: colors.border }}
    >
      <div className="flex items-start justify-between mb-4">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: c.bg }}
        >
          <Icon size={22} style={{ color: c.icon }} />
        </div>
        {change !== undefined && (
          <span 
            className="text-sm font-medium px-2 py-1 rounded-lg"
            style={{ 
              backgroundColor: isPositive ? colors.successSoft : colors.errorSoft,
              color: isPositive ? colors.success : colors.error
            }}
          >
            {isPositive ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <p className="text-sm mb-1" style={{ color: colors.textSecondary }}>{title}</p>
      <p className="text-3xl font-bold" style={{ color: colors.text }}>{value}</p>
    </div>
  );
}
