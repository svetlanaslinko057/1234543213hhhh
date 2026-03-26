import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, Globe, Newspaper, BookOpen, Shield, TrendingUp,
  AlertTriangle, Layers, Activity, DollarSign, Database, BarChart2,
  Eye, RefreshCw, X, ChevronDown, ExternalLink, CheckCircle, XCircle
} from 'lucide-react';
import { colors } from '../../shared/constants';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function NewsSourcesPage() {
  const [newsSources, setNewsSources] = useState({ sources: [], stats: { total: 0 } });
  const [newsSourcesSearch, setNewsSourcesSearch] = useState('');
  const [newsSourcesFilter, setNewsSourcesFilter] = useState({ tier: null, language: null, category: null });
  const [loading, setLoading] = useState(true);

  // Fetch news sources
  const fetchNewsSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/news-intelligence/sources-registry`);
      const data = await res.json();
      setNewsSources({ sources: data.sources || [], stats: data.stats || { total: 0 } });
    } catch (err) {
      console.error('Failed to fetch news sources:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNewsSources();
  }, [fetchNewsSources]);

  const stats = newsSources.stats || {};
  const sources = newsSources.sources || [];
  
  const tierColors = {
    A: { bg: '#ecfdf5', text: '#059669', label: 'Primary' },
    B: { bg: '#eef2ff', text: '#4f46e5', label: 'Secondary' },
    C: { bg: '#fef3c7', text: '#d97706', label: 'Research' },
    D: { bg: '#f7f8fb', text: '#64748b', label: 'Aggregators' }
  };
  
  const categoryConfig = {
    news: { icon: <Newspaper size={14} />, color: '#4f46e5' },
    research: { icon: <BookOpen size={14} />, color: '#8B5CF6' },
    official: { icon: <Shield size={14} />, color: '#059669' },
    analytics: { icon: <TrendingUp size={14} />, color: '#F97316' },
    security: { icon: <AlertTriangle size={14} />, color: '#dc2626' },
    defi: { icon: <Layers size={14} />, color: '#06B6D4' },
    dex: { icon: <Activity size={14} />, color: '#EC4899' },
    funding: { icon: <DollarSign size={14} />, color: '#10B981' },
    aggregator: { icon: <Database size={14} />, color: '#64748b' },
    derivatives: { icon: <BarChart2 size={14} />, color: '#F59E0B' },
    l2: { icon: <Layers size={14} />, color: '#3B82F6' },
    analysis: { icon: <Eye size={14} />, color: '#6366F1' }
  };
  
  const languageFlags = {
    en: '🇬🇧', ru: '🇷🇺', zh: '🇨🇳', jp: '🇯🇵', de: '🇩🇪', ua: '🇺🇦'
  };

  // Filter sources
  const filteredSources = sources.filter(source => {
    // Search filter
    if (newsSourcesSearch) {
      const search = newsSourcesSearch.toLowerCase();
      if (!source.name?.toLowerCase().includes(search) &&
          !source.domain?.toLowerCase().includes(search) &&
          !source.category?.toLowerCase().includes(search) &&
          !source.id?.toLowerCase().includes(search)) {
        return false;
      }
    }
    // Tier filter
    if (newsSourcesFilter.tier && source.tier !== newsSourcesFilter.tier) return false;
    // Language filter
    if (newsSourcesFilter.language && source.language !== newsSourcesFilter.language) return false;
    // Category filter
    if (newsSourcesFilter.category && source.category !== newsSourcesFilter.category) return false;
    
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin" size={32} style={{ color: colors.accent }} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="news-sources-page">
      {/* Stats Subtitle */}
      <p className="text-sm" style={{ color: colors.textSecondary }}>
        {stats.total || 0} sources across {Object.keys(stats.by_language || {}).length} languages and {Object.keys(stats.by_category || {}).length} categories
      </p>

      {/* Search Bar */}
      <div className="bg-white rounded-2xl border p-4" style={{ borderColor: colors.border }}>
        <div className="relative">
          <Search 
            size={20} 
            className="absolute left-4 top-1/2 -translate-y-1/2"
            style={{ color: colors.textMuted }}
          />
          <input
            data-testid="news-sources-search"
            type="text"
            value={newsSourcesSearch}
            onChange={(e) => setNewsSourcesSearch(e.target.value)}
            placeholder="Search sources by name, domain, category..."
            className="w-full pl-12 pr-12 py-3 rounded-xl border transition-all focus:outline-none focus:ring-2"
            style={{ 
              borderColor: colors.border,
              backgroundColor: colors.surface,
              color: colors.text
            }}
          />
          {newsSourcesSearch && (
            <button
              onClick={() => setNewsSourcesSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200"
            >
              <X size={16} style={{ color: colors.textMuted }} />
            </button>
          )}
        </div>
        {newsSourcesSearch && (
          <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
            Found <span className="font-bold" style={{ color: colors.accent }}>{filteredSources.length}</span> matching sources
          </p>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(tierColors).map(([tier, config]) => (
          <div 
            key={tier}
            className="p-5 rounded-2xl border transition-all hover:shadow-lg cursor-pointer"
            style={{ 
              backgroundColor: newsSourcesFilter.tier === tier ? config.bg : 'white',
              borderColor: newsSourcesFilter.tier === tier ? config.text : colors.border
            }}
            onClick={() => setNewsSourcesFilter(prev => ({ 
              ...prev, 
              tier: prev.tier === tier ? null : tier 
            }))}
          >
            <div className="flex items-center justify-between mb-2">
              <span 
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg"
                style={{ backgroundColor: config.bg, color: config.text }}
              >
                {tier}
              </span>
              <span className="text-3xl font-bold" style={{ color: config.text }}>
                {stats.by_tier?.[tier] || 0}
              </span>
            </div>
            <p className="text-sm font-medium" style={{ color: colors.text }}>Tier {tier}</p>
            <p className="text-xs" style={{ color: colors.textSecondary }}>{config.label}</p>
          </div>
        ))}
      </div>

      {/* Language & Category Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Language Distribution */}
        <div className="bg-white rounded-2xl border p-5" style={{ borderColor: colors.border }}>
          <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: colors.text }}>
            <Globe size={18} style={{ color: colors.accent }} />
            By Language
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.by_language || {}).sort((a, b) => b[1] - a[1]).map(([lang, count]) => {
              const isActive = newsSourcesFilter.language === lang;
              return (
                <button
                  key={lang}
                  onClick={() => setNewsSourcesFilter(prev => ({ 
                    ...prev, 
                    language: prev.language === lang ? null : lang 
                  }))}
                  className="px-3 py-2 rounded-lg transition-all flex items-center gap-2"
                  style={{ 
                    backgroundColor: isActive ? colors.accentSoft : colors.surface,
                    color: isActive ? colors.accent : colors.text
                  }}
                >
                  <span>{languageFlags[lang] || '🌐'}</span>
                  <span className="uppercase font-medium">{lang}</span>
                  <span className="text-xs" style={{ color: colors.textMuted }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-2xl border p-5" style={{ borderColor: colors.border }}>
          <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: colors.text }}>
            <Newspaper size={18} style={{ color: colors.accent }} />
            By Category
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.by_category || {}).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([cat, count]) => {
              const isActive = newsSourcesFilter.category === cat;
              const config = categoryConfig[cat] || { icon: <Database size={14} />, color: colors.textMuted };
              return (
                <button
                  key={cat}
                  onClick={() => setNewsSourcesFilter(prev => ({ 
                    ...prev, 
                    category: prev.category === cat ? null : cat 
                  }))}
                  className="px-3 py-2 rounded-lg transition-all flex items-center gap-2"
                  style={{ 
                    backgroundColor: isActive ? colors.accentSoft : colors.surface,
                    color: isActive ? colors.accent : colors.text
                  }}
                >
                  <span style={{ color: config.color }}>{config.icon}</span>
                  <span className="capitalize">{cat}</span>
                  <span className="text-xs" style={{ color: colors.textMuted }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Filters */}
      {(newsSourcesFilter.tier || newsSourcesFilter.language || newsSourcesFilter.category) && (
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: colors.textSecondary }}>Active filters:</span>
          {newsSourcesFilter.tier && (
            <button
              onClick={() => setNewsSourcesFilter(prev => ({ ...prev, tier: null }))}
              className="px-3 py-1 rounded-full text-sm flex items-center gap-1"
              style={{ backgroundColor: tierColors[newsSourcesFilter.tier]?.bg, color: tierColors[newsSourcesFilter.tier]?.text }}
            >
              Tier {newsSourcesFilter.tier} <X size={14} />
            </button>
          )}
          {newsSourcesFilter.language && (
            <button
              onClick={() => setNewsSourcesFilter(prev => ({ ...prev, language: null }))}
              className="px-3 py-1 rounded-full text-sm flex items-center gap-1"
              style={{ backgroundColor: colors.accentSoft, color: colors.accent }}
            >
              {newsSourcesFilter.language.toUpperCase()} <X size={14} />
            </button>
          )}
          {newsSourcesFilter.category && (
            <button
              onClick={() => setNewsSourcesFilter(prev => ({ ...prev, category: null }))}
              className="px-3 py-1 rounded-full text-sm flex items-center gap-1"
              style={{ backgroundColor: colors.accentSoft, color: colors.accent }}
            >
              {newsSourcesFilter.category} <X size={14} />
            </button>
          )}
          <button
            onClick={() => setNewsSourcesFilter({ tier: null, language: null, category: null })}
            className="text-sm underline"
            style={{ color: colors.textMuted }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Sources Table */}
      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: colors.border }}>
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: colors.surface }}>
              <th className="px-6 py-4 text-left text-sm font-medium" style={{ color: colors.textSecondary }}>Source</th>
              <th className="px-6 py-4 text-left text-sm font-medium" style={{ color: colors.textSecondary }}>Category</th>
              <th className="px-6 py-4 text-left text-sm font-medium" style={{ color: colors.textSecondary }}>Tier</th>
              <th className="px-6 py-4 text-left text-sm font-medium" style={{ color: colors.textSecondary }}>Language</th>
              <th className="px-6 py-4 text-left text-sm font-medium" style={{ color: colors.textSecondary }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredSources.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center" style={{ color: colors.textMuted }}>
                  No sources found
                </td>
              </tr>
            ) : (
              filteredSources.slice(0, 50).map((source, idx) => {
                const config = categoryConfig[source.category] || { icon: <Database size={14} />, color: colors.textMuted };
                const tierConfig = tierColors[source.tier] || tierColors.D;
                
                return (
                  <tr 
                    key={source.id || idx} 
                    className="border-t transition-colors hover:bg-gray-50"
                    style={{ borderColor: colors.borderLight }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: config.color + '20' }}
                        >
                          <span style={{ color: config.color }}>{config.icon}</span>
                        </div>
                        <div>
                          <p className="font-medium" style={{ color: colors.text }}>{source.name}</p>
                          <p className="text-xs" style={{ color: colors.textMuted }}>{source.domain || source.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span 
                        className="px-2 py-1 rounded text-xs capitalize"
                        style={{ backgroundColor: config.color + '20', color: config.color }}
                      >
                        {source.category || 'unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span 
                        className="px-3 py-1 rounded-lg font-bold text-sm"
                        style={{ backgroundColor: tierConfig.bg, color: tierConfig.text }}
                      >
                        {source.tier || 'D'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2">
                        <span>{languageFlags[source.language] || '🌐'}</span>
                        <span className="uppercase text-sm" style={{ color: colors.text }}>{source.language || 'en'}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {source.status === 'active' || source.enabled !== false ? (
                        <span className="flex items-center gap-1 text-sm" style={{ color: colors.success }}>
                          <CheckCircle size={14} /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-sm" style={{ color: colors.textMuted }}>
                          <XCircle size={14} /> Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {filteredSources.length > 50 && (
          <div className="px-6 py-4 border-t text-center" style={{ borderColor: colors.borderLight }}>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Showing 50 of {filteredSources.length} sources
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
