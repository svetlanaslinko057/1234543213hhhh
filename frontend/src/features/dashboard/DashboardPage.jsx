import React from 'react';
import { 
  RefreshCw, Box, Activity, Users, Unlock, Database, 
  FileText, Globe, Zap
} from 'lucide-react';
import { colors } from '../../shared/constants';

// Stat Card component
function StatCard({ title, value, icon: Icon, color = 'accent' }) {
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
      </div>
      <p className="text-sm mb-1" style={{ color: colors.textSecondary }}>{title}</p>
      <p className="text-3xl font-bold" style={{ color: colors.text }}>{value}</p>
    </div>
  );
}

// Status Badge component
function StatusBadge({ status }) {
  const statusStyles = {
    active: { bg: colors.successSoft, color: colors.success, label: 'Active' },
    healthy: { bg: colors.successSoft, color: colors.success, label: 'Healthy' },
    pending: { bg: colors.warningSoft, color: colors.warning, label: 'Pending' },
    offline: { bg: colors.surface, color: colors.textMuted, label: 'Offline' },
    error: { bg: colors.errorSoft, color: colors.error, label: 'Error' }
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

// Section Header
function SectionHeader({ title }) {
  return (
    <h2 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>{title}</h2>
  );
}

export default function DashboardPage({ 
  stats, 
  pipelineStatus, 
  exchangeHealth = [], 
  trustScores = [] 
}) {
  return (
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

      {/* Pipeline Status */}
      {pipelineStatus && (
        <div>
          <SectionHeader title="Pipeline Status" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Scheduler Status */}
            <div className="bg-white rounded-2xl border p-5" style={{ borderColor: colors.border }}>
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
            <div className="bg-white rounded-2xl border p-5" style={{ borderColor: colors.border }}>
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
            <div className="bg-white rounded-2xl border p-5" style={{ borderColor: colors.border }}>
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
            <div className="bg-white rounded-2xl border p-5" style={{ borderColor: colors.border }}>
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

      {/* Parser Jobs Detail */}
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
}
