import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, Globe, Database, Activity, ChevronRight, ChevronDown, ChevronUp,
  RefreshCw, ExternalLink, Clock, X, Target, AlertTriangle, CheckCircle,
  XCircle, Server, Layers, Shield, Eye, BarChart2, TrendingUp, Zap, Network
} from 'lucide-react';
import { colors } from '../../shared/constants';
import { SectionHeader } from '../../shared/components';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function DiscoveryPage({ searchQuery = '' }) {
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
    if (searchQuery.length >= 2) {
      const timer = setTimeout(() => {
        performDiscoverySearch(searchQuery, discoveryType);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, discoveryType, performDiscoverySearch]);

  // Fetch sources on mount
  useEffect(() => {
    fetchDataSources();
  }, [fetchDataSources]);

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

  // Fetch on mount
  useEffect(() => {
    fetchDiscoveredEndpoints();
    fetchDataSources();
    fetchSourceHealth();
  }, [fetchDiscoveredEndpoints, fetchDataSources, fetchSourceHealth]);

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
  
  // Fetch parser status on mount
  useEffect(() => {
    fetchParserStatus();
  }, [fetchParserStatus]);
  
  // Main render
  return renderDiscovery();
}
