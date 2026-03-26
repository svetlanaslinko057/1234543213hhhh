import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, Database, TrendingUp, Server, RefreshCw, CheckCircle, 
  AlertCircle, XCircle, Zap, Clock, BarChart3, Layers, Box, Bell
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Status badge - consistent with Observability
const StatusBadge = ({ status }) => {
  const configs = {
    healthy: { bg: '#dcfce7', color: '#16a34a', icon: CheckCircle, label: 'Healthy' },
    degraded: { bg: '#fef3c7', color: '#d97706', icon: AlertCircle, label: 'Degraded' },
    down: { bg: '#fee2e2', color: '#dc2626', icon: XCircle, label: 'Down' },
    unknown: { bg: '#f3f4f6', color: '#6b7280', icon: Clock, label: 'Unknown' }
  };
  
  const config = configs[status] || configs.unknown;
  const Icon = config.icon;
  
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '4px 10px',
      borderRadius: '9999px',
      backgroundColor: config.bg,
      color: config.color,
      fontSize: '12px',
      fontWeight: 500
    }}>
      <Icon size={12} />
      {config.label}
    </span>
  );
};

// Metric card - white background style
const MetricCard = ({ title, value, subtitle, icon: Icon, color = '#4f46e5' }) => (
  <div style={{
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ color: '#64748b', fontSize: '13px', marginBottom: '8px' }}>{title}</div>
        <div style={{ fontSize: '28px', fontWeight: 600, color: '#0f172a' }}>{value}</div>
        {subtitle && (
          <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>{subtitle}</div>
        )}
      </div>
      <div style={{
        width: '44px',
        height: '44px',
        borderRadius: '10px',
        backgroundColor: `${color}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={22} style={{ color }} />
      </div>
    </div>
  </div>
);

// Section card - white background
const SectionCard = ({ title, icon: Icon, children, headerRight }) => (
  <div style={{
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
  }}>
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      marginBottom: '16px' 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          backgroundColor: '#4f46e515',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon size={18} style={{ color: '#4f46e5' }} />
        </div>
        <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '15px' }}>{title}</span>
      </div>
      {headerRight}
    </div>
    {children}
  </div>
);

// Source Health Card
function SourceHealthCard({ source }) {
  const formatScore = (score) => {
    if (score === null || score === undefined) return '-';
    return (score * 100).toFixed(0) + '%';
  };

  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Server size={16} style={{ color: '#4f46e5' }} />
          <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>
            {source.source_id}
          </span>
        </div>
        <StatusBadge status={source.status} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {[
          { label: 'Reliability', value: source.reliability_score },
          { label: 'Latency', value: source.latency_score },
          { label: 'Freshness', value: source.freshness_score },
          { label: 'Final', value: source.final_score, highlight: true }
        ].map((item, i) => (
          <div key={i} style={{
            textAlign: 'center',
            padding: '10px 8px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px'
          }}>
            <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '4px' }}>
              {item.label}
            </div>
            <div style={{ 
              fontWeight: 600, 
              fontSize: '15px',
              color: item.highlight ? '#4f46e5' : '#0f172a'
            }}>
              {formatScore(item.value)}
            </div>
          </div>
        ))}
      </div>

      {source.capabilities && source.capabilities.length > 0 && (
        <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {source.capabilities.map((cap, i) => (
            <span key={i} style={{
              padding: '3px 8px',
              borderRadius: '4px',
              backgroundColor: '#f1f5f9',
              color: '#64748b',
              fontSize: '11px'
            }}>
              {cap}
            </span>
          ))}
        </div>
      )}

      <div style={{ 
        marginTop: '12px', 
        paddingTop: '12px',
        borderTop: '1px solid #f1f5f9',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '12px',
        color: '#94a3b8'
      }}>
        <span>Fetches: {source.total_fetches || 0}</span>
        {source.avg_latency_ms > 0 && <span>Avg: {source.avg_latency_ms?.toFixed(0)}ms</span>}
      </div>
    </div>
  );
}

// Entity Momentum Card - improved design
function EntityMomentumCard({ entityKey, momentum }) {
  const getMomentumColor = (score) => {
    if (score >= 70) return '#16a34a';
    if (score >= 40) return '#d97706';
    return '#64748b';
  };

  const entityName = entityKey?.split(':')[1]?.toUpperCase() || entityKey;

  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '16px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <TrendingUp size={16} style={{ color: '#4f46e5' }} />
          <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>
            {entityName}
          </span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 10px',
          borderRadius: '6px',
          backgroundColor: `${getMomentumColor(momentum.momentum_score)}15`,
          color: getMomentumColor(momentum.momentum_score),
          fontWeight: 600,
          fontSize: '14px'
        }}>
          <Zap size={14} />
          {momentum.momentum_score?.toFixed(0) || 0}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        <div style={{ textAlign: 'center', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
          <div style={{ color: '#64748b', fontSize: '10px' }}>Total</div>
          <div style={{ fontWeight: 600, fontSize: '16px', color: '#0f172a' }}>
            {momentum.total_events || 0}
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
          <div style={{ color: '#64748b', fontSize: '10px' }}>Recent (7d)</div>
          <div style={{ fontWeight: 600, fontSize: '16px', color: '#0f172a' }}>
            {momentum.recent_events_7d || 0}
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
          <div style={{ color: '#64748b', fontSize: '10px' }}>Period</div>
          <div style={{ fontWeight: 600, fontSize: '16px', color: '#0f172a' }}>
            {momentum.period_days || 30}d
          </div>
        </div>
      </div>

      {/* Mini chart - only show if enough data points */}
      {momentum.timeline && momentum.timeline.length >= 3 ? (
        <div style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'end', gap: '2px', height: '32px' }}>
            {momentum.timeline.slice(-14).map((t, i) => {
              const maxCount = Math.max(...momentum.timeline.map(x => x.count), 1);
              const height = Math.max((t.count / maxCount) * 100, 8);
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${height}%`,
                    backgroundColor: '#4f46e5',
                    borderRadius: '2px',
                    opacity: 0.7 + (i / 14) * 0.3
                  }}
                  title={`${t.date?.split('T')[0]}: ${t.count} events`}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ 
          marginTop: '12px', 
          padding: '8px', 
          backgroundColor: '#f1f5f9', 
          borderRadius: '6px',
          textAlign: 'center',
          color: '#64748b',
          fontSize: '11px'
        }}>
          Collecting trend data...
        </div>
      )}
    </div>
  );
}

// Graph Layers Stats
function GraphLayersStats({ stats }) {
  const totalEdges = (stats?.factual?.edge_count || 0) + 
                     (stats?.derived?.edge_count || 0) + 
                     (stats?.intelligence?.edge_count || 0);

  const layers = [
    { name: 'Factual', count: stats?.factual?.edge_count || 0, color: '#3b82f6', types: stats?.factual?.relation_types || [] },
    { name: 'Derived', count: stats?.derived?.edge_count || 0, color: '#8b5cf6', types: stats?.derived?.relation_types || ['coinvested_with'] },
    { name: 'Intelligence', count: stats?.intelligence?.edge_count || 0, color: '#f59e0b', types: stats?.intelligence?.relation_types || ['event_linked'] }
  ];

  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '16px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: '#4f46e515',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Layers size={18} style={{ color: '#4f46e5' }} />
          </div>
          <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '15px' }}>Graph Layers</span>
        </div>
        <span style={{ color: '#64748b', fontSize: '13px' }}>{totalEdges} total edges</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {layers.map((layer, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: layer.color
                }} />
                <span style={{ color: '#374151', fontSize: '13px', fontWeight: 500 }}>{layer.name}</span>
              </div>
              <span style={{ color: layer.color, fontWeight: 600, fontSize: '14px' }}>{layer.count}</span>
            </div>
            <div style={{
              height: '6px',
              backgroundColor: '#f1f5f9',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${totalEdges > 0 ? (layer.count / totalEdges) * 100 : 0}%`,
                backgroundColor: layer.color,
                borderRadius: '3px',
                transition: 'width 0.3s'
              }} />
            </div>
            <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {layer.types.slice(0, 4).map((type, j) => (
                <span key={j} style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: `${layer.color}15`,
                  color: layer.color,
                  fontSize: '10px'
                }}>
                  {type}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Alerts Section
function AlertsSection({ alertStats }) {
  if (!alertStats || alertStats.active_alerts === 0) return null;
  
  return (
    <div style={{
      backgroundColor: '#fef2f2',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '24px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        backgroundColor: '#fee2e2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Bell size={20} style={{ color: '#dc2626' }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: '#dc2626', fontSize: '15px' }}>
          {alertStats.active_alerts} Active Alert{alertStats.active_alerts !== 1 ? 's' : ''}
        </div>
        <div style={{ color: '#991b1b', fontSize: '13px', marginTop: '2px' }}>
          {alertStats.critical > 0 && `${alertStats.critical} critical`}
          {alertStats.critical > 0 && alertStats.warning > 0 && ', '}
          {alertStats.warning > 0 && `${alertStats.warning} warning`}
        </div>
      </div>
      <button
        onClick={() => window.location.href = '/alerts'}
        style={{
          padding: '8px 16px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: '#dc2626',
          color: '#fff',
          fontWeight: 500,
          fontSize: '13px',
          cursor: 'pointer'
        }}
      >
        View Alerts
      </button>
    </div>
  );
}

// Main Architecture Page
export default function ArchitecturePage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [sources, setSources] = useState([]);
  const [momentumEntities, setMomentumEntities] = useState([]);
  const [rebuilding, setRebuilding] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const statsRes = await fetch(`${API_URL}/api/architecture/stats`);
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      const sourcesRes = await fetch(`${API_URL}/api/architecture/sources/reliability`);
      if (sourcesRes.ok) {
        const data = await sourcesRes.json();
        setSources(data.sources || []);
      }

      const topEntities = ['btc', 'eth', 'sol', 'arb', 'op'];
      const momentumPromises = topEntities.map(async (entity) => {
        const res = await fetch(`${API_URL}/api/architecture/events/entity/project/${entity}/momentum?days=30`);
        if (res.ok) return res.json();
        return { entity_key: `project:${entity}`, total_events: 0, momentum_score: 0 };
      });
      
      const momentumResults = await Promise.all(momentumPromises);
      setMomentumEntities(momentumResults);

    } catch (error) {
      console.error('Error fetching architecture data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRebuildProjections = async () => {
    setRebuilding(true);
    try {
      await fetch(`${API_URL}/api/architecture/graph/projection/rebuild`, { method: 'POST' });
      await fetchData();
    } catch (error) {
      console.error('Error rebuilding projections:', error);
    } finally {
      setRebuilding(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '400px' 
      }}>
        <RefreshCw size={24} style={{ color: '#4f46e5', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const projStats = stats?.graph_projection || {};
  const registryStats = stats?.event_registry || {};
  const reliabilityStats = stats?.source_reliability || {};

  return (
    <div style={{ padding: '24px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            Graph Projection, Event Registry, Source Reliability
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={fetchData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#fff',
              color: '#374151',
              fontWeight: 500,
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            onClick={handleRebuildProjections}
            disabled={rebuilding}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#4f46e5',
              color: '#fff',
              fontWeight: 500,
              fontSize: '14px',
              cursor: rebuilding ? 'not-allowed' : 'pointer',
              opacity: rebuilding ? 0.7 : 1
            }}
          >
            <RefreshCw size={16} style={{ animation: rebuilding ? 'spin 1s linear infinite' : 'none' }} />
            {rebuilding ? 'Rebuilding...' : 'Rebuild Projections'}
          </button>
        </div>
      </div>

      {/* Alerts Section */}
      <AlertsSection alertStats={stats?.alerts} />

      {/* Overview Stats - Top Row */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: '16px',
        marginBottom: '24px'
      }}>
        <MetricCard
          title="Projections"
          value={projStats.total_projections || 0}
          subtitle={`${projStats.fresh || 0} fresh, TTL ${projStats.ttl_minutes || 30}min`}
          icon={Database}
          color="#4f46e5"
        />
        <MetricCard
          title="Cached Nodes"
          value={projStats.total_nodes_cached || 0}
          subtitle={`Avg ${projStats.avg_nodes?.toFixed(1) || 0} per projection`}
          icon={Box}
          color="#3b82f6"
        />
        <MetricCard
          title="Event Links"
          value={registryStats.total_links || 0}
          subtitle={`${registryStats.unique_entities || 0} entities, ${registryStats.unique_events || 0} events`}
          icon={Activity}
          color="#8b5cf6"
        />
        <MetricCard
          title="Sources"
          value={reliabilityStats.total_sources || 0}
          subtitle={`${reliabilityStats.healthy || 0} healthy, ${reliabilityStats.down || 0} down`}
          icon={Server}
          color="#16a34a"
        />
      </div>

      {/* Graph Layers */}
      <div style={{ marginBottom: '24px' }}>
        <GraphLayersStats stats={stats?.graph_layers} />
      </div>

      {/* Source Health Section */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          marginBottom: '16px' 
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', margin: 0 }}>
            Source Health
          </h2>
          <span style={{ color: '#64748b', fontSize: '13px' }}>
            ({reliabilityStats.healthy || 0} healthy, {reliabilityStats.degraded || 0} degraded, {reliabilityStats.down || 0} down)
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {sources.map((source) => (
            <SourceHealthCard key={source.source_id} source={source} />
          ))}
        </div>
      </div>

      {/* Entity Momentum Section */}
      <div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          marginBottom: '16px' 
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', margin: 0 }}>
            Entity Momentum
          </h2>
          <span style={{ color: '#64748b', fontSize: '13px' }}>(30 day activity)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
          {momentumEntities.map((momentum) => (
            <EntityMomentumCard 
              key={momentum.entity_key} 
              entityKey={momentum.entity_key}
              momentum={momentum}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
