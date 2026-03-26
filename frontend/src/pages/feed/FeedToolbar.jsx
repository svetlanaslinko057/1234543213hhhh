import React, { memo } from 'react';
import { Search, X } from 'lucide-react';
import { colors } from '../../constants/colors';

const FILTER_TABS = ['all', 'alpha', 'funding', 'unlock', 'activity', 'signal', 'listing', 'news'];
const SENTIMENT_FILTERS = ['all', 'positive', 'neutral', 'negative'];

function FeedToolbar({ 
  searchQuery, 
  onSearchChange, 
  activeFilter, 
  onFilterChange,
  sentimentFilter,
  onSentimentChange,
  searchResults,
  showSearchResults,
  onSearchFocus,
  onSearchBlur,
  onResultClick
}) {
  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <div 
          className="flex items-center gap-3 px-5 py-4 rounded-2xl border"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <Search size={20} style={{ color: colors.textMuted }} />
          <input
            type="text"
            data-testid="feed-search-input"
            placeholder="Search projects, tokens, funds..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
            className="flex-1 bg-transparent outline-none"
            style={{ color: colors.text }}
          />
          {searchQuery && (
            <button onClick={() => onSearchChange('')}>
              <X size={18} style={{ color: colors.textMuted }} />
            </button>
          )}
        </div>
        
        {/* Search Results Dropdown */}
        {showSearchResults && searchResults?.length > 0 && (
          <div 
            className="absolute top-full left-0 right-0 mt-2 rounded-2xl border shadow-lg overflow-hidden z-50 max-h-80 overflow-y-auto"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            {searchResults.map((result, i) => (
              <div
                key={i}
                data-testid={`search-result-${i}`}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => onResultClick?.(result)}
              >
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: colors.accentSoft, color: colors.accent }}
                >
                  {(result.symbol || result.name || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium" style={{ color: colors.text }}>{result.name}</p>
                  <p className="text-xs" style={{ color: colors.textMuted }}>
                    {result.symbol || result.type}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {FILTER_TABS.map(filter => (
            <button
              key={filter}
              data-testid={`filter-${filter}`}
              onClick={() => onFilterChange(filter)}
              className="px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all whitespace-nowrap"
              style={{ 
                backgroundColor: activeFilter === filter ? colors.accent : colors.surface,
                color: activeFilter === filter ? 'white' : colors.textSecondary
              }}
            >
              {filter === 'alpha' ? '🔥 Alpha' : filter}
            </button>
          ))}
        </div>
        
        {/* Sentiment Filters */}
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: colors.textMuted }}>Sentiment:</span>
          {SENTIMENT_FILTERS.map(filter => (
            <button
              key={filter}
              data-testid={`sentiment-filter-${filter}`}
              onClick={() => onSentimentChange(filter)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
              style={{
                backgroundColor: sentimentFilter === filter ? 
                  (filter === 'positive' ? '#dcfce7' : filter === 'negative' ? '#fee2e2' : filter === 'neutral' ? '#f3f4f6' : colors.accentSoft) :
                  colors.surface,
                color: sentimentFilter === filter ?
                  (filter === 'positive' ? '#16a34a' : filter === 'negative' ? '#dc2626' : filter === 'neutral' ? '#6b7280' : colors.accent) :
                  colors.textSecondary,
                border: sentimentFilter === filter ? '2px solid currentColor' : '2px solid transparent'
              }}
            >
              {filter === 'positive' ? '↑ ' : filter === 'negative' ? '↓ ' : filter === 'neutral' ? '→ ' : ''}{filter}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(FeedToolbar);
