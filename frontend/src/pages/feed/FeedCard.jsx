import React, { memo } from 'react';
import { colors } from '../../constants/colors';

const EVENT_TYPE_CONFIG = {
  funding: { color: '#10b981', bg: '#d1fae5', label: 'Funding', icon: '💰' },
  unlock: { color: '#f59e0b', bg: '#fef3c7', label: 'Unlock', icon: '🔓' },
  listing: { color: '#3b82f6', bg: '#dbeafe', label: 'Listing', icon: '📈' },
  activity: { color: '#f97316', bg: '#ffedd5', label: 'Activity', icon: '⚡' },
  signal: { color: '#8b5cf6', bg: '#ede9fe', label: 'Signal', icon: '📡' },
  news: { color: '#06b6d4', bg: '#cffafe', label: 'News', icon: '📰' },
  regulation: { color: '#d97706', bg: '#fef3c7', label: 'Regulation', icon: '⚖️' },
  hack: { color: '#dc2626', bg: '#fee2e2', label: 'Hack', icon: '🔓' },
  launch: { color: '#7c3aed', bg: '#ede9fe', label: 'Launch', icon: '🚀' },
  partnership: { color: '#db2777', bg: '#fce7f3', label: 'Partnership', icon: '🤝' }
};

const getSentimentStyle = (sentiment) => {
  if (sentiment === 'positive') return { bg: '#dcfce7', color: '#16a34a', icon: '↑' };
  if (sentiment === 'negative') return { bg: '#fee2e2', color: '#dc2626', icon: '↓' };
  return { bg: '#f3f4f6', color: '#6b7280', icon: '→' };
};

const getImportanceColor = (score) => {
  if (score >= 80) return { bg: '#fef3c7', color: '#d97706' };
  if (score >= 60) return { bg: '#dbeafe', color: '#2563eb' };
  return { bg: '#f3f4f6', color: '#6b7280' };
};

const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
};

function FeedCard({ event, onClick }) {
  const typeConfig = EVENT_TYPE_CONFIG[event.event_type] || EVENT_TYPE_CONFIG.news;
  const sentimentStyle = getSentimentStyle(event.sentiment);
  const importanceColors = getImportanceColor(event.importance_score || 0);

  return (
    <div
      data-testid={`feed-card-${event.id || event._id}`}
      onClick={() => onClick?.(event)}
      className="bg-white rounded-2xl border overflow-hidden transition-all hover:shadow-lg cursor-pointer h-full"
      style={{ borderColor: colors.border }}
    >
      {/* Cover Image */}
      {event.cover_image && (
        <div className="w-full h-32 overflow-hidden relative">
          <img 
            src={event.cover_image}
            alt={event.headline}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => e.target.style.display = 'none'}
          />
          {/* Badges */}
          <div className="absolute top-2 right-2 flex gap-1">
            {event.importance_score && (
              <span 
                className="px-2 py-1 rounded-lg text-xs font-bold shadow-md"
                style={{ backgroundColor: 'rgba(255,255,255,0.95)', color: importanceColors.color }}
              >
                IMP {Math.round(event.importance_score)}
              </span>
            )}
          </div>
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {event.sentiment && (
              <span 
                className="px-2 py-1 rounded-lg text-xs font-bold shadow-md flex items-center gap-1"
                style={{ backgroundColor: sentimentStyle.bg, color: sentimentStyle.color }}
              >
                {sentimentStyle.icon} {event.sentiment}
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Content */}
      <div className="p-4">
        {/* Type + Time */}
        <div className="flex items-center justify-between mb-2">
          <span 
            className="text-xs px-2 py-1 rounded-lg font-medium"
            style={{ backgroundColor: typeConfig.bg, color: typeConfig.color }}
          >
            {typeConfig.icon} {typeConfig.label}
          </span>
          <span className="text-xs" style={{ color: colors.textMuted }}>
            {formatDate(event.timestamp || event.created_at)}
          </span>
        </div>
        
        {/* Headline */}
        <h3 
          className="font-semibold text-sm line-clamp-2 mb-2"
          style={{ color: colors.text }}
        >
          {event.headline || event.title}
        </h3>
        
        {/* Summary */}
        {event.summary && (
          <p 
            className="text-xs line-clamp-2 mb-3"
            style={{ color: colors.textSecondary }}
          >
            {event.summary}
          </p>
        )}
        
        {/* Assets */}
        {event.assets?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {event.assets.slice(0, 3).map((asset, i) => (
              <span 
                key={i}
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: colors.accentSoft, color: colors.accent }}
              >
                {asset}
              </span>
            ))}
            {event.assets.length > 3 && (
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: colors.textMuted }}>
                +{event.assets.length - 3}
              </span>
            )}
          </div>
        )}
        
        {/* Sources */}
        {event.source_count && (
          <div className="flex items-center justify-between text-xs" style={{ color: colors.textMuted }}>
            <span>{event.source_count} sources</span>
            {event.fomo_score && (
              <span className="font-bold" style={{ color: colors.accent }}>
                FOMO {event.fomo_score}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(FeedCard);
