import React, { useEffect, useState, useCallback } from 'react';
import { 
  Globe, Search, RefreshCw, Network, Server, Play, Zap,
  CheckCircle, XCircle, AlertTriangle, Activity
} from 'lucide-react';
import { useDiscoveryStore } from '../../store';
import { discoveryApi, adminApi } from '../../api';
import { hydrateSources, hydrateEndpoints } from '../../hydration';
import { colors } from '../../constants/colors';
import { SectionHeader, StatusBadge, Loader } from '../../components/common';

const STATUS_CONFIG = {
  discovering: { icon: RefreshCw, color: colors.accent, label: 'API Probing...', spin: true },
  browser_discovery: { icon: Globe, color: colors.warning, label: 'Browser Discovery...', pulse: true },
  running: { icon: RefreshCw, color: colors.warning, label: 'Scanning...', spin: true },
  success: { icon: CheckCircle, color: colors.success, label: 'Found endpoints' },
  error: { icon: XCircle, color: colors.error, label: 'Error' },
  parsing: { icon: RefreshCw, color: colors.accent, label: 'Parsing...', spin: true },
  registered: { icon: CheckCircle, color: colors.success, label: 'Registered' },
  no_endpoints: { icon: AlertTriangle, color: colors.warning, label: 'No endpoints found' },
  blocked: { icon: AlertTriangle, color: colors.error, label: 'Blocked (anti-bot)' },
  rediscovering: { icon: RefreshCw, color: colors.warning, label: 'Re-discovering...', spin: true },
  active: { icon: CheckCircle, color: colors.success, label: 'Active' },
  inactive: { icon: XCircle, color: colors.error, label: 'Inactive' }
};

function StatusIcon({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.inactive;
  const Icon = config.icon;
  return (
    <Icon 
      size={14} 
      style={{ color: config.color }}
      className={config.spin ? 'animate-spin' : config.pulse ? 'animate-pulse' : ''}
    />
  );
}

export default function DiscoveryPage() {
  // Store
  const sources = useDiscoveryStore(s => s.sources);
  const endpoints = useDiscoveryStore(s => s.endpoints);
  const searchResults = useDiscoveryStore(s => s.searchResults);
  const loading = useDiscoveryStore(s => s.loading);
  const parsingInProgress = useDiscoveryStore(s => s.parsingInProgress);
  const setSearchResults = useDiscoveryStore(s => s.setSearchResults);
  const setParsingProgress = useDiscoveryStore(s => s.setParsingProgress);

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // Load initial data via hydration
  useEffect(() => {
    hydrateSources();
    hydrateEndpoints({ limit: 50 });
  }, []);

  // Search
  const searchSites = useCallback(async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setSearchLoading(true);
    try {
      const data = await discoveryApi.search(query);
      setSearchResults(data.items || []);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setSearchLoading(false);
    }
  }, [setSearchResults]);

  // Discover domain
  const discoverDomain = useCallback(async (domain) => {
    const cleanDomain = domain.replace(/https?:\/\//, '').split('/')[0].replace('www.', '');
    setParsingProgress(cleanDomain, 'discovering');
    
    try {
      const data = await discoveryApi.discoverDomain(cleanDomain);
      const activeEndpoints = data.endpoints?.filter(ep => ep.status === 'active') || [];
      
      if (activeEndpoints.length > 0) {
        setParsingProgress(cleanDomain, 'success');
        hydrateEndpoints({ limit: 50 });
        return;
      }
      
      // Try browser discovery
      setParsingProgress(cleanDomain, 'browser_discovery');
      const browserData = await discoveryApi.browserDiscovery(cleanDomain);
      
      if (browserData.ok) {
        setParsingProgress(cleanDomain, 'running');
        setTimeout(() => {
          hydrateEndpoints({ limit: 50 });
          setParsingProgress(cleanDomain, 'success');
        }, 15000);
      } else {
        setParsingProgress(cleanDomain, 'no_endpoints');
      }
    } catch (e) {
      setParsingProgress(cleanDomain, 'error');
    }
  }, [setParsingProgress]);

  // Rediscover
  const rediscoverDomain = useCallback(async (domain) => {
    setParsingProgress(domain, 'rediscovering');
    try {
      await discoveryApi.rediscover(domain);
      setParsingProgress(domain, 'success');
      hydrateEndpoints({ limit: 50 });
    } catch (e) {
      setParsingProgress(domain, 'error');
    }
  }, [setParsingProgress]);

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

        {/* Search Input */}
        <div className="relative">
          <Search 
            size={20} 
            className="absolute left-4 top-1/2 -translate-y-1/2"
            style={{ color: colors.textMuted }}
          />
          <input
            data-testid="site-discovery-input"
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
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

        {/* Actions */}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            data-testid="discover-btn"
            onClick={() => searchQuery.length >= 2 && discoverDomain(searchQuery)}
            disabled={searchQuery.length < 2}
            className="px-6 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
            style={{ 
              backgroundColor: searchQuery.length >= 2 ? colors.accent : colors.surface,
              color: searchQuery.length >= 2 ? 'white' : colors.textMuted,
              cursor: searchQuery.length >= 2 ? 'pointer' : 'not-allowed'
            }}
          >
            <Network size={18} />
            Discover API Endpoints
          </button>
          <button
            onClick={() => hydrateEndpoints({ limit: 50 })}
            className="px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
            style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search Results */}
      {searchLoading ? (
        <Loader text="Searching..." />
      ) : searchResults.length > 0 ? (
        <div>
          <SectionHeader title={`Found ${searchResults.length} matches`} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {searchResults.map((item, i) => (
              <SearchResultCard 
                key={item.id || i} 
                item={item} 
                parsingStatus={parsingInProgress[item.domain] || parsingInProgress[item.id]}
                onDiscover={() => discoverDomain(item.domain)}
                onRediscover={() => rediscoverDomain(item.domain)}
              />
            ))}
          </div>
        </div>
      ) : searchQuery.length >= 2 ? (
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
            onClick={() => discoverDomain(searchQuery)}
            className="px-6 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 mx-auto"
            style={{ backgroundColor: colors.accent, color: 'white' }}
          >
            <Network size={18} />
            Discover {searchQuery}
          </button>
        </div>
      ) : null}

      {/* Data Sources Registry */}
      <div>
        <SectionHeader title={`Data Sources (${sources.length})`} />
        {loading ? (
          <Loader text="Loading sources..." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sources.slice(0, 30).map((source, i) => (
              <SourceCard 
                key={source.id || i} 
                source={source}
                parsingStatus={parsingInProgress[source.domain]}
                onDiscover={() => discoverDomain(source.domain)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Discovered Endpoints */}
      {endpoints.length > 0 && (
        <div>
          <SectionHeader title={`Discovered Endpoints (${endpoints.length})`} />
          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: colors.border }}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: colors.textSecondary }}>Domain</th>
                  <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: colors.textSecondary }}>Endpoint</th>
                  <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: colors.textSecondary }}>Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: colors.textSecondary }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.slice(0, 20).map((ep, i) => (
                  <tr 
                    key={ep.id || i}
                    className="hover:bg-slate-50 transition-colors"
                    style={{ borderBottom: `1px solid ${colors.border}` }}
                  >
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: colors.text }}>
                      {ep.domain}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono truncate max-w-xs" style={{ color: colors.textSecondary }}>
                      {ep.path || ep.endpoint}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: colors.textMuted }}>
                      {ep.data_type || ep.type || 'API'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ep.status || 'active'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== SUB-COMPONENTS ==========

function SearchResultCard({ item, parsingStatus, onDiscover, onRediscover }) {
  const config = STATUS_CONFIG[parsingStatus];
  
  return (
    <div 
      className="bg-white rounded-2xl border p-5 transition-all hover:shadow-lg"
      style={{ borderColor: colors.border }}
    >
      <div className="flex items-start gap-4">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: item.type === 'endpoint' ? colors.successSoft : colors.accentSoft }}
        >
          {item.type === 'endpoint' ? 
            <Server size={20} style={{ color: colors.success }} /> : 
            <Globe size={20} style={{ color: colors.accent }} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span 
              className="px-2 py-0.5 rounded text-xs font-medium uppercase"
              style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
            >
              {item.type}
            </span>
            {item.status && <StatusBadge status={item.status} />}
          </div>
          <p className="font-semibold" style={{ color: colors.text }}>{item.name}</p>
          {item.website && (
            <p className="text-sm truncate" style={{ color: colors.textSecondary }}>{item.website}</p>
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
              onClick={onDiscover}
              disabled={parsingStatus}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
              style={{ 
                backgroundColor: parsingStatus ? colors.surface : colors.accentSoft,
                color: parsingStatus ? config?.color : colors.accent
              }}
            >
              {parsingStatus ? <StatusIcon status={parsingStatus} /> : <Play size={12} />}
              {config?.label || 'Discover'}
            </button>
          )}
          {item.type === 'endpoint' && (
            <button
              onClick={onRediscover}
              disabled={parsingStatus}
              className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
              style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
            >
              <RefreshCw size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceCard({ source, parsingStatus, onDiscover }) {
  const config = STATUS_CONFIG[parsingStatus];
  
  return (
    <div 
      className="bg-white rounded-2xl border p-4 transition-all hover:shadow-md"
      style={{ borderColor: colors.border }}
    >
      <div className="flex items-center gap-3">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: colors.accentSoft }}
        >
          <Globe size={18} style={{ color: colors.accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate" style={{ color: colors.text }}>
            {source.name || source.domain}
          </p>
          <p className="text-xs truncate" style={{ color: colors.textMuted }}>
            {source.domain || source.website}
          </p>
        </div>
        <button
          onClick={onDiscover}
          disabled={parsingStatus}
          className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1"
          style={{ 
            backgroundColor: parsingStatus ? colors.surface : colors.successSoft,
            color: parsingStatus ? config?.color : colors.success
          }}
        >
          {parsingStatus ? <StatusIcon status={parsingStatus} /> : <Zap size={14} />}
        </button>
      </div>
    </div>
  );
}
