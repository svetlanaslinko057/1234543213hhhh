import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
import { colors } from '../../constants/colors';
import FeedCard from './FeedCard';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const FILTER_TABS = ['all', 'alpha', 'funding', 'unlock', 'activity', 'signal', 'listing', 'news'];

export default function FeedPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/news/feed?limit=50`);
      const data = await res.json();
      setEvents(data.articles || data.events || []);
    } catch (e) {
      console.error('Feed fetch error:', e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  return (
    <div className="space-y-6">
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
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none"
            style={{ color: colors.text }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}>
              <X size={18} style={{ color: colors.textMuted }} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {FILTER_TABS.map(f => (
          <button
            key={f}
            data-testid={`filter-${f}`}
            onClick={() => setFilter(f)}
            className="px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all whitespace-nowrap"
            style={{ 
              backgroundColor: filter === f ? colors.accent : colors.surface,
              color: filter === f ? 'white' : colors.textSecondary
            }}
          >
            {f === 'alpha' ? '🔥 Alpha' : f}
          </button>
        ))}
      </div>

      {/* Refresh button */}
      <div className="flex justify-end">
        <button
          data-testid="refresh-feed-btn"
          onClick={fetchFeed}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border transition-all hover:shadow-md disabled:opacity-50"
          style={{ borderColor: colors.border, color: colors.text }}
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Feed List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin" size={32} style={{ color: colors.accent }} />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12" style={{ color: colors.textMuted }}>
          No events found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event, i) => (
            <FeedCard key={event.id || event._id || i} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
