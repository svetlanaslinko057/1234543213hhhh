import React from 'react';
import { ChevronRight } from 'lucide-react';
import { colors } from '../constants';

// Section Header
export function SectionHeader({ title, action, onAction }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold" style={{ color: colors.text }}>{title}</h2>
      {action && (
        <button 
          onClick={onAction}
          className="text-sm flex items-center gap-1 hover:gap-2 transition-all"
          style={{ color: colors.accent }}
        >
          {action} <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}
