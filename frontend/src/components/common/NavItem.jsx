import React from 'react';
import { colors } from '../../constants/colors';

function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      data-testid={`nav-${label?.toLowerCase().replace(/\s+/g, '-')}`}
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all ${
        active ? 'font-medium' : ''
      }`}
      style={{
        backgroundColor: active ? colors.accentSoft : 'transparent',
        color: active ? colors.accent : colors.textSecondary
      }}
    >
      <div className="flex items-center gap-3">
        {Icon && <Icon size={20} />}
        <span>{label}</span>
      </div>
      {badge && (
        <span 
          className="px-2 py-0.5 text-xs rounded-full font-medium"
          style={{ 
            backgroundColor: active ? colors.accent : colors.accentSoft,
            color: active ? 'white' : colors.accent
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export default React.memo(NavItem);
