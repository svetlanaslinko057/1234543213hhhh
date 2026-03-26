import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Activity, Layers, Users, DollarSign, TrendingUp, Database, Zap, Globe } from 'lucide-react';
import { adminApi } from '../../api';
import { colors } from '../../constants/colors';
import { StatCard, SectionHeader, StatusBadge } from '../../components/common';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [exchangeHealth, setExchangeHealth] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, schedulerRes] = await Promise.all([
        adminApi.getSystemStats().catch(() => ({})),
        adminApi.getSchedulerStatus().catch(() => ({}))
      ]);
      
      setStats(statsRes);
      setPipelineStatus(schedulerRes);
      setExchangeHealth(statsRes.exchange_health || []);
    } catch (e) {
      console.error('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin" size={32} style={{ color: colors.accent }} />
      </div>
    );
  }

  const intelStats = stats?.intel?.collections || {};

  return (
    <div className="space-y-8">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Events" 
          value={intelStats.events || 0} 
          icon={Activity}
          color="accent"
        />
        <StatCard 
          title="Projects" 
          value={intelStats.projects || 0} 
          icon={Layers}
          color="success"
        />
        <StatCard 
          title="Investors" 
          value={intelStats.investors || 0} 
          icon={Users}
          color="warning"
        />
        <StatCard 
          title="Funding Rounds" 
          value={intelStats.funding || 0} 
          icon={DollarSign}
          color="accent"
        />
      </div>

      {/* Pipeline Status */}
      {pipelineStatus && (
        <div>
          <SectionHeader title="Data Pipeline" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Scheduler */}
            <div 
              className="bg-white rounded-2xl border p-5"
              style={{ borderColor: colors.border }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: colors.successSoft }}>
                    <Database size={18} style={{ color: colors.success }} />
                  </div>
                  <span className="font-medium" style={{ color: colors.text }}>Scheduler</span>
                </div>
                <StatusBadge status={pipelineStatus.running ? 'active' : 'offline'} />
              </div>
              <div className="text-sm" style={{ color: colors.textSecondary }}>
                <p>{pipelineStatus.job_count || 0} active jobs</p>
              </div>
            </div>

            {/* Parsers */}
            <div 
              className="bg-white rounded-2xl border p-5"
              style={{ borderColor: colors.border }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: colors.warningSoft }}>
                    <Zap size={18} style={{ color: colors.warning }} />
                  </div>
                  <span className="font-medium" style={{ color: colors.text }}>Parsers</span>
                </div>
                <StatusBadge status="active" />
              </div>
              <div className="text-sm" style={{ color: colors.textSecondary }}>
                <p>{pipelineStatus.parsers?.active || 0} running</p>
              </div>
            </div>

            {/* Discovery */}
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
                <StatusBadge status="active" />
              </div>
              <div className="text-sm" style={{ color: colors.textSecondary }}>
                <p>{stats?.discovery?.endpoints || 0} endpoints</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exchange Providers */}
      {exchangeHealth.length > 0 && (
        <div>
          <SectionHeader title="Exchange Providers" />
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
      )}

      {/* Intelligence Stats */}
      <div>
        <SectionHeader title="Intelligence Data" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            { label: 'Persons', value: intelStats.persons || 0 },
            { label: 'Exchanges', value: intelStats.exchanges || 0 },
            { label: 'Unlocks', value: intelStats.unlocks || 0 },
            { label: 'Sales', value: intelStats.sales || 0 },
            { label: 'News Sources', value: stats?.news?.sources || 0 },
            { label: 'Graph Nodes', value: stats?.graph?.nodes || 0 },
          ].map((item, i) => (
            <div 
              key={i}
              className="bg-white rounded-xl border p-4 text-center"
              style={{ borderColor: colors.border }}
            >
              <p className="text-2xl font-bold" style={{ color: colors.text }}>
                {item.value.toLocaleString()}
              </p>
              <p className="text-sm" style={{ color: colors.textMuted }}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
