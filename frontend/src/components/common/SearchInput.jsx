import React from 'react';
import { Search } from 'lucide-react';
import { colors } from '../../constants/colors';

function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="relative">
      <Search 
        className="absolute left-4 top-1/2 -translate-y-1/2" 
        size={20} 
        style={{ color: colors.textMuted }}
      />
      <input
        data-testid="search-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-12 pr-4 py-3 rounded-xl border bg-white transition-all focus:outline-none focus:ring-2"
        style={{ 
          borderColor: colors.border,
          color: colors.text
        }}
      />
    </div>
  );
}

export default React.memo(SearchInput);
