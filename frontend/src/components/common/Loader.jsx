import React from 'react';
import { RefreshCw } from 'lucide-react';
import { colors } from '../../constants/colors';

function Loader({ size = 32, text }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <RefreshCw 
        className="animate-spin" 
        size={size} 
        style={{ color: colors.accent }} 
      />
      {text && (
        <p className="text-sm" style={{ color: colors.textSecondary }}>
          {text}
        </p>
      )}
    </div>
  );
}

export default React.memo(Loader);
