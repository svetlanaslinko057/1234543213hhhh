import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, Server, Database, AlertTriangle, CheckCircle, XCircle,
  RefreshCw, Clock, TrendingUp, TrendingDown, Minus, BarChart2,
  Zap, Bell, Shield, Radio, Layers, Box, AlertCircle
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Health status badge
const StatusBadge = ({ status }) => {
  const configs = {
    healthy: { bg: '#dcfce7', color: '#16a34a', icon: CheckCircle, label: 'Healthy' },
    degraded: { bg: '#fef3c7', color: '#d97706', icon: AlertTriangle, label: 'Degraded' },
    unhealthy: { bg: '#fee2e2', color: '#dc2626', icon: AlertCircle, label: 'Unhealthy' },
    offline: { bg: '#f3f4f6', color: '#6b7280', icon: XCircle, label: 'Offline' }
  };
  
  const config = configs[status] || configs.offline;
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

// Metric card
const MetricCard = ({ title, value, subtitle, icon: Icon, trend, color = '#4f46e5' }) => (
  <div style={{
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #e7e9ee',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
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
    {trend !== undefined && (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '4px', 
        marginTop: '12px',
        color: trend > 0 ? '#16a34a' : trend < 0 ? '#dc2626' : '#64748b',
        fontSize: '12px'
      }}>
        {trend > 0 ? <TrendingUp size={14} /> : trend < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
        <span>{trend > 0 ? '+' : ''}{trend}% from last hour</span>
      </div>
    )}
  </div>
);

// Alert item
const AlertItem = ({ alert, onResolve }) => {
  const severityColors = {
    critical: { bg: '#fee2e2', border: '#fca5a5', color: '#dc2626' },
    warning: { bg: '#fef3c7', border: '#fcd34d', color: '#d97706' },
    info: { bg: '#dbeafe', border: '#93c5fd', color: '#2563eb' }
  };
  
  const config = severityColors[alert.severity] || severityColors.info;
  
  return (
    <div style={{
      backgroundColor: config.bg,
      border: `1px solid ${config.border}`,
      borderRadius: '8px',
      padding: '12px 16px',
      marginBottom: '8px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            marginBottom: '4px'
          }}>
            <AlertTriangle size={14} style={{ color: config.color }} />
            <span style={{ fontWeight: 600, color: config.color, fontSize: '13px' }}>
              {alert.alert_type?.toUpperCase().replace('_', ' ')}
            </span>
          </div>
          <div style={{ color: '#374151', fontSize: '14px', fontWeight: 500 }}>
            {alert.title}
          </div>
          <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>
            {alert.description}
          </div>
          <div style={{ color: '#9ca3af', fontSize: '11px', marginTop: '6px' }}>
            Source: {alert.source_name} • {new Date(alert.detected_at).toLocaleString()}
          </div>
        </div>
        {onResolve && (
          <button
            onClick={() => onResolve(alert.id)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: '#fff',
              color: '#374151',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Resolve
          </button>
        )}
      </div>
    </div>
  );
};

// Source health row
const SourceHealthRow = ({ source }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: '1fr 100px 100px 100px 120px',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '13px'
  }}>
    <div style={{ fontWeight: 500, color: '#0f172a' }}>{source.source_name}</div>
    <div><StatusBadge status={source.status} /></div>
    <div style={{ color: '#64748b' }}>
      {(source.success_rate_24h * 100).toFixed(1)}%
    </div>
    <div style={{ color: '#64748b' }}>
      {source.avg_latency_ms?.toFixed(0) || 0}ms
    </div>
    <div style={{ color: '#94a3b8', fontSize: '11px' }}>
      {source.last_check ? new Date(source.last_check).toLocaleTimeString() : '-'}
    </div>
  </div>
);

// Queue stats panel
const QueueStatsPanel = ({ stats }) => {
  if (!stats) return null;
  
  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '12px',
      border: '1px solid #e7e9ee',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #f3f4f6',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <Layers size={18} style={{ color: '#4f46e5' }} />
        <span style={{ fontWeight: 600, color: '#0f172a' }}>Queue Status</span>
      </div>
      
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>Active Jobs</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#0f172a' }}>
              {stats.active_jobs || 0}
            </div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>Completed (24h)</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#16a34a' }}>
              {stats.completed_24h || 0}
            </div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>Failed (24h)</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#dc2626' }}>
              {stats.failed_24h || 0}
            </div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>Dead Letter</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#d97706' }}>
              {stats.dead_letter_count || 0}
            </div>
          </div>
        </div>
        
        {stats.avg_processing_time_ms > 0 && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
            <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>
              Avg Processing Time
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>
                {stats.avg_processing_time_ms.toFixed(0)}
              </span>
              <span style={{ color: '#64748b', fontSize: '12px' }}>ms</span>
            </div>
          </div>
        )}
        
        {stats.queue_depths && Object.keys(stats.queue_depths).length > 0 && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
            <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>
              Queue Depths
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(stats.queue_depths).map(([queue, depth]) => (
                <span key={queue} style={{
                  padding: '4px 10px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: '#374151'
                }}>
                  {queue}: {depth}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Feed stats panel
const FeedStatsPanel = ({ stats }) => {
  if (!stats) return null;
  
  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '12px',
      border: '1px solid #e7e9ee',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #f3f4f6',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <Radio size={18} style={{ color: '#4f46e5' }} />
        <span style={{ fontWeight: 600, color: '#0f172a' }}>Feed Projection</span>
      </div>
      
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>Hot Cards</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#0f172a' }}>
              {stats.hot_cards || 0}
            </div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>Archive Cards</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#64748b' }}>
              {stats.archive_cards || 0}
            </div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>Total</div>
            <div style={{ fontSize: '24px', fontWeight: 600, color: '#4f46e5' }}>
              {stats.total_cards || 0}
            </div>
          </div>
        </div>
        
        {stats.priority_distribution && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
            <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>
              Priority Distribution
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              {Object.entries(stats.priority_distribution).map(([priority, count]) => (
                <div key={priority} style={{ textAlign: 'center' }}>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: 600,
                    color: priority === 'breaking' ? '#dc2626' : 
                           priority === 'high' ? '#d97706' : '#0f172a'
                  }}>
                    {count}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'capitalize' }}>
                    {priority}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Main Observability Dashboard
const ObservabilityDashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [sources, setSources] = useState([]);
  const [queueStats, setQueueStats] = useState(null);
  const [feedStats, setFeedStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [dashboardRes, alertsRes, sourcesRes, queueRes] = await Promise.all([
        fetch(`${API_URL}/api/enhanced/health/dashboard`).then(r => r.json()).catch(() => null),
        fetch(`${API_URL}/api/enhanced/alerts?limit=20`).then(r => r.json()).catch(() => ({ alerts: [] })),
        fetch(`${API_URL}/api/enhanced/health/sources`).then(r => r.json()).catch(() => ({ sources: [] })),
        fetch(`${API_URL}/api/enhanced/queue/stats`).then(r => r.json()).catch(() => null)
      ]);

      if (dashboardRes) setDashboard(dashboardRes);
      if (alertsRes?.alerts) setAlerts(alertsRes.alerts);
      if (sourcesRes?.sources) setSources(sourcesRes.sources);
      if (queueRes) setQueueStats(queueRes);
      
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to fetch observability data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleResolveAlert = async (alertId) => {
    try {
      await fetch(`${API_URL}/api/enhanced/alerts/${alertId}/resolve`, { method: 'POST' });
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  const sourceHealth = dashboard?.source_health || {};
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
  const warningAlerts = alerts.filter(a => a.severity === 'warning').length;

  return (
    <div style={{ 
      padding: '24px',
      backgroundColor: '#f7f8fb',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{ 
            fontSize: '24px', 
            fontWeight: 700, 
            color: '#0f172a',
            margin: 0 
          }}>
            System Observability
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0' }}>
            Monitor system health, queues, and data pipelines
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastRefresh && (
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              backgroundColor: '#4f46e5',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(5, 1fr)', 
        gap: '16px',
        marginBottom: '24px'
      }}>
        <MetricCard
          title="Healthy Sources"
          value={sourceHealth.healthy || 0}
          subtitle={`of ${sourceHealth.total || 0} total`}
          icon={CheckCircle}
          color="#16a34a"
        />
        <MetricCard
          title="Degraded Sources"
          value={sourceHealth.degraded || 0}
          icon={AlertTriangle}
          color="#d97706"
        />
        <MetricCard
          title="Offline Sources"
          value={(sourceHealth.offline || 0) + (sourceHealth.unhealthy || 0)}
          icon={XCircle}
          color="#dc2626"
        />
        <MetricCard
          title="Critical Alerts"
          value={criticalAlerts}
          subtitle={`${warningAlerts} warnings`}
          icon={Bell}
          color="#dc2626"
        />
        <MetricCard
          title="Active Jobs"
          value={queueStats?.active_jobs || 0}
          subtitle={`${queueStats?.completed_24h || 0} completed today`}
          icon={Activity}
          color="#4f46e5"
        />
      </div>

      {/* Main Content Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 400px', 
        gap: '24px' 
      }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Alerts */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            border: '1px solid #e7e9ee',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Bell size={18} style={{ color: '#dc2626' }} />
                <span style={{ fontWeight: 600, color: '#0f172a' }}>Active Alerts</span>
                {alerts.length > 0 && (
                  <span style={{
                    padding: '2px 8px',
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 600
                  }}>
                    {alerts.length}
                  </span>
                )}
              </div>
            </div>
            
            <div style={{ padding: '16px 20px', maxHeight: '400px', overflowY: 'auto' }}>
              {alerts.length > 0 ? (
                alerts.map(alert => (
                  <AlertItem 
                    key={alert.id} 
                    alert={alert} 
                    onResolve={handleResolveAlert}
                  />
                ))
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '32px',
                  color: '#94a3b8'
                }}>
                  <CheckCircle size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                  <div>No active alerts</div>
                </div>
              )}
            </div>
          </div>

          {/* Source Health Table */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            border: '1px solid #e7e9ee',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #f3f4f6',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <Server size={18} style={{ color: '#4f46e5' }} />
              <span style={{ fontWeight: 600, color: '#0f172a' }}>Data Sources</span>
            </div>
            
            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 100px 100px 100px 120px',
              padding: '10px 16px',
              backgroundColor: '#f9fafb',
              fontSize: '11px',
              fontWeight: 600,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              <div>Source</div>
              <div>Status</div>
              <div>Success Rate</div>
              <div>Latency</div>
              <div>Last Check</div>
            </div>
            
            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
              {sources.length > 0 ? (
                sources.map((source, i) => (
                  <SourceHealthRow key={source.source_id || i} source={source} />
                ))
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '32px',
                  color: '#94a3b8'
                }}>
                  No source data available
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <QueueStatsPanel stats={queueStats} />
          <FeedStatsPanel stats={feedStats} />
          
          {/* System Info */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            border: '1px solid #e7e9ee',
            padding: '20px'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px',
              marginBottom: '16px'
            }}>
              <Database size={18} style={{ color: '#4f46e5' }} />
              <span style={{ fontWeight: 600, color: '#0f172a' }}>System Info</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>API Version</span>
                <span style={{ color: '#0f172a', fontSize: '13px', fontWeight: 500 }}>2.0.0</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Architecture</span>
                <span style={{ color: '#0f172a', fontSize: '13px', fontWeight: 500 }}>Enhanced v2</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Feed Projection</span>
                <span style={{ color: '#16a34a', fontSize: '13px', fontWeight: 500 }}>Enabled</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Queue Layer</span>
                <span style={{ color: '#16a34a', fontSize: '13px', fontWeight: 500 }}>Active</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Hot/Archive Split</span>
                <span style={{ color: '#16a34a', fontSize: '13px', fontWeight: 500 }}>Enabled</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ObservabilityDashboard;
