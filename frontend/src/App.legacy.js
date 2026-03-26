import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, BarChart3, Database, Settings, Activity, 
  TrendingUp, Users, Calendar, Layers, Globe, 
  ChevronRight, ChevronDown, RefreshCw, ExternalLink, Clock, X,
  Zap, Target, Shield, Server, Terminal, FileText,
  DollarSign, Unlock, LineChart, Box, Rss, Radio,
  Network, Plus, Trash2, CheckCircle, XCircle, Play, Wifi,
  RotateCcw, AlertTriangle, Key, Newspaper, BookOpen, 
  Eye, BarChart2, Bell, HelpCircle, GitBranch, AlertCircle
} from 'lucide-react';
import ForceGraphViewer from './components/ForceGraphViewer';
import GraphExplorer from './components/GraphExplorer';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';
const WS_URL = API_URL.replace('https://', 'wss://').replace('http://', 'ws://');

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

  // Render Dashboard View
  const renderDashboard = () => (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Entities" 
          value={stats?.entities_count || stats?.intel?.collections?.entities || '0'}
          icon={Box}
          color="accent"
        />
        <StatCard 
          title="Events" 
          value={stats?.events_count || stats?.intel?.collections?.events || '0'}
          icon={Activity}
          color="success"
        />
        <StatCard 
          title="Investors" 
          value={stats?.intel?.collections?.investors || '0'}
          icon={Users}
          color="warning"
        />
        <StatCard 
          title="Unlocks" 
          value={stats?.unlocks_count || stats?.intel?.collections?.unlocks || '0'}
          icon={Unlock}
          color="error"
        />
      </div>

      {/* Pipeline Status - P0 #3 */}
      {pipelineStatus && (
        <div>
          <SectionHeader title="Pipeline Status" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Scheduler Status */}
            <div 
              className="bg-white rounded-2xl border p-5"
              style={{ borderColor: colors.border }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: colors.accentSoft }}>
                    <RefreshCw size={18} style={{ color: colors.accent }} />
                  </div>
                  <span className="font-medium" style={{ color: colors.text }}>Scheduler</span>
                </div>
                <StatusBadge status={pipelineStatus.scheduler?.running ? 'active' : 'offline'} />
              </div>
              <div className="text-sm" style={{ color: colors.textSecondary }}>
                <p>{pipelineStatus.scheduler?.jobs_active || 0} jobs active</p>
                <p>{pipelineStatus.scheduler?.jobs_success || 0} success / {pipelineStatus.scheduler?.jobs_failed || 0} failed</p>
              </div>
            </div>

            {/* Parser Jobs */}
            <div 
              className="bg-white rounded-2xl border p-5"
              style={{ borderColor: colors.border }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: colors.successSoft }}>
                    <Database size={18} style={{ color: colors.success }} />
                  </div>
                  <span className="font-medium" style={{ color: colors.text }}>Parsers</span>
                </div>
                <span className="text-sm font-medium" style={{ color: colors.success }}>
                  {pipelineStatus.parsers?.active || 0}/{pipelineStatus.parsers?.total || 0}
                </span>
              </div>
              <div className="text-sm" style={{ color: colors.textSecondary }}>
                <p>{pipelineStatus.parsers?.active || 0} active, {pipelineStatus.parsers?.pending || 0} pending</p>
                <p>{pipelineStatus.parsers?.failed || 0} failed</p>
              </div>
            </div>

            {/* News Pipeline */}
            <div 
              className="bg-white rounded-2xl border p-5"
              style={{ borderColor: colors.border }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: colors.warningSoft }}>
                    <FileText size={18} style={{ color: colors.warning }} />
                  </div>
                  <span className="font-medium" style={{ color: colors.text }}>News</span>
                </div>
                <span className="text-sm font-medium" style={{ color: colors.warning }}>
                  {pipelineStatus.news_pipeline?.sources || 0} sources
                </span>
              </div>
              <div className="text-sm" style={{ color: colors.textSecondary }}>
                <p>{pipelineStatus.news_pipeline?.articles_total || 0} articles total</p>
                <p>{pipelineStatus.news_pipeline?.events_detected || 0} events detected</p>
              </div>
            </div>

            {/* Discovery Engine */}
            <div 
              className="bg-white rounded-2xl border p-5"
              style={{ borderColor: colors.border }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: colors.errorSoft }}>
                    <Globe size={18} style={{ color: colors.error }} />
                  </div>
                  <span className="font-medium" style={{ color: colors.text }}>Discovery</span>
                </div>
                <StatusBadge status={pipelineStatus.discovery?.running ? 'active' : 'offline'} />
              </div>
              <div className="text-sm" style={{ color: colors.textSecondary }}>
                <p>{pipelineStatus.discovery?.endpoints_discovered || 0} endpoints</p>
                <p>{pipelineStatus.discovery?.providers_registered || 0} providers</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Parser Jobs Detail - P0 #2 */}
      {pipelineStatus?.parsers?.jobs?.length > 0 && (
        <div>
          <SectionHeader title="Parser Jobs" />
          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: colors.border }}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {pipelineStatus.parsers.jobs.map(job => (
                <div 
                  key={job.id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ backgroundColor: colors.surface }}
                >
                  <div>
                    <p className="font-medium text-sm" style={{ color: colors.text }}>{job.name}</p>
                    <p className="text-xs" style={{ color: colors.textMuted }}>
                      {job.last_run ? `Last: ${new Date(job.last_run).toLocaleTimeString()}` : 'Never run'}
                    </p>
                  </div>
                  <StatusBadge status={job.status === 'pending' ? 'pending' : job.status} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* System Status */}
      <div>
        <SectionHeader title="Intelligence Engines" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['correlation', 'trust', 'query'].map(engine => (
            <div 
              key={engine}
              className="bg-white rounded-2xl border p-5 flex items-center justify-between"
              style={{ borderColor: colors.border }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: colors.accentSoft }}
                >
                  <Zap size={18} style={{ color: colors.accent }} />
                </div>
                <div>
                  <p className="font-medium capitalize" style={{ color: colors.text }}>
                    {engine} Engine
                  </p>
                  <p className="text-sm" style={{ color: colors.textSecondary }}>
                    Intelligence Module
                  </p>
                </div>
              </div>
              <StatusBadge status={stats?.engines?.[engine]?.initialized ? 'active' : 'offline'} />
            </div>
          ))}
        </div>
      </div>

      {/* Exchange Providers */}
      <div>
        <SectionHeader title="Exchange Providers" action="View All" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {exchangeHealth.map((provider, i) => (
            <div 
              key={i}
              className="bg-white rounded-2xl border p-5"
              style={{ borderColor: colors.border }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium capitalize" style={{ color: colors.text }}>
                  {provider.venue}
                </span>
                <StatusBadge status={provider.healthy ? 'healthy' : 'error'} />
              </div>
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                Latency: {provider.latency_ms?.toFixed(0) || 'N/A'}ms
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Source Trust Scores */}
      {trustScores.length > 0 && (
        <div>
          <SectionHeader title="Source Trust Scores" />
          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: colors.border }}>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-6">
              {trustScores.map((source, i) => (
                <div key={i} className="text-center">
                  <div 
                    className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-2"
                    style={{ 
                      backgroundColor: source.trust_score > 0.8 ? colors.successSoft : 
                                       source.trust_score > 0.6 ? colors.warningSoft : colors.errorSoft
                    }}
                  >
                    <span className="text-lg font-bold" style={{ 
                      color: source.trust_score > 0.8 ? colors.success : 
                             source.trust_score > 0.6 ? colors.warning : colors.error
                    }}>
                      {(source.trust_score * 100).toFixed(0)}
                    </span>
                  </div>
                  <p className="text-sm font-medium capitalize" style={{ color: colors.text }}>
                    {source.source_id}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Render Explorer View
  const renderExplorer = () => {
    const collections = stats?.intel?.collections || {};
    const explorerData = [
      { name: 'Projects', count: collections.projects || 0, icon: Layers },
      { name: 'Investors', count: collections.investors || 0, icon: Users },
      { name: 'Funding', count: collections.funding || 0, icon: DollarSign },
      { name: 'Unlocks', count: collections.unlocks || 0, icon: Unlock },
      { name: 'Sales', count: collections.sales || 0, icon: TrendingUp },
      { name: 'Events', count: collections.events || 0, icon: Activity },
    ];

    return (
      <div className="space-y-8">
        <SearchInput 
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search entities by name, symbol, or address..."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {explorerData.map((item, i) => (
            <div 
              key={i}
              data-testid={`explorer-${item.name.toLowerCase()}`}
              className="bg-white rounded-2xl border p-6 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5"
              style={{ borderColor: colors.border }}
            >
              <div className="flex items-center gap-4">
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: colors.accentSoft }}
                >
                  <item.icon size={24} style={{ color: colors.accent }} />
                </div>
                <div>
                  <p className="text-sm" style={{ color: colors.textSecondary }}>{item.name}</p>
                  <p className="text-2xl font-bold" style={{ color: colors.text }}>
                    {item.count.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════
  // NETWORK DISCOVERY STATE
  // ═══════════════════════════════════════════════════════════════
  const [discoveryResults, setDiscoveryResults] = useState([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryType, setDiscoveryType] = useState(null);
  const [discoverySourcesUsed, setDiscoverySourcesUsed] = useState([]);
  const [discoverySourceFilter, setDiscoverySourceFilter] = useState('all'); // 'all', 'new', 'active', 'planned'
  const [discoveryTierFilter, setDiscoveryTierFilter] = useState('all'); // 'all', 'T1', 'T2', 'T3', 'T4'
  const [dataSources, setDataSources] = useState([]);
  const [dataSourcesLoading, setDataSourcesLoading] = useState(false);
  const [sourceHealth, setSourceHealth] = useState({});
  const [tierStatus, setTierStatus] = useState({});
  const [healthAlerts, setHealthAlerts] = useState([]);
  const [alertStats, setAlertStats] = useState({});
  const [exchangeStatus, setExchangeStatus] = useState({});

  // Fetch source health data
  const fetchSourceHealth = useCallback(async () => {
    try {
      const [healthRes, tiersRes, alertsRes, exchangeRes] = await Promise.all([
        fetch(`${API_URL}/api/scheduler/health`),
        fetch(`${API_URL}/api/scheduler/tiers`),
        fetch(`${API_URL}/api/scheduler/alerts`),
        fetch(`${API_URL}/api/scheduler/exchange/status`).catch(() => ({ json: () => ({}) }))
      ]);
      const healthData = await healthRes.json();
      const tiersData = await tiersRes.json();
      const alertsData = await alertsRes.json();
      const exchangeData = await exchangeRes.json();
      
      setSourceHealth(healthData.sources || {});
      setTierStatus(tiersData || {});
      setHealthAlerts(alertsData.alerts || []);
      setAlertStats(alertsData.stats || {});
      setExchangeStatus(exchangeData || {});
    } catch (e) {
      console.error('Failed to fetch source health:', e);
    }
  }, []);

  // Fetch data sources
  const fetchDataSources = useCallback(async () => {
    setDataSourcesLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/discovery/sources`);
      const data = await res.json();
      setDataSources(data.sources || []);
    } catch (e) {
      console.error('Failed to fetch data sources:', e);
    }
    setDataSourcesLoading(false);
  }, []);

  // Network Discovery search
  const performDiscoverySearch = useCallback(async (query, type = null) => {
    if (!query || query.length < 2) return;
    
    setDiscoveryLoading(true);
    setDiscoveryResults([]);
    setDiscoverySourcesUsed([]);
    
    try {
      const params = new URLSearchParams({ q: query, limit: '20' });
      if (type) params.append('type', type);
      
      const res = await fetch(`${API_URL}/api/discovery/search?${params}`);
      const data = await res.json();
      
      setDiscoveryResults(data.items || []);
      setDiscoverySourcesUsed(data.sources_used || []);
    } catch (e) {
      console.error('Discovery search failed:', e);
    }
    setDiscoveryLoading(false);
  }, []);

  // Debounced search
  useEffect(() => {
    if (activeTab === 'discovery' && searchQuery.length >= 2) {
      const timer = setTimeout(() => {
        performDiscoverySearch(searchQuery, discoveryType);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, discoveryType, activeTab, performDiscoverySearch]);

  // Fetch sources when tab changes
  useEffect(() => {
    if (activeTab === 'discovery') {
      fetchDataSources();
    }
  }, [activeTab, fetchDataSources]);

  // Render Discovery View
  // Site Discovery State
  const [siteDiscoveryQuery, setSiteDiscoveryQuery] = useState('');
  const [siteDiscoveryResults, setSiteDiscoveryResults] = useState([]);
  const [siteDiscoveryLoading, setSiteDiscoveryLoading] = useState(false);
  const [parsingInProgress, setParsingInProgress] = useState({});
  const [discoveredEndpoints, setDiscoveredEndpoints] = useState([]);
  
  // Modal State for Project Details
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectParsingStatus, setProjectParsingStatus] = useState({
    stage: 'idle', // idle, discovering, parsing, success, error
    progress: 0,
    message: '',
    data: null
  });

  // Brand colors for known projects
  const PROJECT_BRANDS = {
    'defillama': { primary: '#0d9488', secondary: '#14b8a6', bg: '#0f1f1d', name: 'DefiLlama', icon: '🦙' },
    'coingecko': { primary: '#8dc647', secondary: '#6ba42f', bg: '#1a2c1a', name: 'CoinGecko', icon: '🦎' },
    'dexscreener': { primary: '#00d395', secondary: '#00a676', bg: '#0d1f1a', name: 'DexScreener', icon: '📊' },
    'coinmarketcap': { primary: '#3861fb', secondary: '#1e3fa0', bg: '#0d1629', name: 'CoinMarketCap', icon: '📈' },
    'cryptorank': { primary: '#6366f1', secondary: '#4f46e5', bg: '#1e1b4b', name: 'CryptoRank', icon: '🏆' },
    'messari': { primary: '#0052ff', secondary: '#0047e1', bg: '#001a4d', name: 'Messari', icon: '📋' },
    'coinglass': { primary: '#f7931a', secondary: '#e68217', bg: '#2d1f0d', name: 'CoinGlass', icon: '🔍' },
    'geckoterminal': { primary: '#8dc647', secondary: '#6ba42f', bg: '#1a2c1a', name: 'GeckoTerminal', icon: '🖥️' },
    'tokenterminal': { primary: '#7c3aed', secondary: '#6d28d9', bg: '#1e1033', name: 'TokenTerminal', icon: '📉' },
    'dropstab': { primary: '#06b6d4', secondary: '#0891b2', bg: '#0c2d33', name: 'Dropstab', icon: '💧' },
    'rootdata': { primary: '#10b981', secondary: '#059669', bg: '#0d2d24', name: 'RootData', icon: '🌱' },
  };

  // Get brand for domain
  const getBrandForDomain = (domain) => {
    if (!domain) return { primary: colors.accent, secondary: colors.accentSoft, bg: '#1a1a2e', name: domain, icon: '🌐' };
    const domainLower = domain.toLowerCase().replace('.com', '').replace('.io', '');
    for (const [key, brand] of Object.entries(PROJECT_BRANDS)) {
      if (domainLower.includes(key)) return brand;
    }
    return { primary: colors.accent, secondary: colors.accentSoft, bg: '#1a1a2e', name: domain, icon: '🌐' };
  };

  // Search for websites/services
  const searchSites = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSiteDiscoveryResults([]);
      return;
    }
    
    setSiteDiscoveryLoading(true);
    try {
      // Search in data sources registry and discovered endpoints
      const [sourcesRes, endpointsRes] = await Promise.all([
        fetch(`${API_URL}/api/discovery/sources`).then(r => r.json()).catch(() => ({ sources: [] })),
        fetch(`${API_URL}/api/discovery/endpoints?limit=50`).then(r => r.json()).catch(() => ({ endpoints: [] }))
      ]);
      
      const queryLower = query.toLowerCase();
      
      // Filter sources matching query
      const matchedSources = (sourcesRes.sources || []).filter(s => 
        s.name?.toLowerCase().includes(queryLower) ||
        s.website?.toLowerCase().includes(queryLower) ||
        s.categories?.some(c => c.toLowerCase().includes(queryLower))
      );
      
      // Filter endpoints matching query  
      const matchedEndpoints = (endpointsRes.endpoints || []).filter(e =>
        e.domain?.toLowerCase().includes(queryLower) ||
        e.url?.toLowerCase().includes(queryLower)
      );
      
      // Combine and format results
      const results = [
        ...matchedSources.map(s => ({
          id: s.id,
          type: 'source',
          name: s.name,
          website: s.website,
          domain: s.website?.replace(/https?:\/\//, '').split('/')[0],
          categories: s.categories || [],
          status: s.status,
          hasApi: s.has_api,
          apiKeyRequired: s.api_key_required,
          description: s.description
        })),
        ...matchedEndpoints.map(e => ({
          id: e.id,
          type: 'endpoint',
          name: e.domain,
          website: e.url,
          domain: e.domain,
          path: e.path,
          status: e.status,
          capabilities: e.capabilities || [],
          latency: e.latency_ms
        }))
      ];
      
      setSiteDiscoveryResults(results);
    } catch (e) {
      console.error('Site search failed:', e);
    }
    setSiteDiscoveryLoading(false);
  }, []);

  // Discover new domain
  const discoverDomain = async (domain) => {
    if (!domain) return;
    
    // Clean domain
    const cleanDomain = domain.replace(/https?:\/\//, '').split('/')[0].replace('www.', '');
    
    setParsingInProgress(prev => ({ ...prev, [cleanDomain]: 'discovering' }));
    
    try {
      // First try simple API probe
      const simpleRes = await fetch(`${API_URL}/api/discovery/domain/${encodeURIComponent(cleanDomain)}`, {
        method: 'POST'
      });
      const simpleData = await simpleRes.json();
      
      // Check if we found active endpoints with simple probe
      const activeEndpoints = simpleData.endpoints?.filter(ep => ep.status === 'active') || [];
      
      if (activeEndpoints.length > 0) {
        setParsingInProgress(prev => ({ ...prev, [cleanDomain]: 'success' }));
        fetchDiscoveredEndpoints();
        return simpleData;
      }
      
      // If no active endpoints found, try browser discovery
      setParsingInProgress(prev => ({ ...prev, [cleanDomain]: 'browser_discovery' }));
      
      const browserRes = await fetch(`${API_URL}/api/discovery/browser/${encodeURIComponent(cleanDomain)}`, {
        method: 'POST'
      });
      const browserData = await browserRes.json();
      
      if (browserData.ok) {
        // Browser discovery started in background
        setParsingInProgress(prev => ({ ...prev, [cleanDomain]: 'running' }));
        
        // Poll for results
        setTimeout(async () => {
          const checkRes = await fetch(`${API_URL}/api/discovery/endpoints?domain=${encodeURIComponent(cleanDomain)}`);
          const checkData = await checkRes.json();
          
          if (checkData.endpoints?.length > 0) {
            setParsingInProgress(prev => ({ ...prev, [cleanDomain]: 'success' }));
          } else {
            setParsingInProgress(prev => ({ ...prev, [cleanDomain]: 'blocked' }));
          }
          fetchDiscoveredEndpoints();
        }, 15000); // Wait 15 seconds for browser discovery
        
        return browserData;
      } else {
        setParsingInProgress(prev => ({ ...prev, [cleanDomain]: 'no_endpoints' }));
      }
    } catch (e) {
      console.error('Domain discovery failed:', e);
      setParsingInProgress(prev => ({ ...prev, [cleanDomain]: 'error' }));
    }
    
    return null;
  };

  // Force re-discovery for domain (when API changes)
  const rediscoverDomain = async (domain) => {
    if (!domain) return;
    
    const cleanDomain = domain.replace(/https?:\/\//, '').split('/')[0].replace('www.', '');
    setParsingInProgress(prev => ({ ...prev, [cleanDomain]: 'rediscovering' }));
    
    try {
      const res = await fetch(`${API_URL}/api/discovery/rediscover/${encodeURIComponent(cleanDomain)}`, {
        method: 'POST'
      });
      const data = await res.json();
      
      if (data.status === 'success') {
        setParsingInProgress(prev => ({ ...prev, [cleanDomain]: 'success' }));
        fetchDiscoveredEndpoints();
      } else {
        setParsingInProgress(prev => ({ ...prev, [cleanDomain]: 'error' }));
      }
      
      return data;
    } catch (e) {
      console.error('Re-discovery failed:', e);
      setParsingInProgress(prev => ({ ...prev, [cleanDomain]: 'error' }));
    }
    
    return null;
  };

  // Run parsing on discovered endpoint
  const runParsing = async (endpointId) => {
    setParsingInProgress(prev => ({ ...prev, [endpointId]: 'parsing' }));
    
    try {
      // Register as provider and trigger sync
      const res = await fetch(`${API_URL}/api/discovery/endpoints/${endpointId}/register?provider_name=auto_${endpointId}`, {
        method: 'POST'
      });
      const data = await res.json();
      
      if (data.ok) {
        setParsingInProgress(prev => ({ ...prev, [endpointId]: 'registered' }));
        // Refresh endpoints list to show updated status
        fetchDiscoveredEndpoints();
      } else {
        setParsingInProgress(prev => ({ ...prev, [endpointId]: 'error' }));
      }
    } catch (e) {
      console.error('Parsing failed:', e);
      setParsingInProgress(prev => ({ ...prev, [endpointId]: 'error' }));
    }
  };

  // Fetch discovered endpoints
  const fetchDiscoveredEndpoints = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/discovery/endpoints?limit=100`);
      const data = await res.json();
      setDiscoveredEndpoints(data.endpoints || []);
    } catch (e) {
      console.error('Failed to fetch endpoints:', e);
    }
  }, []);

  // Open project modal and start auto-discovery
  const openProjectModal = async (project) => {
    const brand = getBrandForDomain(project.domain || project.name);
    setSelectedProject({ ...project, brand });
    setProjectModalOpen(true);
    setProjectParsingStatus({ stage: 'discovering', progress: 10, message: 'Searching for API endpoints...', data: null });

    try {
      // Step 1: Discover domain
      const domain = project.domain || project.website?.replace(/https?:\/\//, '').split('/')[0];
      if (!domain) {
        setProjectParsingStatus({ stage: 'error', progress: 0, message: 'Domain not found', data: null });
        return;
      }

      setProjectParsingStatus({ stage: 'discovering', progress: 30, message: `Scanning ${domain}...`, data: null });

      const discoverRes = await fetch(`${API_URL}/api/discovery/domain/${encodeURIComponent(domain)}`, { method: 'POST' });
      const discoverData = await discoverRes.json();

      if (!discoverData.endpoints || discoverData.endpoints.length === 0) {
        setProjectParsingStatus({ stage: 'error', progress: 0, message: 'No API endpoints found', data: null });
        return;
      }

      setProjectParsingStatus({ 
        stage: 'discovered', 
        progress: 60, 
        message: `Found ${discoverData.endpoints.length} endpoints`, 
        data: discoverData 
      });

      // Step 2: Auto-register active endpoints
      const activeEndpoints = discoverData.endpoints.filter(ep => ep.status === 'active');
      
      if (activeEndpoints.length > 0) {
        setProjectParsingStatus({ stage: 'parsing', progress: 70, message: 'Registering providers...', data: discoverData });

        for (let i = 0; i < activeEndpoints.length; i++) {
          const ep = activeEndpoints[i];
          const providerName = `${brand.name}_${ep.path.replace(/\//g, '_').slice(1) || 'api'}`;
          
          try {
            await fetch(`${API_URL}/api/discovery/endpoints/${ep.id}/register?provider_name=${encodeURIComponent(providerName)}`, { method: 'POST' });
          } catch (e) {
            console.error('Failed to register endpoint:', e);
          }
          
          setProjectParsingStatus(prev => ({ 
            ...prev, 
            progress: 70 + Math.round((i + 1) / activeEndpoints.length * 20),
            message: `Registered ${ep.path}...`
          }));
        }

        // Step 3: Fetch sample data
        setProjectParsingStatus(prev => ({ ...prev, stage: 'fetching', progress: 95, message: 'Fetching data...' }));
        
        // Try to fetch actual data from first active endpoint
        const firstEndpoint = activeEndpoints[0];
        try {
          const sampleRes = await fetch(firstEndpoint.url);
          const sampleData = await sampleRes.json();
          
          setProjectParsingStatus({ 
            stage: 'success', 
            progress: 100, 
            message: `Success! Fetched ${Array.isArray(sampleData) ? sampleData.length : Object.keys(sampleData).length} records`,
            data: { 
              ...discoverData, 
              sampleData: Array.isArray(sampleData) ? sampleData.slice(0, 10) : sampleData,
              totalRecords: Array.isArray(sampleData) ? sampleData.length : 1
            }
          });
        } catch (e) {
          setProjectParsingStatus({ 
            stage: 'success', 
            progress: 100, 
            message: 'Providers registered',
            data: discoverData 
          });
        }
      } else {
        setProjectParsingStatus({ 
          stage: 'discovered', 
          progress: 60, 
          message: `Found ${discoverData.endpoints.length} endpoints (API key required)`, 
          data: discoverData 
        });
      }

      // Refresh endpoints list
      fetchDiscoveredEndpoints();
      
    } catch (e) {
      console.error('Project discovery failed:', e);
      setProjectParsingStatus({ stage: 'error', progress: 0, message: `Error: ${e.message}`, data: null });
    }
  };

  // Fetch on tab change
  useEffect(() => {
    if (activeTab === 'discovery') {
      fetchDiscoveredEndpoints();
      fetchDataSources();
      fetchSourceHealth();
    }
  }, [activeTab, fetchDiscoveredEndpoints, fetchDataSources, fetchSourceHealth]);

  const renderDiscovery = () => {
    const statusIcons = {
      discovering: <RefreshCw size={14} className="animate-spin" />,
      browser_discovery: <Globe size={14} className="animate-pulse" />,
      running: <RefreshCw size={14} className="animate-spin" />,
      success: <CheckCircle size={14} />,
      error: <XCircle size={14} />,
      parsing: <RefreshCw size={14} className="animate-spin" />,
      registered: <CheckCircle size={14} />,
      no_endpoints: <AlertTriangle size={14} />,
      blocked: <AlertTriangle size={14} />,
      rediscovering: <RefreshCw size={14} className="animate-spin" />
    };

    const statusColors = {
      discovering: colors.accent,
      browser_discovery: colors.warning,
      running: colors.warning,
      success: colors.success,
      error: colors.error,
      parsing: colors.accent,
      registered: colors.success,
      no_endpoints: colors.warning,
      blocked: colors.error,
      rediscovering: colors.warning
    };
    
    const statusLabels = {
      discovering: 'API Probing...',
      browser_discovery: 'Browser Discovery...',
      running: 'Scanning with browser...',
      success: 'Found endpoints',
      error: 'Error',
      parsing: 'Parsing...',
      registered: 'Registered',
      no_endpoints: 'No endpoints found',
      blocked: 'Blocked (anti-bot)',
      rediscovering: 'Re-discovering...'
    };

    return (
      <div className="space-y-8">
        {/* Search Header */}
        <div className="bg-white rounded-2xl border p-8" style={{ borderColor: colors.border }}>
          <div className="text-center mb-8">
            <div 
              className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-4"
              style={{ backgroundColor: colors.accentSoft }}
            >
              <Globe size={36} style={{ color: colors.accent }} />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: colors.text }}>
              Network Discovery
            </h2>
            <p style={{ color: colors.textSecondary }}>
              Search for websites and services for data parsing
            </p>
          </div>

          {/* Site Search Input */}
          <div className="relative">
            <Search 
              size={20} 
              className="absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: colors.textMuted }}
            />
            <input
              data-testid="site-discovery-input"
              type="text"
              value={siteDiscoveryQuery}
              onChange={(e) => {
                setSiteDiscoveryQuery(e.target.value);
                searchSites(e.target.value);
              }}
              placeholder="Enter domain or service name (e.g., defillama.com, coingecko)"
              className="w-full pl-12 pr-4 py-4 rounded-xl border transition-all focus:outline-none focus:ring-2"
              style={{ 
                borderColor: colors.border,
                backgroundColor: colors.surface,
                color: colors.text
              }}
            />
          </div>

          {/* Quick Actions */}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              data-testid="discover-btn"
              onClick={() => {
                if (siteDiscoveryQuery.length >= 2) {
                  discoverDomain(siteDiscoveryQuery);
                }
              }}
              disabled={siteDiscoveryQuery.length < 2}
              className="px-6 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
              style={{ 
                backgroundColor: siteDiscoveryQuery.length >= 2 ? colors.accent : colors.surface,
                color: siteDiscoveryQuery.length >= 2 ? 'white' : colors.textMuted,
                cursor: siteDiscoveryQuery.length >= 2 ? 'pointer' : 'not-allowed'
              }}
            >
              <Network size={18} />
              Discover API Endpoints
            </button>
            <button
              onClick={fetchDiscoveredEndpoints}
              className="px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
              style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
            >
              <RefreshCw size={18} />
              Refresh
            </button>
          </div>
        </div>

        {/* Search Results */}
        {siteDiscoveryLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="animate-spin" size={32} style={{ color: colors.accent }} />
          </div>
        ) : siteDiscoveryResults.length > 0 ? (
          <div>
            <SectionHeader title={`Found ${siteDiscoveryResults.length} matches`} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {siteDiscoveryResults.map((item, i) => (
                <div 
                  key={item.id || i}
                  className="bg-white rounded-2xl border p-5 transition-all hover:shadow-lg"
                  style={{ borderColor: colors.border }}
                >
                  <div className="flex items-start gap-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: item.type === 'endpoint' ? colors.successSoft : colors.accentSoft }}
                    >
                      {item.type === 'endpoint' ? <Server size={20} style={{ color: colors.success }} /> : <Globe size={20} style={{ color: colors.accent }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span 
                          className="px-2 py-0.5 rounded text-xs font-medium uppercase"
                          style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
                        >
                          {item.type}
                        </span>
                        {item.status && (
                          <span 
                            className="px-2 py-0.5 rounded text-xs"
                            style={{ 
                              backgroundColor: item.status === 'active' ? colors.successSoft : colors.surface,
                              color: item.status === 'active' ? colors.success : colors.textMuted
                            }}
                          >
                            {item.status}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold" style={{ color: colors.text }}>
                        {item.name}
                      </p>
                      {item.website && (
                        <p className="text-sm truncate" style={{ color: colors.textSecondary }}>
                          {item.website}
                        </p>
                      )}
                      {item.description && (
                        <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
                          {item.description}
                        </p>
                      )}
                      {item.categories?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.categories.slice(0, 3).map(cat => (
                            <span 
                              key={cat}
                              className="px-2 py-0.5 rounded text-xs"
                              style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {item.type === 'source' && (
                        <button
                          onClick={() => discoverDomain(item.domain)}
                          disabled={parsingInProgress[item.domain]}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                          style={{ 
                            backgroundColor: parsingInProgress[item.domain] ? colors.surface : colors.accentSoft,
                            color: parsingInProgress[item.domain] ? statusColors[parsingInProgress[item.domain]] : colors.accent
                          }}
                        >
                          {parsingInProgress[item.domain] ? statusIcons[parsingInProgress[item.domain]] : <Play size={12} />}
                          {statusLabels[parsingInProgress[item.domain]] || 'Discover'}
                        </button>
                      )}
                      {item.type === 'endpoint' && (
                        <>
                          <button
                            onClick={() => runParsing(item.id)}
                            disabled={parsingInProgress[item.id]}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                            style={{ 
                              backgroundColor: parsingInProgress[item.id] ? colors.surface : colors.successSoft,
                              color: parsingInProgress[item.id] ? statusColors[parsingInProgress[item.id]] : colors.success
                            }}
                          >
                            {parsingInProgress[item.id] ? statusIcons[parsingInProgress[item.id]] : <Zap size={12} />}
                            {statusLabels[parsingInProgress[item.id]] || 'Parse'}
                          </button>
                          <button
                            onClick={() => rediscoverDomain(item.domain)}
                            disabled={parsingInProgress[item.domain]}
                            className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                            style={{ 
                              backgroundColor: colors.surface,
                              color: colors.textSecondary
                            }}
                            title="Re-discover endpoints (use when API changes)"
                          >
                            <RefreshCw size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : siteDiscoveryQuery.length >= 2 ? (
          <div 
            className="bg-white rounded-2xl border p-12 text-center"
            style={{ borderColor: colors.border }}
          >
            <Globe size={48} className="mx-auto mb-4" style={{ color: colors.textMuted }} />
            <p className="font-medium mb-2" style={{ color: colors.text }}>Service not found in database</p>
            <p className="text-sm mb-6" style={{ color: colors.textSecondary }}>
              Click "Discover API Endpoints" to scan the domain
            </p>
            <button
              onClick={() => discoverDomain(siteDiscoveryQuery)}
              className="px-6 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 mx-auto"
              style={{ backgroundColor: colors.accent, color: 'white' }}
            >
              <Network size={18} />
              Discover {siteDiscoveryQuery}
            </button>
          </div>
        ) : null}

        {/* Data Sources Registry */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionHeader title="Data Sources Registry" />
            <div className="flex gap-2 items-center flex-wrap">
              <button
                onClick={async () => {
                  setDataSourcesLoading(true);
                  try {
                    await fetch(`${API_BASE_URL}/api/discovery/sources/health-check`, { method: 'POST' });
                    await fetchDataSources();
                  } catch (e) {
                    console.error('Health check failed:', e);
                  }
                  setDataSourcesLoading(false);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                style={{ backgroundColor: colors.primary, color: 'white' }}
                data-testid="health-check-btn"
              >
                <Activity size={12} />
                Health Check
              </button>
              {/* TIER Filters */}
              <div className="flex gap-1 px-2 py-1 rounded-lg" style={{ backgroundColor: colors.surface }}>
                {['all', 'T1', 'T2', 'T3', 'T4'].map(tierFilter => (
                  <button
                    key={tierFilter}
                    onClick={() => setDiscoveryTierFilter(tierFilter)}
                    className="px-2 py-1 rounded text-xs font-bold transition-all"
                    style={{
                      backgroundColor: discoveryTierFilter === tierFilter 
                        ? tierFilter === 'T1' ? '#22c55e'
                        : tierFilter === 'T2' ? '#3b82f6' 
                        : tierFilter === 'T3' ? '#f59e0b'
                        : tierFilter === 'T4' ? '#8b5cf6'
                        : colors.accent
                        : 'transparent',
                      color: discoveryTierFilter === tierFilter ? 'white' : colors.textMuted
                    }}
                  >
                    {tierFilter}
                  </button>
                ))}
              </div>
              {/* Status Filters */}
              {['all', 'new', 'active', 'degraded', 'offline', 'planned'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setDiscoverySourceFilter(filter)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
                  style={{
                    backgroundColor: discoverySourceFilter === filter ? colors.accent : colors.surface,
                    color: discoverySourceFilter === filter ? 'white' : colors.textSecondary
                  }}
                >
                  {filter}
                  {filter === 'new' && dataSources.filter(s => s.is_new).length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px]" 
                      style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}>
                      {dataSources.filter(s => s.is_new).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          {dataSourcesLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="animate-spin" style={{ color: colors.accent }} />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {dataSources
                .filter(source => {
                  // TIER filter
                  if (discoveryTierFilter !== 'all') {
                    const tierNum = parseInt(discoveryTierFilter.replace('T', ''));
                    if (source.tier !== tierNum) return false;
                  }
                  // Status filter
                  if (discoverySourceFilter === 'all') return true;
                  if (discoverySourceFilter === 'new') return source.is_new;
                  if (discoverySourceFilter === 'active') return source.status === 'active';
                  if (discoverySourceFilter === 'degraded') return source.status === 'degraded';
                  if (discoverySourceFilter === 'offline') return ['error', 'offline', 'timeout'].includes(source.status);
                  if (discoverySourceFilter === 'planned') return source.status === 'planned';
                  return true;
                })
                .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
                .map(source => (
                <div 
                  key={source.id}
                  data-testid={`source-${source.id}`}
                  className="bg-white rounded-xl border p-4 transition-all hover:shadow-lg hover:scale-[1.02] relative cursor-pointer group"
                  style={{ borderColor: source.is_new ? colors.warning : colors.border }}
                  onClick={() => openProjectModal(source)}
                >
                  {/* New badge */}
                  {source.is_new && (
                    <span 
                      className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: colors.warning, color: 'white' }}
                    >
                      NEW
                    </span>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {/* TIER label - simple text */}
                      {source.tier && (
                        <span 
                          className="text-xs font-bold"
                          style={{ 
                            color: source.tier === 1 ? '#22c55e'
                              : source.tier === 2 ? '#3b82f6' 
                              : source.tier === 3 ? '#f59e0b'
                              : '#8b5cf6'
                          }}
                          title={`Tier ${source.tier} - ${source.tier === 1 ? 'Core Data (10min)' : source.tier === 2 ? 'Market Data (15min)' : source.tier === 3 ? 'Activities (30min)' : 'Research (3h)'}`}
                        >
                          T{source.tier}
                        </span>
                      )}
                      <span className="font-medium" style={{ color: colors.text }}>{source.name}</span>
                    </div>
                    {source.status === 'active' ? (
                      <span 
                        className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
                        style={{ backgroundColor: colors.successSoft, color: colors.success }}
                        title="Source is working correctly"
                      >
                        <CheckCircle size={10} />
                        Active
                      </span>
                    ) : source.status === 'degraded' || source.status === 'needs_key' ? (
                      <span 
                        className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
                        style={{ backgroundColor: colors.warningSoft || '#FEF3C7', color: colors.warning || '#F59E0B' }}
                        title={source.last_check?.message || "API key required for full access"}
                      >
                        <Key size={10} />
                        Key Required
                      </span>
                    ) : source.status === 'error' || source.status === 'offline' ? (
                      <span 
                        className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
                        style={{ backgroundColor: colors.dangerSoft || '#FEE2E2', color: colors.danger || '#EF4444' }}
                        title={source.last_check?.message || "Source is offline"}
                      >
                        <XCircle size={10} />
                        Offline
                      </span>
                    ) : source.status === 'timeout' ? (
                      <span 
                        className="px-2 py-0.5 rounded-full text-xs flex items-center gap-1"
                        style={{ backgroundColor: colors.dangerSoft || '#FEE2E2', color: colors.warning || '#F59E0B' }}
                        title={source.last_check?.message || "Request timeout"}
                      >
                        <Clock size={10} />
                        Timeout
                      </span>
                    ) : (
                      <span 
                        className="px-2 py-0.5 rounded-full text-xs"
                        style={{ backgroundColor: colors.surface, color: colors.textMuted }}
                        title="Not yet configured"
                      >
                        Planned
                      </span>
                    )}
                  </div>
                  {/* Status reason - показываем причину если не active */}
                  {source.status !== 'active' && source.last_check?.message && (
                    <div 
                      className="text-xs px-2 py-1 rounded mb-2 truncate"
                      style={{ 
                        backgroundColor: source.status === 'error' || source.status === 'offline' || source.status === 'timeout' 
                          ? colors.dangerSoft || '#FEE2E2' 
                          : colors.warningSoft || '#FEF3C7',
                        color: colors.textSecondary 
                      }}
                      title={source.last_check.message}
                    >
                      {source.last_check.message}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {source.categories?.slice(0, 3).map(cat => (
                      <span 
                        key={cat}
                        className="px-2 py-0.5 rounded text-xs"
                        style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs" style={{ color: colors.textMuted }}>
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {source.sync_interval_min ? `${source.sync_interval_min}min` : source.tier === 1 ? '10min' : source.tier === 2 ? '15min' : source.tier === 3 ? '30min' : '3h'}
                    </span>
                    {source.last_sync && (
                      <span>{source.last_sync_ago}</span>
                    )}
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3">
                    <span className="text-white text-xs font-medium flex items-center gap-1">
                      <Zap size={12} /> Start Discovery
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Source Health Dashboard */}
        <div 
          data-testid="source-health-dashboard"
          className="bg-white rounded-2xl border p-6"
          style={{ borderColor: colors.border }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Activity size={20} style={{ color: colors.accent }} />
              <span className="font-semibold" style={{ color: colors.text }}>Source Health Dashboard</span>
            </div>
            <button
              onClick={fetchSourceHealth}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
              style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
              data-testid="refresh-health-btn"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          
          {/* Tier Status Overview */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(tier => {
              const tierJobs = tierStatus.jobs_by_tier?.[tier] || [];
              const healthyCount = tierJobs.filter(j => (j.health_score || 1) >= 0.7).length;
              const pausedCount = tierJobs.filter(j => j.is_paused).length;
              const lastRun = tierStatus.last_tier_runs?.[tier];
              
              return (
                <div 
                  key={tier}
                  className="p-4 rounded-xl"
                  style={{ 
                    backgroundColor: tier === 1 ? '#dcfce7' : tier === 2 ? '#dbeafe' : tier === 3 ? '#fef3c7' : '#f3e8ff',
                    borderLeft: `4px solid ${tier === 1 ? '#22c55e' : tier === 2 ? '#3b82f6' : tier === 3 ? '#f59e0b' : '#8b5cf6'}`
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span 
                      className="text-sm font-bold"
                      style={{ color: tier === 1 ? '#15803d' : tier === 2 ? '#1d4ed8' : tier === 3 ? '#b45309' : '#7c3aed' }}
                    >
                      TIER {tier}
                    </span>
                    <span className="text-xs" style={{ color: colors.textMuted }}>
                      {tierStatus.tier_intervals?.[tier] || '-'}min
                    </span>
                  </div>
                  <div className="text-xs space-y-1" style={{ color: colors.textSecondary }}>
                    <div className="flex justify-between">
                      <span>Sources:</span>
                      <span className="font-medium">{tierJobs.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Healthy:</span>
                      <span className="font-medium" style={{ color: colors.success }}>{healthyCount}</span>
                    </div>
                    {pausedCount > 0 && (
                      <div className="flex justify-between">
                        <span>Paused:</span>
                        <span className="font-medium" style={{ color: colors.warning }}>{pausedCount}</span>
                      </div>
                    )}
                    {lastRun && (
                      <div className="text-[10px] mt-1 opacity-75">
                        Last: {new Date(lastRun).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Individual Source Health */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {Object.entries(sourceHealth)
              .sort((a, b) => (b[1].health_score || 1) - (a[1].health_score || 1))
              .map(([sourceId, health]) => (
                <div 
                  key={sourceId}
                  className="flex items-center justify-between p-3 rounded-lg transition-all"
                  style={{ backgroundColor: colors.surface }}
                  data-testid={`health-${sourceId}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Health indicator */}
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ 
                        backgroundColor: health.is_paused ? colors.warning 
                          : health.health_score >= 0.7 ? colors.success 
                          : health.health_score >= 0.4 ? colors.warning 
                          : colors.error
                      }}
                    />
                    <span className="font-medium text-sm" style={{ color: colors.text }}>
                      {sourceId}
                    </span>
                    {health.is_paused && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: colors.warningSoft, color: colors.warning }}>
                        PAUSED
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs" style={{ color: colors.textMuted }}>
                    {/* Success rate */}
                    <div className="text-right">
                      <div className="font-medium" style={{ color: colors.text }}>
                        {((health.success_rate || 1) * 100).toFixed(0)}%
                      </div>
                      <div>success</div>
                    </div>
                    {/* Health score bar */}
                    <div className="w-20">
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.border }}>
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${(health.health_score || 1) * 100}%`,
                            backgroundColor: health.health_score >= 0.7 ? colors.success 
                              : health.health_score >= 0.4 ? colors.warning 
                              : colors.error
                          }}
                        />
                      </div>
                      <div className="text-[10px] text-center mt-0.5">
                        {((health.health_score || 1) * 100).toFixed(0)}% health
                      </div>
                    </div>
                    {/* Fail count */}
                    {health.consecutive_fails > 0 && (
                      <div className="text-right">
                        <div className="font-medium" style={{ color: colors.error }}>
                          {health.consecutive_fails}
                        </div>
                        <div>fails</div>
                      </div>
                    )}
                    {/* Actions */}
                    <div className="flex gap-1">
                      {health.is_paused ? (
                        <button
                          onClick={async () => {
                            await fetch(`${API_URL}/api/scheduler/health/${sourceId}/unpause`, { method: 'POST' });
                            fetchSourceHealth();
                          }}
                          className="px-2 py-1 rounded text-xs"
                          style={{ backgroundColor: colors.success, color: 'white' }}
                        >
                          Resume
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            await fetch(`${API_URL}/api/scheduler/health/${sourceId}/pause?minutes=60`, { method: 'POST' });
                            fetchSourceHealth();
                          }}
                          className="px-2 py-1 rounded text-xs"
                          style={{ backgroundColor: colors.surface, color: colors.textMuted }}
                        >
                          Pause
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            {Object.keys(sourceHealth).length === 0 && (
              <div className="text-center py-8 text-sm" style={{ color: colors.textMuted }}>
                No health data yet. Sources will appear after first sync.
              </div>
            )}
          </div>

          {/* Health Alerts Section */}
          {healthAlerts.length > 0 && (
            <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                  <span className="font-semibold text-sm" style={{ color: '#b91c1c' }}>
                    Active Alerts ({alertStats.active_alerts || healthAlerts.length})
                  </span>
                </div>
                <button
                  onClick={async () => {
                    await fetch(`${API_URL}/api/scheduler/alerts/check`, { method: 'POST' });
                    fetchSourceHealth();
                  }}
                  className="text-xs px-2 py-1 rounded"
                  style={{ backgroundColor: '#fecaca', color: '#b91c1c' }}
                >
                  Run Check
                </button>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {healthAlerts.slice(0, 5).map((alert, idx) => (
                  <div 
                    key={alert.alert_id || idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-white"
                  >
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2 h-2 rounded-full"
                        style={{ 
                          backgroundColor: alert.severity === 'critical' ? '#dc2626' 
                            : alert.severity === 'error' ? '#ef4444'
                            : alert.severity === 'warning' ? '#f59e0b' 
                            : '#6b7280'
                        }}
                      />
                      <span className="text-xs font-medium" style={{ color: colors.text }}>
                        {alert.source_id}
                      </span>
                      <span className="text-xs" style={{ color: colors.textMuted }}>
                        {alert.message}
                      </span>
                    </div>
                    <button
                      onClick={async () => {
                        await fetch(`${API_URL}/api/scheduler/alerts/${alert.alert_id}/acknowledge`, { method: 'POST' });
                        fetchSourceHealth();
                      }}
                      className="text-[10px] px-2 py-0.5 rounded"
                      style={{ backgroundColor: colors.surface, color: colors.textMuted }}
                    >
                      Ack
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Exchange Tree Status */}
          {exchangeStatus.running && (
            <div className="mt-6 p-4 rounded-xl" style={{ backgroundColor: '#f0fdf4', borderLeft: '4px solid #22c55e' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} style={{ color: '#22c55e' }} />
                  <span className="font-semibold text-sm" style={{ color: '#15803d' }}>
                    Exchange Tree
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: '#dcfce7', color: '#15803d' }}>
                    RUNNING
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(exchangeStatus.exchanges || []).map(exchange => {
                  const health = exchangeStatus.health?.[exchange] || {};
                  return (
                    <div 
                      key={exchange}
                      className="p-3 rounded-lg bg-white flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-2 h-2 rounded-full"
                          style={{ 
                            backgroundColor: health.is_paused ? colors.warning 
                              : (health.health_score || 1) >= 0.7 ? colors.success 
                              : colors.error
                          }}
                        />
                        <span className="text-xs font-medium capitalize">{exchange}</span>
                      </div>
                      <div className="text-[10px]" style={{ color: colors.textMuted }}>
                        {health.latency_ms ? `${Math.round(health.latency_ms)}ms` : '-'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Endpoint Registry - Discovered API Endpoints */}
        {discoveredEndpoints.length > 0 && (
          <div 
            data-testid="endpoint-registry"
            className="bg-white rounded-2xl border p-6"
            style={{ borderColor: colors.border }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Server size={20} style={{ color: colors.accent }} />
                <span className="font-semibold" style={{ color: colors.text }}>Endpoint Registry</span>
                <span 
                  className="px-2 py-0.5 rounded-full text-xs"
                  style={{ backgroundColor: colors.accentSoft, color: colors.accent }}
                >
                  {discoveredEndpoints.length} endpoints
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchDiscoveredEndpoints}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                  style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {discoveredEndpoints.map((ep, idx) => (
                <div 
                  key={ep.id || idx}
                  data-testid={`endpoint-${ep.id || idx}`}
                  className="flex items-center justify-between p-3 rounded-xl transition-all hover:shadow-md"
                  style={{ backgroundColor: colors.surface }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ 
                        backgroundColor: ep.status === 'active' ? colors.successSoft : colors.warningSoft 
                      }}
                    >
                      {ep.status === 'active' ? 
                        <CheckCircle size={16} style={{ color: colors.success }} /> : 
                        <AlertTriangle size={16} style={{ color: colors.warning }} />
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate" style={{ color: colors.text }}>
                          {ep.domain}
                        </span>
                        <span 
                          className="px-2 py-0.5 rounded text-xs flex-shrink-0"
                          style={{ 
                            backgroundColor: ep.status === 'active' ? colors.successSoft : colors.warningSoft,
                            color: ep.status === 'active' ? colors.success : colors.warning
                          }}
                        >
                          {ep.status}
                        </span>
                      </div>
                      <p className="text-xs font-mono truncate" style={{ color: colors.textMuted }}>
                        {ep.path || ep.url}
                      </p>
                      {ep.capabilities?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {ep.capabilities.slice(0, 3).map((cap, i) => (
                            <span 
                              key={i}
                              className="px-1.5 py-0.5 rounded text-[10px]"
                              style={{ backgroundColor: colors.accentSoft, color: colors.accent }}
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <button
                      onClick={() => runParsing(ep.id)}
                      disabled={parsingInProgress[ep.id]}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
                      style={{ 
                        backgroundColor: ep.scraper_ready ? colors.successSoft : colors.surface,
                        color: ep.scraper_ready ? colors.success : colors.textSecondary
                      }}
                    >
                      {ep.scraper_ready ? <CheckCircle size={12} /> : <Zap size={12} />}
                      {ep.scraper_ready ? 'Ready' : 'Parse'}
                    </button>
                    <button
                      onClick={() => rediscoverDomain(ep.domain)}
                      disabled={parsingInProgress[ep.domain]}
                      className="p-1.5 rounded-lg transition-all"
                      style={{ backgroundColor: colors.surface, color: colors.textMuted }}
                      title="Re-discover endpoints"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Project Discovery Modal */}
        {projectModalOpen && selectedProject && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
            onClick={() => setProjectModalOpen(false)}
          >
            <div 
              className="w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
              style={{ backgroundColor: selectedProject.brand?.bg || '#1a1a2e' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header with brand colors */}
              <div 
                className="p-6 relative overflow-hidden"
                style={{ 
                  background: `linear-gradient(135deg, ${selectedProject.brand?.primary}40, ${selectedProject.brand?.secondary}20)` 
                }}
              >
                <button
                  onClick={() => setProjectModalOpen(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/20"
                  style={{ color: 'white' }}
                >
                  <XCircle size={20} />
                </button>
                
                <div className="flex items-center gap-4">
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                    style={{ backgroundColor: selectedProject.brand?.primary + '30' }}
                  >
                    {selectedProject.brand?.icon || '🌐'}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {selectedProject.brand?.name || selectedProject.name}
                    </h2>
                    <p className="text-white/70 text-sm">
                      {selectedProject.website || selectedProject.domain}
                    </p>
                  </div>
                </div>
                
                {/* Categories */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {selectedProject.categories?.map(cat => (
                    <span 
                      key={cat}
                      className="px-3 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: selectedProject.brand?.primary + '40', color: 'white' }}
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>

              {/* Progress Section */}
              <div className="p-6">
                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white/80">
                      {projectParsingStatus.message || 'Ready to start'}
                    </span>
                    <span className="text-sm text-white/60">
                      {projectParsingStatus.progress}%
                    </span>
                  </div>
                  <div 
                    className="h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                  >
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${projectParsingStatus.progress}%`,
                        backgroundColor: projectParsingStatus.stage === 'error' 
                          ? '#ef4444' 
                          : projectParsingStatus.stage === 'success' 
                            ? '#10b981' 
                            : selectedProject.brand?.primary 
                      }}
                    />
                  </div>
                </div>

                {/* Status Icon */}
                <div className="flex items-center justify-center py-6">
                  {projectParsingStatus.stage === 'idle' && (
                    <div className="text-center">
                      <Globe size={48} className="mx-auto mb-3" style={{ color: selectedProject.brand?.primary }} />
                      <p className="text-white/60">Click to start automatic Discovery</p>
                    </div>
                  )}
                  {(projectParsingStatus.stage === 'discovering' || projectParsingStatus.stage === 'parsing' || projectParsingStatus.stage === 'fetching') && (
                    <div className="text-center">
                      <RefreshCw size={48} className="mx-auto mb-3 animate-spin" style={{ color: selectedProject.brand?.primary }} />
                      <p className="text-white/80">{projectParsingStatus.message}</p>
                    </div>
                  )}
                  {projectParsingStatus.stage === 'error' && (
                    <div className="text-center">
                      <XCircle size={48} className="mx-auto mb-3 text-red-400" />
                      <p className="text-red-300">{projectParsingStatus.message}</p>
                    </div>
                  )}
                  {(projectParsingStatus.stage === 'success' || projectParsingStatus.stage === 'discovered') && (
                    <div className="w-full">
                      <div className="text-center mb-6">
                        <CheckCircle size={48} className="mx-auto mb-3" style={{ color: '#10b981' }} />
                        <p className="text-green-300 font-medium">{projectParsingStatus.message}</p>
                      </div>
                      
                      {/* Discovered Endpoints */}
                      {projectParsingStatus.data?.endpoints && (
                        <div className="space-y-3">
                          <p className="text-white/60 text-sm">Discovered endpoints:</p>
                          {projectParsingStatus.data.endpoints.slice(0, 5).map((ep, idx) => (
                            <div 
                              key={idx}
                              className="flex items-center justify-between p-3 rounded-xl"
                              style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                            >
                              <div className="flex items-center gap-3">
                                <Server size={16} style={{ color: selectedProject.brand?.primary }} />
                                <div>
                                  <p className="text-white text-sm font-mono">{ep.path || '/'}</p>
                                  <p className="text-white/50 text-xs">{ep.url}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span 
                                  className="px-2 py-0.5 rounded text-xs"
                                  style={{ 
                                    backgroundColor: ep.status === 'active' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
                                    color: ep.status === 'active' ? '#10b981' : '#f59e0b'
                                  }}
                                >
                                  {ep.status}
                                </span>
                                {ep.capabilities?.[0] && (
                                  <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }}>
                                    {ep.capabilities[0]}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Sample Data Preview */}
                      {projectParsingStatus.data?.sampleData && (
                        <div className="mt-6">
                          <p className="text-white/60 text-sm mb-3">
                            Fetched data ({projectParsingStatus.data.totalRecords} records):
                          </p>
                          <div 
                            className="p-4 rounded-xl overflow-auto max-h-48 text-xs font-mono"
                            style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
                          >
                            <pre className="text-green-300">
                              {JSON.stringify(
                                Array.isArray(projectParsingStatus.data.sampleData) 
                                  ? projectParsingStatus.data.sampleData.slice(0, 3) 
                                  : projectParsingStatus.data.sampleData, 
                                null, 2
                              ).slice(0, 1000)}
                              {JSON.stringify(projectParsingStatus.data.sampleData).length > 1000 && '...'}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 mt-4">
                  {projectParsingStatus.stage === 'idle' && (
                    <button
                      onClick={() => openProjectModal(selectedProject)}
                      className="flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                      style={{ backgroundColor: selectedProject.brand?.primary, color: 'white' }}
                    >
                      <Zap size={18} />
                      Start Auto-Discovery
                    </button>
                  )}
                  {projectParsingStatus.stage === 'success' && (
                    <>
                      <button
                        onClick={() => {
                          setProjectModalOpen(false);
                          setActiveTab('data-explorer');
                        }}
                        className="flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                        style={{ backgroundColor: selectedProject.brand?.primary, color: 'white' }}
                      >
                        <Database size={18} />
                        Open Data Explorer
                      </button>
                      <button
                        onClick={() => setProjectModalOpen(false)}
                        className="px-6 py-3 rounded-xl font-medium transition-all"
                        style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'white' }}
                      >
                        Close
                      </button>
                    </>
                  )}
                  {projectParsingStatus.stage === 'error' && (
                    <button
                      onClick={() => openProjectModal(selectedProject)}
                      className="flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                      style={{ backgroundColor: selectedProject.brand?.primary, color: 'white' }}
                    >
                      <RefreshCw size={18} />
                      Try Again
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render Developer View
  // Parser monitoring state
  const [parserStatus, setParserStatus] = useState(null);
  const [parserStatusLoading, setParserStatusLoading] = useState(false);
  
  const fetchParserStatus = useCallback(async () => {
    setParserStatusLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/intel/admin/proxy/parser-status`);
      const data = await res.json();
      setParserStatus(data);
    } catch (err) {
      console.error('Failed to fetch parser status:', err);
    }
    setParserStatusLoading(false);
  }, []);
  
  const forceRestartParser = async () => {
    setParserStatusLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/intel/admin/parser/force-restart`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        await fetchParserStatus();
      }
    } catch (err) {
      console.error('Failed to restart parser:', err);
    }
    setParserStatusLoading(false);
  };
  
  // Fetch parser status when on developer tab
  useEffect(() => {
    if (activeTab === 'developer') {
      fetchParserStatus();
    }
  }, [activeTab, fetchParserStatus]);
  
  const renderDeveloper = () => (
    <div className="space-y-8">
      {/* Parser Monitor - New Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <SectionHeader title="Parser Monitor" />
          <div className="flex gap-2">
            <button
              onClick={fetchParserStatus}
              disabled={parserStatusLoading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-sm"
              style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
            >
              <RefreshCw size={14} className={parserStatusLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={forceRestartParser}
              disabled={parserStatusLoading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-sm font-medium"
              style={{ backgroundColor: colors.warningSoft, color: colors.warning }}
            >
              <RotateCcw size={14} />
              Force Restart
            </button>
          </div>
        </div>
        
        {parserStatus && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Parser State Card */}
            <div 
              className="rounded-2xl border p-5"
              style={{ 
                borderColor: parserStatus.parser?.state === 'error' ? colors.error : 
                             parserStatus.parser?.state === 'ready' ? colors.success : colors.border,
                backgroundColor: colors.background
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ 
                      backgroundColor: parserStatus.parser?.state === 'error' ? colors.error : 
                                       parserStatus.parser?.state === 'ready' ? colors.success :
                                       parserStatus.parser?.state === 'running' ? colors.accent : colors.textMuted
                    }}
                  />
                  <span className="font-medium" style={{ color: colors.text }}>Parser Status</span>
                </div>
                <span 
                  className="px-3 py-1 rounded-full text-xs font-medium uppercase"
                  style={{ 
                    backgroundColor: parserStatus.parser?.state === 'error' ? colors.errorSoft : 
                                     parserStatus.parser?.state === 'ready' ? colors.successSoft :
                                     parserStatus.parser?.state === 'running' ? colors.accentSoft : colors.surface,
                    color: parserStatus.parser?.state === 'error' ? colors.error : 
                           parserStatus.parser?.state === 'ready' ? colors.success :
                           parserStatus.parser?.state === 'running' ? colors.accent : colors.textMuted
                  }}
                >
                  {parserStatus.parser?.state || 'unknown'}
                </span>
              </div>
              <p className="text-sm mb-4" style={{ color: colors.textSecondary }}>
                {parserStatus.parser?.reason || 'Unknown state'}
              </p>
              
              {/* Data counts */}
              <div className="grid grid-cols-3 gap-2 text-center">
                {Object.entries(parserStatus.data_counts || {}).map(([key, value]) => (
                  <div key={key} className="p-2 rounded-lg" style={{ backgroundColor: colors.surface }}>
                    <div className="text-lg font-bold" style={{ color: colors.accent }}>{value}</div>
                    <div className="text-xs capitalize" style={{ color: colors.textSecondary }}>{key}</div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Last Sync Info */}
            <div 
              className="rounded-2xl border p-5"
              style={{ borderColor: colors.border, backgroundColor: colors.background }}
            >
              <div className="flex items-center gap-3 mb-4">
                <Clock size={20} style={{ color: colors.accent }} />
                <span className="font-medium" style={{ color: colors.text }}>Last Sync</span>
              </div>
              
              {parserStatus.last_sync ? (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span style={{ color: colors.textSecondary }}>Time:</span>
                    <span style={{ color: colors.text }}>
                      {new Date(parserStatus.last_sync.ts).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: colors.textSecondary }}>Source:</span>
                    <span className="capitalize" style={{ color: colors.text }}>{parserStatus.last_sync.source}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: colors.textSecondary }}>Status:</span>
                    <span 
                      className="px-2 py-0.5 rounded text-xs"
                      style={{ 
                        backgroundColor: parserStatus.last_sync.status === 'success' ? colors.successSoft : colors.errorSoft,
                        color: parserStatus.last_sync.status === 'success' ? colors.success : colors.error
                      }}
                    >
                      {parserStatus.last_sync.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: colors.textSecondary }}>Records:</span>
                    <span style={{ color: colors.text }}>{parserStatus.last_sync.records}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm" style={{ color: colors.textMuted }}>No sync history yet</p>
              )}
              
              {/* Last Error */}
              {parserStatus.last_error && (
                <div className="mt-4 p-3 rounded-xl" style={{ backgroundColor: colors.errorSoft }}>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={14} style={{ color: colors.error }} />
                    <span className="text-xs font-medium" style={{ color: colors.error }}>Last Error</span>
                  </div>
                  <p className="text-xs" style={{ color: colors.error }}>
                    {parserStatus.last_error.error}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Sync History Table */}
        {parserStatus?.sync_history && parserStatus.sync_history.length > 0 && (
          <div 
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: colors.border }}
          >
            <div className="p-4 border-b" style={{ borderColor: colors.border, backgroundColor: colors.surface }}>
              <span className="font-medium" style={{ color: colors.text }}>Sync History</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: colors.surface }}>
                    <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: colors.textSecondary }}>Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: colors.textSecondary }}>Source</th>
                    <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: colors.textSecondary }}>Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: colors.textSecondary }}>Records</th>
                    <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: colors.textSecondary }}>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {parserStatus.sync_history.map((sync, idx) => (
                    <tr key={idx} className="border-t" style={{ borderColor: colors.border }}>
                      <td className="px-4 py-3 text-sm" style={{ color: colors.text }}>
                        {new Date(sync.ts).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm capitalize" style={{ color: colors.text }}>
                        {sync.source}
                      </td>
                      <td className="px-4 py-3">
                        <span 
                          className="px-2 py-1 rounded text-xs"
                          style={{ 
                            backgroundColor: sync.status === 'success' ? colors.successSoft : 
                                             sync.status === 'restart' ? colors.accentSoft : colors.errorSoft,
                            color: sync.status === 'success' ? colors.success : 
                                   sync.status === 'restart' ? colors.accent : colors.error
                          }}
                        >
                          {sync.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: colors.text }}>
                        {sync.records}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: colors.textSecondary }}>
                        {sync.duration_ms ? `${(sync.duration_ms / 1000).toFixed(1)}s` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      
      {/* System Health */}
      <div>
        <SectionHeader title="System Health" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div 
            className="bg-white rounded-2xl border p-5"
            style={{ borderColor: colors.border }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Server size={20} style={{ color: colors.accent }} />
              <span className="font-medium" style={{ color: colors.text }}>Backend</span>
            </div>
            <StatusBadge status={stats?.health?.ok ? 'running' : 'error'} />
          </div>
          <div 
            className="bg-white rounded-2xl border p-5"
            style={{ borderColor: colors.border }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Database size={20} style={{ color: colors.accent }} />
              <span className="font-medium" style={{ color: colors.text }}>MongoDB</span>
            </div>
            <StatusBadge status="running" />
          </div>
          <div 
            className="bg-white rounded-2xl border p-5"
            style={{ borderColor: colors.border }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Zap size={20} style={{ color: colors.accent }} />
              <span className="font-medium" style={{ color: colors.text }}>Scheduler</span>
            </div>
            <StatusBadge status="active" />
          </div>
        </div>
      </div>

      {/* API Endpoints */}
      <div>
        <SectionHeader title="API Endpoints" />
        <DataTable 
          columns={[
            { header: 'Endpoint', key: 'endpoint' },
            { header: 'Method', key: 'method', render: (r) => (
              <span 
                className="px-2 py-1 rounded text-xs font-medium"
                style={{ backgroundColor: colors.successSoft, color: colors.success }}
              >
                {r.method}
              </span>
            )},
            { header: 'Description', key: 'description' }
          ]}
          data={[
            { endpoint: '/api/intel/entity/{query}', method: 'GET', description: 'Get entity by any identifier' },
            { endpoint: '/api/intel/entity/{query}/timeline', method: 'GET', description: 'Get entity event timeline' },
            { endpoint: '/api/intel/engine/query/events', method: 'POST', description: 'Query events with filters' },
            { endpoint: '/api/intel/engine/correlation/run', method: 'POST', description: 'Run correlation engine' },
            { endpoint: '/api/intel/engine/trust/scores', method: 'GET', description: 'Get source trust scores' },
            { endpoint: '/api/exchange/ticker', method: 'GET', description: 'Get exchange ticker' },
          ]}
          loading={false}
        />
      </div>

      {/* Logs */}
      <div>
        <SectionHeader title="Recent Activity" />
        <div 
          className="bg-white rounded-2xl border p-6 font-mono text-sm"
          style={{ borderColor: colors.border, backgroundColor: colors.surface }}
        >
          <div className="space-y-2" style={{ color: colors.textSecondary }}>
            <p>[INFO] Entity Intelligence Engine initialized</p>
            <p>[INFO] Query Engine ready</p>
            <p>[INFO] Source Trust Engine loaded 8 default scores</p>
            <p>[INFO] Correlation Engine active</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Render API Docs View
  const [docsLang, setDocsLang] = useState('en');
  const [apiDocs, setApiDocs] = useState([]);
  const [docsCategories, setDocsCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [expandedEndpoint, setExpandedEndpoint] = useState(null);
  const [docsLoading, setDocsLoading] = useState(false);

  // Fetch API documentation
  const fetchApiDocs = useCallback(async () => {
    setDocsLoading(true);
    try {
      const [docsRes, catsRes] = await Promise.all([
        fetch(`${API_URL}/api/docs/?lang=${docsLang}`).then(r => r.json()),
        fetch(`${API_URL}/api/docs/categories`).then(r => r.json())
      ]);
      setApiDocs(docsRes.endpoints || []);
      setDocsCategories(catsRes.categories || []);
    } catch (e) {
      console.error('Failed to fetch API docs:', e);
    }
    setDocsLoading(false);
  }, [docsLang]);

  useEffect(() => {
    if (activeTab === 'api') {
      fetchApiDocs();
    }
  }, [activeTab, docsLang, fetchApiDocs]);

  const renderApiDocs = () => {
    const filteredDocs = selectedCategory 
      ? apiDocs.filter(d => d.category === selectedCategory)
      : apiDocs;

    const methodColors = {
      GET: { bg: colors.successSoft, color: colors.success },
      POST: { bg: colors.accentSoft, color: colors.accent },
      PUT: { bg: colors.warningSoft, color: colors.warning },
      DELETE: { bg: colors.errorSoft, color: colors.error }
    };

    return (
      <div className="space-y-6">
        {/* Header with Language Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: colors.text }}>
              {docsLang === 'en' ? 'API Documentation' : 'Документация API'}
            </h2>
            <p style={{ color: colors.textSecondary }}>
              {docsLang === 'en' 
                ? `${apiDocs.length} endpoints. Complete reference for Market & Intel layers.` 
                : `${apiDocs.length} endpoints. Full reference for Market and Intel layers.`}
            </p>
          </div>
          
          {/* Language Toggle */}
          <div 
            className="flex rounded-xl overflow-hidden border"
            style={{ borderColor: colors.border }}
          >
            <button
              data-testid="lang-en"
              onClick={() => setDocsLang('en')}
              className="px-4 py-2 text-sm font-medium transition-all"
              style={{ 
                backgroundColor: docsLang === 'en' ? colors.accent : colors.background,
                color: docsLang === 'en' ? 'white' : colors.textSecondary
              }}
            >
              EN
            </button>
            <button
              data-testid="lang-ru"
              onClick={() => setDocsLang('ru')}
              className="px-4 py-2 text-sm font-medium transition-all"
              style={{ 
                backgroundColor: docsLang === 'ru' ? colors.accent : colors.background,
                color: docsLang === 'ru' ? 'white' : colors.textSecondary
              }}
            >
              RU
            </button>
          </div>
        </div>

        {/* Category Filter - Grouped by Layer */}
        <div className="space-y-3">
          {/* Layer 1: Market Data */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>
              {docsLang === 'en' ? '📊 Market Layer' : '📊 Слой рынка'}
            </div>
            <div className="flex flex-wrap gap-2">
              {docsCategories.filter(c => ['market', 'derivatives', 'indices', 'exchange', 'spot'].includes(c.id)).map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ 
                    backgroundColor: selectedCategory === cat.id ? colors.accent : colors.surface,
                    color: selectedCategory === cat.id ? 'white' : colors.textSecondary
                  }}
                >
                  {docsLang === 'en' ? cat.name_en : cat.name_ru}
                  <span className="ml-1 opacity-60">
                    ({apiDocs.filter(d => d.category === cat.id).length})
                  </span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Layer 2: Intel */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>
              {docsLang === 'en' ? '🧠 Intel Layer' : '🧠 Слой интеллекта'}
            </div>
            <div className="flex flex-wrap gap-2">
              {docsCategories.filter(c => ['entity', 'query', 'correlation', 'trust'].includes(c.id)).map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ 
                    backgroundColor: selectedCategory === cat.id ? colors.accent : colors.surface,
                    color: selectedCategory === cat.id ? 'white' : colors.textSecondary
                  }}
                >
                  {docsLang === 'en' ? cat.name_en : cat.name_ru}
                  <span className="ml-1 opacity-60">
                    ({apiDocs.filter(d => d.category === cat.id).length})
                  </span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Data Categories */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>
              {docsLang === 'en' ? '📁 Data' : '📁 Данные'}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ 
                  backgroundColor: !selectedCategory ? colors.accent : colors.surface,
                  color: !selectedCategory ? 'white' : colors.textSecondary
                }}
              >
                {docsLang === 'en' ? 'All' : 'Все'}
                <span className="ml-1 opacity-60">({apiDocs.length})</span>
              </button>
              {docsCategories.filter(c => ['global', 'projects', 'funds', 'persons', 'fundraising', 'unlocks', 'ico', 'exchanges', 'search', 'system'].includes(c.id)).map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ 
                    backgroundColor: selectedCategory === cat.id ? colors.accent : colors.surface,
                    color: selectedCategory === cat.id ? 'white' : colors.textSecondary
                  }}
                >
                  {docsLang === 'en' ? cat.name_en : cat.name_ru}
                  <span className="ml-1 opacity-60">
                    ({apiDocs.filter(d => d.category === cat.id).length})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {docsLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="animate-spin" style={{ color: colors.accent }} />
            <span className="ml-2" style={{ color: colors.textSecondary }}>
              {docsLang === 'en' ? 'Loading...' : 'Загрузка...'}
            </span>
          </div>
        ) : (
          /* Endpoints List */
          <div className="space-y-4">
            {filteredDocs.map((endpoint, i) => {
              const mc = methodColors[endpoint.method] || methodColors.GET;
              const isExpanded = expandedEndpoint === endpoint.endpoint_id;
              
              return (
                <div 
                  key={i}
                  className="bg-white rounded-2xl border overflow-hidden transition-all"
                  style={{ borderColor: colors.border }}
                >
                  {/* Endpoint Header */}
                  <button
                    onClick={() => setExpandedEndpoint(isExpanded ? null : endpoint.endpoint_id)}
                    className="w-full p-5 flex items-center gap-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span 
                      className="px-3 py-1 rounded-lg text-xs font-bold"
                      style={{ backgroundColor: mc.bg, color: mc.color }}
                    >
                      {endpoint.method}
                    </span>
                    <code className="text-sm font-medium" style={{ color: colors.accent }}>
                      {endpoint.path}
                    </code>
                    <span className="flex-1 text-sm truncate" style={{ color: colors.textSecondary }}>
                      {endpoint.title}
                    </span>
                    <ChevronRight 
                      size={20} 
                      style={{ 
                        color: colors.textMuted,
                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.2s'
                      }} 
                    />
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div 
                      className="px-5 pb-5 border-t"
                      style={{ borderColor: colors.borderLight }}
                    >
                      {/* Description */}
                      <div className="py-4">
                        <p style={{ color: colors.text }}>{endpoint.description}</p>
                      </div>

                      {/* Parameters */}
                      {endpoint.parameters && endpoint.parameters.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold mb-3" style={{ color: colors.text }}>
                            {docsLang === 'en' ? 'Parameters' : 'Параметры'}
                          </h4>
                          <div className="space-y-2">
                            {endpoint.parameters.map((param, j) => (
                              <div 
                                key={j}
                                className="flex items-start gap-3 p-3 rounded-xl"
                                style={{ backgroundColor: colors.surface }}
                              >
                                <code className="text-sm font-medium" style={{ color: colors.accent }}>
                                  {param.name}
                                </code>
                                <span 
                                  className="px-2 py-0.5 rounded text-xs"
                                  style={{ backgroundColor: colors.border, color: colors.textSecondary }}
                                >
                                  {param.type}
                                </span>
                                {param.required && (
                                  <span 
                                    className="px-2 py-0.5 rounded text-xs"
                                    style={{ backgroundColor: colors.errorSoft, color: colors.error }}
                                  >
                                    {docsLang === 'en' ? 'required' : 'обязательный'}
                                  </span>
                                )}
                                <span className="text-sm flex-1" style={{ color: colors.textSecondary }}>
                                  {param.description}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Responses */}
                      {endpoint.responses && endpoint.responses.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-3" style={{ color: colors.text }}>
                            {docsLang === 'en' ? 'Responses' : 'Ответы'}
                          </h4>
                          {endpoint.responses.map((resp, j) => (
                            <div key={j} className="mb-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span 
                                  className="px-2 py-0.5 rounded text-xs font-medium"
                                  style={{ 
                                    backgroundColor: resp.status_code < 300 ? colors.successSoft : colors.errorSoft,
                                    color: resp.status_code < 300 ? colors.success : colors.error
                                  }}
                                >
                                  {resp.status_code}
                                </span>
                                <span className="text-sm" style={{ color: colors.textSecondary }}>
                                  {resp.description}
                                </span>
                              </div>
                              {resp.example && (
                                <pre 
                                  className="p-4 rounded-xl text-xs overflow-auto"
                                  style={{ backgroundColor: colors.surface, color: colors.text }}
                                >
                                  {JSON.stringify(resp.example, null, 2)}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Intelligence Feed State
  const [feedEvents, setFeedEvents] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedFilter, setFeedFilter] = useState('all');
  const [alphaProjects, setAlphaProjects] = useState([]);
  const [alphaSignals, setAlphaSignals] = useState([]);
  const [alphaSearchResults, setAlphaSearchResults] = useState([]);
  const [showAlphaSearchResults, setShowAlphaSearchResults] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedNewsStory, setSelectedNewsStory] = useState(null);
  
  // News Intelligence state
  const [newsIntelligence, setNewsIntelligence] = useState([]);
  const [newsIntelLoading, setNewsIntelLoading] = useState(false);
  const [sentimentFilter, setSentimentFilter] = useState('all'); // all, positive, neutral, negative
  
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
      setShowAlphaSearchResults(false);
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/alpha/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setAlphaSearchResults(data.results || []);
      setShowAlphaSearchResults(true);
    } catch (e) {
      console.error('Search failed:', e);
    }
  };

  // Legacy fetch for backward compatibility
  const fetchFeedEvents = fetchAlphaFeed;

  useEffect(() => {
    if (activeTab === 'feed') {
      fetchAlphaFeed();
      fetchSentimentTrends();
      fetchSentimentProviders();
      fetchSentimentHeatmap();
    }
  }, [activeTab, fetchAlphaFeed, fetchSentimentTrends, fetchSentimentProviders, fetchSentimentHeatmap]);

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
  const renderFeed = () => {
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
              <span className="text-sm" style={{ color: colors.textMuted }}>Filter:</span>
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
                      title={`${provider.name}: ${provider.model}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${provider.available ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                      {provider.id === 'fomo' ? 'FOMO' : provider.id.toUpperCase()}
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
              {newsIntelligence.slice(0, 6).map((event, i) => {
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
                    onClick={() => setSelectedNewsStory(event)}
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
                
                <h1 className="text-3xl font-bold mb-4" style={{ color: colors.text }}>
                  {selectedNewsStory.headline || selectedNewsStory.title_en || 'News Story'}
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
                {(selectedNewsStory.story_en || selectedNewsStory.story_ru) ? (
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
                      <span className="font-semibold" style={{ color: colors.accent }}>AI Analysis</span>
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
  };

  // ═══════════════════════════════════════════════════════════════
  // ADMIN - PROXY MANAGEMENT
  // ═══════════════════════════════════════════════════════════════
  
  const [proxyStatus, setProxyStatus] = useState(null);
  const [proxyLoading, setProxyLoading] = useState(false);
  const [newProxy, setNewProxy] = useState({ 
    host: '', 
    port: '', 
    type: 'http', 
    username: '', 
    password: '', 
    priority: 1 
  });
  const [testResults, setTestResults] = useState(null);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  
  const proxyTypes = [
    { value: 'http', label: 'HTTP' },
    { value: 'https', label: 'HTTPS' },
    { value: 'socks5', label: 'SOCKS5' },
  ];
  
  const fetchProxyStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/intel/admin/proxy/status`);
      const data = await res.json();
      setProxyStatus(data);
    } catch (err) {
      console.error('Failed to fetch proxy status:', err);
    }
  }, []);
  
  const buildProxyServer = () => {
    if (!newProxy.host || !newProxy.port) return '';
    return `${newProxy.type}://${newProxy.host}:${newProxy.port}`;
  };
  
  const addProxy = async () => {
    const server = buildProxyServer();
    if (!server) return;
    setProxyLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/intel/admin/proxy/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server,
          username: newProxy.username || null,
          password: newProxy.password || null,
          priority: newProxy.priority
        })
      });
      await res.json();
      setNewProxy({ host: '', port: '', type: 'http', username: '', password: '', priority: 1 });
      await fetchProxyStatus();
    } catch (err) {
      console.error('Failed to add proxy:', err);
    }
    setProxyLoading(false);
  };
  
  const removeProxy = async (proxyId) => {
    setProxyLoading(true);
    try {
      await fetch(`${API_URL}/api/intel/admin/proxy/${proxyId}`, { method: 'DELETE' });
      await fetchProxyStatus();
    } catch (err) {
      console.error('Failed to remove proxy:', err);
    }
    setProxyLoading(false);
  };
  
  const toggleProxy = async (proxyId, enabled) => {
    setProxyLoading(true);
    try {
      const endpoint = enabled ? 'disable' : 'enable';
      await fetch(`${API_URL}/api/intel/admin/proxy/${proxyId}/${endpoint}`, { method: 'POST' });
      await fetchProxyStatus();
    } catch (err) {
      console.error('Failed to toggle proxy:', err);
    }
    setProxyLoading(false);
  };
  
  const testProxies = async (proxyId = null) => {
    setProxyLoading(true);
    setTestResults(null);
    try {
      const url = proxyId 
        ? `${API_URL}/api/intel/admin/proxy/test?proxy_id=${proxyId}`
        : `${API_URL}/api/intel/admin/proxy/test`;
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      setTestResults(data);
    } catch (err) {
      console.error('Failed to test proxies:', err);
    }
    setProxyLoading(false);
  };
  
  const clearAllProxies = async () => {
    if (!window.confirm('Clear all proxies? Exchanges will use direct connection.')) return;
    setProxyLoading(true);
    try {
      await fetch(`${API_URL}/api/intel/admin/proxy/clear`, { method: 'POST' });
      await fetchProxyStatus();
    } catch (err) {
      console.error('Failed to clear proxies:', err);
    }
    setProxyLoading(false);
  };
  
  // Parser state and functions
  const [parserRunning, setParserRunning] = useState(false);
  const [parserResult, setParserResult] = useState(null);
  
  const startParser = async (proxyId = null) => {
    setParserRunning(true);
    setParserResult(null);
    try {
      const url = proxyId 
        ? `${API_URL}/api/intel/admin/proxy/start-parser?source=cryptorank&proxy_id=${proxyId}`
        : `${API_URL}/api/intel/admin/proxy/start-parser?source=all`;
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      setParserResult(data);
      // Refresh proxy status to show updated counts
      await fetchProxyStatus();
    } catch (err) {
      console.error('Failed to start parser:', err);
      setParserResult({ ok: false, error: err.message });
    }
    setParserRunning(false);
  };
  
  // ═══════════════════════════════════════════════════════════════
  // ADMIN - API KEYS MANAGEMENT
  // ═══════════════════════════════════════════════════════════════
  
  const [apiKeysData, setApiKeysData] = useState({ keys: [], services: [], summary: {} });
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [newApiKey, setNewApiKey] = useState({ service: 'coingecko', api_key: '', name: '', is_pro: false });
  const [apiKeyServiceDropdown, setApiKeyServiceDropdown] = useState(false);
  const [adminSubTab, setAdminSubTab] = useState('proxy'); // 'proxy', 'api-keys', 'llm-keys', 'sentiment-keys', 'providers', 'health', 'discovery'
  const [apiKeyServiceFilter, setApiKeyServiceFilter] = useState(null); // null = show all, or 'coingecko', 'coinmarketcap', 'messari'
  
  // LLM Keys State
  const [llmKeys, setLlmKeys] = useState([]);
  const [llmProviders, setLlmProviders] = useState([]);
  const [llmKeysSummary, setLlmKeysSummary] = useState(null);
  const [llmKeysLoading, setLlmKeysLoading] = useState(false);
  const [showAddLlmKey, setShowAddLlmKey] = useState(false);
  const [newLlmKey, setNewLlmKey] = useState({ provider: 'openai', api_key: '', name: '', capabilities: ['text'], is_default: false });
  
  // Sentiment Keys State
  const [sentimentKeys, setSentimentKeys] = useState([]);
  // sentimentProviders declared earlier in Multi-Provider Sentiment State
  const [sentimentSummary, setSentimentSummary] = useState(null);
  const [sentimentKeysLoading, setSentimentKeysLoading] = useState(false);
  const [showAddSentimentKey, setShowAddSentimentKey] = useState(false);
  const [newSentimentKey, setNewSentimentKey] = useState({ provider: 'openai', api_key: '', name: '', model: '', endpoint_url: '', is_default: false });
  
  // Health Monitor State
  const [sourcesHealth, setSourcesHealth] = useState({ sources: [], summary: {} });
  const [healthLoading, setHealthLoading] = useState(false);
  
  // LLM Analytics State
  const [llmAnalytics, setLlmAnalytics] = useState(null);
  const [llmAnalyticsByProvider, setLlmAnalyticsByProvider] = useState([]);
  const [llmHourlyData, setLlmHourlyData] = useState([]);
  
  // Discovery Dashboard State
  const [discoveryDashboard, setDiscoveryDashboard] = useState(null);
  const [discoveryDashboardLoading, setDiscoveryDashboardLoading] = useState(false);
  
  const fetchDiscoveryDashboard = useCallback(async () => {
    setDiscoveryDashboardLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/discovery/dashboard`);
      const data = await res.json();
      setDiscoveryDashboard(data);
    } catch (err) {
      console.error('Failed to fetch discovery dashboard:', err);
    }
    setDiscoveryDashboardLoading(false);
  }, []);
  
  // Trigger manual discovery
  const triggerManualDiscovery = async (domain = null) => {
    try {
      const url = domain 
        ? `${API_URL}/api/discovery/scheduler/trigger/discovery?domain=${encodeURIComponent(domain)}`
        : `${API_URL}/api/discovery/scheduler/trigger/discovery`;
      await fetch(url, { method: 'POST' });
      fetchDiscoveryDashboard();
    } catch (err) {
      console.error('Failed to trigger discovery:', err);
    }
  };
  
  // Trigger drift check
  const triggerDriftCheck = async (domain = null) => {
    try {
      const url = domain 
        ? `${API_URL}/api/discovery/scheduler/trigger/drift-check?domain=${encodeURIComponent(domain)}`
        : `${API_URL}/api/discovery/scheduler/trigger/drift-check`;
      await fetch(url, { method: 'POST' });
      fetchDiscoveryDashboard();
    } catch (err) {
      console.error('Failed to trigger drift check:', err);
    }
  };
  
  // Trigger scoring
  const triggerScoring = async (domain = null) => {
    try {
      const url = domain 
        ? `${API_URL}/api/discovery/scheduler/trigger/scoring?domain=${encodeURIComponent(domain)}`
        : `${API_URL}/api/discovery/scheduler/trigger/scoring`;
      await fetch(url, { method: 'POST' });
      fetchDiscoveryDashboard();
    } catch (err) {
      console.error('Failed to trigger scoring:', err);
    }
  };
  
  const fetchSourcesHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/news-intelligence/health/sources`);
      const data = await res.json();
      setSourcesHealth({
        sources: data.sources || [],
        summary: data.summary || {}
      });
    } catch (err) {
      console.error('Failed to fetch health:', err);
    }
    setHealthLoading(false);
  }, []);
  
  // News Sources State (full list with categories)
  const [newsSources, setNewsSources] = useState({ sources: [], stats: {} });
  const [newsSourcesLoading, setNewsSourcesLoading] = useState(false);
  const [newsSourcesFilter, setNewsSourcesFilter] = useState({ tier: null, language: null, category: null });
  const [newsSourcesSearch, setNewsSourcesSearch] = useState('');
  
  const fetchNewsSources = useCallback(async () => {
    setNewsSourcesLoading(true);
    try {
      let url = `${API_URL}/api/news-intelligence/sources-registry`;
      const params = [];
      if (newsSourcesFilter.tier) params.push(`tier=${newsSourcesFilter.tier}`);
      if (newsSourcesFilter.language) params.push(`language=${newsSourcesFilter.language}`);
      if (newsSourcesFilter.category) params.push(`category=${newsSourcesFilter.category}`);
      if (params.length > 0) url += `?${params.join('&')}`;
      
      const res = await fetch(url);
      const data = await res.json();
      setNewsSources({
        sources: data.sources || [],
        stats: data.stats || {}
      });
    } catch (err) {
      console.error('Failed to fetch news sources:', err);
    }
    setNewsSourcesLoading(false);
  }, [newsSourcesFilter]);
  
  const handleUnpauseSource = async (sourceId) => {
    try {
      await fetch(`${API_URL}/api/news-intelligence/health/unpause/${sourceId}`, { method: 'POST' });
      fetchSourcesHealth();
    } catch (err) {
      console.error('Failed to unpause:', err);
    }
  };
  
  const fetchApiKeys = useCallback(async () => {
    setApiKeysLoading(true);
    try {
      const [keysRes, servicesRes, summaryRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/api-keys`),
        fetch(`${API_URL}/api/admin/api-keys/services`),
        fetch(`${API_URL}/api/admin/api-keys/summary`)
      ]);
      const [keys, services, summary] = await Promise.all([
        keysRes.json(),
        servicesRes.json(),
        summaryRes.json()
      ]);
      setApiKeysData({ 
        keys: keys.keys || [], 
        services: services.services || [],
        summary: summary.summary || {}
      });
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
    }
    setApiKeysLoading(false);
  }, []);
  
  // LLM Keys Functions
  const fetchLlmKeys = useCallback(async () => {
    setLlmKeysLoading(true);
    try {
      const [keysRes, providersRes, summaryRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/llm-keys`),
        fetch(`${API_URL}/api/admin/llm-keys/providers`),
        fetch(`${API_URL}/api/admin/llm-keys/summary`)
      ]);
      const [keys, providers, summary] = await Promise.all([
        keysRes.json(),
        providersRes.json(),
        summaryRes.json()
      ]);
      setLlmKeys(keys.keys || []);
      setLlmProviders(providers.providers || []);
      setLlmKeysSummary(summary);
    } catch (err) {
      console.error('Failed to fetch LLM keys:', err);
    }
    setLlmKeysLoading(false);
  }, []);
  
  const addLlmKey = async () => {
    if (!newLlmKey.api_key) return;
    setLlmKeysLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/llm-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLlmKey)
      });
      const data = await res.json();
      if (data.ok) {
        setNewLlmKey({ provider: 'openai', api_key: '', name: '', capabilities: ['text'], is_default: false });
        setShowAddLlmKey(false);
        await fetchLlmKeys();
      }
    } catch (err) {
      console.error('Failed to add LLM key:', err);
    }
    setLlmKeysLoading(false);
  };
  
  const removeLlmKey = async (keyId) => {
    setLlmKeysLoading(true);
    try {
      await fetch(`${API_URL}/api/admin/llm-keys/${keyId}`, { method: 'DELETE' });
      await fetchLlmKeys();
    } catch (err) {
      console.error('Failed to remove LLM key:', err);
    }
    setLlmKeysLoading(false);
  };
  
  const toggleLlmKey = async (keyId, enabled) => {
    try {
      await fetch(`${API_URL}/api/admin/llm-keys/${keyId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      await fetchLlmKeys();
    } catch (err) {
      console.error('Failed to toggle LLM key:', err);
    }
  };
  
  const testLlmKey = async (keyId) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/llm-keys/${keyId}/test`, { method: 'POST' });
      const data = await res.json();
      await fetchLlmKeys();
      return data;
    } catch (err) {
      console.error('Failed to test LLM key:', err);
    }
  };
  
  const setLlmKeyDefault = async (keyId, capability) => {
    try {
      await fetch(`${API_URL}/api/admin/llm-keys/${keyId}/set-default`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capability })
      });
      await fetchLlmKeys();
    } catch (err) {
      console.error('Failed to set default:', err);
    }
  };
  
  // Fetch LLM Analytics
  const fetchLlmAnalytics = useCallback(async () => {
    try {
      const [overviewRes, byProviderRes, hourlyRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/llm-keys/analytics/overview?hours=24`),
        fetch(`${API_URL}/api/admin/llm-keys/analytics/by-provider?hours=24`),
        fetch(`${API_URL}/api/admin/llm-keys/analytics/hourly?hours=24`)
      ]);
      const [overview, byProvider, hourly] = await Promise.all([
        overviewRes.json(),
        byProviderRes.json(),
        hourlyRes.json()
      ]);
      setLlmAnalytics(overview);
      setLlmAnalyticsByProvider(byProvider.providers || []);
      setLlmHourlyData(hourly.data || []);
    } catch (err) {
      console.error('Failed to fetch LLM analytics:', err);
    }
  }, []);
  
  const resetKeyHealth = async (keyId) => {
    try {
      await fetch(`${API_URL}/api/admin/llm-keys/${keyId}/reset-health`, { method: 'POST' });
      await fetchLlmKeys();
    } catch (err) {
      console.error('Failed to reset key health:', err);
    }
  };
  
  // Sentiment Keys Functions
  const fetchSentimentKeys = useCallback(async () => {
    setSentimentKeysLoading(true);
    try {
      const [keysRes, summaryRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/sentiment-keys`),
        fetch(`${API_URL}/api/admin/sentiment-keys/summary`)
      ]);
      const [keys, summary] = await Promise.all([
        keysRes.json(),
        summaryRes.json()
      ]);
      setSentimentKeys(keys.keys || []);
      setSentimentSummary(summary);
    } catch (err) {
      console.error('Failed to fetch sentiment keys:', err);
    }
    setSentimentKeysLoading(false);
  }, []);
  
  const addSentimentKey = async () => {
    setSentimentKeysLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/sentiment-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSentimentKey)
      });
      const data = await res.json();
      if (data.ok) {
        setNewSentimentKey({ provider: 'internal', api_key: '', name: '', model: '', endpoint_url: '', is_default: false });
        setShowAddSentimentKey(false);
        await fetchSentimentKeys();
      }
    } catch (err) {
      console.error('Failed to add sentiment key:', err);
    }
    setSentimentKeysLoading(false);
  };
  
  const removeSentimentKey = async (keyId) => {
    setSentimentKeysLoading(true);
    try {
      await fetch(`${API_URL}/api/admin/sentiment-keys/${keyId}`, { method: 'DELETE' });
      await fetchSentimentKeys();
    } catch (err) {
      console.error('Failed to remove sentiment key:', err);
    }
    setSentimentKeysLoading(false);
  };
  
  const toggleSentimentKey = async (keyId, enabled) => {
    try {
      await fetch(`${API_URL}/api/admin/sentiment-keys/${keyId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      await fetchSentimentKeys();
    } catch (err) {
      console.error('Failed to toggle sentiment key:', err);
    }
  };
  
  const addApiKey = async () => {
    if (!newApiKey.api_key) return;
    setApiKeysLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newApiKey)
      });
      const data = await res.json();
      if (data.ok) {
        setNewApiKey({ service: 'coingecko', api_key: '', name: '', is_pro: false });
        await fetchApiKeys();
      }
    } catch (err) {
      console.error('Failed to add API key:', err);
    }
    setApiKeysLoading(false);
  };
  
  const removeApiKey = async (keyId) => {
    setApiKeysLoading(true);
    try {
      await fetch(`${API_URL}/api/admin/api-keys/${keyId}`, { method: 'DELETE' });
      await fetchApiKeys();
    } catch (err) {
      console.error('Failed to remove API key:', err);
    }
    setApiKeysLoading(false);
  };
  
  const toggleApiKey = async (keyId, enabled) => {
    try {
      await fetch(`${API_URL}/api/admin/api-keys/${keyId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      await fetchApiKeys();
    } catch (err) {
      console.error('Failed to toggle API key:', err);
    }
  };
  
  const checkApiKeyHealth = async (keyId) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/api-keys/${keyId}/health`, { method: 'POST' });
      const data = await res.json();
      // Refresh to show updated health status
      await fetchApiKeys();
      return data;
    } catch (err) {
      console.error('Failed to check key health:', err);
    }
  };
  
  const checkAllKeysHealth = async () => {
    setApiKeysLoading(true);
    try {
      await fetch(`${API_URL}/api/admin/api-keys/health/all`, { method: 'POST' });
      await fetchApiKeys();
    } catch (err) {
      console.error('Failed to check all keys health:', err);
    }
    setApiKeysLoading(false);
  };
  
  useEffect(() => {
    if (activeTab === 'admin') {
      fetchProxyStatus();
      fetchApiKeys();
      fetchProviderPool();
      fetchSourcesHealth();
      fetchDiscoveryDashboard();
      fetchSentimentProviders();
    }
  }, [activeTab, fetchProxyStatus, fetchApiKeys, fetchSourcesHealth, fetchDiscoveryDashboard, fetchSentimentProviders]);
  
  // Auto-refresh discovery dashboard every 30 seconds when on discovery tab
  useEffect(() => {
    if (activeTab === 'admin' && adminSubTab === 'discovery') {
      const interval = setInterval(fetchDiscoveryDashboard, 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab, adminSubTab, fetchDiscoveryDashboard]);
  
  // Fetch news sources when news-sources tab is active
  useEffect(() => {
    if (activeTab === 'news-sources') {
      fetchNewsSources();
    }
  }, [activeTab, fetchNewsSources, newsSourcesFilter]);
  
  // Fetch provider pool status
  const [providerPool, setProviderPool] = useState({ providers: [], bindings: [] });
  
  const fetchProviderPool = async () => {
    try {
      // Get providers from new Provider Gateway
      const gatewayRes = await fetch(`${API_URL}/api/providers`);
      const gatewayData = await gatewayRes.json();
      
      // Get exchange providers health
      const healthRes = await fetch(`${API_URL}/api/exchange/providers/health`);
      const healthData = await healthRes.json();
      
      // Build unified provider list
      const providers = [];
      
      // Add providers from gateway
      if (gatewayData.providers) {
        gatewayData.providers.forEach(p => {
          providers.push({
            id: p.id,
            name: p.name,
            type: p.requires_api_key ? 'api' : 'public',
            category: p.category,
            status: p.status,
            endpoint: p.endpoint,
            capabilities: p.capabilities || [],
            rate_limit: p.rate_limit,
            requires_api_key: p.requires_api_key,
            website: p.website,
            description: p.description,
            is_new: p.is_new || false,
            discovered_at: p.discovered_at,
            proxy: null
          });
        });
      }
      
      // Add exchange providers with health data
      if (healthData.providers) {
        Object.entries(healthData.providers).forEach(([name, data]) => {
          // Check if already exists
          const existing = providers.find(p => p.id === name.toLowerCase());
          if (existing) {
            existing.latency = data.latency_ms;
            existing.health_status = data.status;
            existing.error = data.error;
          } else {
            providers.push({
              id: name.toLowerCase(),
              name: name,
              type: 'exchange',
              category: 'exchange',
              status: data.status,
              latency: data.latency_ms,
              error: data.error,
              proxy: null
            });
          }
        });
      }
      
      // Get gateway stats
      const statsRes = await fetch(`${API_URL}/api/providers/stats`);
      const statsData = await statsRes.json();
      
      setProviderPool({ 
        providers,
        stats: statsData,
        categories: statsData.providers_by_category || {},
        capabilities: statsData.capabilities_count || {}
      });
    } catch (err) {
      console.error('Failed to fetch provider pool:', err);
    }
  };
  
  const renderAdmin = () => {
    return (
      <div className="space-y-6">
        {/* Sub-tabs */}
        <div className="flex gap-4 border-b pb-4" style={{ borderColor: colors.border }}>
          <button
            onClick={() => setAdminSubTab('proxy')}
            className="px-4 py-2 rounded-xl font-medium transition-all"
            style={{
              backgroundColor: adminSubTab === 'proxy' ? colors.accent : colors.surface,
              color: adminSubTab === 'proxy' ? 'white' : colors.textSecondary
            }}
          >
            <Server size={16} className="inline mr-2" />
            Proxy Pool
          </button>
          <button
            onClick={() => setAdminSubTab('api-keys')}
            className="px-4 py-2 rounded-xl font-medium transition-all"
            style={{
              backgroundColor: adminSubTab === 'api-keys' ? colors.accent : colors.surface,
              color: adminSubTab === 'api-keys' ? 'white' : colors.textSecondary
            }}
          >
            <Key size={16} className="inline mr-2" />
            API Keys
          </button>
          <button
            onClick={() => { setAdminSubTab('llm-keys'); fetchLlmKeys(); }}
            data-testid="admin-llm-keys-tab"
            className="px-4 py-2 rounded-xl font-medium transition-all"
            style={{
              backgroundColor: adminSubTab === 'llm-keys' ? '#8b5cf6' : colors.surface,
              color: adminSubTab === 'llm-keys' ? 'white' : colors.textSecondary
            }}
          >
            <Zap size={16} className="inline mr-2" />
            LLM Keys
          </button>
          <button
            onClick={() => { setAdminSubTab('sentiment-keys'); fetchSentimentKeys(); fetchSentimentProviders(); }}
            data-testid="admin-sentiment-keys-tab"
            className="px-4 py-2 rounded-xl font-medium transition-all"
            style={{
              backgroundColor: adminSubTab === 'sentiment-keys' ? '#06b6d4' : colors.surface,
              color: adminSubTab === 'sentiment-keys' ? 'white' : colors.textSecondary
            }}
          >
            <BarChart2 size={16} className="inline mr-2" />
            Sentiment
          </button>
          <button
            onClick={() => setAdminSubTab('providers')}
            className="px-4 py-2 rounded-xl font-medium transition-all"
            style={{
              backgroundColor: adminSubTab === 'providers' ? colors.accent : colors.surface,
              color: adminSubTab === 'providers' ? 'white' : colors.textSecondary
            }}
          >
            <Layers size={16} className="inline mr-2" />
            Provider Pool
          </button>
          <button
            onClick={() => setAdminSubTab('health')}
            className="px-4 py-2 rounded-xl font-medium transition-all"
            style={{
              backgroundColor: adminSubTab === 'health' ? colors.accent : colors.surface,
              color: adminSubTab === 'health' ? 'white' : colors.textSecondary
            }}
          >
            <Activity size={16} className="inline mr-2" />
            Health Monitor
          </button>
          <button
            onClick={() => setAdminSubTab('discovery')}
            className="px-4 py-2 rounded-xl font-medium transition-all"
            data-testid="admin-discovery-tab"
            style={{
              backgroundColor: adminSubTab === 'discovery' ? colors.accent : colors.surface,
              color: adminSubTab === 'discovery' ? 'white' : colors.textSecondary
            }}
          >
            <Globe size={16} className="inline mr-2" />
            Discovery System
          </button>
        </div>

        {adminSubTab === 'proxy' && renderProxyAdmin()}
        {adminSubTab === 'api-keys' && renderApiKeysAdmin()}
        {adminSubTab === 'llm-keys' && renderLlmKeysAdmin()}
        {adminSubTab === 'sentiment-keys' && renderSentimentKeysAdmin()}
        {adminSubTab === 'providers' && renderProviderPool()}
        {adminSubTab === 'health' && renderHealthMonitor()}
        {adminSubTab === 'discovery' && renderDiscoveryDashboard()}
      </div>
    );
  };

  // LLM Keys Admin Section
  const renderLlmKeysAdmin = () => (
    <div className="space-y-6" data-testid="llm-keys-admin">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: colors.text }}>
            <Zap size={24} style={{ color: '#8b5cf6' }} />
            LLM Keys Management
          </h2>
          <p className="text-sm" style={{ color: colors.textSecondary }}>
            Manage API keys for text and image generation (OpenAI, Anthropic, Google, Emergent)
          </p>
        </div>
        <button
          onClick={() => setShowAddLlmKey(true)}
          data-testid="add-llm-key-btn"
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all"
          style={{ backgroundColor: '#8b5cf6', color: 'white' }}
        >
          <Plus size={18} />
          Add LLM Key
        </button>
      </div>
      
      {/* Summary Cards */}
      {llmKeysSummary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-4 border" style={{ borderColor: '#e9d5ff' }}>
            <p className="text-sm font-medium" style={{ color: '#7c3aed' }}>Total Keys</p>
            <p className="text-2xl font-bold" style={{ color: '#5b21b6' }}>{llmKeysSummary.total_keys || 0}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border" style={{ borderColor: '#bbf7d0' }}>
            <p className="text-sm font-medium" style={{ color: '#059669' }}>Text Coverage</p>
            <p className="text-2xl font-bold" style={{ color: '#047857' }}>
              {llmKeysSummary.capabilities_coverage?.text || 0} keys
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border" style={{ borderColor: '#bae6fd' }}>
            <p className="text-sm font-medium" style={{ color: '#0891b2' }}>Image Coverage</p>
            <p className="text-2xl font-bold" style={{ color: '#0e7490' }}>
              {llmKeysSummary.capabilities_coverage?.image || 0} keys
            </p>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-4 border" style={{ borderColor: '#fed7aa' }}>
            <p className="text-sm font-medium" style={{ color: '#d97706' }}>
              {llmKeysSummary.emergent_key_configured ? 'Emergent Key Active' : 'No Emergent Key'}
            </p>
            <p className="text-2xl font-bold" style={{ color: '#b45309' }}>
              {llmKeysSummary.emergent_key_configured ? '✓' : '—'}
            </p>
          </div>
        </div>
      )}
      
      {/* Analytics Section */}
      <div className="bg-white rounded-2xl border p-6" style={{ borderColor: colors.border }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: colors.text }}>
            <BarChart2 size={20} style={{ color: '#8b5cf6' }} />
            Usage Analytics (24h)
          </h3>
          <button
            onClick={fetchLlmAnalytics}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
            style={{ backgroundColor: '#f3e8ff', color: '#7c3aed' }}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
        
        {llmAnalytics ? (
          <div className="space-y-4">
            {/* Overview Stats */}
            <div className="grid grid-cols-5 gap-3">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold" style={{ color: colors.text }}>{llmAnalytics.total_requests || 0}</p>
                <p className="text-xs" style={{ color: colors.textMuted }}>Total Requests</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold" style={{ color: '#16a34a' }}>{llmAnalytics.success_count || 0}</p>
                <p className="text-xs" style={{ color: colors.textMuted }}>Success</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold" style={{ color: '#dc2626' }}>{llmAnalytics.error_count || 0}</p>
                <p className="text-xs" style={{ color: colors.textMuted }}>Errors</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold" style={{ color: '#2563eb' }}>
                  {((llmAnalytics.success_rate || 0) * 100).toFixed(1)}%
                </p>
                <p className="text-xs" style={{ color: colors.textMuted }}>Success Rate</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold" style={{ color: '#7c3aed' }}>
                  {(llmAnalytics.total_tokens || 0).toLocaleString()}
                </p>
                <p className="text-xs" style={{ color: colors.textMuted }}>Tokens Used</p>
              </div>
            </div>
            
            {/* By Provider */}
            {llmAnalyticsByProvider.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>By Provider</p>
                <div className="grid grid-cols-4 gap-2">
                  {llmAnalyticsByProvider.map(p => (
                    <div key={p.provider} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium capitalize" style={{ color: colors.text }}>{p.provider}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded" 
                          style={{ 
                            backgroundColor: p.success_rate > 0.9 ? '#dcfce7' : p.success_rate > 0.7 ? '#fef9c3' : '#fee2e2',
                            color: p.success_rate > 0.9 ? '#16a34a' : p.success_rate > 0.7 ? '#ca8a04' : '#dc2626'
                          }}>
                          {(p.success_rate * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: colors.textMuted }}>
                        {p.total_requests} requests • {p.avg_latency_ms}ms avg
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Hourly Chart (Simple bar visualization) */}
            {llmHourlyData.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>Hourly Activity</p>
                <div className="flex items-end gap-1 h-20">
                  {llmHourlyData.slice(-24).map((h, i) => {
                    const maxReq = Math.max(...llmHourlyData.map(d => d.requests)) || 1;
                    const height = (h.requests / maxReq) * 100;
                    return (
                      <div 
                        key={i}
                        className="flex-1 rounded-t transition-all hover:opacity-80"
                        style={{ 
                          height: `${Math.max(4, height)}%`,
                          backgroundColor: h.success_rate > 0.9 ? '#86efac' : h.success_rate > 0.5 ? '#fde047' : '#fca5a5'
                        }}
                        title={`${h.hour}: ${h.requests} requests (${(h.success_rate * 100).toFixed(0)}% success)`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs" style={{ color: colors.textMuted }}>24h ago</span>
                  <span className="text-xs" style={{ color: colors.textMuted }}>Now</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <BarChart2 size={32} className="mx-auto mb-2" style={{ color: colors.textMuted }} />
            <p className="text-sm" style={{ color: colors.textSecondary }}>No analytics data yet</p>
            <button
              onClick={fetchLlmAnalytics}
              className="mt-2 text-sm px-4 py-2 rounded-lg"
              style={{ backgroundColor: '#f3e8ff', color: '#7c3aed' }}
            >
              Load Analytics
            </button>
          </div>
        )}
      </div>
      
      {/* Add Key Modal */}
      {showAddLlmKey && (
        <div className="bg-white rounded-2xl border p-6 shadow-xl" style={{ borderColor: colors.border }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold" style={{ color: colors.text }}>Add LLM API Key</h3>
            <button 
              onClick={() => setShowAddLlmKey(false)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={20} style={{ color: colors.textMuted }} />
            </button>
          </div>
          
          <div className="space-y-5">
            {/* Provider Selection - Custom White Dropdown */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>Provider</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setNewLlmKey(prev => ({ ...prev, _dropdownOpen: !prev._dropdownOpen }))}
                    className="w-full px-4 py-3 rounded-xl border bg-white text-left flex items-center justify-between hover:border-violet-400 transition-colors"
                    style={{ borderColor: colors.border }}
                  >
                    <span className="flex items-center gap-2" style={{ color: colors.text }}>
                      {newLlmKey.provider === 'openai' && <Zap size={16} style={{ color: '#10a37f' }} />}
                      {newLlmKey.provider === 'anthropic' && <Shield size={16} style={{ color: '#d97706' }} />}
                      {newLlmKey.provider === 'google' && <Globe size={16} style={{ color: '#4285f4' }} />}
                      {newLlmKey.provider === 'emergent' && <Activity size={16} style={{ color: '#8b5cf6' }} />}
                      {llmProviders.find(p => p.id === newLlmKey.provider)?.name || 'Select Provider'}
                    </span>
                    <ChevronDown size={18} style={{ color: colors.textMuted }} />
                  </button>
                  
                  {/* Custom Dropdown Menu */}
                  {newLlmKey._dropdownOpen && (
                    <div 
                      className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border shadow-lg z-50 overflow-hidden"
                      style={{ borderColor: colors.border }}
                    >
                      {llmProviders.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setNewLlmKey(prev => ({ 
                              ...prev, 
                              provider: p.id, 
                              capabilities: p.capabilities || ['text'],
                              _dropdownOpen: false 
                            }));
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-violet-50 transition-colors flex items-center justify-between"
                          style={{ 
                            backgroundColor: newLlmKey.provider === p.id ? '#f5f3ff' : 'white',
                            color: colors.text
                          }}
                        >
                          <span className="flex items-center gap-2">
                            {p.id === 'openai' && <Zap size={16} style={{ color: '#10a37f' }} />}
                            {p.id === 'anthropic' && <Shield size={16} style={{ color: '#d97706' }} />}
                            {p.id === 'google' && <Globe size={16} style={{ color: '#4285f4' }} />}
                            {p.id === 'emergent' && <Activity size={16} style={{ color: '#8b5cf6' }} />}
                            {p.name}
                          </span>
                          {newLlmKey.provider === p.id && (
                            <CheckCircle size={18} style={{ color: '#8b5cf6' }} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>Name (optional)</label>
                <input
                  type="text"
                  value={newLlmKey.name}
                  onChange={(e) => setNewLlmKey({ ...newLlmKey, name: e.target.value })}
                  placeholder="My OpenAI Key"
                  className="w-full px-4 py-3 rounded-xl border bg-white hover:border-violet-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-all outline-none"
                  style={{ borderColor: colors.border }}
                />
              </div>
            </div>
            
            {/* API Key Input */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>API Key</label>
              <input
                type="password"
                value={newLlmKey.api_key}
                onChange={(e) => setNewLlmKey({ ...newLlmKey, api_key: e.target.value })}
                placeholder="sk-..."
                className="w-full px-4 py-3 rounded-xl border font-mono bg-white hover:border-violet-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-all outline-none"
                style={{ borderColor: colors.border }}
              />
            </div>
            
            {/* Capabilities - Updated with Sentiment */}
            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: colors.textSecondary }}>
                Capabilities
                <span className="ml-2 text-xs font-normal" style={{ color: colors.textMuted }}>
                  Select what this key can be used for
                </span>
              </label>
              <div className="flex gap-3 flex-wrap">
                {['text', 'image', 'audio', 'video', 'sentiment'].map(cap => (
                  <label 
                    key={cap} 
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                      newLlmKey.capabilities.includes(cap) 
                        ? 'bg-violet-50 border-violet-400' 
                        : 'bg-white hover:border-violet-300'
                    }`}
                    style={{ borderColor: newLlmKey.capabilities.includes(cap) ? '#a78bfa' : colors.border }}
                  >
                    <input
                      type="checkbox"
                      checked={newLlmKey.capabilities.includes(cap)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewLlmKey({ ...newLlmKey, capabilities: [...newLlmKey.capabilities, cap] });
                        } else {
                          setNewLlmKey({ ...newLlmKey, capabilities: newLlmKey.capabilities.filter(c => c !== cap) });
                        }
                      }}
                      className="sr-only"
                    />
                    <span 
                      className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                        newLlmKey.capabilities.includes(cap) 
                          ? 'bg-violet-500 border-violet-500' 
                          : 'bg-white border-gray-300'
                      }`}
                    >
                      {newLlmKey.capabilities.includes(cap) && (
                        <CheckCircle size={14} style={{ color: 'white' }} />
                      )}
                    </span>
                    <span className={`text-sm font-medium capitalize ${
                      newLlmKey.capabilities.includes(cap) ? 'text-violet-700' : ''
                    }`} style={{ color: newLlmKey.capabilities.includes(cap) ? '#6d28d9' : colors.text }}>
                      {cap === 'sentiment' ? 'Sentiment Analysis' : cap}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
                OpenAI keys can handle multiple capabilities: news analysis, image generation, and sentiment analysis
              </p>
            </div>
            
            {/* Set as Default */}
            <div className="flex items-center pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={newLlmKey.is_default}
                    onChange={(e) => setNewLlmKey({ ...newLlmKey, is_default: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-violet-500 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow-sm"></div>
                </div>
                <span className="text-sm font-medium" style={{ color: colors.text }}>Set as default provider</span>
              </label>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: colors.border }}>
            <button
              onClick={() => setShowAddLlmKey(false)}
              className="px-5 py-2.5 rounded-xl font-medium transition-all hover:bg-gray-100"
              style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
            >
              Cancel
            </button>
            <button
              onClick={addLlmKey}
              disabled={!newLlmKey.api_key}
              className="px-5 py-2.5 rounded-xl font-medium transition-all"
              style={{ 
                backgroundColor: newLlmKey.api_key ? '#8b5cf6' : '#d1d5db', 
                color: 'white',
                cursor: newLlmKey.api_key ? 'pointer' : 'not-allowed'
              }}
            >
              Add Key
            </button>
          </div>
        </div>
      )}
      
      {/* Keys List */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: colors.text }}>
          Configured LLM Keys ({llmKeys.length})
        </h3>
        
        {llmKeysLoading ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="animate-spin" size={24} style={{ color: colors.accent }} />
          </div>
        ) : llmKeys.length === 0 ? (
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-8 text-center border" style={{ borderColor: '#e9d5ff' }}>
            <Zap size={48} className="mx-auto mb-4" style={{ color: '#8b5cf6' }} />
            <p className="font-medium" style={{ color: '#5b21b6' }}>No LLM Keys Configured</p>
            <p className="text-sm mt-1" style={{ color: '#7c3aed' }}>
              Add OpenAI, Anthropic, or Google keys to enable text/image generation
            </p>
            <p className="text-xs mt-2" style={{ color: '#a78bfa' }}>
              Currently using Emergent Universal Key as fallback
            </p>
          </div>
        ) : (
          llmKeys.map((key, i) => (
            <div 
              key={key.id || i}
              data-testid={`llm-key-${key.id}`}
              className="bg-white rounded-2xl border p-4 transition-all hover:shadow-md"
              style={{ borderColor: colors.border }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ 
                      backgroundColor: key.healthy ? '#f0fdf4' : '#fef2f2',
                      color: key.healthy ? '#16a34a' : '#dc2626'
                    }}
                  >
                    {key.provider === 'openai' && <Zap size={24} />}
                    {key.provider === 'anthropic' && <Terminal size={24} />}
                    {key.provider === 'google' && <Globe size={24} />}
                    {key.provider === 'emergent' && <Shield size={24} />}
                  </div>
                  <div>
                    <p className="font-medium flex items-center gap-2" style={{ color: colors.text }}>
                      {key.name}
                      <span className="px-2 py-0.5 rounded text-xs font-medium capitalize"
                        style={{ backgroundColor: '#f3e8ff', color: '#7c3aed' }}>
                        {key.provider}
                      </span>
                      {key.is_default && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: '#dbeafe', color: '#2563eb' }}>
                          Default
                        </span>
                      )}
                      {!key.enabled && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                          Disabled
                        </span>
                      )}
                    </p>
                    <p className="text-sm flex items-center gap-2 flex-wrap" style={{ color: colors.textSecondary }}>
                      Key: {key.api_key_masked} • 
                      <span className="flex gap-1">
                        {key.capabilities?.map(cap => (
                          <span 
                            key={cap}
                            className="px-1.5 py-0.5 rounded text-xs font-medium capitalize"
                            style={{ 
                              backgroundColor: cap === 'sentiment' ? '#fef3c7' : '#ecfdf5',
                              color: cap === 'sentiment' ? '#92400e' : '#059669'
                            }}
                          >
                            {cap === 'sentiment' ? 'Sentiment' : cap}
                          </span>
                        ))}
                      </span>
                      • Requests: {key.requests_total || 0}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => testLlmKey(key.id)}
                    className="p-2 rounded-lg transition-all hover:bg-purple-50"
                    title="Test key"
                  >
                    <Activity size={18} style={{ color: '#8b5cf6' }} />
                  </button>
                  {!key.healthy && (
                    <button
                      onClick={() => resetKeyHealth(key.id)}
                      className="p-2 rounded-lg transition-all hover:bg-green-50"
                      title="Reset health status"
                    >
                      <RotateCcw size={18} style={{ color: '#16a34a' }} />
                    </button>
                  )}
                  <button
                    onClick={() => toggleLlmKey(key.id, !key.enabled)}
                    className="p-2 rounded-lg transition-all hover:bg-gray-100"
                    title={key.enabled ? 'Disable' : 'Enable'}
                  >
                    {key.enabled ? (
                      <CheckCircle size={18} style={{ color: colors.success }} />
                    ) : (
                      <XCircle size={18} style={{ color: colors.textMuted }} />
                    )}
                  </button>
                  <button
                    onClick={() => removeLlmKey(key.id)}
                    className="p-2 rounded-lg transition-all hover:bg-red-50"
                    title="Remove key"
                  >
                    <Trash2 size={18} style={{ color: colors.error }} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Provider Info */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>Supported Providers</h3>
        <div className="grid grid-cols-2 gap-4">
          {llmProviders.map(provider => (
            <div 
              key={provider.id}
              className="bg-white rounded-2xl border p-4"
              style={{ borderColor: colors.border }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#f3e8ff' }}>
                  {provider.id === 'openai' && <Zap size={20} style={{ color: '#8b5cf6' }} />}
                  {provider.id === 'anthropic' && <Terminal size={20} style={{ color: '#8b5cf6' }} />}
                  {provider.id === 'google' && <Globe size={20} style={{ color: '#8b5cf6' }} />}
                  {provider.id === 'emergent' && <Shield size={20} style={{ color: '#8b5cf6' }} />}
                </div>
                <div>
                  <p className="font-medium" style={{ color: colors.text }}>{provider.name}</p>
                  <p className="text-xs" style={{ color: colors.textSecondary }}>{provider.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {provider.capabilities?.map(cap => (
                  <span key={cap} className="px-2 py-0.5 rounded text-xs capitalize"
                    style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                    {cap}
                  </span>
                ))}
              </div>
              <p className="text-xs" style={{ color: colors.textMuted }}>
                Key format: {provider.key_format}
              </p>
              {provider.docs_url && (
                <a href={provider.docs_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs flex items-center gap-1 mt-1" style={{ color: colors.accent }}>
                  Get API Key <ExternalLink size={12} />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Sentiment Keys Admin Section
  const renderSentimentKeysAdmin = () => {
    // Check provider status from loaded sentimentProviders
    const fomoProvider = sentimentProviders.find(p => p.id === 'fomo');
    const openaiProvider = sentimentProviders.find(p => p.id === 'openai');
    
    // Use available field from API response
    const fomoActive = fomoProvider?.available === true;
    const openaiActive = openaiProvider?.available === true;
    const bothActive = fomoActive && openaiActive;
    
    return (
    <div className="space-y-6" data-testid="sentiment-keys-admin">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: colors.text }}>
            <BarChart2 size={24} style={{ color: '#7c3aed' }} />
            Sentiment Analysis
          </h2>
          <p className="text-sm" style={{ color: colors.textSecondary }}>
            Multi-provider sentiment engine configuration
          </p>
        </div>
        <button
          onClick={() => setShowAddSentimentKey(true)}
          data-testid="add-sentiment-key-btn"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all hover:shadow-md"
          style={{ backgroundColor: '#7c3aed', color: 'white' }}
        >
          <Plus size={18} />
          Add Custom Key
        </button>
      </div>
      
      {/* Add Custom Sentiment Key Modal */}
      {showAddSentimentKey && (
        <div className="bg-white rounded-2xl border p-6 shadow-xl" style={{ borderColor: colors.border }}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold" style={{ color: colors.text }}>Add Custom Sentiment Key</h3>
            <button 
              onClick={() => setShowAddSentimentKey(false)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={20} style={{ color: colors.textMuted }} />
            </button>
          </div>
          
          <div className="space-y-5">
            {/* Provider Type */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>Provider Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNewSentimentKey({ ...newSentimentKey, provider: 'openai' })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    newSentimentKey.provider === 'openai' ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-violet-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#10a37f20' }}>
                      <Zap size={20} style={{ color: '#10a37f' }} />
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: colors.text }}>OpenAI</p>
                      <p className="text-xs" style={{ color: colors.textMuted }}>GPT-4o for sentiment</p>
                    </div>
                  </div>
                </button>
                
                <button
                  type="button"
                  onClick={() => setNewSentimentKey({ ...newSentimentKey, provider: 'custom' })}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    newSentimentKey.provider === 'custom' ? 'border-violet-500 bg-violet-50' : 'border-gray-200 hover:border-violet-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#8b5cf620' }}>
                      <Server size={20} style={{ color: '#8b5cf6' }} />
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: colors.text }}>Custom API</p>
                      <p className="text-xs" style={{ color: colors.textMuted }}>Your own sentiment API</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
            
            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>Name</label>
              <input
                type="text"
                value={newSentimentKey.name}
                onChange={(e) => setNewSentimentKey({ ...newSentimentKey, name: e.target.value })}
                placeholder="My Sentiment Key"
                className="w-full px-4 py-3 rounded-xl border bg-white hover:border-violet-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-all outline-none"
                style={{ borderColor: colors.border }}
              />
            </div>
            
            {/* API Key */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>API Key</label>
              <input
                type="password"
                value={newSentimentKey.api_key}
                onChange={(e) => setNewSentimentKey({ ...newSentimentKey, api_key: e.target.value })}
                placeholder={newSentimentKey.provider === 'openai' ? 'sk-...' : 'your-api-key'}
                className="w-full px-4 py-3 rounded-xl border font-mono bg-white hover:border-violet-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-all outline-none"
                style={{ borderColor: colors.border }}
              />
            </div>
            
            {/* Custom Endpoint URL (only for custom provider) */}
            {newSentimentKey.provider === 'custom' && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>
                  Endpoint URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={newSentimentKey.endpoint_url || ''}
                  onChange={(e) => setNewSentimentKey({ ...newSentimentKey, endpoint_url: e.target.value })}
                  placeholder="https://api.yourservice.com/sentiment"
                  className="w-full px-4 py-3 rounded-xl border font-mono bg-white hover:border-violet-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-all outline-none"
                  style={{ borderColor: colors.border }}
                />
                <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
                  Your custom sentiment API endpoint. Should accept POST with {"{"}"text": "..."{"}"}
                </p>
              </div>
            )}
            
            {/* Set as Default */}
            <div className="flex items-center pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={newSentimentKey.is_default}
                    onChange={(e) => setNewSentimentKey({ ...newSentimentKey, is_default: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-violet-500 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow-sm"></div>
                </div>
                <span className="text-sm font-medium" style={{ color: colors.text }}>Set as default sentiment provider</span>
              </label>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: colors.border }}>
            <button
              onClick={() => setShowAddSentimentKey(false)}
              className="px-5 py-2.5 rounded-xl font-medium transition-all hover:bg-gray-100"
              style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
            >
              Cancel
            </button>
            <button
              onClick={addSentimentKey}
              disabled={!newSentimentKey.api_key || (newSentimentKey.provider === 'custom' && !newSentimentKey.endpoint_url)}
              className="px-5 py-2.5 rounded-xl font-medium transition-all"
              style={{ 
                backgroundColor: (newSentimentKey.api_key && (newSentimentKey.provider !== 'custom' || newSentimentKey.endpoint_url)) ? '#7c3aed' : '#d1d5db', 
                color: 'white',
                cursor: (newSentimentKey.api_key && (newSentimentKey.provider !== 'custom' || newSentimentKey.endpoint_url)) ? 'pointer' : 'not-allowed'
              }}
            >
              Add Key
            </button>
          </div>
        </div>
      )}
      
      {/* System Status Alert */}
      {!openaiActive && (
        <div 
          className="flex items-center gap-3 p-4 rounded-xl border"
          style={{ 
            backgroundColor: '#fef3c7', 
            borderColor: '#fcd34d',
            color: '#92400e'
          }}
        >
          <AlertTriangle size={20} />
          <div>
            <p className="font-medium">OpenAI API Key Not Configured</p>
            <p className="text-sm opacity-80">
              Multi-provider consensus is limited. Only FOMO keyword-based analysis is active.
              Add OpenAI key below for full AI-powered sentiment analysis.
            </p>
          </div>
        </div>
      )}
      
      {/* Provider Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* FOMO Provider Card */}
        <div 
          className={`rounded-2xl p-5 border-2 transition-all ${fomoActive ? 'shadow-md' : 'opacity-60'}`}
          style={{ 
            backgroundColor: fomoActive ? '#fefce8' : '#f9fafb',
            borderColor: fomoActive ? '#facc15' : '#e5e7eb'
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: fomoActive ? '#fef08a' : '#e5e7eb' }}
              >
                <Zap size={20} style={{ color: fomoActive ? '#ca8a04' : '#9ca3af' }} />
              </div>
              <div>
                <p className="font-semibold" style={{ color: fomoActive ? '#854d0e' : '#6b7280' }}>FOMO</p>
                <p className="text-xs" style={{ color: fomoActive ? '#a16207' : '#9ca3af' }}>Custom Engine</p>
              </div>
            </div>
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: fomoActive ? '#22c55e' : '#d1d5db' }}
            />
          </div>
          <p className="text-xs mb-3" style={{ color: fomoActive ? '#92400e' : '#6b7280' }}>
            Keyword-based crypto sentiment with bullish/bearish pattern detection
          </p>
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: fomoActive ? '#a16207' : '#9ca3af' }}>Weight: 1.5x</span>
            <span 
              className="px-2 py-0.5 rounded-full font-medium"
              style={{ 
                backgroundColor: fomoActive ? '#dcfce7' : '#f3f4f6',
                color: fomoActive ? '#16a34a' : '#9ca3af'
              }}
            >
              {fomoActive ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
        </div>
        
        {/* OpenAI Provider Card */}
        <div 
          className={`rounded-2xl p-5 border-2 transition-all ${openaiActive ? 'shadow-md' : 'opacity-60'}`}
          style={{ 
            backgroundColor: openaiActive ? '#f0fdf4' : '#f9fafb',
            borderColor: openaiActive ? '#22c55e' : '#e5e7eb'
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: openaiActive ? '#bbf7d0' : '#e5e7eb' }}
              >
                <Globe size={20} style={{ color: openaiActive ? '#16a34a' : '#9ca3af' }} />
              </div>
              <div>
                <p className="font-semibold" style={{ color: openaiActive ? '#166534' : '#6b7280' }}>OpenAI</p>
                <p className="text-xs" style={{ color: openaiActive ? '#15803d' : '#9ca3af' }}>GPT-4o</p>
              </div>
            </div>
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: openaiActive ? '#22c55e' : '#d1d5db' }}
            />
          </div>
          <p className="text-xs mb-3" style={{ color: openaiActive ? '#166534' : '#6b7280' }}>
            AI-powered deep semantic analysis with context understanding
          </p>
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: openaiActive ? '#15803d' : '#9ca3af' }}>Weight: 1.0x</span>
            <span 
              className="px-2 py-0.5 rounded-full font-medium"
              style={{ 
                backgroundColor: openaiActive ? '#dcfce7' : '#f3f4f6',
                color: openaiActive ? '#16a34a' : '#9ca3af'
              }}
            >
              {openaiActive ? 'ACTIVE' : 'REQUIRES KEY'}
            </span>
          </div>
        </div>
        
        {/* Consensus Card */}
        <div 
          className={`rounded-2xl p-5 border-2 transition-all ${bothActive ? 'shadow-md' : 'opacity-60'}`}
          style={{ 
            backgroundColor: bothActive ? '#f5f3ff' : '#f9fafb',
            borderColor: bothActive ? '#8b5cf6' : '#e5e7eb'
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: bothActive ? '#ddd6fe' : '#e5e7eb' }}
              >
                <Activity size={20} style={{ color: bothActive ? '#7c3aed' : '#9ca3af' }} />
              </div>
              <div>
                <p className="font-semibold" style={{ color: bothActive ? '#5b21b6' : '#6b7280' }}>Consensus</p>
                <p className="text-xs" style={{ color: bothActive ? '#6d28d9' : '#9ca3af' }}>FOMO + OpenAI</p>
              </div>
            </div>
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: bothActive ? '#22c55e' : '#d1d5db' }}
            />
          </div>
          <p className="text-xs mb-3" style={{ color: bothActive ? '#5b21b6' : '#6b7280' }}>
            Weighted average combining both engines for maximum accuracy
          </p>
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: bothActive ? '#6d28d9' : '#9ca3af' }}>Best results</span>
            <span 
              className="px-2 py-0.5 rounded-full font-medium"
              style={{ 
                backgroundColor: bothActive ? '#dcfce7' : '#f3f4f6',
                color: bothActive ? '#16a34a' : '#9ca3af'
              }}
            >
              {bothActive ? 'ACTIVE' : 'PARTIAL'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Consensus Formula - Improved Design */}
      <div 
        className="rounded-2xl overflow-hidden"
        style={{ 
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)'
        }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10">
                <Activity size={20} style={{ color: '#c4b5fd' }} />
              </div>
              <div>
                <h3 className="font-semibold text-white">Consensus Formula</h3>
                <p className="text-xs text-indigo-300">Weighted multi-provider averaging</p>
              </div>
            </div>
            <div className="relative group">
              <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                <HelpCircle size={16} style={{ color: '#c4b5fd' }} />
              </button>
              {/* Tooltip */}
              <div className="absolute right-0 top-full mt-2 w-72 p-4 bg-white rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <p className="text-sm font-medium text-gray-900 mb-2">How Consensus Works</p>
                <p className="text-xs text-gray-600 mb-3">
                  Each provider analyzes text independently. Results are combined using weighted average where:
                </p>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• FOMO has 1.5x weight (crypto-specific)</li>
                  <li>• OpenAI has 1.0x weight (general AI)</li>
                  <li>• Agreement bonus: +15% confidence when both agree</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Formula Visualization */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-yellow-300">1.5x</p>
              <p className="text-[10px] text-indigo-300 mt-1">FOMO Weight</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center flex items-center justify-center">
              <span className="text-2xl text-indigo-400">×</span>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-green-300">score</p>
              <p className="text-[10px] text-indigo-300 mt-1">Provider Score</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center flex items-center justify-center">
              <span className="text-2xl text-indigo-400">×</span>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-blue-300">conf</p>
              <p className="text-[10px] text-indigo-300 mt-1">Confidence</p>
            </div>
          </div>
          
          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-xs text-indigo-200 font-mono text-center">
              consensus = Σ(weight × score × confidence) / Σ(weight × confidence)
            </p>
          </div>
        </div>
        
        {/* Agreement Bonus Section */}
        <div className="px-6 py-4 bg-black/20 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} style={{ color: '#86efac' }} />
              <span className="text-sm text-indigo-200">Agreement Bonus</span>
            </div>
            <span className="text-sm font-medium text-green-300">+15% confidence when providers agree</span>
          </div>
        </div>
      </div>
      
      {/* Intelligence Score Formula - Compact Design */}
      <div 
        className="rounded-2xl overflow-hidden"
        style={{ 
          background: 'linear-gradient(135deg, #164e63 0%, #0e7490 100%)'
        }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10">
                <Target size={20} style={{ color: '#67e8f9' }} />
              </div>
              <div>
                <h3 className="font-semibold text-white">News Intelligence Score</h3>
                <p className="text-xs text-cyan-300">Importance calculation (0-100)</p>
              </div>
            </div>
            <div className="relative group">
              <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                <HelpCircle size={16} style={{ color: '#67e8f9' }} />
              </button>
              {/* Tooltip */}
              <div className="absolute right-0 top-full mt-2 w-72 p-4 bg-white rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <p className="text-sm font-medium text-gray-900 mb-2">Intelligence Score Factors</p>
                <ul className="text-xs text-gray-600 space-y-2">
                  <li><span className="font-medium text-cyan-600">35% Source Weight</span> - Reliability of news source</li>
                  <li><span className="font-medium text-emerald-600">25% Source Count</span> - Multi-source confirmation</li>
                  <li><span className="font-medium text-amber-600">20% Entity Importance</span> - Key players involved</li>
                  <li><span className="font-medium text-violet-600">10% Sentiment</span> - Sentiment strength</li>
                  <li><span className="font-medium text-pink-600">10% Novelty</span> - Breaking news factor</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Compact Factor Pills */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
              <span className="text-lg font-bold text-cyan-300">35%</span>
              <span className="text-xs text-cyan-100">Source Weight</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
              <span className="text-lg font-bold text-emerald-300">25%</span>
              <span className="text-xs text-cyan-100">Source Count</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
              <span className="text-lg font-bold text-amber-300">20%</span>
              <span className="text-xs text-cyan-100">Entity Importance</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
              <span className="text-lg font-bold text-violet-300">10%</span>
              <span className="text-xs text-cyan-100">Sentiment</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
              <span className="text-lg font-bold text-pink-300">10%</span>
              <span className="text-xs text-cyan-100">Novelty</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Cache Statistics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-4 border" style={{ borderColor: '#ddd6fe' }}>
          <p className="text-sm font-medium" style={{ color: '#7c3aed' }}>Providers Active</p>
          <p className="text-2xl font-bold" style={{ color: '#5b21b6' }}>
            {sentimentProviders.filter(p => p.available).length} / 2
          </p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border" style={{ borderColor: '#bbf7d0' }}>
          <p className="text-sm font-medium" style={{ color: '#059669' }}>Total Cached</p>
          <p className="text-2xl font-bold" style={{ color: '#047857' }}>
            {sentimentHeatmapData[0]?.total || 0}
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border" style={{ borderColor: '#c7d2fe' }}>
          <p className="text-sm font-medium" style={{ color: '#4f46e5' }}>FOMO Status</p>
          <p className="text-2xl font-bold" style={{ color: '#4338ca' }}>
            {fomoActive ? '✓ Active' : '—'}
          </p>
        </div>
        <div className="bg-gradient-to-br from-cyan-50 to-teal-50 rounded-2xl p-4 border" style={{ borderColor: '#99f6e4' }}>
          <p className="text-sm font-medium" style={{ color: '#0891b2' }}>OpenAI Status</p>
          <p className="text-2xl font-bold" style={{ color: '#0e7490' }}>
            {openaiActive ? '✓ Active' : 'No Key'}
          </p>
        </div>
      </div>
    </div>
  )};

  // Provider Pool Section - Shows API + Proxy bindings
  const renderProviderPool = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: colors.text }}>
            Provider Gateway
          </h2>
          <p className="text-sm" style={{ color: colors.textSecondary }}>
            {providerPool.stats?.total_providers || 0} providers • {providerPool.stats?.api_key_providers || 0} require API keys • {providerPool.stats?.public_providers || 0} public
          </p>
        </div>
        <button
          onClick={fetchProviderPool}
          className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
          style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Category A: API Key Required */}
      <div 
        className="bg-white rounded-2xl border p-6"
        style={{ borderColor: colors.border }}
      >
        <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: colors.text }}>
          <Key size={18} />
          Category A: API Key Required
        </h3>
        <p className="text-sm mb-4" style={{ color: colors.textSecondary }}>
          Configure API keys in the API Keys tab to enable these providers
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {providerPool.providers?.filter(p => p.requires_api_key === true).map(provider => (
            <div 
              key={provider.id}
              className="border rounded-xl p-4 hover:shadow-md transition-all"
              style={{ 
                borderColor: provider.status === 'active' ? colors.success : colors.border,
                backgroundColor: 'white'
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: colors.accentSoft }}>
                    <Database size={16} style={{ color: colors.accent }} />
                  </div>
                  <span className="font-semibold" style={{ color: colors.text }}>
                    {provider.name}
                  </span>
                </div>
                <span 
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ 
                    backgroundColor: provider.status === 'active' ? colors.successSoft : colors.warningSoft,
                    color: provider.status === 'active' ? colors.success : colors.warning
                  }}
                >
                  {provider.status}
                </span>
              </div>
              <p className="text-xs mb-3" style={{ color: colors.textSecondary }}>
                {provider.description?.slice(0, 80) || 'Data provider'}
              </p>
              <div className="flex flex-wrap gap-1 mb-3">
                {provider.capabilities?.slice(0, 4).map(cap => (
                  <span key={cap} className="px-2 py-0.5 rounded text-xs"
                    style={{ backgroundColor: colors.surface, color: colors.textSecondary }}>
                    {cap.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
              <div className="text-xs flex items-center justify-between pt-2 border-t"
                style={{ borderColor: colors.border, color: colors.textMuted }}>
                <span>Rate: {provider.rate_limit}/min</span>
                <span className="capitalize">{provider.category?.replace(/_/g, ' ')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category B: Public APIs */}
      <div 
        className="bg-white rounded-2xl border p-6"
        style={{ borderColor: colors.border }}
      >
        <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: colors.text }}>
          <Globe size={18} />
          Category B: Public APIs (No Key Required)
        </h3>
        <p className="text-sm mb-4" style={{ color: colors.textSecondary }}>
          Free public APIs - only proxy configuration needed for rate limiting
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {providerPool.providers?.filter(p => p.requires_api_key === false && p.type !== 'exchange').map(provider => (
            <div 
              key={provider.id}
              className="border rounded-xl p-4 hover:shadow-md transition-all relative"
              style={{ 
                borderColor: provider.is_new ? colors.warning : (provider.status === 'active' ? colors.success : colors.border)
              }}
            >
              {/* New badge */}
              {provider.is_new && (
                <span 
                  className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ backgroundColor: colors.warning, color: 'white' }}
                >
                  NEW
                </span>
              )}
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium" style={{ color: colors.text }}>
                  {provider.name}
                </span>
                <span 
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ 
                    backgroundColor: colors.successSoft,
                    color: colors.success
                  }}
                >
                  Public
                </span>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {provider.capabilities?.slice(0, 3).map(cap => (
                  <span key={cap} className="px-1.5 py-0.5 rounded text-xs"
                    style={{ backgroundColor: colors.accentSoft, color: colors.accent }}>
                    {cap.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
              <div className="text-xs" style={{ color: colors.textMuted }}>
                {provider.category?.replace(/_/g, ' ')} • {provider.rate_limit}/min
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exchange Providers */}
      <div 
        className="bg-white rounded-2xl border p-6"
        style={{ borderColor: colors.border }}
      >
        <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: colors.text }}>
          <TrendingUp size={18} />
          Exchange Providers
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {providerPool.providers?.filter(p => p.type === 'exchange' || p.category === 'exchange').map(provider => (
            <div 
              key={provider.id || provider.name}
              className="border rounded-xl p-4"
              style={{ 
                borderColor: (provider.status === 'healthy' || provider.health_status === 'healthy') ? colors.success : 
                             (provider.status === 'error' || provider.health_status === 'error') ? colors.error : colors.border
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium capitalize" style={{ color: colors.text }}>
                  {provider.name}
                </span>
                <span 
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ 
                    backgroundColor: (provider.health_status === 'healthy' || provider.status === 'healthy') ? colors.successSoft : 
                                     (provider.health_status === 'error' || provider.status === 'error') ? colors.errorSoft : colors.warningSoft,
                    color: (provider.health_status === 'healthy' || provider.status === 'healthy') ? colors.success : 
                           (provider.health_status === 'error' || provider.status === 'error') ? colors.error : colors.warning
                  }}
                >
                  {provider.health_status || provider.status}
                </span>
              </div>
              <div className="text-xs space-y-1" style={{ color: colors.textSecondary }}>
                {provider.latency && <p>Latency: {provider.latency.toFixed(0)}ms</p>}
                {provider.error && <p className="truncate" style={{ color: colors.error }}>Error: {provider.error}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Capabilities Overview */}
      {providerPool.capabilities && Object.keys(providerPool.capabilities).length > 0 && (
        <div 
          className="rounded-2xl p-6"
          style={{ backgroundColor: colors.accentSoft }}
        >
          <h4 className="font-medium mb-4 flex items-center gap-2" style={{ color: colors.accent }}>
            <Layers size={18} />
            Available Capabilities
          </h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(providerPool.capabilities || {}).map(([cap, count]) => (
              <span key={cap} className="px-3 py-1.5 rounded-full text-sm bg-white flex items-center gap-1"
                style={{ color: colors.text }}>
                {cap.replace(/_/g, ' ')}
                <span className="text-xs px-1.5 py-0.5 rounded-full ml-1"
                  style={{ backgroundColor: colors.accentSoft, color: colors.accent }}>
                  {count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Architecture Diagram */}
      <div 
        className="rounded-2xl p-6 border"
        style={{ borderColor: colors.border, backgroundColor: 'white' }}
      >
        <h4 className="font-medium mb-4" style={{ color: colors.text }}>
          Provider Gateway Architecture
        </h4>
        <div className="grid grid-cols-5 gap-2 text-center text-sm">
          <div className="rounded-xl p-3" style={{ backgroundColor: colors.surface, color: colors.text }}>
            <p className="font-medium">Client</p>
            <p className="text-xs" style={{ color: colors.textMuted }}>API Request</p>
          </div>
          <div className="flex items-center justify-center">
            <ChevronRight size={20} style={{ color: colors.accent }} />
          </div>
          <div className="rounded-xl p-3" style={{ backgroundColor: colors.accentSoft, color: colors.accent }}>
            <p className="font-medium">Provider Router</p>
            <p className="text-xs">Select best instance</p>
          </div>
          <div className="flex items-center justify-center">
            <ChevronRight size={20} style={{ color: colors.accent }} />
          </div>
          <div className="rounded-xl p-3" style={{ backgroundColor: colors.surface, color: colors.text }}>
            <p className="font-medium">External API</p>
            <p className="text-xs" style={{ color: colors.textMuted }}>+ Proxy + Key</p>
          </div>
        </div>
        <div className="mt-4 text-sm" style={{ color: colors.text }}>
          <p className="mb-2"><strong>Failover strategy:</strong></p>
          <p style={{ color: colors.textSecondary }}>
            Instance 1 (Proxy A + Key 1) → Instance 2 (Proxy B + Key 2) → Direct request
          </p>
        </div>
      </div>
    </div>
  );

  // Health Monitor Section
  const renderHealthMonitor = () => (
    <div className="space-y-6" data-testid="health-monitor">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: colors.text }}>
            News Sources Health Monitor
          </h2>
          <p className="text-sm" style={{ color: colors.textSecondary }}>
            Parser Sandbox • Validation Layer • Auto-pause • Drift Detection
          </p>
        </div>
        <button
          onClick={fetchSourcesHealth}
          disabled={healthLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
          style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
        >
          <RefreshCw size={16} className={healthLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 border" style={{ borderColor: colors.border }}>
          <p className="text-sm mb-1" style={{ color: colors.textSecondary }}>Total Sources</p>
          <p className="text-2xl font-bold" style={{ color: colors.text }}>
            {sourcesHealth.summary.total_sources || 0}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border" style={{ borderColor: colors.success }}>
          <p className="text-sm mb-1" style={{ color: colors.textSecondary }}>Active</p>
          <p className="text-2xl font-bold" style={{ color: colors.success }}>
            {sourcesHealth.summary.active || 0}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border" style={{ borderColor: colors.warning }}>
          <p className="text-sm mb-1" style={{ color: colors.textSecondary }}>Degraded</p>
          <p className="text-2xl font-bold" style={{ color: colors.warning }}>
            {sourcesHealth.summary.degraded || 0}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border" style={{ borderColor: colors.error }}>
          <p className="text-sm mb-1" style={{ color: colors.textSecondary }}>Paused</p>
          <p className="text-2xl font-bold" style={{ color: colors.error }}>
            {sourcesHealth.summary.paused || 0}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border" style={{ borderColor: colors.accent }}>
          <p className="text-sm mb-1" style={{ color: colors.textSecondary }}>Avg Health</p>
          <p className="text-2xl font-bold" style={{ color: colors.accent }}>
            {((sourcesHealth.summary.avg_health_score || 0) * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Sources Table */}
      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: colors.border }}>
        <div className="p-4 border-b" style={{ borderColor: colors.border }}>
          <h3 className="font-semibold flex items-center gap-2" style={{ color: colors.text }}>
            <Server size={18} />
            Source Status
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: colors.surface }}>
                <th className="text-left px-4 py-3 text-sm font-medium" style={{ color: colors.textSecondary }}>Source</th>
                <th className="text-center px-4 py-3 text-sm font-medium" style={{ color: colors.textSecondary }}>Status</th>
                <th className="text-center px-4 py-3 text-sm font-medium" style={{ color: colors.textSecondary }}>Health</th>
                <th className="text-center px-4 py-3 text-sm font-medium" style={{ color: colors.textSecondary }}>Success Rate</th>
                <th className="text-center px-4 py-3 text-sm font-medium" style={{ color: colors.textSecondary }}>Valid Rate</th>
                <th className="text-center px-4 py-3 text-sm font-medium" style={{ color: colors.textSecondary }}>Latency</th>
                <th className="text-center px-4 py-3 text-sm font-medium" style={{ color: colors.textSecondary }}>Drift</th>
                <th className="text-center px-4 py-3 text-sm font-medium" style={{ color: colors.textSecondary }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sourcesHealth.sources?.map((source, idx) => {
                const statusColors = {
                  active: { bg: colors.successSoft, text: colors.success },
                  degraded: { bg: colors.warningSoft, text: colors.warning },
                  paused: { bg: colors.errorSoft, text: colors.error },
                  disabled: { bg: colors.surface, text: colors.textMuted }
                };
                const sc = statusColors[source.status] || statusColors.degraded;
                const healthPct = ((source.health_score || 0) * 100).toFixed(0);
                const successPct = ((source.success_rate || 0) * 100).toFixed(0);
                const validPct = ((source.validation?.valid_rate || source.valid_rate || 0) * 100).toFixed(0);
                
                return (
                  <tr 
                    key={source.source_id} 
                    className="border-b hover:bg-gray-50 transition-colors"
                    style={{ borderColor: colors.borderLight }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: colors.accentSoft }}>
                          <Rss size={14} style={{ color: colors.accent }} />
                        </div>
                        <div>
                          <p className="font-medium text-sm" style={{ color: colors.text }}>
                            {source.source_name || source.source_id}
                          </p>
                          <p className="text-xs" style={{ color: colors.textMuted }}>
                            {source.source_id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span 
                        className="px-2 py-1 rounded-full text-xs font-medium capitalize"
                        style={{ backgroundColor: sc.bg, color: sc.text }}
                      >
                        {source.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.surface }}>
                          <div 
                            className="h-full rounded-full transition-all"
                            style={{ 
                              width: `${healthPct}%`,
                              backgroundColor: healthPct >= 80 ? colors.success : healthPct >= 50 ? colors.warning : colors.error
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium" style={{ color: colors.text }}>{healthPct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm" style={{ color: successPct >= 90 ? colors.success : successPct >= 70 ? colors.warning : colors.error }}>
                        {successPct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm" style={{ color: validPct >= 90 ? colors.success : validPct >= 70 ? colors.warning : colors.error }}>
                        {validPct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs" style={{ color: colors.textSecondary }}>
                        {(source.avg_latency_ms || source.sandbox?.avg_duration_ms || 0).toFixed(0)}ms
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {source.drift_detected ? (
                        <span className="flex items-center justify-center gap-1 text-xs" style={{ color: colors.error }}>
                          <AlertTriangle size={14} /> Drift
                        </span>
                      ) : (
                        <CheckCircle size={14} style={{ color: colors.success }} className="mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {source.status === 'paused' && (
                        <button
                          onClick={() => handleUnpauseSource(source.source_id)}
                          className="px-2 py-1 rounded text-xs font-medium transition-all hover:opacity-80"
                          style={{ backgroundColor: colors.accentSoft, color: colors.accent }}
                        >
                          <Play size={12} className="inline mr-1" />
                          Unpause
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Architecture Info */}
      <div className="bg-white rounded-2xl border p-6" style={{ borderColor: colors.border }}>
        <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: colors.text }}>
          <Shield size={18} />
          Parser Sandbox Architecture
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl" style={{ backgroundColor: colors.accentSoft }}>
            <div className="flex items-center gap-2 mb-2">
              <Box size={16} style={{ color: colors.accent }} />
              <span className="font-medium text-sm" style={{ color: colors.accent }}>Sandbox Isolation</span>
            </div>
            <p className="text-xs" style={{ color: colors.textSecondary }}>
              Each parser runs isolated with 10s timeout, 3 retries, 2MB max response
            </p>
          </div>
          <div className="p-4 rounded-xl" style={{ backgroundColor: colors.successSoft }}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={16} style={{ color: colors.success }} />
              <span className="font-medium text-sm" style={{ color: colors.success }}>Validation Layer</span>
            </div>
            <p className="text-xs" style={{ color: colors.textSecondary }}>
              Title, content, date validation with spam detection and confidence scoring
            </p>
          </div>
          <div className="p-4 rounded-xl" style={{ backgroundColor: colors.warningSoft }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} style={{ color: colors.warning }} />
              <span className="font-medium text-sm" style={{ color: colors.warning }}>Auto-Pause</span>
            </div>
            <p className="text-xs" style={{ color: colors.textSecondary }}>
              Sources with 5+ consecutive errors or health &lt;40% auto-paused for 30min
            </p>
          </div>
          <div className="p-4 rounded-xl" style={{ backgroundColor: colors.errorSoft }}>
            <div className="flex items-center gap-2 mb-2">
              <Activity size={16} style={{ color: colors.error }} />
              <span className="font-medium text-sm" style={{ color: colors.error }}>Drift Detection</span>
            </div>
            <p className="text-xs" style={{ color: colors.textSecondary }}>
              Detects parser drift when validation rate drops below 50% or confidence &lt;60%
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // NEWS SOURCES PAGE (Dedicated page for news sources management)
  // ═══════════════════════════════════════════════════════════════
  
  const renderNewsSourcesPage = () => {
    const stats = newsSources.stats || {};
    const sources = newsSources.sources || [];
    
    const tierColors = {
      A: { bg: colors.successSoft, text: colors.success, label: 'Primary' },
      B: { bg: colors.accentSoft, text: colors.accent, label: 'Secondary' },
      C: { bg: colors.warningSoft, text: colors.warning, label: 'Research' },
      D: { bg: colors.surface, text: colors.textSecondary, label: 'Aggregators' }
    };
    
    const categoryConfig = {
      news: { icon: <Newspaper size={14} />, color: colors.accent },
      research: { icon: <BookOpen size={14} />, color: '#8B5CF6' },
      official: { icon: <Shield size={14} />, color: colors.success },
      analytics: { icon: <TrendingUp size={14} />, color: '#F97316' },
      security: { icon: <AlertTriangle size={14} />, color: colors.error },
      defi: { icon: <Layers size={14} />, color: '#06B6D4' },
      dex: { icon: <Activity size={14} />, color: '#EC4899' },
      funding: { icon: <DollarSign size={14} />, color: '#10B981' },
      aggregator: { icon: <Database size={14} />, color: colors.textSecondary },
      derivatives: { icon: <BarChart2 size={14} />, color: '#F59E0B' },
      l2: { icon: <Layers size={14} />, color: '#3B82F6' },
      analysis: { icon: <Eye size={14} />, color: '#6366F1' }
    };
    
    const languageFlags = {
      en: '🇬🇧',
      ru: '🇷🇺',
      zh: '🇨🇳',
      jp: '🇯🇵',
      de: '🇩🇪',
      ua: '🇺🇦'
    };
    
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
              placeholder="Search sources by name, domain, category... (e.g. incrypted, cointelegraph, defi)"
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
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 transition-all"
              >
                <X size={16} style={{ color: colors.textMuted }} />
              </button>
            )}
          </div>
          {newsSourcesSearch && (
            <p className="mt-2 text-sm" style={{ color: colors.textSecondary }}>
              Found <span className="font-bold" style={{ color: colors.accent }}>
                {sources.filter(s => 
                  s.name?.toLowerCase().includes(newsSourcesSearch.toLowerCase()) ||
                  s.domain?.toLowerCase().includes(newsSourcesSearch.toLowerCase()) ||
                  s.category?.toLowerCase().includes(newsSourcesSearch.toLowerCase()) ||
                  s.id?.toLowerCase().includes(newsSourcesSearch.toLowerCase())
                ).length}
              </span> matching sources
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

        {/* Filters & Stats Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Language Distribution */}
          <div className="bg-white rounded-2xl border p-5" style={{ borderColor: colors.border }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: colors.text }}>
              <Globe size={18} style={{ color: colors.accent }} />
              By Language
            </h3>
            <div className="space-y-2">
              {Object.entries(stats.by_language || {}).sort((a, b) => b[1] - a[1]).map(([lang, count]) => {
                const maxCount = Math.max(...Object.values(stats.by_language || {}));
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                const isActive = newsSourcesFilter.language === lang;
                
                return (
                  <div 
                    key={lang} 
                    className="flex items-center gap-3 cursor-pointer p-2 rounded-lg transition-all hover:bg-gray-50"
                    style={{ backgroundColor: isActive ? colors.accentSoft : 'transparent' }}
                    onClick={() => setNewsSourcesFilter(prev => ({ 
                      ...prev, 
                      language: prev.language === lang ? null : lang 
                    }))}
                  >
                    <span className="text-lg">{languageFlags[lang] || '🌐'}</span>
                    <span className="text-sm w-8 uppercase font-medium" style={{ color: colors.text }}>{lang}</span>
                    <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ backgroundColor: colors.surface }}>
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: isActive ? colors.accent : colors.textMuted }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right" style={{ color: colors.text }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Distribution */}
          <div className="bg-white rounded-2xl border p-5" style={{ borderColor: colors.border }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: colors.text }}>
              <Layers size={18} style={{ color: colors.accent }} />
              By Category
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {Object.entries(stats.by_category || {}).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
                const config = categoryConfig[cat] || { icon: <Globe size={14} />, color: colors.textSecondary };
                const isActive = newsSourcesFilter.category === cat;
                
                return (
                  <div 
                    key={cat}
                    className="flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50"
                    style={{ backgroundColor: isActive ? colors.accentSoft : 'transparent' }}
                    onClick={() => setNewsSourcesFilter(prev => ({ 
                      ...prev, 
                      category: prev.category === cat ? null : cat 
                    }))}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ color: config.color }}>{config.icon}</span>
                      <span className="text-sm capitalize" style={{ color: colors.text }}>{cat}</span>
                    </div>
                    <span 
                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${config.color}20`, color: config.color }}
                    >
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Filters */}
          <div className="bg-white rounded-2xl border p-5" style={{ borderColor: colors.border }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: colors.text }}>
              <Target size={18} style={{ color: colors.accent }} />
              Active Filters
            </h3>
            <div className="space-y-3">
              {newsSourcesFilter.tier && (
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: tierColors[newsSourcesFilter.tier]?.bg }}>
                  <span className="text-sm" style={{ color: colors.text }}>Tier: {newsSourcesFilter.tier}</span>
                  <button onClick={() => setNewsSourcesFilter(prev => ({ ...prev, tier: null }))}>
                    <X size={16} style={{ color: colors.textMuted }} />
                  </button>
                </div>
              )}
              {newsSourcesFilter.language && (
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: colors.accentSoft }}>
                  <span className="text-sm" style={{ color: colors.text }}>
                    Language: {languageFlags[newsSourcesFilter.language]} {newsSourcesFilter.language.toUpperCase()}
                  </span>
                  <button onClick={() => setNewsSourcesFilter(prev => ({ ...prev, language: null }))}>
                    <X size={16} style={{ color: colors.textMuted }} />
                  </button>
                </div>
              )}
              {newsSourcesFilter.category && (
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: colors.warningSoft }}>
                  <span className="text-sm capitalize" style={{ color: colors.text }}>
                    Category: {newsSourcesFilter.category}
                  </span>
                  <button onClick={() => setNewsSourcesFilter(prev => ({ ...prev, category: null }))}>
                    <X size={16} style={{ color: colors.textMuted }} />
                  </button>
                </div>
              )}
              {!newsSourcesFilter.tier && !newsSourcesFilter.language && !newsSourcesFilter.category && (
                <p className="text-sm text-center py-4" style={{ color: colors.textMuted }}>
                  Click on any stat to filter
                </p>
              )}
              {(newsSourcesFilter.tier || newsSourcesFilter.language || newsSourcesFilter.category) && (
                <button
                  onClick={() => setNewsSourcesFilter({ tier: null, language: null, category: null })}
                  className="w-full px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
                >
                  Clear All Filters
                </button>
              )}
            </div>
            
            {/* Showing count */}
            <div className="mt-4 pt-4 border-t" style={{ borderColor: colors.border }}>
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                Showing <span className="font-bold" style={{ color: colors.accent }}>{sources.length}</span> of {stats.total || 0} sources
              </p>
            </div>
          </div>
        </div>

        {/* Sources List */}
        <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: colors.border }}>
          {/* Header */}
          <div 
            className="px-6 py-4 border-b flex items-center justify-between"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <span className="font-semibold" style={{ color: colors.text }}>
              Sources ({sources.length})
            </span>
            <div className="flex gap-2 text-xs" style={{ color: colors.textSecondary }}>
              <span>Tier</span>
              <span>•</span>
              <span>Name</span>
              <span>•</span>
              <span>Category</span>
              <span>•</span>
              <span>Language</span>
              <span>•</span>
              <span>Status</span>
            </div>
          </div>
          
          {/* List */}
          <div className="divide-y max-h-[600px] overflow-y-auto" style={{ borderColor: colors.border }}>
            {sources
              .filter(source => {
                if (!newsSourcesSearch) return true;
                const searchLower = newsSourcesSearch.toLowerCase();
                return (
                  source.name?.toLowerCase().includes(searchLower) ||
                  source.domain?.toLowerCase().includes(searchLower) ||
                  source.category?.toLowerCase().includes(searchLower) ||
                  source.id?.toLowerCase().includes(searchLower) ||
                  source.language?.toLowerCase().includes(searchLower)
                );
              })
              .map((source, idx) => {
              const tc = tierColors[source.tier] || tierColors.D;
              const catConfig = categoryConfig[source.category] || { icon: <Globe size={14} />, color: colors.textSecondary };
              
              return (
                <div 
                  key={source.id || idx}
                  className="px-6 py-4 flex items-center gap-4 transition-all hover:bg-gray-50"
                  data-testid={`source-row-${source.id}`}
                >
                  {/* Tier badge */}
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0"
                    style={{ backgroundColor: tc.bg, color: tc.text }}
                  >
                    {source.tier}
                  </div>
                  
                  {/* Name & Domain */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: colors.text }}>
                      {source.name}
                    </p>
                    <p className="text-sm truncate" style={{ color: colors.textMuted }}>
                      {source.domain}
                    </p>
                  </div>
                  
                  {/* Category */}
                  <div 
                    className="px-3 py-1.5 rounded-lg flex items-center gap-1.5 flex-shrink-0"
                    style={{ backgroundColor: `${catConfig.color}15` }}
                  >
                    <span style={{ color: catConfig.color }}>{catConfig.icon}</span>
                    <span className="text-xs font-medium capitalize" style={{ color: catConfig.color }}>
                      {source.category}
                    </span>
                  </div>
                  
                  {/* Language */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-lg">{languageFlags[source.language] || '🌐'}</span>
                    <span className="text-xs uppercase font-medium" style={{ color: colors.textSecondary }}>
                      {source.language}
                    </span>
                  </div>
                  
                  {/* Status indicator */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span 
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ 
                        backgroundColor: source.status === 'active' ? colors.success : 
                          source.status === 'degraded' ? colors.warning : colors.textMuted
                      }}
                    />
                    <span className="text-xs capitalize" style={{ color: colors.textSecondary }}>
                      {source.status || 'unknown'}
                    </span>
                  </div>
                  
                  {/* External link */}
                  <a 
                    href={`https://${source.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg transition-all hover:bg-gray-100 flex-shrink-0"
                    style={{ color: colors.textMuted }}
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
              );
            })}
            
            {sources.length === 0 && !newsSourcesLoading && (
              <div className="px-6 py-12 text-center">
                <Rss size={48} style={{ color: colors.textMuted }} className="mx-auto mb-4" />
                <p className="text-lg font-medium" style={{ color: colors.text }}>No sources found</p>
                <p className="text-sm" style={{ color: colors.textSecondary }}>Try adjusting your filters</p>
              </div>
            )}
            
            {newsSourcesLoading && (
              <div className="px-6 py-12 text-center">
                <RefreshCw size={32} className="animate-spin mx-auto mb-4" style={{ color: colors.accent }} />
                <p className="text-sm" style={{ color: colors.textSecondary }}>Loading sources...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Discovery System Dashboard
  const renderDiscoveryDashboard = () => {
    const d = discoveryDashboard || {};
    const scheduler = d.scheduler || {};
    const sources = d.sources || {};
    const endpoints = d.endpoints || {};
    const topEndpoints = d.top_endpoints || [];
    const driftAlerts = d.drift_alerts || [];
    const driftSummary = d.drift_summary || {};
    const coverage = d.coverage || {};
    const activity = d.activity || [];
    
    const severityColors = {
      critical: { bg: colors.errorSoft, text: colors.error },
      high: { bg: '#FEE2E2', text: '#DC2626' },
      medium: { bg: colors.warningSoft, text: colors.warning },
      low: { bg: colors.surface, text: colors.textSecondary }
    };
    
    const jobStatusColors = {
      active: colors.success,
      stopped: colors.error,
      delayed: colors.warning
    };
    
    return (
      <div className="space-y-6" data-testid="discovery-dashboard">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold" style={{ color: colors.text }}>
              Self-Learning Discovery System
            </h2>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Browser Discovery • Drift Detection • Endpoint Scoring • Auto Re-discovery
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => triggerManualDiscovery()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium"
              style={{ backgroundColor: colors.accentSoft, color: colors.accent }}
              data-testid="trigger-discovery-btn"
            >
              <Globe size={16} />
              Run Discovery
            </button>
            <button
              onClick={() => triggerDriftCheck()}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
              style={{ backgroundColor: colors.warningSoft, color: colors.warning }}
              data-testid="trigger-drift-btn"
            >
              <AlertTriangle size={16} />
              Check Drift
            </button>
            <button
              onClick={() => triggerScoring()}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
              style={{ backgroundColor: colors.successSoft, color: colors.success }}
              data-testid="trigger-scoring-btn"
            >
              <TrendingUp size={16} />
              Score All
            </button>
            <button
              onClick={fetchDiscoveryDashboard}
              disabled={discoveryDashboardLoading}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
              style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
            >
              <RefreshCw size={16} className={discoveryDashboardLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Row 1: Scheduler Status + Source Health */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Scheduler Status */}
          <div className="bg-white rounded-2xl border p-6" style={{ borderColor: colors.border }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2" style={{ color: colors.text }}>
                <Clock size={18} style={{ color: colors.accent }} />
                Scheduler Status
              </h3>
              <span 
                className="px-2 py-1 rounded-full text-xs font-medium"
                style={{ 
                  backgroundColor: scheduler.running ? colors.successSoft : colors.errorSoft,
                  color: scheduler.running ? colors.success : colors.error
                }}
              >
                {scheduler.running ? 'RUNNING' : 'STOPPED'}
              </span>
            </div>
            <div className="space-y-3">
              {(scheduler.jobs || []).map((job, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ backgroundColor: colors.surface }}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: jobStatusColors[job.status] || colors.textMuted }}
                    />
                    <span className="font-medium text-sm" style={{ color: colors.text }}>
                      {job.name}
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: colors.textSecondary }}>
                    {job.next_run ? new Date(job.next_run).toLocaleString() : 'N/A'}
                  </span>
                </div>
              ))}
              {(scheduler.jobs || []).length === 0 && (
                <p className="text-sm text-center py-4" style={{ color: colors.textMuted }}>
                  No scheduler jobs configured
                </p>
              )}
            </div>
          </div>

          {/* Endpoint & Source Stats */}
          <div className="bg-white rounded-2xl border p-6" style={{ borderColor: colors.border }}>
            <h3 className="font-semibold flex items-center gap-2 mb-4" style={{ color: colors.text }}>
              <Database size={18} style={{ color: colors.accent }} />
              Discovery Health
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="p-4 rounded-xl text-center" style={{ backgroundColor: colors.surface }}>
                <p className="text-2xl font-bold" style={{ color: colors.text }}>{sources.total || 0}</p>
                <p className="text-xs" style={{ color: colors.textSecondary }}>Total Sources</p>
              </div>
              <div className="p-4 rounded-xl text-center" style={{ backgroundColor: colors.successSoft }}>
                <p className="text-2xl font-bold" style={{ color: colors.success }}>{sources.active || 0}</p>
                <p className="text-xs" style={{ color: colors.textSecondary }}>Active</p>
              </div>
              <div className="p-4 rounded-xl text-center" style={{ backgroundColor: colors.warningSoft }}>
                <p className="text-2xl font-bold" style={{ color: colors.warning }}>{sources.degraded || 0}</p>
                <p className="text-xs" style={{ color: colors.textSecondary }}>Degraded</p>
              </div>
              <div className="p-4 rounded-xl text-center" style={{ backgroundColor: colors.accentSoft }}>
                <p className="text-2xl font-bold" style={{ color: colors.accent }}>{endpoints.scored || 0}</p>
                <p className="text-xs" style={{ color: colors.textSecondary }}>Scored Endpoints</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm" style={{ color: colors.textSecondary }}>
              <span>Total Endpoints: {endpoints.total || 0}</span>
              <span>Active: {endpoints.active || 0}</span>
            </div>
          </div>
        </div>

        {/* Row 2: Top Endpoints + Drift Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Endpoints */}
          <div className="bg-white rounded-2xl border p-6" style={{ borderColor: colors.border }}>
            <h3 className="font-semibold flex items-center gap-2 mb-4" style={{ color: colors.text }}>
              <TrendingUp size={18} style={{ color: colors.success }} />
              Top Endpoints by Score
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {topEndpoints.map((ep, idx) => (
                <div 
                  key={ep.id || idx}
                  className="flex items-center justify-between p-3 rounded-xl transition-all hover:shadow-sm"
                  style={{ backgroundColor: colors.surface }}
                  data-testid={`top-endpoint-${idx}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
                      style={{ 
                        backgroundColor: idx < 3 ? colors.accentSoft : colors.surface,
                        color: idx < 3 ? colors.accent : colors.textSecondary,
                        border: `1px solid ${colors.border}`
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate" style={{ color: colors.text }}>
                        {ep.domain}
                      </p>
                      <p className="text-xs truncate" style={{ color: colors.textMuted }}>
                        {ep.path}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="font-bold text-lg" style={{ color: ep.score >= 70 ? colors.success : ep.score >= 50 ? colors.warning : colors.error }}>
                        {ep.score}
                      </p>
                      <p className="text-[10px]" style={{ color: colors.textMuted }}>
                        {ep.latency_ms}ms
                      </p>
                    </div>
                    {ep.replay_ok && (
                      <CheckCircle size={16} style={{ color: colors.success }} />
                    )}
                  </div>
                </div>
              ))}
              {topEndpoints.length === 0 && (
                <p className="text-sm text-center py-8" style={{ color: colors.textMuted }}>
                  No scored endpoints yet. Run scoring to populate.
                </p>
              )}
            </div>
          </div>

          {/* Drift Alerts */}
          <div className="bg-white rounded-2xl border p-6" style={{ borderColor: colors.border }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2" style={{ color: colors.text }}>
                <AlertTriangle size={18} style={{ color: colors.warning }} />
                Drift Alerts
              </h3>
              {Object.keys(driftSummary).length > 0 && (
                <div className="flex gap-2">
                  {Object.entries(driftSummary).map(([sev, count]) => (
                    <span 
                      key={sev}
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={severityColors[sev] || severityColors.low}
                    >
                      {sev}: {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {driftAlerts.map((drift, idx) => {
                const sc = severityColors[drift.severity] || severityColors.low;
                return (
                  <div 
                    key={idx}
                    className="p-3 rounded-xl"
                    style={{ backgroundColor: sc.bg }}
                    data-testid={`drift-alert-${idx}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm" style={{ color: sc.text }}>
                        {drift.domain}
                      </span>
                      <span 
                        className="px-2 py-0.5 rounded text-xs font-medium uppercase"
                        style={{ backgroundColor: 'rgba(0,0,0,0.1)', color: sc.text }}
                      >
                        {drift.severity}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: colors.textSecondary }}>
                      {drift.type} drift detected
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: colors.textMuted }}>
                      {drift.detected_at ? new Date(drift.detected_at).toLocaleString() : ''}
                    </p>
                  </div>
                );
              })}
              {driftAlerts.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle size={32} style={{ color: colors.success }} className="mx-auto mb-2" />
                  <p className="text-sm" style={{ color: colors.success }}>No drift detected</p>
                  <p className="text-xs" style={{ color: colors.textMuted }}>All endpoints healthy</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Coverage + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Endpoint Coverage */}
          <div className="bg-white rounded-2xl border p-6" style={{ borderColor: colors.border }}>
            <h3 className="font-semibold flex items-center gap-2 mb-4" style={{ color: colors.text }}>
              <Layers size={18} style={{ color: colors.accent }} />
              Endpoint Coverage by Capability
            </h3>
            <div className="space-y-3">
              {Object.entries(coverage).slice(0, 8).map(([cap, count], idx) => {
                const maxCount = Math.max(...Object.values(coverage));
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                const capColors = {
                  market_data: colors.success,
                  defi_data: colors.accent,
                  dex_data: colors.warning,
                  funding: '#8B5CF6',
                  news: '#EC4899',
                  derivatives: '#F97316',
                  token_data: '#06B6D4',
                  onchain: '#10B981'
                };
                const barColor = capColors[cap] || colors.textSecondary;
                
                return (
                  <div key={cap} className="flex items-center gap-3">
                    <span className="text-sm w-28 truncate" style={{ color: colors.text }}>
                      {cap.replace(/_/g, ' ')}
                    </span>
                    <div className="flex-1 h-6 rounded-lg overflow-hidden" style={{ backgroundColor: colors.surface }}>
                      <div 
                        className="h-full rounded-lg transition-all flex items-center justify-end pr-2"
                        style={{ width: `${pct}%`, backgroundColor: barColor }}
                      >
                        <span className="text-xs font-medium text-white">{count}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {Object.keys(coverage).length === 0 && (
                <p className="text-sm text-center py-4" style={{ color: colors.textMuted }}>
                  No endpoint coverage data
                </p>
              )}
            </div>
          </div>

          {/* Discovery Activity */}
          <div className="bg-white rounded-2xl border p-6" style={{ borderColor: colors.border }}>
            <h3 className="font-semibold flex items-center gap-2 mb-4" style={{ color: colors.text }}>
              <Activity size={18} style={{ color: colors.accent }} />
              Recent Discovery Activity
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activity.slice(0, 15).map((log, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-3 p-2 rounded-lg"
                  style={{ backgroundColor: colors.surface }}
                >
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ 
                      backgroundColor: log.status === 'success' || log.status === 'completed' 
                        ? colors.success 
                        : log.status === 'error' ? colors.error : colors.warning
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: colors.text }}>
                      {log.domain || 'System'}
                      {log.endpoints_found > 0 && (
                        <span style={{ color: colors.success }}> (+{log.endpoints_found} endpoints)</span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: colors.textMuted }}>
                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                  </span>
                </div>
              ))}
              {activity.length === 0 && (
                <p className="text-sm text-center py-4" style={{ color: colors.textMuted }}>
                  No recent activity
                </p>
              )}
            </div>
          </div>
        </div>

        {/* News Sources Registry */}
        <div className="bg-white rounded-2xl border p-6" style={{ borderColor: colors.border }} data-testid="news-sources-registry">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Rss size={20} style={{ color: colors.accent }} />
              <span className="font-semibold" style={{ color: colors.text }}>News Sources Registry</span>
              <span 
                className="px-2 py-0.5 rounded-full text-xs"
                style={{ backgroundColor: colors.accentSoft, color: colors.accent }}
              >
                {newsSources.stats?.total || 0} sources
              </span>
            </div>
            <div className="flex gap-2">
              {/* Tier Filter */}
              <select
                value={newsSourcesFilter.tier || ''}
                onChange={(e) => setNewsSourcesFilter(prev => ({ ...prev, tier: e.target.value || null }))}
                className="px-3 py-1.5 rounded-lg text-xs"
                style={{ backgroundColor: colors.surface, color: colors.text, border: `1px solid ${colors.border}` }}
              >
                <option value="">All Tiers</option>
                <option value="A">Tier A (Primary)</option>
                <option value="B">Tier B (Secondary)</option>
                <option value="C">Tier C (Research)</option>
                <option value="D">Tier D (Aggregators)</option>
              </select>
              {/* Language Filter */}
              <select
                value={newsSourcesFilter.language || ''}
                onChange={(e) => setNewsSourcesFilter(prev => ({ ...prev, language: e.target.value || null }))}
                className="px-3 py-1.5 rounded-lg text-xs"
                style={{ backgroundColor: colors.surface, color: colors.text, border: `1px solid ${colors.border}` }}
              >
                <option value="">All Languages</option>
                <option value="en">English ({newsSources.stats?.by_language?.en || 0})</option>
                <option value="ru">Russian ({newsSources.stats?.by_language?.ru || 0})</option>
                <option value="zh">Chinese ({newsSources.stats?.by_language?.zh || 0})</option>
                <option value="jp">Japanese ({newsSources.stats?.by_language?.jp || 0})</option>
                <option value="de">German ({newsSources.stats?.by_language?.de || 0})</option>
                <option value="ua">Ukrainian ({newsSources.stats?.by_language?.ua || 0})</option>
              </select>
              {/* Category Filter */}
              <select
                value={newsSourcesFilter.category || ''}
                onChange={(e) => setNewsSourcesFilter(prev => ({ ...prev, category: e.target.value || null }))}
                className="px-3 py-1.5 rounded-lg text-xs"
                style={{ backgroundColor: colors.surface, color: colors.text, border: `1px solid ${colors.border}` }}
              >
                <option value="">All Categories</option>
                <option value="news">News ({newsSources.stats?.by_category?.news || 0})</option>
                <option value="research">Research ({newsSources.stats?.by_category?.research || 0})</option>
                <option value="official">Official ({newsSources.stats?.by_category?.official || 0})</option>
                <option value="analytics">Analytics ({newsSources.stats?.by_category?.analytics || 0})</option>
                <option value="security">Security ({newsSources.stats?.by_category?.security || 0})</option>
                <option value="defi">DeFi ({newsSources.stats?.by_category?.defi || 0})</option>
                <option value="dex">DEX ({newsSources.stats?.by_category?.dex || 0})</option>
                <option value="funding">Funding ({newsSources.stats?.by_category?.funding || 0})</option>
              </select>
              <button
                onClick={fetchNewsSources}
                disabled={newsSourcesLoading}
                className="p-1.5 rounded-lg transition-all"
                style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
              >
                <RefreshCw size={14} className={newsSourcesLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
          
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="p-3 rounded-xl text-center" style={{ backgroundColor: colors.successSoft }}>
              <p className="text-xl font-bold" style={{ color: colors.success }}>{newsSources.stats?.by_tier?.A || 0}</p>
              <p className="text-[10px]" style={{ color: colors.textSecondary }}>Tier A</p>
            </div>
            <div className="p-3 rounded-xl text-center" style={{ backgroundColor: colors.accentSoft }}>
              <p className="text-xl font-bold" style={{ color: colors.accent }}>{newsSources.stats?.by_tier?.B || 0}</p>
              <p className="text-[10px]" style={{ color: colors.textSecondary }}>Tier B</p>
            </div>
            <div className="p-3 rounded-xl text-center" style={{ backgroundColor: colors.warningSoft }}>
              <p className="text-xl font-bold" style={{ color: colors.warning }}>{newsSources.stats?.by_tier?.C || 0}</p>
              <p className="text-[10px]" style={{ color: colors.textSecondary }}>Tier C</p>
            </div>
            <div className="p-3 rounded-xl text-center" style={{ backgroundColor: colors.surface }}>
              <p className="text-xl font-bold" style={{ color: colors.textSecondary }}>{newsSources.stats?.by_tier?.D || 0}</p>
              <p className="text-[10px]" style={{ color: colors.textSecondary }}>Tier D</p>
            </div>
          </div>
          
          {/* Sources list */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {(newsSources.sources || []).map((source, idx) => {
              const tierColors = {
                A: { bg: colors.successSoft, text: colors.success },
                B: { bg: colors.accentSoft, text: colors.accent },
                C: { bg: colors.warningSoft, text: colors.warning },
                D: { bg: colors.surface, text: colors.textSecondary }
              };
              const categoryIcons = {
                news: <Newspaper size={14} />,
                research: <BookOpen size={14} />,
                official: <Shield size={14} />,
                analytics: <TrendingUp size={14} />,
                security: <AlertTriangle size={14} />,
                defi: <Layers size={14} />,
                dex: <Activity size={14} />,
                funding: <DollarSign size={14} />,
                aggregator: <Database size={14} />,
                derivatives: <BarChart2 size={14} />,
                l2: <Layers size={14} />,
                analysis: <Eye size={14} />
              };
              const tc = tierColors[source.tier] || tierColors.D;
              
              return (
                <div 
                  key={source.id || idx}
                  className="flex items-center justify-between p-3 rounded-xl transition-all hover:shadow-sm"
                  style={{ backgroundColor: colors.surface }}
                  data-testid={`news-source-${source.id}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: tc.bg }}
                    >
                      <span className="text-xs font-bold" style={{ color: tc.text }}>
                        {source.tier}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate" style={{ color: colors.text }}>
                          {source.name}
                        </span>
                        <span 
                          className="px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1"
                          style={{ backgroundColor: colors.accentSoft, color: colors.accent }}
                        >
                          {categoryIcons[source.category] || <Globe size={12} />}
                          {source.category}
                        </span>
                      </div>
                      <p className="text-xs truncate" style={{ color: colors.textMuted }}>
                        {source.domain}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span 
                      className="px-2 py-0.5 rounded text-[10px] uppercase"
                      style={{ 
                        backgroundColor: source.language === 'en' ? colors.accentSoft : colors.warningSoft,
                        color: source.language === 'en' ? colors.accent : colors.warning
                      }}
                    >
                      {source.language}
                    </span>
                    <span 
                      className={`w-2 h-2 rounded-full`}
                      style={{ 
                        backgroundColor: source.status === 'active' ? colors.success : 
                          source.status === 'degraded' ? colors.warning : colors.textMuted
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {(newsSources.sources || []).length === 0 && !newsSourcesLoading && (
              <p className="text-sm text-center py-8" style={{ color: colors.textMuted }}>
                No sources found
              </p>
            )}
          </div>
        </div>

        {/* Architecture Info */}
        <div className="bg-white rounded-2xl border p-6" style={{ borderColor: colors.border }}>
          <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: colors.text }}>
            <Shield size={18} />
            Self-Learning Discovery Architecture
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl" style={{ backgroundColor: colors.accentSoft }}>
              <div className="flex items-center gap-2 mb-2">
                <Globe size={16} style={{ color: colors.accent }} />
                <span className="font-medium text-sm" style={{ color: colors.accent }}>Browser Discovery</span>
              </div>
              <p className="text-xs" style={{ color: colors.textSecondary }}>
                Playwright intercepts XHR/Fetch/GraphQL with human-like behavior simulation
              </p>
            </div>
            <div className="p-4 rounded-xl" style={{ backgroundColor: colors.warningSoft }}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} style={{ color: colors.warning }} />
                <span className="font-medium text-sm" style={{ color: colors.warning }}>Drift Detection</span>
              </div>
              <p className="text-xs" style={{ color: colors.textSecondary }}>
                Schema, status, performance, data drift with auto re-discovery on critical
              </p>
            </div>
            <div className="p-4 rounded-xl" style={{ backgroundColor: colors.successSoft }}>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={16} style={{ color: colors.success }} />
                <span className="font-medium text-sm" style={{ color: colors.success }}>Endpoint Scoring</span>
              </div>
              <p className="text-xs" style={{ color: colors.textSecondary }}>
                5-factor scoring: Reliability, Performance, Quality, Coverage, Freshness
              </p>
            </div>
            <div className="p-4 rounded-xl" style={{ backgroundColor: '#EDE9FE' }}>
              <div className="flex items-center gap-2 mb-2">
                <Zap size={16} style={{ color: '#8B5CF6' }} />
                <span className="font-medium text-sm" style={{ color: '#8B5CF6' }}>API Replay</span>
              </div>
              <p className="text-xs" style={{ color: colors.textSecondary }}>
                Fetch data via stored blueprints (headers, cookies) without browser
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Proxy Admin Section
  const renderProxyAdmin = () => (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold" style={{ color: colors.text }}>
              Proxy Management
            </h2>
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Configure proxies for Binance, Bybit and parsers
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => startParser()}
              disabled={parserRunning || !proxyStatus?.enabled}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium"
              style={{ 
                backgroundColor: proxyStatus?.enabled ? colors.success : colors.surface, 
                color: proxyStatus?.enabled ? 'white' : colors.textMuted 
              }}
              title={proxyStatus?.enabled ? "Start sync via proxy" : "Add and enable a proxy first"}
            >
              <Play size={16} className={parserRunning ? 'animate-pulse' : ''} />
              {parserRunning ? 'Syncing...' : 'Start Sync'}
            </button>
            <button
              onClick={() => testProxies()}
              disabled={proxyLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
              style={{ backgroundColor: colors.accentSoft, color: colors.accent }}
            >
              <Wifi size={16} />
              Test
            </button>
            <button
              onClick={fetchProxyStatus}
              disabled={proxyLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
              style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
            >
              <RefreshCw size={16} className={proxyLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
        
        {/* Parser Result */}
        {parserResult && (
          <div 
            className="rounded-2xl p-4 border"
            style={{ 
              borderColor: parserResult.ok ? colors.success : colors.error,
              backgroundColor: parserResult.ok ? colors.successSoft : colors.errorSoft 
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              {parserResult.ok ? (
                <CheckCircle size={20} style={{ color: colors.success }} />
              ) : (
                <XCircle size={20} style={{ color: colors.error }} />
              )}
              <span className="font-medium" style={{ color: parserResult.ok ? colors.success : colors.error }}>
                {parserResult.ok ? 'Sync Completed' : 'Sync Failed'}
              </span>
            </div>
            {parserResult.synced && (
              <div className="grid grid-cols-3 gap-4 mt-3">
                {Object.entries(parserResult.synced).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <span className="font-medium capitalize">{key}: </span>
                    <span style={{ color: colors.textSecondary }}>
                      {typeof value === 'object' ? (value.total || value.error || JSON.stringify(value)) : value}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {parserResult.error && (
              <p className="text-sm mt-2" style={{ color: colors.error }}>{parserResult.error}</p>
            )}
          </div>
        )}
        
        {/* Add Proxy Form */}
        <div 
          className="bg-white rounded-2xl border p-6"
          style={{ borderColor: colors.border }}
        >
          <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: colors.text }}>
            <Plus size={18} />
            Add Proxy
          </h3>
          
          {/* Row 1: Type, Host, Port */}
          <div className="grid grid-cols-6 gap-4 mb-4">
            <div className="relative">
              <label className="text-sm mb-1 block" style={{ color: colors.textSecondary }}>
                Type *
              </label>
              <div 
                onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                className="w-full px-4 py-2 rounded-xl border cursor-pointer flex items-center justify-between"
                style={{ borderColor: colors.border, backgroundColor: 'white' }}
              >
                <span style={{ color: colors.text }}>
                  {proxyTypes.find(t => t.value === newProxy.type)?.label}
                </span>
                <ChevronRight 
                  size={16} 
                  style={{ 
                    color: colors.textMuted,
                    transform: typeDropdownOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }} 
                />
              </div>
              {typeDropdownOpen && (
                <div 
                  className="absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-lg z-50 overflow-hidden"
                  style={{ backgroundColor: 'white', borderColor: colors.border }}
                >
                  {proxyTypes.map((type) => (
                    <div
                      key={type.value}
                      onClick={() => {
                        setNewProxy({...newProxy, type: type.value});
                        setTypeDropdownOpen(false);
                      }}
                      className="px-4 py-2.5 cursor-pointer transition-all flex items-center gap-2"
                      style={{ 
                        backgroundColor: newProxy.type === type.value ? colors.accentSoft : 'white',
                        color: newProxy.type === type.value ? colors.accent : colors.text
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = colors.surface}
                      onMouseLeave={(e) => e.target.style.backgroundColor = newProxy.type === type.value ? colors.accentSoft : 'white'}
                    >
                      {newProxy.type === type.value && (
                        <CheckCircle size={14} style={{ color: colors.accent }} />
                      )}
                      <span className="font-medium">{type.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="col-span-3">
              <label className="text-sm mb-1 block" style={{ color: colors.textSecondary }}>
                IP Address / Host *
              </label>
              <input
                type="text"
                value={newProxy.host}
                onChange={(e) => setNewProxy({...newProxy, host: e.target.value})}
                placeholder="192.168.1.1 или proxy.example.com"
                className="w-full px-4 py-2 rounded-xl border"
                style={{ borderColor: colors.border }}
              />
            </div>
            <div>
              <label className="text-sm mb-1 block" style={{ color: colors.textSecondary }}>
                Port *
              </label>
              <input
                type="text"
                value={newProxy.port}
                onChange={(e) => setNewProxy({...newProxy, port: e.target.value})}
                placeholder="8080"
                className="w-full px-4 py-2 rounded-xl border"
                style={{ borderColor: colors.border }}
              />
            </div>
            <div>
              <label className="text-sm mb-1 block" style={{ color: colors.textSecondary }}>
                Priority
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={newProxy.priority}
                onChange={(e) => setNewProxy({...newProxy, priority: parseInt(e.target.value) || 1})}
                className="w-full px-4 py-2 rounded-xl border"
                style={{ borderColor: colors.border }}
              />
            </div>
          </div>
          
          {/* Row 2: Username, Password, Add Button */}
          <div className="grid grid-cols-6 gap-4">
            <div className="col-span-2">
              <label className="text-sm mb-1 block" style={{ color: colors.textSecondary }}>
                Username (если требуется)
              </label>
              <input
                type="text"
                value={newProxy.username}
                onChange={(e) => setNewProxy({...newProxy, username: e.target.value})}
                placeholder="optional"
                className="w-full px-4 py-2 rounded-xl border"
                style={{ borderColor: colors.border }}
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm mb-1 block" style={{ color: colors.textSecondary }}>
                Password (если требуется)
              </label>
              <input
                type="password"
                value={newProxy.password}
                onChange={(e) => setNewProxy({...newProxy, password: e.target.value})}
                placeholder="optional"
                className="w-full px-4 py-2 rounded-xl border"
                style={{ borderColor: colors.border }}
              />
            </div>
            <div className="col-span-2 flex items-end">
              <button
                onClick={addProxy}
                disabled={proxyLoading || !newProxy.host || !newProxy.port}
                className="w-full flex items-center justify-center gap-2 px-6 py-2 rounded-xl font-medium transition-all"
                style={{ 
                  backgroundColor: (newProxy.host && newProxy.port) ? colors.accent : colors.surface, 
                  color: (newProxy.host && newProxy.port) ? 'white' : colors.textMuted 
                }}
              >
                <Plus size={16} />
                Add Proxy
              </button>
            </div>
          </div>
          
          {/* Preview */}
          {newProxy.host && newProxy.port && (
            <div 
              className="mt-4 p-3 rounded-xl text-sm"
              style={{ backgroundColor: colors.surface }}
            >
              <span style={{ color: colors.textSecondary }}>Preview: </span>
              <code style={{ color: colors.accent }}>
                {buildProxyServer()}
                {newProxy.username && ` (auth: ${newProxy.username}:***)`}
              </code>
            </div>
          )}
        </div>
        
        {/* Proxy List */}
        <div 
          className="bg-white rounded-2xl border p-6"
          style={{ borderColor: colors.border }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2" style={{ color: colors.text }}>
              <Network size={18} />
              Configured Proxies
            </h3>
            {proxyStatus?.total > 0 && (
              <button
                onClick={clearAllProxies}
                className="text-sm px-3 py-1 rounded-lg"
                style={{ backgroundColor: colors.errorSoft, color: colors.error }}
              >
                Clear All
              </button>
            )}
          </div>
          
          {!proxyStatus || proxyStatus.total === 0 ? (
            <div className="text-center py-8">
              <Wifi size={48} className="mx-auto mb-4" style={{ color: colors.textMuted }} />
              <p className="font-medium" style={{ color: colors.text }}>No proxies configured</p>
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                Add a proxy above to route Binance/Bybit traffic
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {proxyStatus.proxies?.map((proxy) => (
                <div 
                  key={proxy.id}
                  className="flex items-center justify-between p-4 rounded-xl border"
                  style={{ 
                    borderColor: proxy.enabled ? colors.border : colors.errorSoft,
                    backgroundColor: proxy.enabled ? 'white' : colors.surface
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ 
                        backgroundColor: proxy.enabled ? colors.successSoft : colors.errorSoft 
                      }}
                    >
                      {proxy.enabled ? (
                        <CheckCircle size={20} style={{ color: colors.success }} />
                      ) : (
                        <XCircle size={20} style={{ color: colors.error }} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: colors.text }}>
                        {proxy.server}
                        {proxy.has_auth && (
                          <span 
                            className="ml-2 text-xs px-2 py-0.5 rounded"
                            style={{ backgroundColor: colors.warningSoft, color: colors.warning }}
                          >
                            Auth
                          </span>
                        )}
                      </p>
                      <p className="text-sm" style={{ color: colors.textSecondary }}>
                        Priority: {proxy.priority} • 
                        Success: {proxy.success_count} • 
                        Errors: {proxy.error_count}
                        {proxy.last_error && (
                          <span style={{ color: colors.error }}> • Last error: {proxy.last_error.slice(0, 50)}...</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startParser(proxy.id)}
                      disabled={parserRunning || !proxy.enabled}
                      className="p-2 rounded-lg transition-all"
                      style={{ backgroundColor: proxy.enabled ? colors.successSoft : colors.surface }}
                      title={proxy.enabled ? "Start sync via this proxy" : "Enable proxy first"}
                    >
                      <Play size={16} style={{ color: proxy.enabled ? colors.success : colors.textMuted }} />
                    </button>
                    <button
                      onClick={() => testProxies(proxy.id)}
                      className="p-2 rounded-lg transition-all"
                      style={{ backgroundColor: colors.accentSoft }}
                      title="Test this proxy"
                    >
                      <Wifi size={16} style={{ color: colors.accent }} />
                    </button>
                    <button
                      onClick={() => toggleProxy(proxy.id, proxy.enabled)}
                      className="p-2 rounded-lg transition-all"
                      style={{ backgroundColor: proxy.enabled ? colors.warningSoft : colors.successSoft }}
                      title={proxy.enabled ? 'Disable' : 'Enable'}
                    >
                      {proxy.enabled ? (
                        <XCircle size={16} style={{ color: colors.warning }} />
                      ) : (
                        <CheckCircle size={16} style={{ color: colors.success }} />
                      )}
                    </button>
                    <button
                      onClick={() => removeProxy(proxy.id)}
                      className="p-2 rounded-lg transition-all"
                      style={{ backgroundColor: colors.errorSoft }}
                      title="Remove"
                    >
                      <Trash2 size={16} style={{ color: colors.error }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Test Results */}
        {testResults && (
          <div 
            className="bg-white rounded-2xl border p-6"
            style={{ borderColor: colors.border }}
          >
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: colors.text }}>
              <Activity size={18} />
              Test Results
            </h3>
            <div className="space-y-4">
              {testResults.results?.map((result, i) => (
                <div key={i} className="border rounded-xl p-4" style={{ borderColor: colors.border }}>
                  <p className="font-medium mb-2" style={{ color: colors.text }}>
                    Proxy #{result.id}: {result.server}
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    {result.tests?.map((test, j) => (
                      <div 
                        key={j}
                        className="p-3 rounded-lg"
                        style={{ 
                          backgroundColor: test.success ? colors.successSoft : colors.errorSoft 
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {test.success ? (
                            <CheckCircle size={16} style={{ color: colors.success }} />
                          ) : (
                            <XCircle size={16} style={{ color: colors.error }} />
                          )}
                          <span className="font-medium">{test.target}</span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: colors.textSecondary }}>
                          Status: {test.status}
                          {test.error && ` - ${test.error.slice(0, 40)}...`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Info Box */}
        <div 
          className="rounded-2xl p-6"
          style={{ backgroundColor: colors.accentSoft }}
        >
          <h4 className="font-medium mb-2" style={{ color: colors.accent }}>
            How Proxy Failover Works
          </h4>
          <ul className="text-sm space-y-1" style={{ color: colors.text }}>
            <li>• Proxies are used in priority order (1 = highest)</li>
            <li>• If primary proxy fails, system automatically switches to next</li>
            <li>• Binance and Bybit require proxy due to IP restrictions</li>
            <li>• CryptoRank parser also uses configured proxies</li>
          </ul>
        </div>
      </div>
    );

  // API Keys Admin Section
  const renderApiKeysAdmin = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: colors.text }}>
            API Keys Management
          </h2>
          <p className="text-sm" style={{ color: colors.textSecondary }}>
            Manage API keys for CoinGecko, CoinMarketCap, Messari and more
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={checkAllKeysHealth}
            disabled={apiKeysLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
            style={{ backgroundColor: colors.successSoft, color: colors.success }}
          >
            <Activity size={16} />
            Check All
          </button>
          <button
            onClick={fetchApiKeys}
            disabled={apiKeysLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
            style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
          >
            <RefreshCw size={16} className={apiKeysLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Service Summary Cards - Click to filter */}
      <div className="grid grid-cols-3 gap-4">
        {apiKeysData.services?.map(service => {
          const summary = apiKeysData.summary[service.id] || {};
          const isSelected = apiKeyServiceFilter === service.id;
          return (
            <div 
              key={service.id}
              onClick={() => setApiKeyServiceFilter(isSelected ? null : service.id)}
              className="bg-white rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-md"
              style={{ 
                borderColor: isSelected ? colors.accent : colors.border,
                borderWidth: isSelected ? '2px' : '1px',
                backgroundColor: isSelected ? colors.accentSoft : 'white'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium" style={{ color: colors.text }}>{service.name}</span>
                {summary.healthy_keys > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-xs" 
                    style={{ backgroundColor: colors.successSoft, color: colors.success }}>
                    {summary.healthy_keys} OK
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs" 
                    style={{ backgroundColor: colors.surface, color: colors.textMuted }}>
                    No keys
                  </span>
                )}
              </div>
              <div className="text-xs space-y-1" style={{ color: colors.textSecondary }}>
                <p>Keys: {summary.total_keys || 0} ({summary.enabled_keys || 0} enabled)</p>
                <p>Requests today: {summary.requests_today || 0}</p>
                <p>Rate limit: {service.free_rate_limit}/{service.rate_limit_window || 'min'}
                  {service.pro_rate_limit && ` → ${service.pro_rate_limit} (Pro)`}
                </p>
                {service.description && (
                  <p className="text-xs italic" style={{ color: colors.textMuted }}>
                    {service.description.substring(0, 60)}...
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between mt-2">
                {isSelected && (
                  <span className="text-xs font-medium" style={{ color: colors.accent }}>
                    Filtering
                  </span>
                )}
                {service.docs_url && (
                  <a 
                    href={service.docs_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs flex items-center gap-1 hover:underline"
                    style={{ color: colors.accent }}
                  >
                    Get Key <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add API Key Form */}
      <div 
        className="bg-white rounded-2xl border p-6"
        style={{ borderColor: colors.border }}
      >
        <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: colors.text }}>
          <Plus size={18} />
          Add API Key
        </h3>
        
        <div className="grid grid-cols-6 gap-4 mb-4">
          {/* Service selector */}
          <div className="relative col-span-2">
            <label className="text-sm mb-1 block" style={{ color: colors.textSecondary }}>
              Service *
            </label>
            <div 
              onClick={() => setApiKeyServiceDropdown(!apiKeyServiceDropdown)}
              className="w-full px-4 py-2 rounded-xl border cursor-pointer flex items-center justify-between"
              style={{ borderColor: colors.border, backgroundColor: 'white' }}
            >
              <span style={{ color: colors.text }}>
                {apiKeysData.services?.find(s => s.id === newApiKey.service)?.name || newApiKey.service}
              </span>
              <ChevronRight 
                size={16} 
                style={{ 
                  color: colors.textMuted,
                  transform: apiKeyServiceDropdown ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }} 
              />
            </div>
            {apiKeyServiceDropdown && (
              <div 
                className="absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-lg z-50 overflow-hidden max-h-60 overflow-y-auto"
                style={{ backgroundColor: 'white', borderColor: colors.border }}
              >
                {apiKeysData.services?.map((service) => (
                  <div
                    key={service.id}
                    onClick={() => {
                      setNewApiKey({...newApiKey, service: service.id});
                      setApiKeyServiceDropdown(false);
                    }}
                    className="px-4 py-2.5 cursor-pointer transition-all flex items-center gap-2"
                    style={{ 
                      backgroundColor: newApiKey.service === service.id ? colors.accentSoft : 'white',
                      color: newApiKey.service === service.id ? colors.accent : colors.text
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = colors.surface}
                    onMouseLeave={(e) => e.target.style.backgroundColor = newApiKey.service === service.id ? colors.accentSoft : 'white'}
                  >
                    {newApiKey.service === service.id && (
                      <CheckCircle size={14} style={{ color: colors.accent }} />
                    )}
                    <span className="font-medium">{service.name}</span>
                    {service.key_required && (
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: colors.warningSoft, color: colors.warning }}>
                        Key required
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* API Key input */}
          <div className="col-span-3">
            <label className="text-sm mb-1 block" style={{ color: colors.textSecondary }}>
              API Key *
            </label>
            <input
              type="text"
              value={newApiKey.api_key}
              onChange={(e) => setNewApiKey({...newApiKey, api_key: e.target.value})}
              placeholder="Enter your API key"
              className="w-full px-4 py-2 rounded-xl border"
              style={{ borderColor: colors.border }}
            />
          </div>
          
          {/* Pro checkbox */}
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newApiKey.is_pro}
                onChange={(e) => setNewApiKey({...newApiKey, is_pro: e.target.checked})}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm" style={{ color: colors.textSecondary }}>Pro tier</span>
            </label>
          </div>
        </div>
        
        <div className="grid grid-cols-6 gap-4">
          {/* Name */}
          <div className="col-span-2">
            <label className="text-sm mb-1 block" style={{ color: colors.textSecondary }}>
              Friendly Name (optional)
            </label>
            <input
              type="text"
              value={newApiKey.name}
              onChange={(e) => setNewApiKey({...newApiKey, name: e.target.value})}
              placeholder="e.g. My CoinGecko Key #1"
              className="w-full px-4 py-2 rounded-xl border"
              style={{ borderColor: colors.border }}
            />
          </div>
          
          {/* Proxy Binding */}
          <div className="col-span-2">
            <label className="text-sm mb-1 block" style={{ color: colors.textSecondary }}>
              Bind to Proxy (optional)
            </label>
            <select
              value={newApiKey.proxy_id || ''}
              onChange={(e) => setNewApiKey({...newApiKey, proxy_id: e.target.value || null})}
              className="w-full px-4 py-2 rounded-xl border"
              style={{ borderColor: colors.border }}
            >
              <option value="">Direct (no proxy)</option>
              {proxyStatus?.proxies?.filter(p => p.enabled).map(proxy => (
                <option key={proxy.id} value={proxy.id}>
                  {proxy.server} (Priority: {proxy.priority})
                </option>
              ))}
            </select>
          </div>
          
          {/* Add button */}
          <div className="col-span-2 flex items-end">
            <button
              onClick={addApiKey}
              disabled={!newApiKey.api_key || apiKeysLoading}
              className="w-full py-2 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
              style={{ 
                backgroundColor: newApiKey.api_key ? colors.accent : colors.surface, 
                color: newApiKey.api_key ? 'white' : colors.textMuted 
              }}
            >
              <Plus size={16} />
              Add API Key
            </button>
          </div>
        </div>
      </div>

      {/* API Keys List */}
      <div 
        className="bg-white rounded-2xl border p-6"
        style={{ borderColor: colors.border }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2" style={{ color: colors.text }}>
            <Shield size={18} />
            Configured API Keys ({apiKeyServiceFilter 
              ? apiKeysData.keys?.filter(k => k.service === apiKeyServiceFilter).length 
              : apiKeysData.keys?.length || 0})
          </h3>
          {apiKeyServiceFilter && (
            <button
              onClick={() => setApiKeyServiceFilter(null)}
              className="text-sm px-3 py-1 rounded-lg transition-all"
              style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
            >
              Show All Keys
            </button>
          )}
        </div>
        
        {(() => {
          const filteredKeys = apiKeyServiceFilter 
            ? apiKeysData.keys?.filter(k => k.service === apiKeyServiceFilter) 
            : apiKeysData.keys;
          
          if (!filteredKeys || filteredKeys.length === 0) {
            return (
              <div className="text-center py-8" style={{ color: colors.textSecondary }}>
                <Shield size={48} className="mx-auto mb-4 opacity-30" />
                <p>{apiKeyServiceFilter ? `No ${apiKeyServiceFilter} keys configured` : 'No API keys configured yet'}</p>
                <p className="text-sm">Add keys above to enable load-balanced API requests</p>
              </div>
            );
          }
          
          return (
            <div className="space-y-3">
              {filteredKeys.map((key) => (
              <div 
                key={key.id}
                className="border rounded-xl p-4 transition-all hover:shadow-md"
                style={{ 
                  borderColor: key.healthy ? colors.border : colors.error,
                  backgroundColor: !key.enabled ? colors.surface : 'white'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: key.healthy ? colors.successSoft : colors.errorSoft }}
                    >
                      {key.healthy ? (
                        <CheckCircle size={20} style={{ color: colors.success }} />
                      ) : (
                        <AlertTriangle size={20} style={{ color: colors.error }} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium flex items-center gap-2 flex-wrap" style={{ color: colors.text }}>
                        {key.name}
                        <span className="text-xs px-2 py-0.5 rounded-full" 
                          style={{ backgroundColor: colors.accentSoft, color: colors.accent }}>
                          {key.service}
                        </span>
                        {key.is_pro && (
                          <span className="text-xs px-2 py-0.5 rounded-full" 
                            style={{ backgroundColor: colors.warningSoft, color: colors.warning }}>
                            PRO
                          </span>
                        )}
                        {key.proxy_id && (
                          <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1" 
                            style={{ backgroundColor: colors.successSoft, color: colors.success }}>
                            <Server size={10} />
                            {proxyStatus?.proxies?.find(p => p.id === key.proxy_id)?.server || key.proxy_id}
                          </span>
                        )}
                        {!key.enabled && (
                          <span className="text-xs px-2 py-0.5 rounded-full" 
                            style={{ backgroundColor: colors.surface, color: colors.textMuted }}>
                            Disabled
                          </span>
                        )}
                      </p>
                      <p className="text-sm" style={{ color: colors.textSecondary }}>
                        Key: {key.api_key_masked} • 
                        Requests: {key.requests_total || 0} total, {key.requests_today || 0} today
                        {key.last_error_message && (
                          <span style={{ color: colors.error }}> • Error: {key.last_error_message.slice(0, 40)}...</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Usage indicator */}
                    <div className="text-right mr-4">
                      <div className="text-xs mb-1" style={{ color: colors.textSecondary }}>
                        {key.requests_this_minute || 0}/{key.rate_limit || 30} this min
                      </div>
                      <div className="w-24 h-2 rounded-full overflow-hidden" style={{ backgroundColor: colors.surface }}>
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${Math.min(100, ((key.requests_this_minute || 0) / (key.rate_limit || 30)) * 100)}%`,
                            backgroundColor: ((key.requests_this_minute || 0) / (key.rate_limit || 30)) > 0.8 
                              ? colors.warning 
                              : colors.success
                          }}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => checkApiKeyHealth(key.id)}
                      className="p-2 rounded-lg transition-all"
                      style={{ backgroundColor: colors.accentSoft }}
                      title="Test this key"
                    >
                      <Activity size={16} style={{ color: colors.accent }} />
                    </button>
                    <button
                      onClick={() => toggleApiKey(key.id, !key.enabled)}
                      className="p-2 rounded-lg transition-all"
                      style={{ backgroundColor: key.enabled ? colors.warningSoft : colors.successSoft }}
                      title={key.enabled ? 'Disable' : 'Enable'}
                    >
                      {key.enabled ? (
                        <XCircle size={16} style={{ color: colors.warning }} />
                      ) : (
                        <CheckCircle size={16} style={{ color: colors.success }} />
                      )}
                    </button>
                    <button
                      onClick={() => removeApiKey(key.id)}
                      className="p-2 rounded-lg transition-all"
                      style={{ backgroundColor: colors.errorSoft }}
                      title="Remove"
                    >
                      <Trash2 size={16} style={{ color: colors.error }} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          );
        })()}
      </div>

      {/* Info Box */}
      <div 
        className="rounded-2xl p-6"
        style={{ backgroundColor: colors.accentSoft }}
      >
        <h4 className="font-medium mb-2" style={{ color: colors.accent }}>
          How API Key Load Balancing Works
        </h4>
        <ul className="text-sm space-y-1" style={{ color: colors.text }}>
          <li>• Multiple keys per service distribute requests to avoid rate limits</li>
          <li>• Keys with most remaining capacity are used first (smart rotation)</li>
          <li>• Unhealthy keys are automatically skipped after 3 consecutive errors</li>
          <li>• Counters reset: per-minute automatically, per-day at midnight UTC</li>
          <li>• Free tier limits: CoinGecko 30/min, CoinMarketCap 333/day, Messari 20/min</li>
        </ul>
      </div>
    </div>
  );

  // Main content router
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return renderDashboard();
      case 'feed': return renderFeed();
      case 'explorer': return renderExplorer();
      case 'discovery': return renderDiscovery();
      case 'news-sources': return renderNewsSourcesPage();
      case 'api': return renderApiDocs();
      case 'admin': return renderAdmin();
      case 'graph': return renderGraph();
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

export default App;
