import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, BarChart3, Database, Settings, Activity, 
  TrendingUp, Users, Calendar, Layers, Globe, 
  ChevronRight, ChevronDown, ChevronUp, RefreshCw, ExternalLink, Clock, X,
  Zap, Target, Shield, Server, Terminal, FileText,
  DollarSign, Unlock, LineChart, Box, Rss, Radio,
  Network, Plus, Trash2, CheckCircle, XCircle, Play, Wifi,
  RotateCcw, AlertTriangle, Key, Newspaper, BookOpen, 
  Eye, BarChart2, Bell, HelpCircle, GitBranch, AlertCircle, Cpu
} from 'lucide-react';
import ForceGraphViewer from './components/ForceGraphViewer';
import GraphExplorer from './components/GraphExplorer';
import ObservabilityDashboard from './components/ObservabilityDashboard';
import ArchitecturePage from './pages/architecture';
import MomentumPage from './pages/momentum';
import NarrativeDominanceDashboard from './components/NarrativeDominanceDashboard';

// Feature pages (refactored)
import { DashboardPage } from './features/dashboard';
import AdminPage from './features/admin/AdminPage';
import { FeedPage } from './features/feed';
import { DiscoveryPage } from './features/discovery';
import { ApiDocsPage } from './features/api-docs';
import NewsSourcesPage from './features/news-sources/NewsSourcesPage';

// Shared constants and hooks
import { colors as sharedColors, API_URL as SHARED_API_URL, WS_URL as SHARED_WS_URL } from './shared/constants';

const API_URL = SHARED_API_URL;
const WS_URL = SHARED_WS_URL;

// WebSocket Hook for real-time updates
function useWebSocket(channel = 'all') {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [breakingNews, setBreakingNews] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    try {
      wsRef.current = new WebSocket(`${WS_URL}/ws/${channel}`);
      
      wsRef.current.onopen = () => {
        console.log(`[WS] Connected to ${channel}`);
        setIsConnected(true);
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          
          // Handle breaking news specially
          if (data.type === 'breaking') {
            setBreakingNews(data);
            // Auto-dismiss after 30 seconds
            setTimeout(() => setBreakingNews(null), 30000);
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };
      
      wsRef.current.onclose = () => {
        console.log('[WS] Disconnected');
        setIsConnected(false);
        // Reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      };
      
      wsRef.current.onerror = (err) => {
        console.error('[WS] Error:', err);
      };
    } catch (err) {
      console.error('[WS] Connection failed:', err);
    }
  }, [channel]);
  
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);
  
  const clearBreakingNews = useCallback(() => {
    setBreakingNews(null);
  }, []);
  
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);
  
  return { isConnected, lastMessage, breakingNews, clearBreakingNews };
}

// Design System (FOMO.cx style - Light theme)
const colors = {
  background: '#ffffff',
  surface: '#f7f8fb',
  surfaceHover: '#f0f2f5',
  border: '#e7e9ee',
  borderLight: '#f0f2f5',
  text: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  accent: '#4f46e5',
  accentSoft: '#eef2ff',
  success: '#10b981',
  successSoft: '#ecfdf5',
  warning: '#f59e0b',
  warningSoft: '#fffbeb',
  error: '#ef4444',
  errorSoft: '#fef2f2',
};

// Stat Card Component
function StatCard({ title, value, change, icon: Icon, color = 'accent' }) {
  const isPositive = change && change > 0;
  const colorMap = {
    accent: { bg: colors.accentSoft, icon: colors.accent },
    success: { bg: colors.successSoft, icon: colors.success },
    warning: { bg: colors.warningSoft, icon: colors.warning },
    error: { bg: colors.errorSoft, icon: colors.error }
  };
  const c = colorMap[color] || colorMap.accent;

  return (
    <div 
      data-testid={`stat-card-${title.toLowerCase().replace(/\s/g, '-')}`}
      className="bg-white rounded-2xl p-6 border transition-all hover:shadow-lg hover:-translate-y-0.5"
      style={{ borderColor: colors.border }}
    >
      <div className="flex items-start justify-between mb-4">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: c.bg }}
        >
          <Icon size={22} style={{ color: c.icon }} />
        </div>
        {change !== undefined && (
          <span 
            className="text-sm font-medium px-2 py-1 rounded-lg"
            style={{ 
              backgroundColor: isPositive ? colors.successSoft : colors.errorSoft,
              color: isPositive ? colors.success : colors.error
            }}
          >
            {isPositive ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <p className="text-sm mb-1" style={{ color: colors.textSecondary }}>{title}</p>
      <p className="text-3xl font-bold" style={{ color: colors.text }}>{value}</p>
    </div>
  );
}

// Navigation Item
function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      data-testid={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        active ? 'font-medium' : ''
      }`}
      style={{ 
        backgroundColor: active ? colors.accentSoft : 'transparent',
        color: active ? colors.accent : colors.textSecondary
      }}
    >
      <Icon size={20} />
      <span className="flex-1 text-left">{label}</span>
      {badge && (
        <span 
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ backgroundColor: colors.accent, color: 'white' }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// Section Header
function SectionHeader({ title, action, onAction }) {
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

// Data Table
function DataTable({ columns, data, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border p-8" style={{ borderColor: colors.border }}>
        <div className="flex items-center justify-center">
          <RefreshCw className="animate-spin" style={{ color: colors.accent }} />
          <span className="ml-2" style={{ color: colors.textSecondary }}>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: colors.border }}>
      <table className="w-full">
        <thead>
          <tr style={{ backgroundColor: colors.surface }}>
            {columns.map((col, i) => (
              <th 
                key={i} 
                className="px-6 py-4 text-left text-sm font-medium"
                style={{ color: colors.textSecondary }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td 
                colSpan={columns.length} 
                className="px-6 py-12 text-center"
                style={{ color: colors.textMuted }}
              >
                No data available
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr 
                key={i} 
                className="border-t transition-colors hover:bg-gray-50"
                style={{ borderColor: colors.borderLight }}
              >
                {columns.map((col, j) => (
                  <td key={j} className="px-6 py-4 text-sm" style={{ color: colors.text }}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// System Status Badge
function StatusBadge({ status }) {
  const statusStyles = {
    running: { bg: colors.successSoft, color: colors.success, label: 'Running' },
    healthy: { bg: colors.successSoft, color: colors.success, label: 'Healthy' },
    active: { bg: colors.successSoft, color: colors.success, label: 'Active' },
    idle: { bg: colors.warningSoft, color: colors.warning, label: 'Idle' },
    pending: { bg: colors.warningSoft, color: colors.warning, label: 'Pending' },
    stale: { bg: colors.warningSoft, color: colors.warning, label: 'Stale' },
    error: { bg: colors.errorSoft, color: colors.error, label: 'Error' },
    failed: { bg: colors.errorSoft, color: colors.error, label: 'Failed' },
    offline: { bg: colors.surface, color: colors.textMuted, label: 'Offline' }
  };
  const s = statusStyles[status] || statusStyles.offline;

  return (
    <span 
      className="px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
      {s.label}
    </span>
  );
}

// Search Input
function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <Search 
        size={20} 
        className="absolute left-4 top-1/2 -translate-y-1/2"
        style={{ color: colors.textMuted }}
      />
      <input
        data-testid="search-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-12 pr-4 py-3 rounded-xl border transition-all focus:outline-none focus:ring-2"
        style={{ 
          borderColor: colors.border,
          backgroundColor: colors.surface,
          color: colors.text
        }}
      />
    </div>
  );
}

// Main Dashboard Component
function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState(null);
  const [exchangeHealth, setExchangeHealth] = useState([]);
  const [trustScores, setTrustScores] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // P0 #3-#5: Pipeline Status State
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [allSources, setAllSources] = useState([]);
  
  // WebSocket for real-time updates
  const { isConnected: wsConnected, lastMessage, breakingNews, clearBreakingNews } = useWebSocket('all');
  
  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      console.log('[WS] Received:', lastMessage.type);
      
      // Refresh data on certain events
      if (['new_event', 'published', 'breaking'].includes(lastMessage.type)) {
        fetchAlphaFeed();
      }
      
      // Update generation progress
      if (lastMessage.type === 'progress') {
        setActiveGenerations(prev => ({
          ...prev,
          [lastMessage.event_id]: {
            stage: lastMessage.stage,
            progress: lastMessage.progress,
            message: lastMessage.message
          }
        }));
      }
    }
  }, [lastMessage]);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, statsRes, trustRes, engineRes, entitiesRes, eventsRes, unlocksRes, pipelineRes, sourcesRes] = await Promise.all([
        fetch(`${API_URL}/api/health`).then(r => r.json()).catch(() => ({})),
        fetch(`${API_URL}/api/intel/stats`).then(r => r.json()).catch(() => ({})),
        fetch(`${API_URL}/api/intel/engine/trust/scores`).then(r => r.json()).catch(() => ({ sources: [] })),
        fetch(`${API_URL}/api/intel/engine/status`).then(r => r.json()).catch(() => ({ engines: {} })),
        fetch(`${API_URL}/api/intel-core/entities?limit=1`).then(r => r.json()).catch(() => ({ total: 0 })),
        fetch(`${API_URL}/api/intel-core/events?limit=1`).then(r => r.json()).catch(() => ({ total: 0 })),
        fetch(`${API_URL}/api/unlocks/upcoming?days=180`).then(r => r.json()).catch(() => ({ count: 0 })),
        // P0 #3: Real Pipeline Status
        fetch(`${API_URL}/api/system/pipeline-status`).then(r => r.json()).catch(() => null),
        // P0 #5: All Sources (64)
        fetch(`${API_URL}/api/system/sources`).then(r => r.json()).catch(() => ({ sources: [] }))
      ]);

      setStats({
        health: healthRes,
        intel: statsRes,
        engines: engineRes.engines || {},
        entities_count: entitiesRes.total || 0,
        events_count: eventsRes.total || 0,
        unlocks_count: unlocksRes.count || 0
      });
      setTrustScores(trustRes.sources || []);
      setPipelineStatus(pipelineRes);
      setAllSources(sourcesRes.sources || []);
    } catch (e) {
      console.error('Failed to fetch dashboard data:', e);
    }
    setLoading(false);
  }, []);

  // Fetch exchange providers
  const fetchExchangeData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/exchange/providers/health`);
      const data = await res.json();
      setExchangeHealth(Object.values(data.providers || {}));
    } catch (e) {
      console.error('Failed to fetch exchange data:', e);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    fetchExchangeData();
  }, [fetchDashboardData, fetchExchangeData]);

  // Render Dashboard View - Using refactored component
  const renderDashboard = () => (
    <DashboardPage 
      stats={stats}
      pipelineStatus={pipelineStatus}
      exchangeHealth={exchangeHealth}
      trustScores={trustScores}
    />
  );

  // News Sources State (for sidebar badge)
  const [newsSources, setNewsSources] = useState({ sources: [], stats: { total: 0 } });
  
  // Fetch news sources count for badge
  useEffect(() => {
    const fetchNewsSourcesStats = async () => {
      try {
        const res = await fetch(`${API_URL}/api/news-intelligence/sources-registry`);
        const data = await res.json();
        setNewsSources({ sources: data.sources || [], stats: data.stats || { total: 0 } });
      } catch (err) {
        console.error('Failed to fetch news sources:', err);
      }
    };
    fetchNewsSourcesStats();
  }, []);

  // News Sources Page - Using refactored component
  const renderNewsSourcesPage = () => <NewsSourcesPage />;
  
  // Main content router
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'feed': return <FeedPage />;
      case 'explorer': return <DiscoveryPage searchQuery={searchQuery} />;
      case 'discovery': return <DiscoveryPage searchQuery={searchQuery} />;
      case 'news-sources': return renderNewsSourcesPage();
      case 'api': return <ApiDocsPage />;
      case 'admin': return <AdminPage />;
      case 'graph': return renderGraph();
      case 'observability': return <ObservabilityDashboard />;
      case 'architecture': return <ArchitecturePage />;
      case 'momentum': return <MomentumPage />;
      case 'narratives': return <NarrativeDominanceDashboard />;
      default: return renderDashboard();
    }
  };

  // Render Graph tab content
  const renderGraph = () => {
    return <GraphExplorer colors={colors} />;
  };

  return (
    <div 
      data-testid="intel-dashboard"
      className="min-h-screen flex"
      style={{ backgroundColor: colors.surface }}
    >
      {/* Sidebar */}
      <aside 
        className="w-64 border-r p-6 flex flex-col"
        style={{ backgroundColor: colors.background, borderColor: colors.border }}
      >
        {/* Logo */}
        <div className="mb-8">
          <img 
            src="/logo.svg" 
            alt="FOMO" 
            style={{ height: '46px', width: 'auto' }}
          />
          <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
            Crypto Intelligence Terminal
          </p>
        </div>

        {/* Navigation */}
        <nav className="space-y-1 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider mb-3 px-4" 
             style={{ color: colors.textMuted }}>
            Overview
          </p>
          <NavItem 
            icon={BarChart3} 
            label="Dashboard" 
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
          />
          <NavItem 
            icon={Radio} 
            label="Intel Feed" 
            active={activeTab === 'feed'}
            onClick={() => setActiveTab('feed')}
            badge="Live"
          />
          <NavItem 
            icon={GitBranch} 
            label="Graph" 
            active={activeTab === 'graph'}
            onClick={() => setActiveTab('graph')}
            data-testid="nav-graph"
          />
          
          <p className="text-xs font-medium uppercase tracking-wider mt-6 mb-3 px-4"
             style={{ color: colors.textMuted }}>
            Explorer
          </p>
          <NavItem 
            icon={Globe} 
            label="Discovery" 
            active={activeTab === 'discovery'}
            onClick={() => setActiveTab('discovery')}
            data-testid="nav-discovery"
          />
          <NavItem 
            icon={Rss} 
            label="News Sources" 
            active={activeTab === 'news-sources'}
            onClick={() => setActiveTab('news-sources')}
            data-testid="nav-news-sources"
            badge={`${newsSources.stats?.total || 0}`}
          />

          <p className="text-xs font-medium uppercase tracking-wider mt-6 mb-3 px-4"
             style={{ color: colors.textMuted }}>
            Developer
          </p>
          <NavItem 
            icon={FileText} 
            label="API Docs" 
            active={activeTab === 'api'}
            onClick={() => setActiveTab('api')}
          />
          
          <p className="text-xs font-medium uppercase tracking-wider mt-6 mb-3 px-4"
             style={{ color: colors.textMuted }}>
            System
          </p>
          <NavItem 
            icon={Activity} 
            label="Observability" 
            active={activeTab === 'observability'}
            onClick={() => setActiveTab('observability')}
            data-testid="nav-observability"
          />
          <NavItem 
            icon={Cpu} 
            label="Architecture" 
            active={activeTab === 'architecture'}
            onClick={() => setActiveTab('architecture')}
            data-testid="nav-architecture"
          />
          <NavItem 
            icon={Zap} 
            label="Momentum" 
            active={activeTab === 'momentum'}
            onClick={() => setActiveTab('momentum')}
            data-testid="nav-momentum"
          />
          <NavItem 
            icon={Target} 
            label="Narratives" 
            active={activeTab === 'narratives'}
            onClick={() => setActiveTab('narratives')}
            data-testid="nav-narratives"
          />
          <NavItem 
            icon={Settings} 
            label="Admin" 
            active={activeTab === 'admin'}
            onClick={() => setActiveTab('admin')}
          />
        </nav>

        {/* Version */}
        <div 
          className="pt-6 border-t text-sm"
          style={{ borderColor: colors.border, color: colors.textMuted }}
        >
          <p>Version 2.0.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-auto">
        {/* Breaking News Alert Banner */}
        {breakingNews && (
          <div 
            data-testid="breaking-news-banner"
            className="mb-6 p-4 rounded-2xl border-2 animate-pulse"
            style={{ 
              backgroundColor: '#fef2f2',
              borderColor: '#ef4444'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl" style={{ backgroundColor: '#fee2e2' }}>
                  <Bell size={24} style={{ color: '#dc2626' }} className="animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-xs font-bold" 
                      style={{ backgroundColor: '#dc2626', color: 'white' }}>
                      BREAKING
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs font-medium" 
                      style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
                      FOMO {breakingNews.event?.fomo_score || 90}+
                    </span>
                  </div>
                  <p className="font-semibold text-lg" style={{ color: '#0f172a' }}>
                    {breakingNews.event?.headline || 'Breaking news alert'}
                  </p>
                  {breakingNews.event?.summary && (
                    <p className="text-sm mt-1" style={{ color: '#64748b' }}>
                      {breakingNews.event.summary}
                    </p>
                  )}
                  {breakingNews.event?.assets?.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {breakingNews.event.assets.map((asset, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs rounded font-medium"
                          style={{ backgroundColor: '#e0e7ff', color: '#4f46e5' }}>
                          {asset}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setActiveTab('feed');
                    clearBreakingNews();
                  }}
                  className="px-4 py-2 rounded-xl font-medium transition-all hover:shadow-md"
                  style={{ backgroundColor: '#dc2626', color: 'white' }}
                >
                  View Story
                </button>
                <button
                  onClick={clearBreakingNews}
                  className="p-2 rounded-xl transition-all hover:bg-red-100"
                >
                  <X size={20} style={{ color: '#dc2626' }} />
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* WebSocket Status Indicator */}
        <div className="fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium shadow-lg"
          style={{ 
            backgroundColor: wsConnected ? '#ecfdf5' : '#fef2f2',
            color: wsConnected ? '#059669' : '#dc2626',
            border: `1px solid ${wsConnected ? '#10b981' : '#ef4444'}`
          }}
        >
          <span className={`w-2 h-2 rounded-full ${wsConnected ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: wsConnected ? '#10b981' : '#ef4444' }} />
          {wsConnected ? 'Live' : 'Offline'}
        </div>

        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold capitalize" style={{ color: colors.text }}>
              {activeTab === 'api' ? 'API Documentation' : 
               activeTab === 'feed' ? 'Intel Feed' : 
               activeTab === 'admin' ? 'System Admin' :
               activeTab === 'news-sources' ? 'News Sources' :
               activeTab === 'graph' ? 'Entity Graph' : activeTab}
            </h1>
            <p style={{ color: colors.textSecondary }}>
              {activeTab === 'dashboard' && 'System overview and metrics'}
              {activeTab === 'feed' && 'Real-time crypto intelligence stream'}
              {activeTab === 'explorer' && 'Browse and search intel data'}
              {activeTab === 'discovery' && 'Find data across the network'}
              {activeTab === 'news-sources' && 'Manage and monitor news sources'}
              {activeTab === 'developer' && 'System status and configuration'}
              {activeTab === 'api' && 'Complete API reference'}
              {activeTab === 'admin' && 'Manage proxies, API keys and providers'}
              {activeTab === 'graph' && 'Interactive entity relationship visualization'}
            </p>
          </div>
          <button
            data-testid="refresh-btn"
            onClick={fetchDashboardData}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border transition-all hover:shadow-md"
            style={{ borderColor: colors.border, color: colors.text }}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </header>

        {/* Content */}
        {loading && !stats ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="animate-spin" size={32} style={{ color: colors.accent }} />
          </div>
        ) : (
          renderContent()
        )}
      </main>
    </div>
  );
}

// Wrap App with AuthGate
import AuthGate from './components/AuthGate';

function AppWithAuth() {
  return (
    <AuthGate>
      <App />
    </AuthGate>
  );
}

export default AppWithAuth;
