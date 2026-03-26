import React from 'react';
import { colors } from '../constants';

// Navigation Item
export function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      data-testid={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        active ? 'font-medium' : ''
      }`}
      style={{ 
        backgroundColor: active ? colors.accentSoft : 'transparent',
        color: active ? colors.accent : colors.textSecondary
      }}
    >
      <Icon size={20} />
      <span className="flex-1 text-left">{label}</span>
      {badge && (
        <span 
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ backgroundColor: colors.accent, color: 'white' }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
