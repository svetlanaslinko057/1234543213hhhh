import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, DollarSign, Unlock, TrendingUp, Activity, Zap, FileText,
  ChevronRight, ChevronDown, ChevronUp, RefreshCw, ExternalLink, Clock, X,
  Target, Bell, AlertCircle, Globe, Eye, BarChart2, Newspaper, Radio,
  Link, Shield, Users, Sparkles, Database, Layers, CheckCircle
} from 'lucide-react';
import { colors } from '../../shared/constants';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function FeedPage() {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Intel stats state
  const [stats, setStats] = useState(null);
  
  // Intelligence Feed State
  const [feedEvents, setFeedEvents] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedFilter, setFeedFilter] = useState('all');
  const [alphaProjects, setAlphaProjects] = useState([]);
  const [alphaSignals, setAlphaSignals] = useState([]);
  const [alphaSearchResults, setAlphaSearchResults] = useState([]);
  const [newsSearchResults, setNewsSearchResults] = useState([]);
  const [showNewsSearch, setShowNewsSearch] = useState(false);
  const [newsPage, setNewsPage] = useState(1);
  const [newsLanguageFilter, setNewsLanguageFilter] = useState('all');
  const [showAlphaSearchResults, setShowAlphaSearchResults] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedNewsStory, setSelectedNewsStory] = useState(null);
  const [storyLang, setStoryLang] = useState('en'); // Language for viewing story modal
  
  // News Intelligence state
  const [newsIntelligence, setNewsIntelligence] = useState([]);
  const [newsIntelLoading, setNewsIntelLoading] = useState(false);
  const [sentimentFilter, setSentimentFilter] = useState('all'); // all, positive, neutral, negative
  const [feedLangFilter, setFeedLangFilter] = useState('all'); // all, en, ru - for News Intelligence feed
  
  // Multi-Provider Sentiment State
  const [multiProviderSentiment, setMultiProviderSentiment] = useState(null);
  const [sentimentProviders, setSentimentProviders] = useState([]);
  const [sentimentAnalysisLoading, setSentimentAnalysisLoading] = useState(false);
  const [cachedSentiments, setCachedSentiments] = useState({});
  const [sentimentHeatmapData, setSentimentHeatmapData] = useState([]);
  
  // Sentiment Trends state
  const [sentimentTrends, setSentimentTrends] = useState(null);
  const [topAssetsSentiment, setTopAssetsSentiment] = useState([]);
  const [marketSentiment, setMarketSentiment] = useState(null);
  const [sentimentTrendsLoading, setSentimentTrendsLoading] = useState(false);
  
  // Generation Progress state (P1)
  const [activeGenerations, setActiveGenerations] = useState({});
  const [generationPolling, setGenerationPolling] = useState(false);
  const [storyLoading, setStoryLoading] = useState(false);
  
  // Fetch detailed news story with language support
  const fetchNewsStoryDetail = useCallback(async (eventId, language = 'en') => {
    setStoryLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/news-intelligence/events/${eventId}?language=${language}`);
      const data = await res.json();
      setSelectedNewsStory(data);
    } catch (e) {
      console.error('Failed to fetch news story:', e);
    }
    setStoryLoading(false);
  }, []);
  
  // Reload story when language changes
  useEffect(() => {
    if (selectedNewsStory?.id) {
      fetchNewsStoryDetail(selectedNewsStory.id, storyLang);
    }
  }, [storyLang]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Poll for active generations
  const pollGenerationProgress = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/news-intelligence/generation/active`);
      const data = await res.json();
      if (data.ok) {
        setActiveGenerations(data.generations || {});
      }
    } catch (e) {
      console.error('Failed to poll generation progress:', e);
    }
  }, []);
  
  // Start polling when generations are active
  useEffect(() => {
    if (Object.keys(activeGenerations).length > 0 && !generationPolling) {
      setGenerationPolling(true);
      const interval = setInterval(pollGenerationProgress, 2000);
      return () => {
        clearInterval(interval);
        setGenerationPolling(false);
      };
    }
  }, [activeGenerations, generationPolling, pollGenerationProgress]);

  // Fetch Alpha Feed data
  const fetchAlphaFeed = useCallback(async () => {
    setFeedLoading(true);
    setNewsIntelLoading(true);
    try {
      // Fetch from Alpha API and News Intelligence API (ranked by importance)
      const sentimentParam = sentimentFilter !== 'all' ? `&sentiment=${sentimentFilter}` : '';
      const [eventsRes, projectsRes, signalsRes, newsRes, generationsRes] = await Promise.all([
        fetch(`${API_URL}/api/alpha/events?limit=24${feedFilter !== 'all' ? `&event_type=${feedFilter}` : ''}`).then(r => r.json()).catch(() => ({ events: [] })),
        fetch(`${API_URL}/api/alpha/projects?limit=8`).then(r => r.json()).catch(() => ({ projects: [] })),
        fetch(`${API_URL}/api/alpha/signals?limit=6`).then(r => r.json()).catch(() => ({ signals: [] })),
        fetch(`${API_URL}/api/news-intelligence/feed-ranked?limit=12${sentimentParam}`).then(r => r.json()).catch(() => ({ events: [] })),
        fetch(`${API_URL}/api/news-intelligence/generation/active`).then(r => r.json()).catch(() => ({ generations: {} }))
      ]);
      
      setFeedEvents(eventsRes.events || []);
      setAlphaProjects(projectsRes.projects || []);
      setAlphaSignals(signalsRes.signals || []);
      // Sort by importance_score if available, fallback to fomo_score
      const sortedNews = (newsRes.events || []).sort((a, b) => {
        const scoreA = a.importance_score ?? a.fomo_score ?? 0;
        const scoreB = b.importance_score ?? b.fomo_score ?? 0;
        return scoreB - scoreA;
      });
      setNewsIntelligence(sortedNews);
      setActiveGenerations(generationsRes.generations || {});
    } catch (e) {
      console.error('Failed to fetch alpha feed:', e);
    }
    setFeedLoading(false);
    setNewsIntelLoading(false);
  }, [feedFilter, sentimentFilter]);
  
  // Fetch Sentiment Trends data
  const fetchSentimentTrends = useCallback(async () => {
    setSentimentTrendsLoading(true);
    try {
      const [marketRes, topAssetsRes] = await Promise.all([
        fetch(`${API_URL}/api/news-intelligence/sentiment/market-trend?period=24h`).then(r => r.json()).catch(() => null),
        fetch(`${API_URL}/api/news-intelligence/sentiment/top-assets?limit=6`).then(r => r.json()).catch(() => ({ assets: [] }))
      ]);
      
      setMarketSentiment(marketRes);
      setTopAssetsSentiment(topAssetsRes.assets || []);
    } catch (e) {
      console.error('Failed to fetch sentiment trends:', e);
    }
    setSentimentTrendsLoading(false);
  }, []);

  // Fetch Multi-Provider Sentiment Status
  const fetchSentimentProviders = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/sentiment/providers`);
      const data = await res.json();
      setSentimentProviders(data.providers || []);
    } catch (e) {
      console.error('Failed to fetch sentiment providers:', e);
    }
  }, []);

  // Analyze text with Multi-Provider Sentiment
  const analyzeTextSentiment = useCallback(async (text) => {
    if (!text || text.length < 10) return null;
    
    setSentimentAnalysisLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/sentiment/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      setMultiProviderSentiment(data);
      return data;
    } catch (e) {
      console.error('Sentiment analysis failed:', e);
      return null;
    } finally {
      setSentimentAnalysisLoading(false);
    }
  }, []);

  // Fetch cached sentiments for events
  const fetchCachedSentiments = useCallback(async (eventIds) => {
    if (!eventIds || eventIds.length === 0) return;
    
    try {
      const res = await fetch(`${API_URL}/api/sentiment/cache/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventIds)
      });
      const data = await res.json();
      setCachedSentiments(prev => ({ ...prev, ...data.sentiments }));
    } catch (e) {
      console.error('Failed to fetch cached sentiments:', e);
    }
  }, []);

  // Fetch sentiment heatmap data
  const fetchSentimentHeatmap = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/sentiment/cache/stats`);
      const stats = await res.json();
      
      // Generate heatmap data from cache stats
      const heatmap = [];
      const now = new Date();
      
      // Create 24-hour heatmap buckets
      for (let i = 23; i >= 0; i--) {
        const hour = new Date(now);
        hour.setHours(now.getHours() - i);
        
        // Simulate sentiment distribution based on stats
        const total = stats.total_cached || 0;
        const byLabel = stats.by_label || {};
        
        heatmap.push({
          hour: hour.toISOString(),
          hourLabel: hour.getHours() + ':00',
          positive: byLabel.positive?.count || 0,
          neutral: byLabel.neutral?.count || 0,
          negative: byLabel.negative?.count || 0,
          avgScore: ((byLabel.positive?.avg_score || 0) + (byLabel.negative?.avg_score || 0)) / 2,
          total: total
        });
      }
      
      setSentimentHeatmapData(heatmap);
    } catch (e) {
      console.error('Failed to fetch sentiment heatmap:', e);
    }
  }, []);

  // Search handler for Alpha Feed
  const handleAlphaSearch = async (query) => {
    if (query.length < 2) {
      setAlphaSearchResults([]);
      setNewsSearchResults([]);
      setShowAlphaSearchResults(false);
      setShowNewsSearch(false);
      return;
    }
    
    try {
      // Search both alpha entities, news, and events
      const [alphaRes, newsRes, eventsRes] = await Promise.all([
        fetch(`${API_URL}/api/alpha/search?q=${encodeURIComponent(query)}`),
        fetch(`${API_URL}/api/news/search?q=${encodeURIComponent(query)}&limit=30`),
        fetch(`${API_URL}/api/alpha/events?limit=20`)
      ]);
      
      const alphaData = await alphaRes.json();
      const newsData = await newsRes.json();
      const eventsData = await eventsRes.json();
      
      // Filter events by search query
      const filteredEvents = (eventsData.events || []).filter(e => {
        const searchLower = query.toLowerCase();
        return (
          (e.title && e.title.toLowerCase().includes(searchLower)) ||
          (e.asset && e.asset.toLowerCase().includes(searchLower)) ||
          (e.description && e.description.toLowerCase().includes(searchLower))
        );
      });
      
      // Combine alpha results with matching events
      const combinedResults = [
        ...(alphaData.results || []),
        ...filteredEvents.map(e => ({
          type: e.type || 'event',
          id: e.id,
          name: e.title || e.asset,
          symbol: e.asset,
          entity_type: 'event'
        }))
      ];
      
      setAlphaSearchResults(combinedResults.slice(0, 20));
      setNewsSearchResults(newsData.articles || []);
      setShowAlphaSearchResults(true);
      setShowNewsSearch(true);
      setNewsPage(1);
    } catch (e) {
      console.error('Search failed:', e);
    }
  };

  // Legacy fetch for backward compatibility
  const fetchFeedEvents = fetchAlphaFeed;

  // Load data on mount (FeedPage is only rendered when feed tab is active)
  useEffect(() => {
    fetchAlphaFeed();
    fetchSentimentTrends();
    fetchSentimentProviders();
    fetchSentimentHeatmap();
    
    // Fetch intel stats
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_URL}/api/intel/stats`);
        const data = await res.json();
        setStats(data);
      } catch (e) {
        console.error('Failed to fetch stats:', e);
      }
    };
    fetchStats();
  }, []);

  // Load cached sentiments when news events load
  useEffect(() => {
    if (newsIntelligence && newsIntelligence.length > 0) {
      const eventIds = newsIntelligence
        .map(e => e.event_id || e.id)
        .filter(Boolean);
      if (eventIds.length > 0) {
        fetchCachedSentiments(eventIds);
      }
    }
  }, [newsIntelligence, fetchCachedSentiments]);

  // Render Alpha Feed (Main Intelligence Feed)

  // Event type configuration
  const eventTypeConfig = {
    funding: { icon: DollarSign, color: '#10b981', bg: '#d1fae5', label: 'Funding' },
    unlock: { icon: Unlock, color: '#f59e0b', bg: '#fef3c7', label: 'Unlock' },
    listing: { icon: TrendingUp, color: '#3b82f6', bg: '#dbeafe', label: 'Listing' },
    activity: { icon: Activity, color: '#f97316', bg: '#ffedd5', label: 'Activity' },
    signal: { icon: Zap, color: '#8b5cf6', bg: '#ede9fe', label: 'Signal' },
    news: { icon: FileText, color: '#06b6d4', bg: '#cffafe', label: 'News' },
    market_signal: { icon: Zap, color: '#8b5cf6', bg: '#ede9fe', label: 'Signal' },
    trending: { icon: TrendingUp, color: '#10b981', bg: '#d1fae5', label: 'Trending' }
  };

  const filterTabs = ['all', 'alpha', 'funding', 'unlock', 'activity', 'signal', 'listing', 'news'];

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

  const getImpactColor = (score) => {
    if (score >= 80) return { bg: '#fee2e2', color: '#dc2626' };
    if (score >= 60) return { bg: '#fef3c7', color: '#d97706' };
    if (score >= 40) return { bg: '#dbeafe', color: '#2563eb' };
    return { bg: '#f3f4f6', color: '#6b7280' };
  };

  // Main render
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
              data-testid="alpha-search-input"
              placeholder="Search projects, tokens, funds..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleAlphaSearch(e.target.value);
              }}
              onFocus={() => searchQuery.length >= 2 && setShowAlphaSearchResults(true)}
              onBlur={() => setTimeout(() => setShowAlphaSearchResults(false), 200)}
              className="flex-1 bg-transparent outline-none"
              style={{ color: colors.text }}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setAlphaSearchResults([]); }}>
                <X size={18} style={{ color: colors.textMuted }} />
              </button>
            )}
          </div>
          
          {/* Search Results Dropdown */}
          {showAlphaSearchResults && alphaSearchResults.length > 0 && (
            <div 
              className="absolute top-full left-0 right-0 mt-2 rounded-2xl border shadow-lg overflow-hidden z-50"
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            >
              {alphaSearchResults.map((result, i) => (
                <div
                  key={i}
                  data-testid={`search-result-${i}`}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    setSearchQuery(result.name || result.symbol);
                    setShowAlphaSearchResults(false);
                  }}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: colors.accentSoft, color: colors.accent }}>
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

        {/* News Search Results */}
        {showNewsSearch && newsSearchResults.length > 0 && searchQuery.length >= 2 && (
          <div 
            className="rounded-2xl border p-4 mb-4"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2" style={{ color: colors.text }}>
                <Newspaper size={18} style={{ color: '#06b6d4' }} />
                News Results for "{searchQuery}"
                <span className="text-sm font-normal" style={{ color: colors.textMuted }}>
                  ({newsSearchResults.length} articles)
                </span>
              </h3>
              <div className="flex items-center gap-2">
                {/* Language Filter */}
                {['all', 'en', 'ru'].map(lang => (
                  <button
                    key={lang}
                    onClick={() => setNewsLanguageFilter(lang)}
                    className="px-2 py-1 rounded text-xs font-medium"
                    style={{
                      backgroundColor: newsLanguageFilter === lang ? colors.accent : colors.surface,
                      color: newsLanguageFilter === lang ? 'white' : colors.textMuted
                    }}
                  >
                    {lang === 'all' ? 'All' : lang.toUpperCase()}
                  </button>
                ))}
                <button 
                  onClick={() => { setNewsSearchResults([]); setShowNewsSearch(false); }}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <X size={16} style={{ color: colors.textMuted }} />
                </button>
              </div>
            </div>
            
            {/* News Articles */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {newsSearchResults
                .filter(a => newsLanguageFilter === 'all' || a.language === newsLanguageFilter)
                .slice((newsPage - 1) * 5, newsPage * 5)
                .map((article, i) => (
                <div 
                  key={i}
                  className="flex gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-all"
                  onClick={() => article.url && window.open(article.url, '_blank')}
                >
                  {(article.image_url || article.image) ? (
                    <img 
                      src={article.image_url || article.image} 
                      alt="" 
                      className="w-20 h-14 object-cover rounded-lg flex-shrink-0"
                    />
                  ) : (
                    <div 
                      className="w-20 h-14 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: colors.surface }}
                    >
                      <Newspaper size={20} style={{ color: colors.textMuted }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-clamp-2" style={{ color: colors.text }}>
                      {article.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs" style={{ color: colors.textMuted }}>
                        {article.source}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ 
                        backgroundColor: article.language === 'ru' ? '#fee2e2' : '#dbeafe',
                        color: article.language === 'ru' ? '#dc2626' : '#2563eb'
                      }}>
                        {(article.language || 'en').toUpperCase()}
                      </span>
                      <span className="text-xs" style={{ color: colors.textMuted }}>
                        {article.published_at ? new Date(article.published_at).toLocaleDateString() : ''}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Pagination */}
            {newsSearchResults.filter(a => newsLanguageFilter === 'all' || a.language === newsLanguageFilter).length > 5 && (
              <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t" style={{ borderColor: colors.border }}>
                <button
                  onClick={() => setNewsPage(p => Math.max(1, p - 1))}
                  disabled={newsPage === 1}
                  className="px-3 py-1 rounded text-sm"
                  style={{ 
                    backgroundColor: newsPage > 1 ? colors.accent : colors.surface,
                    color: newsPage > 1 ? 'white' : colors.textMuted
                  }}
                >
                  ← Prev
                </button>
                <span className="text-sm" style={{ color: colors.textMuted }}>
                  Page {newsPage} of {Math.ceil(newsSearchResults.filter(a => newsLanguageFilter === 'all' || a.language === newsLanguageFilter).length / 5)}
                </span>
                <button
                  onClick={() => setNewsPage(p => p + 1)}
                  disabled={newsPage >= Math.ceil(newsSearchResults.filter(a => newsLanguageFilter === 'all' || a.language === newsLanguageFilter).length / 5)}
                  className="px-3 py-1 rounded text-sm"
                  style={{ 
                    backgroundColor: newsPage < Math.ceil(newsSearchResults.filter(a => newsLanguageFilter === 'all' || a.language === newsLanguageFilter).length / 5) ? colors.accent : colors.surface,
                    color: newsPage < Math.ceil(newsSearchResults.filter(a => newsLanguageFilter === 'all' || a.language === newsLanguageFilter).length / 5) ? 'white' : colors.textMuted
                  }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {filterTabs.map(filter => (
            <button
              key={filter}
              data-testid={`filter-${filter}`}
              onClick={() => setFeedFilter(filter)}
              className="px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all whitespace-nowrap"
              style={{ 
                backgroundColor: feedFilter === filter ? colors.accent : colors.surface,
                color: feedFilter === filter ? 'white' : colors.textSecondary
              }}
            >
              {filter === 'alpha' ? '🔥 Alpha' : filter}
            </button>
          ))}
        </div>

        {/* Alpha Projects Grid */}
        {(feedFilter === 'all' || feedFilter === 'alpha') && alphaProjects.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: colors.text }}>
              <Zap size={20} style={{ color: colors.warning }} />
              Alpha Projects
            </h3>
            <div className="grid grid-cols-4 gap-4">
              {alphaProjects.slice(0, 8).map((project, i) => (
                <div
                  key={i}
                  data-testid={`alpha-project-${i}`}
                  className="bg-white rounded-2xl border p-4 transition-all hover:shadow-lg cursor-pointer"
                  style={{ borderColor: colors.border }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
                      style={{ backgroundColor: colors.accentSoft, color: colors.accent }}>
                      {(project.symbol || project.name || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate" style={{ color: colors.text }}>
                        {project.name || project.symbol}
                      </p>
                      <p className="text-xs" style={{ color: colors.textMuted }}>
                        {project.category || 'Crypto'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mb-3">
                    {project.metrics?.funding && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#d1fae5', color: '#059669' }}>
                        💰 Funding
                      </span>
                    )}
                    {project.metrics?.activity && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#ffedd5', color: '#ea580c' }}>
                        ⚡ Activity
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: colors.textMuted }}>
                      {project.events_count} events
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold" style={{ color: colors.accent }}>
                        {project.alpha_score}
                      </span>
                      <span className="text-xs" style={{ color: colors.textMuted }}>Alpha</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alpha Signals */}
        {(feedFilter === 'all' || feedFilter === 'signal' || feedFilter === 'alpha') && alphaSignals.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: colors.text }}>
              <Activity size={20} style={{ color: '#8b5cf6' }} />
              Market Signals
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {alphaSignals.slice(0, 6).map((signal, i) => (
                <div
                  key={i}
                  data-testid={`signal-${i}`}
                  className="rounded-2xl border p-4 transition-all hover:shadow-lg"
                  style={{ borderColor: colors.border, backgroundColor: '#faf5ff' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-bold" style={{ color: colors.text }}>
                      {signal.asset}
                    </span>
                    <span className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: '#8b5cf6', color: 'white' }}>
                      {signal.type?.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-3">
                    {Object.entries(signal.components || {}).slice(0, 3).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span style={{ color: colors.textMuted }}>{key.replace('_', ' ')}</span>
                        <span className="font-medium" style={{ color: colors.text }}>
                          {(value * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: colors.border }}>
                    <span className="text-xs" style={{ color: colors.textMuted }}>Score</span>
                    <span className="text-xl font-bold" style={{ color: '#8b5cf6' }}>{signal.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* News Intelligence Events */}
        {newsIntelligence.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: colors.text }}>
              <Globe size={20} style={{ color: '#06b6d4' }} />
              News Intelligence
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#cffafe', color: '#0891b2' }}>
                AI-Powered
              </span>
            </h3>
            
            {/* Sentiment Filter Buttons */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-sm" style={{ color: colors.textMuted }}>Sentiment:</span>
              {['all', 'positive', 'neutral', 'negative'].map(filter => (
                <button
                  key={filter}
                  data-testid={`sentiment-filter-${filter}`}
                  onClick={() => setSentimentFilter(filter)}
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
              
              {/* Language Filter */}
              <span className="text-sm ml-4" style={{ color: colors.textMuted }}>Language:</span>
              {['all', 'en', 'ru'].map(lang => (
                <button
                  key={lang}
                  data-testid={`lang-filter-${lang}`}
                  onClick={() => setFeedLangFilter(lang)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    backgroundColor: feedLangFilter === lang ? colors.accent : colors.surface,
                    color: feedLangFilter === lang ? 'white' : colors.textSecondary,
                    border: feedLangFilter === lang ? '2px solid transparent' : '2px solid transparent'
                  }}
                >
                  {lang === 'all' ? 'All' : lang.toUpperCase()}
                </button>
              ))}
            </div>
            
            {/* Multi-Provider Sentiment Engine Widget */}
            <div 
              data-testid="multi-provider-sentiment-widget"
              className="mb-6 bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border p-5"
              style={{ borderColor: '#c4b5fd' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#a855f7' }}>
                    <Zap size={16} style={{ color: 'white' }} />
                  </div>
                  <div>
                    <span className="font-semibold text-sm" style={{ color: '#6b21a8' }}>Multi-Provider Sentiment</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs" style={{ color: '#9333ea' }}>
                        {sentimentProviders.filter(p => p.available).length} providers active
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {sentimentProviders.map(provider => (
                    <div 
                      key={provider.id}
                      className="px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1"
                      style={{ 
                        backgroundColor: provider.available ? '#dcfce7' : '#f3f4f6',
                        color: provider.available ? '#16a34a' : '#9ca3af'
                      }}
                      title={provider.id === 'fomo' 
                        ? 'FOMO: Внутренний движок (ключ не требуется)'
                        : `${provider.name}: ${provider.model}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${provider.available ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                      {provider.id === 'fomo' ? 'FOMO (Internal)' : provider.id.toUpperCase()}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Consensus + FOMO Display */}
              {multiProviderSentiment ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Consensus Score */}
                  <div className="bg-white rounded-xl p-4 border" style={{ borderColor: '#e9d5ff' }}>
                    <div className="text-xs font-medium mb-1" style={{ color: '#7c3aed' }}>CONSENSUS</div>
                    <div className="flex items-center justify-between">
                      <span 
                        className="text-2xl font-bold"
                        style={{ 
                          color: multiProviderSentiment.consensus?.score > 0.15 ? '#16a34a' : 
                                 multiProviderSentiment.consensus?.score < -0.15 ? '#dc2626' : '#6b7280' 
                        }}
                      >
                        {multiProviderSentiment.consensus?.score > 0 ? '+' : ''}
                        {(multiProviderSentiment.consensus?.score * 100).toFixed(0)}%
                      </span>
                      <span 
                        className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                        style={{ 
                          backgroundColor: multiProviderSentiment.consensus?.label === 'positive' ? '#dcfce7' :
                                          multiProviderSentiment.consensus?.label === 'negative' ? '#fee2e2' : '#f3f4f6',
                          color: multiProviderSentiment.consensus?.label === 'positive' ? '#16a34a' :
                                 multiProviderSentiment.consensus?.label === 'negative' ? '#dc2626' : '#6b7280'
                        }}
                      >
                        {multiProviderSentiment.consensus?.label}
                      </span>
                    </div>
                    <div className="text-xs mt-1" style={{ color: '#9ca3af' }}>
                      {multiProviderSentiment.consensus?.providers_used} providers used
                    </div>
                  </div>
                  
                  {/* FOMO Score */}
                  <div 
                    className="bg-white rounded-xl p-4 border"
                    style={{ borderColor: multiProviderSentiment.fomo?.available ? '#fde68a' : '#e5e7eb' }}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs font-medium" style={{ color: '#d97706' }}>FOMO</span>
                      <span 
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ 
                          backgroundColor: multiProviderSentiment.fomo?.available ? '#fef3c7' : '#f3f4f6',
                          color: multiProviderSentiment.fomo?.available ? '#92400e' : '#9ca3af'
                        }}
                      >
                        {multiProviderSentiment.fomo?.available ? 'ACTIVE' : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span 
                        className="text-2xl font-bold"
                        style={{ 
                          color: multiProviderSentiment.fomo?.available ? 
                            (multiProviderSentiment.fomo?.score > 0.15 ? '#16a34a' : 
                             multiProviderSentiment.fomo?.score < -0.15 ? '#dc2626' : '#6b7280') : '#d1d5db'
                        }}
                      >
                        {multiProviderSentiment.fomo?.available ? 
                          `${multiProviderSentiment.fomo?.score > 0 ? '+' : ''}${(multiProviderSentiment.fomo?.score * 100).toFixed(0)}%` : 
                          '—'}
                      </span>
                      {multiProviderSentiment.fomo?.available && (
                        <span 
                          className="px-2 py-0.5 rounded-full text-xs font-medium capitalize"
                          style={{ 
                            backgroundColor: multiProviderSentiment.fomo?.label === 'positive' ? '#dcfce7' :
                                            multiProviderSentiment.fomo?.label === 'negative' ? '#fee2e2' : '#f3f4f6',
                            color: multiProviderSentiment.fomo?.label === 'positive' ? '#16a34a' :
                                   multiProviderSentiment.fomo?.label === 'negative' ? '#dc2626' : '#6b7280'
                          }}
                        >
                          {multiProviderSentiment.fomo?.label}
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-1" style={{ color: '#9ca3af' }}>
                      Confidence: {((multiProviderSentiment.fomo?.confidence || 0) * 100).toFixed(0)}%
                    </div>
                  </div>
                  
                  {/* Provider Breakdown */}
                  <div className="bg-white rounded-xl p-4 border" style={{ borderColor: '#e9d5ff' }}>
                    <div className="text-xs font-medium mb-2" style={{ color: '#7c3aed' }}>PROVIDERS</div>
                    <div className="space-y-2">
                      {multiProviderSentiment.providers?.map((provider, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-xs font-medium uppercase" style={{ color: colors.text }}>
                            {provider.provider}
                          </span>
                          <div className="flex items-center gap-2">
                            <span 
                              className="text-xs font-bold"
                              style={{ 
                                color: provider.error ? '#ef4444' :
                                       provider.score > 0.15 ? '#16a34a' : 
                                       provider.score < -0.15 ? '#dc2626' : '#6b7280'
                              }}
                            >
                              {provider.error ? 'ERR' : `${provider.score > 0 ? '+' : ''}${(provider.score * 100).toFixed(0)}%`}
                            </span>
                            <span className="text-[10px]" style={{ color: '#9ca3af' }}>
                              {provider.latency_ms}ms
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm" style={{ color: '#7c3aed' }}>
                    Select a news item or click "Analyze" to see multi-provider sentiment
                  </p>
                </div>
              )}
            </div>
            
            {/* Sentiment Heatmap */}
            <div 
              data-testid="sentiment-heatmap"
              className="mb-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 border border-slate-700"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-orange-500 to-red-500">
                    <Activity size={16} style={{ color: 'white' }} />
                  </div>
                  <div>
                    <span className="font-semibold text-sm text-white">Sentiment Heatmap</span>
                    <div className="text-xs text-slate-400">24h sentiment momentum</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-green-500"></span>
                    <span className="text-slate-400">Bullish</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-slate-500"></span>
                    <span className="text-slate-400">Neutral</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-red-500"></span>
                    <span className="text-slate-400">Bearish</span>
                  </span>
                </div>
              </div>
              
              {/* Heatmap Grid */}
              <div className="grid grid-cols-12 gap-1 mb-3">
                {sentimentHeatmapData.slice(-12).map((item, idx) => {
                  const positiveRatio = item.positive / Math.max(item.total, 1);
                  const negativeRatio = item.negative / Math.max(item.total, 1);
                  const dominantSentiment = positiveRatio > negativeRatio ? 'positive' : 
                                            negativeRatio > positiveRatio ? 'negative' : 'neutral';
                  const intensity = Math.max(positiveRatio, negativeRatio);
                  
                  return (
                    <div key={idx} className="flex flex-col items-center">
                      <div 
                        className="w-full h-16 rounded-lg transition-all hover:scale-105 cursor-pointer relative overflow-hidden"
                        style={{ 
                          backgroundColor: dominantSentiment === 'positive' ? `rgba(34, 197, 94, ${0.3 + intensity * 0.7})` :
                                          dominantSentiment === 'negative' ? `rgba(239, 68, 68, ${0.3 + intensity * 0.7})` :
                                          'rgba(100, 116, 139, 0.4)'
                        }}
                        title={`${item.hourLabel}: ${item.positive} bullish, ${item.negative} bearish`}
                      >
                        {/* Sentiment bar inside cell */}
                        <div 
                          className="absolute bottom-0 left-0 right-0 bg-white/20"
                          style={{ height: `${Math.min(intensity * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1">{item.hourLabel}</span>
                    </div>
                  );
                })}
              </div>
              
              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-3 pt-3 border-t border-slate-700">
                <div className="text-center">
                  <div className="text-lg font-bold text-green-400">
                    {sentimentHeatmapData.reduce((sum, i) => sum + (i.positive || 0), 0)}
                  </div>
                  <div className="text-xs text-slate-500">Bullish Events</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-400">
                    {sentimentHeatmapData.reduce((sum, i) => sum + (i.negative || 0), 0)}
                  </div>
                  <div className="text-xs text-slate-500">Bearish Events</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-slate-300">
                    {sentimentHeatmapData.reduce((sum, i) => sum + (i.neutral || 0), 0)}
                  </div>
                  <div className="text-xs text-slate-500">Neutral Events</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-400">
                    {sentimentHeatmapData.length > 0 ? sentimentHeatmapData[0].total : 0}
                  </div>
                  <div className="text-xs text-slate-500">Total Cached</div>
                </div>
              </div>
            </div>
            
            {/* Sentiment Trends Dashboard */}
            {marketSentiment && (
              <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Market Sentiment Card */}
                <div 
                  className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border"
                  style={{ borderColor: '#c7d2fe' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart2 size={18} style={{ color: '#6366f1' }} />
                    <span className="text-sm font-medium" style={{ color: '#4f46e5' }}>Market Sentiment</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span 
                      className="text-2xl font-bold"
                      style={{ 
                        color: marketSentiment.summary?.avg_sentiment > 0.1 ? '#16a34a' : 
                               marketSentiment.summary?.avg_sentiment < -0.1 ? '#dc2626' : '#6b7280' 
                      }}
                    >
                      {marketSentiment.summary?.avg_sentiment > 0 ? '+' : ''}{(marketSentiment.summary?.avg_sentiment * 100).toFixed(0)}%
                    </span>
                    <span 
                      className="text-xs px-2 py-1 rounded-full font-medium capitalize"
                      style={{ 
                        backgroundColor: marketSentiment.summary?.trend === 'improving' ? '#dcfce7' :
                                        marketSentiment.summary?.trend === 'declining' ? '#fee2e2' : '#f3f4f6',
                        color: marketSentiment.summary?.trend === 'improving' ? '#16a34a' :
                               marketSentiment.summary?.trend === 'declining' ? '#dc2626' : '#6b7280'
                      }}
                    >
                      {marketSentiment.summary?.trend}
                    </span>
                  </div>
                  <div className="text-xs mt-2" style={{ color: '#6b7280' }}>
                    {marketSentiment.summary?.event_count || 0} events in 24h
                  </div>
                </div>
                
                {/* Sentiment Distribution */}
                <div 
                  className="bg-white rounded-2xl p-4 border"
                  style={{ borderColor: colors.border }}
                >
                  <div className="text-sm font-medium mb-3" style={{ color: colors.text }}>Distribution</div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-xs" style={{ color: '#16a34a' }}>Positive</span>
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div 
                          className="h-full rounded-full"
                          style={{ 
                            width: `${marketSentiment.sentiment_distribution?.positive_pct || 0}%`,
                            backgroundColor: '#16a34a'
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium w-8 text-right" style={{ color: colors.text }}>
                        {marketSentiment.sentiment_distribution?.positive_pct?.toFixed(0) || 0}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-xs" style={{ color: '#6b7280' }}>Neutral</span>
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div 
                          className="h-full rounded-full"
                          style={{ 
                            width: `${marketSentiment.sentiment_distribution?.neutral_pct || 0}%`,
                            backgroundColor: '#6b7280'
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium w-8 text-right" style={{ color: colors.text }}>
                        {marketSentiment.sentiment_distribution?.neutral_pct?.toFixed(0) || 0}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-16 text-xs" style={{ color: '#dc2626' }}>Negative</span>
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div 
                          className="h-full rounded-full"
                          style={{ 
                            width: `${marketSentiment.sentiment_distribution?.negative_pct || 0}%`,
                            backgroundColor: '#dc2626'
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium w-8 text-right" style={{ color: colors.text }}>
                        {marketSentiment.sentiment_distribution?.negative_pct?.toFixed(0) || 0}%
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Top Assets Sentiment */}
                <div 
                  className="col-span-2 bg-white rounded-2xl p-4 border"
                  style={{ borderColor: colors.border }}
                >
                  <div className="text-sm font-medium mb-3" style={{ color: colors.text }}>Top Assets Sentiment</div>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {topAssetsSentiment.slice(0, 6).map((asset, i) => (
                      <div 
                        key={asset.asset || i}
                        className="flex-shrink-0 px-3 py-2 rounded-xl text-center"
                        style={{ 
                          backgroundColor: asset.sentiment_label === 'positive' ? '#dcfce7' :
                                          asset.sentiment_label === 'negative' ? '#fee2e2' : '#f3f4f6',
                          minWidth: '70px'
                        }}
                      >
                        <div 
                          className="font-bold text-sm"
                          style={{ 
                            color: asset.sentiment_label === 'positive' ? '#16a34a' :
                                   asset.sentiment_label === 'negative' ? '#dc2626' : '#374151'
                          }}
                        >
                          {asset.asset}
                        </div>
                        <div 
                          className="text-xs font-medium"
                          style={{ 
                            color: asset.sentiment_label === 'positive' ? '#16a34a' :
                                   asset.sentiment_label === 'negative' ? '#dc2626' : '#6b7280'
                          }}
                        >
                          {asset.avg_sentiment > 0 ? '+' : ''}{(asset.avg_sentiment * 100).toFixed(0)}%
                        </div>
                        <div className="text-[10px]" style={{ color: '#9ca3af' }}>
                          {asset.event_count} news
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Active Generations Progress (P1) */}
            {Object.keys(activeGenerations).length > 0 && (
              <div className="mb-4 space-y-2">
                {Object.entries(activeGenerations).map(([eventId, progress]) => (
                  <div 
                    key={eventId}
                    data-testid={`generation-progress-${eventId}`}
                    className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <RefreshCw size={16} className="animate-spin" style={{ color: '#6366f1' }} />
                        <span className="text-sm font-medium" style={{ color: '#4f46e5' }}>
                          {progress.stage === 'AI_WRITING' ? 'Generating AI Content...' :
                           progress.stage === 'IMAGE_GENERATION' ? 'Creating Cover Image...' :
                           progress.stage === 'PUBLISHED' ? 'Story Published!' :
                           progress.stage === 'ERROR' ? 'Generation Failed' :
                           progress.message || 'Processing...'}
                        </span>
                      </div>
                      <span className="text-xs font-bold" style={{ color: '#6366f1' }}>
                        {progress.progress}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${progress.progress}%`,
                          background: progress.stage === 'ERROR' ? '#ef4444' :
                                     progress.stage === 'PUBLISHED' ? '#10b981' :
                                     'linear-gradient(90deg, #6366f1, #a855f7)'
                        }}
                      />
                    </div>
                    <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
                      Event: {eventId.substring(0, 20)}...
                    </p>
                  </div>
                ))}
              </div>
            )}
            
            <div className="grid grid-cols-3 gap-4">
              {newsIntelligence
                .filter(event => {
                  // Language filter
                  if (feedLangFilter !== 'all' && event.language && event.language !== feedLangFilter) {
                    return false;
                  }
                  // Sentiment filter
                  if (sentimentFilter !== 'all' && event.sentiment !== sentimentFilter) {
                    return false;
                  }
                  return true;
                })
                .slice(0, 6).map((event, i) => {
                const getFomoColor = (score) => {
                  if (score >= 80) return { bg: '#fee2e2', color: '#dc2626' };
                  if (score >= 60) return { bg: '#fef3c7', color: '#d97706' };
                  if (score >= 40) return { bg: '#dbeafe', color: '#2563eb' };
                  return { bg: '#f3f4f6', color: '#6b7280' };
                };
                const fomoColors = getFomoColor(event.fomo_score || 50);
                
                // Sentiment badge colors
                const getSentimentStyle = (sentiment, score) => {
                  if (sentiment === 'positive') return { bg: '#dcfce7', color: '#16a34a', icon: '↑' };
                  if (sentiment === 'negative') return { bg: '#fee2e2', color: '#dc2626', icon: '↓' };
                  return { bg: '#f3f4f6', color: '#6b7280', icon: '→' };
                };
                const sentimentStyle = getSentimentStyle(event.sentiment, event.sentiment_score);
                
                // Importance score colors
                const getImportanceColor = (score) => {
                  if (score >= 80) return { bg: '#fef3c7', color: '#d97706' };
                  if (score >= 60) return { bg: '#dbeafe', color: '#2563eb' };
                  if (score >= 40) return { bg: '#e0e7ff', color: '#4f46e5' };
                  return { bg: '#f3f4f6', color: '#6b7280' };
                };
                const importanceColors = getImportanceColor(event.importance_score || 0);
                
                // Confidence level colors
                const getConfidenceStyle = (level) => {
                  if (level === 'CONFIRMED') return { bg: '#dcfce7', color: '#16a34a', label: 'CONF' };
                  if (level === 'HIGH') return { bg: '#dbeafe', color: '#2563eb', label: 'HIGH' };
                  if (level === 'MEDIUM') return { bg: '#fef3c7', color: '#d97706', label: 'MED' };
                  return { bg: '#fee2e2', color: '#dc2626', label: 'LOW' };
                };
                const confidenceStyle = getConfidenceStyle(event.confidence_level);
                
                // Rumor level colors
                const getRumorStyle = (level) => {
                  if (level === 'CONFIRMED') return { bg: '#dcfce7', color: '#16a34a', icon: '✓' };
                  if (level === 'SPECULATION') return { bg: '#fef3c7', color: '#d97706', icon: '?' };
                  return { bg: '#fee2e2', color: '#dc2626', icon: '!' };
                };
                const rumorStyle = getRumorStyle(event.rumor_level);
                
                const eventTypeColors = {
                  regulation: { bg: '#fef3c7', color: '#d97706', icon: '⚖️' },
                  funding: { bg: '#d1fae5', color: '#059669', icon: '💰' },
                  listing: { bg: '#dbeafe', color: '#2563eb', icon: '📈' },
                  hack: { bg: '#fee2e2', color: '#dc2626', icon: '🔓' },
                  launch: { bg: '#ede9fe', color: '#7c3aed', icon: '🚀' },
                  partnership: { bg: '#fce7f3', color: '#db2777', icon: '🤝' },
                  news: { bg: '#cffafe', color: '#0891b2', icon: '📰' }
                };
                const typeConfig = eventTypeColors[event.event_type] || eventTypeColors.news;
                
                return (
                  <div
                    key={i}
                    data-testid={`news-intel-${i}`}
                    onClick={() => {
                      setSelectedNewsStory(event);
                      setStoryLang('en'); // Reset to EN on new story selection
                      if (event.id) fetchNewsStoryDetail(event.id, 'en');
                    }}
                    className="bg-white rounded-2xl border overflow-hidden transition-all hover:shadow-lg cursor-pointer"
                    style={{ borderColor: colors.border }}
                  >
                    {/* Cover Image */}
                    {event.cover_image && (
                      <div className="w-full h-32 overflow-hidden relative">
                        <img 
                          src={event.cover_image}
                          alt={event.headline}
                          className="w-full h-full object-cover"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                        {/* Importance Score Badge (top right) */}
                        {event.importance_score && (
                          <div 
                            className="absolute top-2 right-2 flex gap-1"
                          >
                            <span 
                              className="px-2 py-1 rounded-lg text-xs font-bold shadow-md"
                              style={{ backgroundColor: 'rgba(255,255,255,0.95)', color: importanceColors.color }}
                              title="Importance Score"
                            >
                              IMP {Math.round(event.importance_score)}
                            </span>
                            {event.confidence_level && (
                              <span 
                                className="px-2 py-1 rounded-lg text-xs font-bold shadow-md"
                                style={{ backgroundColor: confidenceStyle.bg, color: confidenceStyle.color }}
                                title={`Confidence: ${event.confidence_level} (${event.confidence_score || 0})`}
                              >
                                {confidenceStyle.label}
                              </span>
                            )}
                          </div>
                        )}
                        {/* Sentiment + Rumor Badge (top left) */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          {event.sentiment && (
                            <div 
                              className="px-2 py-1 rounded-lg text-xs font-bold shadow-md flex items-center gap-1"
                              style={{ backgroundColor: sentimentStyle.bg, color: sentimentStyle.color }}
                              title={`Sentiment: ${event.sentiment} (${event.sentiment_score?.toFixed(2) || 0})`}
                            >
                              <span>{sentimentStyle.icon}</span>
                              <span className="capitalize">{event.sentiment}</span>
                            </div>
                          )}
                          {event.rumor_level && event.rumor_level !== 'CONFIRMED' && (
                            <div 
                              className="px-2 py-1 rounded-lg text-xs font-bold shadow-md flex items-center gap-1"
                              style={{ backgroundColor: rumorStyle.bg, color: rumorStyle.color }}
                              title={`Rumor: ${event.rumor_level} (score: ${event.rumor_score || 0})`}
                            >
                              <span>{rumorStyle.icon}</span>
                              <span>{event.rumor_level}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* No image - show badges in header */}
                    {!event.cover_image && (event.importance_score || event.sentiment) && (
                      <div className="flex items-center justify-between px-4 pt-3">
                        {event.sentiment && (
                          <span 
                            className="px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1"
                            style={{ backgroundColor: sentimentStyle.bg, color: sentimentStyle.color }}
                          >
                            <span>{sentimentStyle.icon}</span>
                            <span className="capitalize">{event.sentiment}</span>
                          </span>
                        )}
                        {event.importance_score && (
                          <span 
                            className="px-2 py-0.5 rounded text-xs font-bold"
                            style={{ backgroundColor: importanceColors.bg, color: importanceColors.color }}
                          >
                            IMP {Math.round(event.importance_score)}
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg">{typeConfig.icon}</span>
                      <div className="flex items-center gap-2">
                        <span 
                          className="px-2 py-0.5 rounded text-xs font-medium capitalize"
                          style={{ backgroundColor: typeConfig.bg, color: typeConfig.color }}
                        >
                          {event.event_type?.replace('_', ' ')}
                        </span>
                        <span 
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: '#e0e7ff', color: '#4f46e5' }}
                        >
                          {event.source_count} sources
                        </span>
                      </div>
                    </div>
                    
                    <p className="font-semibold text-sm mb-2 line-clamp-2" style={{ color: colors.text }}>
                      {event.headline}
                    </p>
                    
                    {/* KEY TAKEAWAY - highlighted insight */}
                    {event.key_takeaway && (
                      <div 
                        className="px-3 py-2 rounded-lg mb-3 border-l-4"
                        style={{ 
                          backgroundColor: '#f0f9ff', 
                          borderLeftColor: '#0ea5e9',
                          color: '#0c4a6e'
                        }}
                      >
                        <p className="text-xs font-medium flex items-start gap-1">
                          <span style={{ color: '#0ea5e9' }}>💡</span>
                          <span className="line-clamp-2">{event.key_takeaway}</span>
                        </p>
                      </div>
                    )}
                    
                    {/* Summary (fallback if no key_takeaway) */}
                    {!event.key_takeaway && event.summary && (
                      <p className="text-xs mb-3 line-clamp-2" style={{ color: colors.textSecondary }}>
                        {event.summary}
                      </p>
                    )}
                    
                    {/* Topics from sentiment analysis */}
                    {event.topics?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {event.topics.slice(0, 3).map((topic, j) => (
                          <span 
                            key={j}
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}
                          >
                            #{topic}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {event.assets?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {event.assets.slice(0, 4).map((asset, j) => (
                          <span 
                            key={j}
                            className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: '#f3f4f6', color: '#374151' }}
                          >
                            {asset}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: colors.border }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs flex items-center gap-1" style={{ color: colors.textMuted }}>
                          <span style={{ color: event.status === 'confirmed' ? '#10b981' : '#f59e0b' }}>●</span>
                          {event.status}
                        </span>
                        {/* Cached Multi-Provider Sentiment */}
                        {cachedSentiments[event.event_id || event.id] && (
                          <div className="flex items-center gap-1.5">
                            <span 
                              className="text-xs px-1.5 py-0.5 rounded font-bold flex items-center gap-1"
                              style={{ 
                                backgroundColor: cachedSentiments[event.event_id || event.id]?.consensus?.label === 'positive' ? '#dcfce7' :
                                                cachedSentiments[event.event_id || event.id]?.consensus?.label === 'negative' ? '#fee2e2' : '#f3f4f6',
                                color: cachedSentiments[event.event_id || event.id]?.consensus?.label === 'positive' ? '#16a34a' :
                                       cachedSentiments[event.event_id || event.id]?.consensus?.label === 'negative' ? '#dc2626' : '#6b7280'
                              }}
                              title={`Consensus: ${(cachedSentiments[event.event_id || event.id]?.consensus?.score * 100).toFixed(0)}%`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{
                                backgroundColor: cachedSentiments[event.event_id || event.id]?.consensus?.label === 'positive' ? '#16a34a' :
                                                cachedSentiments[event.event_id || event.id]?.consensus?.label === 'negative' ? '#dc2626' : '#6b7280'
                              }}></span>
                              {cachedSentiments[event.event_id || event.id]?.consensus?.score > 0 ? '+' : ''}
                              {(cachedSentiments[event.event_id || event.id]?.consensus?.score * 100).toFixed(0)}%
                            </span>
                            {cachedSentiments[event.event_id || event.id]?.fomo?.available && (
                              <span 
                                className="text-[10px] px-1 py-0.5 rounded font-medium"
                                style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
                                title={`FOMO Score: ${(cachedSentiments[event.event_id || event.id]?.fomo?.score * 100).toFixed(0)}%`}
                              >
                                F:{(cachedSentiments[event.event_id || event.id]?.fomo?.score * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        )}
                        {/* Confidence indicator */}
                        {!cachedSentiments[event.event_id || event.id] && event.sentiment_confidence && (
                          <span className="text-xs" style={{ color: colors.textMuted }}>
                            {Math.round(event.sentiment_confidence * 100)}% conf
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Multi-Provider Analyze Button - show only if not cached */}
                        {!cachedSentiments[event.event_id || event.id] && (
                          <button
                            data-testid={`analyze-sentiment-${i}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              analyzeTextSentiment(event.headline || event.summary || event.title);
                            }}
                            className="text-xs px-2 py-1 rounded-lg flex items-center gap-1 transition-all hover:scale-105"
                            style={{ backgroundColor: '#f3e8ff', color: '#7c3aed' }}
                            title="Analyze with Multi-Provider Sentiment Engine"
                          >
                            <Zap size={10} />
                            Analyze
                          </button>
                        )}
                        {event.importance_score && (
                          <span 
                            className="text-xs px-2 py-0.5 rounded-full font-bold"
                            style={{ backgroundColor: importanceColors.bg, color: importanceColors.color }}
                            title="Importance Score"
                          >
                            {Math.round(event.importance_score)}
                          </span>
                        )}
                        {event.fomo_score && (
                          <span 
                            className="text-xs px-2 py-0.5 rounded-full font-bold"
                            style={{ backgroundColor: fomoColors.bg, color: fomoColors.color }}
                          >
                            FOMO {event.fomo_score}
                          </span>
                        )}
                      </div>
                    </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Event Feed Grid */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: colors.text }}>
            <Radio size={20} style={{ color: colors.accent }} />
            Events
          </h3>
          
          {feedLoading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="animate-spin" size={32} style={{ color: colors.accent }} />
            </div>
          ) : feedEvents.length === 0 ? (
            <div 
              className="bg-white rounded-2xl border p-12 text-center"
              style={{ borderColor: colors.border }}
            >
              <Radio size={48} className="mx-auto mb-4" style={{ color: colors.textMuted }} />
              <p className="font-medium" style={{ color: colors.text }}>No events yet</p>
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                Sync data sources to populate the feed
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {feedEvents
                .filter(e => feedFilter === 'all' || feedFilter === 'alpha' || e.type === feedFilter)
                .slice(0, 24)
                .map((event, i) => {
                  const config = eventTypeConfig[event.type] || eventTypeConfig.activity;
                  const Icon = config.icon;
                  const impactColors = getImpactColor(event.impact_score || 50);
                  
                  return (
                    <div 
                      key={i}
                      data-testid={`event-card-${i}`}
                      onClick={() => setSelectedEvent(event)}
                      className="bg-white rounded-2xl border p-4 transition-all hover:shadow-lg cursor-pointer"
                      style={{ borderColor: colors.border }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: config.bg }}
                        >
                          <Icon size={20} style={{ color: config.color }} />
                        </div>
                        <span 
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: config.bg, color: config.color }}
                        >
                          {config.label}
                        </span>
                      </div>
                      
                      <p className="font-semibold text-sm mb-1 line-clamp-2" style={{ color: colors.text }}>
                        {event.title || event.asset || 'Event'}
                      </p>
                      
                      {event.description && (
                        <p className="text-xs mb-2 line-clamp-2" style={{ color: colors.textSecondary }}>
                          {event.description}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between mt-auto pt-3 border-t" style={{ borderColor: colors.border }}>
                        <span className="text-xs" style={{ color: colors.textMuted }}>
                          {formatDate(event.timestamp || event.date)}
                        </span>
                        {event.impact_score && (
                          <span 
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: impactColors.bg, color: impactColors.color }}
                          >
                            {event.impact_score}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Stats Summary */}
        <div 
          className="bg-white rounded-2xl border p-6"
          style={{ borderColor: colors.border }}
        >
          <h3 className="font-semibold mb-4" style={{ color: colors.text }}>Feed Statistics</h3>
          <div className="grid grid-cols-7 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ color: '#06b6d4' }}>{newsIntelligence.length}</p>
              <p className="text-xs" style={{ color: colors.textSecondary }}>News Intel</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ color: colors.accent }}>{alphaProjects.length}</p>
              <p className="text-xs" style={{ color: colors.textSecondary }}>Alpha Projects</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ color: '#8b5cf6' }}>{alphaSignals.length}</p>
              <p className="text-xs" style={{ color: colors.textSecondary }}>Signals</p>
            </div>
            {Object.entries(
              feedEvents.reduce((acc, e) => {
                acc[e.type] = (acc[e.type] || 0) + 1;
                return acc;
              }, {})
            ).slice(0, 4).map(([type, count]) => {
              const config = eventTypeConfig[type] || eventTypeConfig.activity;
              return (
                <div key={type} className="text-center">
                  <p className="text-2xl font-bold" style={{ color: config.color }}>{count}</p>
                  <p className="text-xs capitalize" style={{ color: colors.textSecondary }}>{type}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Intel Data Overview (moved from Data Explorer) */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: colors.text }}>
            <Database size={20} style={{ color: colors.accent }} />
            Intel Database
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: 'Projects', count: stats?.intel?.collections?.projects || 0, icon: Layers, color: '#4f46e5' },
              { name: 'Investors', count: stats?.intel?.collections?.investors || 0, icon: Users, color: '#10b981' },
              { name: 'Funding', count: stats?.intel?.collections?.funding || 0, icon: DollarSign, color: '#f59e0b' },
              { name: 'Unlocks', count: stats?.intel?.collections?.unlocks || 0, icon: Unlock, color: '#ef4444' },
              { name: 'Sales', count: stats?.intel?.collections?.sales || 0, icon: TrendingUp, color: '#06b6d4' },
              { name: 'Events', count: stats?.intel?.collections?.events || 0, icon: Activity, color: '#8b5cf6' },
            ].map((item, i) => (
              <div 
                key={i}
                data-testid={`intel-stat-${item.name.toLowerCase()}`}
                className="bg-white rounded-2xl border p-4 transition-all hover:shadow-md"
                style={{ borderColor: colors.border }}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${item.color}15` }}
                  >
                    <item.icon size={20} style={{ color: item.color }} />
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: colors.textSecondary }}>{item.name}</p>
                    <p className="text-xl font-bold" style={{ color: colors.text }}>
                      {item.count.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Event Detail Modal */}
        {selectedEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEvent(null)}>
            <div 
              className="bg-white rounded-3xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b" style={{ borderColor: colors.border }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold" style={{ color: colors.text }}>Event Details</h2>
                  <button onClick={() => setSelectedEvent(null)} className="p-2 hover:bg-gray-100 rounded-full">
                    <X size={20} style={{ color: colors.textMuted }} />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <span 
                    className="px-3 py-1 rounded-full text-sm font-medium"
                    style={{ 
                      backgroundColor: (eventTypeConfig[selectedEvent.type] || eventTypeConfig.activity).bg,
                      color: (eventTypeConfig[selectedEvent.type] || eventTypeConfig.activity).color
                    }}
                  >
                    {(eventTypeConfig[selectedEvent.type] || eventTypeConfig.activity).label}
                  </span>
                </div>
                <h3 className="text-2xl font-bold" style={{ color: colors.text }}>
                  {selectedEvent.title || selectedEvent.asset}
                </h3>
                {selectedEvent.description && (
                  <p style={{ color: colors.textSecondary }}>{selectedEvent.description}</p>
                )}
                <div className="grid grid-cols-3 gap-4 py-4">
                  <div className="text-center p-4 rounded-xl" style={{ backgroundColor: colors.surface }}>
                    <p className="text-2xl font-bold" style={{ color: colors.accent }}>{selectedEvent.impact_score || '-'}</p>
                    <p className="text-xs" style={{ color: colors.textMuted }}>Impact Score</p>
                  </div>
                  <div className="text-center p-4 rounded-xl" style={{ backgroundColor: colors.surface }}>
                    <p className="text-2xl font-bold" style={{ color: colors.text }}>
                      {selectedEvent.confidence ? `${(selectedEvent.confidence * 100).toFixed(0)}%` : '-'}
                    </p>
                    <p className="text-xs" style={{ color: colors.textMuted }}>Confidence</p>
                  </div>
                  <div className="text-center p-4 rounded-xl" style={{ backgroundColor: colors.surface }}>
                    <p className="text-2xl font-bold" style={{ color: colors.text }}>{selectedEvent.sources_count || 1}</p>
                    <p className="text-xs" style={{ color: colors.textMuted }}>Sources</p>
                  </div>
                </div>
                {selectedEvent.metrics && Object.keys(selectedEvent.metrics).length > 0 && (
                  <div className="p-4 rounded-xl" style={{ backgroundColor: colors.surface }}>
                    <p className="font-semibold mb-2" style={{ color: colors.text }}>Metrics</p>
                    <div className="space-y-2">
                      {Object.entries(selectedEvent.metrics).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span style={{ color: colors.textMuted }}>{key.replace(/_/g, ' ')}</span>
                          <span className="font-medium" style={{ color: colors.text }}>
                            {typeof value === 'number' ? 
                              (value > 1000000 ? `$${(value/1e6).toFixed(1)}M` : value.toFixed(2)) 
                              : String(value)
                            }
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* News Story Full View Modal */}
        {selectedNewsStory && (
          <div 
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" 
            onClick={() => setSelectedNewsStory(null)}
          >
            <div 
              className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              style={{ minHeight: '70vh' }}
            >
              {/* Cover Image */}
              {selectedNewsStory.cover_image && (
                <div className="w-full h-64 overflow-hidden rounded-t-3xl">
                  <img 
                    src={selectedNewsStory.cover_image}
                    alt={selectedNewsStory.headline}
                    className="w-full h-full object-cover"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                </div>
              )}
              
              {/* Header */}
              <div className="p-8 border-b" style={{ borderColor: colors.border }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span 
                      className="px-3 py-1.5 rounded-full text-sm font-medium capitalize"
                      style={{ 
                        backgroundColor: selectedNewsStory.event_type === 'regulation' ? '#fef3c7' :
                                        selectedNewsStory.event_type === 'funding' ? '#d1fae5' :
                                        selectedNewsStory.event_type === 'listing' ? '#dbeafe' :
                                        selectedNewsStory.event_type === 'hack' ? '#fee2e2' :
                                        selectedNewsStory.event_type === 'launch' ? '#ede9fe' : '#cffafe',
                        color: selectedNewsStory.event_type === 'regulation' ? '#d97706' :
                               selectedNewsStory.event_type === 'funding' ? '#059669' :
                               selectedNewsStory.event_type === 'listing' ? '#2563eb' :
                               selectedNewsStory.event_type === 'hack' ? '#dc2626' :
                               selectedNewsStory.event_type === 'launch' ? '#7c3aed' : '#0891b2'
                      }}
                    >
                      {selectedNewsStory.event_type?.replace('_', ' ') || 'News'}
                    </span>
                    {selectedNewsStory.fomo_score && (
                      <span 
                        className="px-3 py-1.5 rounded-full text-sm font-bold"
                        style={{ 
                          backgroundColor: selectedNewsStory.fomo_score >= 80 ? '#fee2e2' : 
                                          selectedNewsStory.fomo_score >= 60 ? '#fef3c7' : '#dbeafe',
                          color: selectedNewsStory.fomo_score >= 80 ? '#dc2626' :
                                 selectedNewsStory.fomo_score >= 60 ? '#d97706' : '#2563eb'
                        }}
                      >
                        FOMO {selectedNewsStory.fomo_score}
                      </span>
                    )}
                    <span className="text-sm" style={{ color: colors.textMuted }}>
                      {selectedNewsStory.source_count || 1} sources
                    </span>
                  </div>
                  <button 
                    onClick={() => setSelectedNewsStory(null)} 
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X size={24} style={{ color: colors.textMuted }} />
                  </button>
                </div>
                
                {/* Language Toggle */}
                <div className="flex items-center gap-2 mb-4">
                  <Globe size={16} style={{ color: colors.textMuted }} />
                  <span className="text-sm" style={{ color: colors.textMuted }}>Language:</span>
                  <div className="flex gap-1">
                    {['en', 'ru'].map(lang => (
                      <button
                        key={lang}
                        onClick={() => setStoryLang(lang)}
                        disabled={storyLoading}
                        className="px-3 py-1 rounded-lg text-sm font-medium transition-all"
                        style={{
                          backgroundColor: storyLang === lang ? colors.accent : colors.surface,
                          color: storyLang === lang ? 'white' : colors.textMuted,
                          border: `1px solid ${storyLang === lang ? colors.accent : colors.border}`,
                          opacity: storyLoading ? 0.7 : 1
                        }}
                      >
                        {lang === 'en' ? '🇬🇧 EN' : '🇷🇺 RU'}
                      </button>
                    ))}
                  </div>
                </div>
                
                <h1 className="text-3xl font-bold mb-4" style={{ color: colors.text }}>
                  {storyLoading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw size={24} className="animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    selectedNewsStory.headline || selectedNewsStory.title_en || 'News Story'
                  )}
                </h1>
                
                {/* Assets Tags */}
                {selectedNewsStory.assets?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedNewsStory.assets.map((asset, j) => (
                      <span 
                        key={j}
                        className="px-3 py-1 rounded-lg text-sm font-medium"
                        style={{ backgroundColor: colors.accentSoft, color: colors.accent }}
                      >
                        {asset}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Summary */}
                {selectedNewsStory.summary && (
                  <p className="text-lg leading-relaxed" style={{ color: colors.textSecondary }}>
                    {selectedNewsStory.summary}
                  </p>
                )}
              </div>
              
              {/* Full Story Content */}
              <div className="p-8">
                {/* Story Text */}
                {selectedNewsStory.story ? (
                  <div 
                    className="prose prose-lg max-w-none mb-8"
                    style={{ color: colors.text }}
                  >
                    <div className="text-lg leading-[1.8] space-y-4" style={{ fontFamily: 'Georgia, serif' }}>
                      {selectedNewsStory.story
                        .split('\n')
                        .filter(p => p.trim())
                        .map((paragraph, idx) => (
                          <p key={idx} className="text-justify">
                            {paragraph}
                          </p>
                        ))}
                    </div>
                  </div>
                ) : (selectedNewsStory.story_en || selectedNewsStory.story_ru) ? (
                  <div 
                    className="prose prose-lg max-w-none mb-8"
                    style={{ color: colors.text }}
                  >
                    <div className="text-lg leading-[1.8] space-y-4" style={{ fontFamily: 'Georgia, serif' }}>
                      {(selectedNewsStory.story_en || selectedNewsStory.story_ru)
                        .split('\n')
                        .filter(p => p.trim())
                        .map((paragraph, idx) => (
                          <p key={idx} className="text-justify">
                            {paragraph}
                          </p>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div 
                    className="p-8 rounded-2xl text-center"
                    style={{ backgroundColor: colors.surface }}
                  >
                    <FileText size={48} className="mx-auto mb-4" style={{ color: colors.textMuted }} />
                    <p className="font-medium mb-2" style={{ color: colors.text }}>Full story not yet generated</p>
                    <p className="text-sm" style={{ color: colors.textSecondary }}>
                      AI story generation is in progress
                    </p>
                  </div>
                )}
                
                {/* AI View / Analysis */}
                {selectedNewsStory.ai_view && (
                  <div 
                    className="p-6 rounded-2xl mb-8"
                    style={{ backgroundColor: colors.accentSoft }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Zap size={20} style={{ color: colors.accent }} />
                      <span className="font-semibold" style={{ color: colors.accent }}>
                        {storyLang === 'ru' ? 'AI Анализ' : 'AI Analysis'}
                      </span>
                    </div>
                    <p className="text-base leading-relaxed" style={{ color: colors.text }}>
                      {selectedNewsStory.ai_view}
                    </p>
                  </div>
                )}
                
                {/* Key Facts */}
                {selectedNewsStory.key_facts?.length > 0 && (
                  <div className="mb-8">
                    <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: colors.text }}>
                      <Target size={20} style={{ color: colors.accent }} />
                      Key Facts
                    </h3>
                    <ul className="space-y-2">
                      {selectedNewsStory.key_facts.map((fact, idx) => (
                        <li 
                          key={idx}
                          className="flex items-start gap-3 p-3 rounded-xl"
                          style={{ backgroundColor: colors.surface }}
                        >
                          <CheckCircle size={18} className="flex-shrink-0 mt-0.5" style={{ color: colors.success }} />
                          <span style={{ color: colors.text }}>{fact}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Footer Meta */}
                <div 
                  className="flex items-center justify-between pt-6 border-t"
                  style={{ borderColor: colors.border }}
                >
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-2 text-sm" style={{ color: colors.textMuted }}>
                      <Clock size={16} />
                      {selectedNewsStory.first_seen_at ? 
                        new Date(selectedNewsStory.first_seen_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'Recently'
                      }
                    </span>
                    <span 
                      className="flex items-center gap-1 text-sm"
                      style={{ color: selectedNewsStory.status === 'confirmed' ? colors.success : colors.warning }}
                    >
                      <span>●</span>
                      {selectedNewsStory.status || 'developing'}
                    </span>
                  </div>
                  {selectedNewsStory.confidence_score && (
                    <span className="text-sm" style={{ color: colors.textMuted }}>
                      Confidence: {Math.round(selectedNewsStory.confidence_score * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
}
