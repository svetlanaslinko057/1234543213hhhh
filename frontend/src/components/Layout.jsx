import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  BarChart3, Radio, GitBranch, Globe, Rss, FileText, Settings 
} from 'lucide-react';
import { colors } from '../constants/colors';

const NAV_ITEMS = [
  { section: 'Overview', items: [
    { path: '/', icon: BarChart3, label: 'Dashboard' },
    { path: '/feed', icon: Radio, label: 'Intel Feed', badge: 'Live' },
    { path: '/graph', icon: GitBranch, label: 'Graph' },
  ]},
  { section: 'Explorer', items: [
    { path: '/discovery', icon: Globe, label: 'Discovery' },
    { path: '/news-sources', icon: Rss, label: 'News Sources' },
  ]},
  { section: 'Developer', items: [
    { path: '/api-docs', icon: FileText, label: 'API Docs' },
  ]},
  { section: 'System', items: [
    { path: '/admin', icon: Settings, label: 'Admin' },
  ]},
];

function NavItem({ path, icon: Icon, label, badge }) {
  return (
    <NavLink
      to={path}
      data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
      className={({ isActive }) => 
        `w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all ${isActive ? 'font-medium' : ''}`
      }
      style={({ isActive }) => ({
        backgroundColor: isActive ? colors.accentSoft : 'transparent',
        color: isActive ? colors.accent : colors.textSecondary
      })}
    >
      <div className="flex items-center gap-3">
        <Icon size={20} />
        <span>{label}</span>
      </div>
      {badge && (
        <span 
          className="px-2 py-0.5 text-xs rounded-full font-medium"
          style={{ backgroundColor: colors.accent, color: 'white' }}
        >
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export default function Layout({ children, wsConnected }) {
  const location = useLocation();
  
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return { title: 'Dashboard', subtitle: 'System overview and metrics' };
      case '/feed': return { title: 'Intel Feed', subtitle: 'Real-time crypto intelligence stream' };
      case '/graph': return { title: 'Entity Graph', subtitle: 'Interactive entity relationship visualization' };
      case '/discovery': return { title: 'Discovery', subtitle: 'Find data across the network' };
      case '/news-sources': return { title: 'News Sources', subtitle: 'Manage and monitor news sources' };
      case '/api-docs': return { title: 'API Documentation', subtitle: 'Complete API reference' };
      case '/admin': return { title: 'System Admin', subtitle: 'Manage proxies, API keys and providers' };
      default: return { title: 'FOMO', subtitle: 'Crypto Intelligence Terminal' };
    }
  };
  
  const { title, subtitle } = getPageTitle();

  return (
    <div 
      data-testid="intel-dashboard"
      className="min-h-screen flex"
      style={{ backgroundColor: colors.surface }}
    >
      {/* Sidebar */}
      <aside 
        className="w-64 border-r p-6 flex flex-col sticky top-0 h-screen"
        style={{ backgroundColor: colors.background, borderColor: colors.border }}
      >
        {/* Logo */}
        <div className="mb-8">
          <img src="/logo.svg" alt="FOMO" style={{ height: '46px', width: 'auto' }} />
          <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
            Crypto Intelligence Terminal
          </p>
        </div>

        {/* Navigation */}
        <nav className="space-y-1 flex-1 overflow-y-auto">
          {NAV_ITEMS.map(({ section, items }) => (
            <div key={section}>
              <p className="text-xs font-medium uppercase tracking-wider mt-6 mb-3 px-4 first:mt-0" 
                 style={{ color: colors.textMuted }}>
                {section}
              </p>
              {items.map(item => (
                <NavItem key={item.path} {...item} />
              ))}
            </div>
          ))}
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
        {/* WebSocket Status */}
        <div 
          className="fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium shadow-lg z-50"
          style={{ 
            backgroundColor: wsConnected ? '#ecfdf5' : '#fef2f2',
            color: wsConnected ? '#059669' : '#dc2626',
            border: `1px solid ${wsConnected ? '#10b981' : '#ef4444'}`
          }}
        >
          <span 
            className={`w-2 h-2 rounded-full ${wsConnected ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: wsConnected ? '#10b981' : '#ef4444' }} 
          />
          {wsConnected ? 'Live' : 'Offline'}
        </div>

        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: colors.text }}>{title}</h1>
            <p style={{ color: colors.textSecondary }}>{subtitle}</p>
          </div>
        </header>

        {/* Page Content */}
        {children}
      </main>
    </div>
  );
}
