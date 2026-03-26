import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

// Import shared components and hooks
import { Layout } from './shared/components';
import { colors } from './shared/constants';
import { useWebSocket } from './shared/hooks';
import { API_URL } from './shared/constants';

// Import existing page components
import ForceGraphViewer from './components/ForceGraphViewer';
import GraphExplorer from './components/GraphExplorer';
import ObservabilityDashboard from './components/ObservabilityDashboard';
import ArchitecturePage from './pages/architecture';
import MomentumPage from './pages/momentum';
import NarrativeDominanceDashboard from './components/NarrativeDominanceDashboard';

// Import legacy App for remaining features (will be gradually migrated)
import { 
  useDashboardData,
  DashboardContent,
  FeedContent,
  DiscoveryContent,
  AdminContent,
  ApiDocsContent,
  NewsSourcesContent
} from './AppLegacy';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [newsSources, setNewsSources] = useState({ stats: { total: 0 } });
  
  // WebSocket for real-time updates
  const { isConnected: wsConnected, breakingNews, clearBreakingNews } = useWebSocket('all');
  
  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/health`).then(r => r.json()).catch(() => ({})),
        fetch(`${API_URL}/api/intel/stats`).then(r => r.json()).catch(() => ({})),
      ]);
      setStats({ health: healthRes, intel: statsRes });
    } catch (e) {
      console.error('Failed to fetch dashboard data:', e);
    }
    setLoading(false);
  }, []);

  // Fetch news sources count
  const fetchNewsSourcesCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/news/sources/stats`);
      const data = await res.json();
      setNewsSources({ stats: data });
    } catch (e) {
      console.error('Failed to fetch news sources:', e);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    fetchNewsSourcesCount();
  }, [fetchDashboardData, fetchNewsSourcesCount]);

  // Render content based on active tab
  const renderContent = () => {
    // Standalone page components (already extracted)
    switch (activeTab) {
      case 'observability':
        return <ObservabilityDashboard />;
      case 'architecture':
        return <ArchitecturePage />;
      case 'momentum':
        return <MomentumPage />;
      case 'narratives':
        return <NarrativeDominanceDashboard />;
      case 'graph':
        return <GraphExplorer colors={colors} />;
      default:
        // For tabs not yet extracted, show loading or placeholder
        return (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="animate-spin mx-auto mb-4" size={32} style={{ color: colors.accent }} />
              <p style={{ color: colors.textSecondary }}>Loading {activeTab}...</p>
            </div>
          </div>
        );
    }
  };

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      newsSourcesCount={newsSources.stats?.total || 0}
      wsConnected={wsConnected}
      breakingNews={breakingNews}
      clearBreakingNews={clearBreakingNews}
      loading={loading}
      onRefresh={fetchDashboardData}
    >
      {loading && !stats ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin" size={32} style={{ color: colors.accent }} />
        </div>
      ) : (
        renderContent()
      )}
    </Layout>
  );
}

export default App;
