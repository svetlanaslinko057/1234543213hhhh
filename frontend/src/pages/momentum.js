import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Activity, Zap, Users, 
  Building, User, ArrowUpRight, RefreshCw, BarChart3,
  Target, Flame, Bell, Network, AlertTriangle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Design colors (matching App.js)
const colors = {
  background: '#ffffff',
  surface: '#f7f8fb',
  surfaceHover: '#f0f2f5',
  border: '#e7e9ee',
  borderLight: '#f0f2f5',
  text: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  accent: '#6366f1',
  accentHover: '#4f46e5',
  accentLight: '#e0e7ff',
  success: '#10b981',
  successLight: '#d1fae5',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  danger: '#ef4444',
  dangerLight: '#fee2e2',
};

const MomentumPage = () => {
  const [stats, setStats] = useState(null);
  const [topMomentum, setTopMomentum] = useState([]);
  const [fastestGrowing, setFastestGrowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('all');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [graphGrowth, setGraphGrowth] = useState(null);
  const [alerts, setAlerts] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, topRes, fastRes, growthRes, alertsRes] = await Promise.all([
        fetch(`${API_URL}/api/momentum/stats`),
        fetch(`${API_URL}/api/momentum/top?limit=20`),
        fetch(`${API_URL}/api/momentum/fastest-growing?limit=10`),
        fetch(`${API_URL}/api/graph/metrics/growth`),
        fetch(`${API_URL}/api/alerts/momentum?limit=10`)
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (topRes.ok) {
        const topData = await topRes.json();
        setTopMomentum(topData.entities || []);
      }

      if (fastRes.ok) {
        const fastData = await fastRes.json();
        setFastestGrowing(fastData.entities || []);
      }

      if (growthRes.ok) {
        const growthData = await growthRes.json();
        setGraphGrowth(growthData);
      }

      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData.alerts || []);
      }

      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to fetch momentum data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getTypeIcon = (type) => {
    switch (type) {
      case 'project': return <Building size={14} />;
      case 'fund': return <Users size={14} />;
      case 'person': return <User size={14} />;
      case 'exchange': return <BarChart3 size={14} />;
      default: return <Activity size={14} />;
    }
  };

  const getMomentumColor = (score) => {
    if (score >= 70) return colors.success;
    if (score >= 50) return colors.accent;
    if (score >= 30) return colors.warning;
    return colors.textMuted;
  };

  const getVelocityColor = (velocity) => {
    if (velocity > 5) return colors.success;
    if (velocity > 0) return colors.accent;
    if (velocity < -5) return colors.danger;
    return colors.textMuted;
  };

  const filteredTop = selectedType === 'all' 
    ? topMomentum 
    : topMomentum.filter(e => e.entity_type === selectedType);

  return (
    <div className="p-6" style={{ backgroundColor: colors.surface, minHeight: '100vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: colors.text }}>
            <Flame className="text-orange-500" /> Entity Momentum Engine
          </h1>
          <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
            Tracking structural influence across the crypto ecosystem
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs" style={{ color: colors.textMuted }}>
              Updated: {lastUpdated}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            style={{ 
              backgroundColor: colors.accent, 
              color: 'white',
              opacity: loading ? 0.7 : 1
            }}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div 
            className="rounded-xl p-4"
            style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Activity size={18} style={{ color: colors.accent }} />
              <span className="text-sm font-medium" style={{ color: colors.textSecondary }}>
                Entities Tracked
              </span>
            </div>
            <p className="text-3xl font-bold" style={{ color: colors.text }}>
              {stats.total_tracked}
            </p>
          </div>

          <div 
            className="rounded-xl p-4"
            style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap size={18} style={{ color: colors.success }} />
              <span className="text-sm font-medium" style={{ color: colors.textSecondary }}>
                High Momentum (&gt;50)
              </span>
            </div>
            <p className="text-3xl font-bold" style={{ color: colors.success }}>
              {stats.high_momentum}
            </p>
          </div>

          <div 
            className="rounded-xl p-4"
            style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={18} style={{ color: colors.accent }} />
              <span className="text-sm font-medium" style={{ color: colors.textSecondary }}>
                Growing Entities
              </span>
            </div>
            <p className="text-3xl font-bold" style={{ color: colors.accent }}>
              {stats.growing}
            </p>
          </div>

          <div 
            className="rounded-xl p-4"
            style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Target size={18} style={{ color: colors.warning }} />
              <span className="text-sm font-medium" style={{ color: colors.textSecondary }}>
                Avg Project Score
              </span>
            </div>
            <p className="text-3xl font-bold" style={{ color: colors.warning }}>
              {stats.by_type?.project?.avg_momentum?.toFixed(1) || '0'}
            </p>
          </div>
        </div>
      )}

      {/* By Type Breakdown */}
      {stats?.by_type && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {Object.entries(stats.by_type).map(([type, data]) => (
            <div
              key={type}
              className="rounded-xl p-4 cursor-pointer transition-all hover:shadow-md"
              style={{ 
                backgroundColor: selectedType === type ? colors.accentLight : colors.background,
                border: `1px solid ${selectedType === type ? colors.accent : colors.border}`
              }}
              onClick={() => setSelectedType(selectedType === type ? 'all' : type)}
            >
              <div className="flex items-center gap-2 mb-2">
                {getTypeIcon(type)}
                <span className="text-sm font-medium capitalize" style={{ color: colors.textSecondary }}>
                  {type}s
                </span>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-2xl font-bold" style={{ color: colors.text }}>
                    {data.count}
                  </p>
                  <p className="text-xs" style={{ color: colors.textMuted }}>
                    entities
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold" style={{ color: getMomentumColor(data.avg_momentum) }}>
                    {data.avg_momentum?.toFixed(1)}
                  </p>
                  <p className="text-xs" style={{ color: colors.textMuted }}>
                    avg score
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Graph Growth & Alerts Row */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Graph Growth */}
        {graphGrowth?.current && (
          <div 
            className="rounded-xl p-4"
            style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}
          >
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: colors.text }}>
              <Network size={16} style={{ color: colors.accent }} />
              Knowledge Graph
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xl font-bold" style={{ color: colors.text }}>
                  {graphGrowth.current.nodes}
                </p>
                <p className="text-xs" style={{ color: colors.textMuted }}>Nodes</p>
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: colors.accent }}>
                  {graphGrowth.current.edges_total}
                </p>
                <p className="text-xs" style={{ color: colors.textMuted }}>Edges</p>
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: colors.success }}>
                  {graphGrowth.current.avg_degree}
                </p>
                <p className="text-xs" style={{ color: colors.textMuted }}>Avg Degree</p>
              </div>
            </div>
            {graphGrowth.growth_7d && (
              <div className="mt-3 pt-3 border-t flex gap-4" style={{ borderColor: colors.border }}>
                <div className="flex items-center gap-1">
                  <TrendingUp size={12} style={{ color: colors.success }} />
                  <span className="text-xs" style={{ color: colors.textMuted }}>
                    +{graphGrowth.growth_7d.nodes} nodes (7d)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp size={12} style={{ color: colors.success }} />
                  <span className="text-xs" style={{ color: colors.textMuted }}>
                    +{graphGrowth.growth_7d.edges} edges (7d)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Momentum Alerts */}
        <div 
          className="rounded-xl p-4"
          style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}
        >
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: colors.text }}>
            <Bell size={16} style={{ color: colors.warning }} />
            Recent Alerts
          </h3>
          {alerts.length > 0 ? (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {alerts.slice(0, 5).map((alert, idx) => (
                <div 
                  key={alert.alert_id || idx}
                  className="flex items-center justify-between p-2 rounded-lg text-sm"
                  style={{ backgroundColor: colors.surface }}
                >
                  <div className="flex items-center gap-2">
                    {alert.alert_type === 'spike_up' ? (
                      <TrendingUp size={14} style={{ color: colors.success }} />
                    ) : alert.alert_type === 'spike_down' ? (
                      <TrendingDown size={14} style={{ color: colors.danger }} />
                    ) : (
                      <AlertTriangle size={14} style={{ color: colors.warning }} />
                    )}
                    <span style={{ color: colors.text }}>
                      {alert.data?.entity_id || alert.entity_key?.split(':')[1]}
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: colors.textMuted }}>
                    {alert.alert_type?.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4" style={{ color: colors.textMuted }}>
              <Bell size={24} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No active alerts</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Top Momentum */}
        <div 
          className="rounded-xl p-5"
          style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: colors.text }}>
            <Flame size={20} className="text-orange-500" />
            Top Momentum Entities
            {selectedType !== 'all' && (
              <span 
                className="text-xs px-2 py-1 rounded-full ml-2 capitalize"
                style={{ backgroundColor: colors.accentLight, color: colors.accent }}
              >
                {selectedType}
              </span>
            )}
          </h2>
          
          <div className="space-y-2">
            {filteredTop.slice(0, 15).map((entity, idx) => (
              <div
                key={entity.entity_key}
                className="flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-gray-50"
                style={{ backgroundColor: idx % 2 === 0 ? colors.surface : 'transparent' }}
              >
                <div className="flex items-center gap-3">
                  <span 
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ 
                      backgroundColor: idx < 3 ? colors.warningLight : colors.surface,
                      color: idx < 3 ? colors.warning : colors.textMuted
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    {getTypeIcon(entity.entity_type)}
                    <span className="font-medium" style={{ color: colors.text }}>
                      {entity.entity_id}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p 
                      className="font-bold text-lg"
                      style={{ color: getMomentumColor(entity.momentum_score) }}
                    >
                      {entity.momentum_score?.toFixed(1)}
                    </p>
                  </div>
                  {entity.momentum_velocity !== 0 && (
                    <div 
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                      style={{ 
                        backgroundColor: entity.momentum_velocity > 0 ? colors.successLight : colors.dangerLight,
                        color: entity.momentum_velocity > 0 ? colors.success : colors.danger
                      }}
                    >
                      {entity.momentum_velocity > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {Math.abs(entity.momentum_velocity).toFixed(1)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fastest Growing */}
        <div 
          className="rounded-xl p-5"
          style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}
        >
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: colors.text }}>
            <TrendingUp size={20} style={{ color: colors.success }} />
            Fastest Growing (Rising Stars)
          </h2>
          
          <div className="space-y-2">
            {fastestGrowing.map((entity, idx) => (
              <div
                key={entity.entity_key}
                className="flex items-center justify-between p-3 rounded-lg transition-colors hover:bg-gray-50"
                style={{ backgroundColor: idx % 2 === 0 ? colors.surface : 'transparent' }}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: colors.successLight }}
                  >
                    <ArrowUpRight size={16} style={{ color: colors.success }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(entity.entity_type)}
                      <span className="font-medium" style={{ color: colors.text }}>
                        {entity.entity_id}
                      </span>
                    </div>
                    <span className="text-xs capitalize" style={{ color: colors.textMuted }}>
                      {entity.entity_type}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div 
                    className="flex items-center gap-1 text-lg font-bold"
                    style={{ color: colors.success }}
                  >
                    <TrendingUp size={16} />
                    +{entity.momentum_velocity?.toFixed(1)}
                  </div>
                  <p className="text-xs" style={{ color: colors.textMuted }}>
                    Score: {entity.momentum_score?.toFixed(1)}
                  </p>
                </div>
              </div>
            ))}

            {fastestGrowing.length === 0 && (
              <div className="text-center py-8" style={{ color: colors.textMuted }}>
                <Activity size={32} className="mx-auto mb-2 opacity-50" />
                <p>No growing entities detected yet</p>
                <p className="text-xs mt-1">Check back after more data accumulates</p>
              </div>
            )}
          </div>

          {/* Signal Weights */}
          <div className="mt-6 pt-4 border-t" style={{ borderColor: colors.border }}>
            <h3 className="text-sm font-medium mb-3" style={{ color: colors.textSecondary }}>
              Momentum Signal Weights
            </h3>
            <div className="space-y-2">
              {stats?.weights && Object.entries(stats.weights).map(([signal, weight]) => (
                <div key={signal} className="flex items-center gap-2">
                  <div 
                    className="h-2 rounded-full"
                    style={{ 
                      width: `${weight * 100}%`,
                      backgroundColor: colors.accent,
                      minWidth: '20px'
                    }}
                  />
                  <span className="text-xs capitalize" style={{ color: colors.textMuted }}>
                    {signal.replace('_', ' ')} ({(weight * 100).toFixed(0)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MomentumPage;
