import React from 'react';
import { colors } from '../../constants/colors';

function SectionHeader({ title, action, onAction }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold" style={{ color: colors.text }}>
        {title}
      </h2>
      {action && (
        <button
          onClick={onAction}
          className="text-sm font-medium transition-colors hover:opacity-80"
          style={{ color: colors.accent }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

export default React.memo(SectionHeader);
