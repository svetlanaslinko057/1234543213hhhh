import React from 'react';
import { 
  BarChart3, Radio, GitBranch, Globe, Rss, FileText, 
  Activity, Cpu, Zap, Target, Settings, Bell, X, RefreshCw
} from 'lucide-react';
import { NavItem } from './NavItem';
import { colors } from '../constants';

export function Layout({ 
  children, 
  activeTab, 
  setActiveTab, 
  newsSourcesCount = 0,
  wsConnected = false,
  breakingNews = null,
  clearBreakingNews,
  loading = false,
  onRefresh,
  headerTitle,
  headerSubtitle
}) {
  // Tab title mapping
  const tabTitles = {
    api: 'API Documentation',
    feed: 'Intel Feed',
    admin: 'System Admin',
    'news-sources': 'News Sources',
    graph: 'Entity Graph',
    dashboard: 'Dashboard',
    discovery: 'Discovery',
    observability: 'Observability',
    architecture: 'Architecture',
    momentum: 'Momentum',
    narratives: 'Narratives'
  };

  const tabSubtitles = {
    dashboard: 'System overview and metrics',
    feed: 'Real-time crypto intelligence stream',
    explorer: 'Browse and search intel data',
    discovery: 'Find data across the network',
    'news-sources': 'Manage and monitor news sources',
    developer: 'System status and configuration',
    api: 'Complete API reference',
    admin: 'Manage proxies, API keys and providers',
    graph: 'Interactive entity relationship visualization'
  };

  const displayTitle = headerTitle || tabTitles[activeTab] || activeTab;
  const displaySubtitle = headerSubtitle || tabSubtitles[activeTab] || '';

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
          />
          <NavItem 
            icon={Rss} 
            label="News Sources" 
            active={activeTab === 'news-sources'}
            onClick={() => setActiveTab('news-sources')}
            badge={newsSourcesCount > 0 ? `${newsSourcesCount}` : undefined}
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
          />
          <NavItem 
            icon={Cpu} 
            label="Architecture" 
            active={activeTab === 'architecture'}
            onClick={() => setActiveTab('architecture')}
          />
          <NavItem 
            icon={Zap} 
            label="Momentum" 
            active={activeTab === 'momentum'}
            onClick={() => setActiveTab('momentum')}
          />
          <NavItem 
            icon={Target} 
            label="Narratives" 
            active={activeTab === 'narratives'}
            onClick={() => setActiveTab('narratives')}
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
                    clearBreakingNews?.();
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
              {displayTitle}
            </h1>
            <p style={{ color: colors.textSecondary }}>
              {displaySubtitle}
            </p>
          </div>
          {onRefresh && (
            <button
              data-testid="refresh-btn"
              onClick={onRefresh}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border transition-all hover:shadow-md"
              style={{ borderColor: colors.border, color: colors.text }}
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          )}
        </header>

        {/* Content */}
        {children}
      </main>
    </div>
  );
}
