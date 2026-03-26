import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronRight, ChevronDown, Globe, Database, Activity,
  Server, FileText, Code, Terminal, Copy, CheckCircle,
  Search, GitBranch, Users, Zap, TrendingUp, RefreshCw,
  Shield, BarChart2, Layers, Box, AlertTriangle, Settings
} from 'lucide-react';
import { colors } from '../../shared/constants';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Category icons and colors
const categoryConfig = {
  'Parser Operations': { icon: Settings, color: '#8b5cf6' },
  'Parser Sync': { icon: RefreshCw, color: '#06b6d4' },
  'Graph': { icon: GitBranch, color: '#3b82f6' },
  'Intelligence': { icon: Zap, color: '#f59e0b' },
  'Admin': { icon: Shield, color: '#ef4444' },
  'Entities': { icon: Users, color: '#10b981' },
  'Activities': { icon: Activity, color: '#8b5cf6' },
  'Assets': { icon: Database, color: '#06b6d4' },
  'Market': { icon: TrendingUp, color: '#ec4899' },
  'Smart Money': { icon: BarChart2, color: '#f59e0b' },
  'News': { icon: FileText, color: '#3b82f6' },
  'Health': { icon: Activity, color: '#10b981' },
  'Alerts': { icon: AlertTriangle, color: '#f97316' },
  'Cache': { icon: Layers, color: '#64748b' },
  'Architecture': { icon: Box, color: '#6366f1' },
  'Other': { icon: Server, color: '#94a3b8' }
};

// Map path prefix to category
const getCategory = (path) => {
  if (path.includes('/parsers/ops')) return 'Parser Operations';
  if (path.includes('/parsers/sync') || path.includes('/parsers/run')) return 'Parser Sync';
  if (path.includes('/parsers')) return 'Parser Sync';
  if (path.includes('/graph')) return 'Graph';
  if (path.includes('/smart-money')) return 'Smart Money';
  if (path.includes('/intel') || path.includes('/alpha')) return 'Intelligence';
  if (path.includes('/admin')) return 'Admin';
  if (path.includes('/entities') || path.includes('/entity')) return 'Entities';
  if (path.includes('/activities')) return 'Activities';
  if (path.includes('/news')) return 'News';
  if (path.includes('/assets') || path.includes('/asset-registry')) return 'Assets';
  if (path.includes('/market') || path.includes('/derivatives') || path.includes('/candles')) return 'Market';
  if (path.includes('/alerts')) return 'Alerts';
  if (path.includes('/cache')) return 'Cache';
  if (path.includes('/architecture')) return 'Architecture';
  if (path.includes('/health')) return 'Health';
  return 'Other';
};

const methodColors = {
  GET: '#10b981',
  POST: '#3b82f6',
  PUT: '#f59e0b',
  DELETE: '#ef4444',
  PATCH: '#8b5cf6'
};

const ApiDocsPage = () => {
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedEndpoint, setExpandedEndpoint] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Fetch OpenAPI spec
  useEffect(() => {
    const fetchEndpoints = async () => {
      try {
        setLoading(true);
        // Use /api prefix to hit backend directly
        const response = await fetch(`${API_URL}/api/openapi.json`);
        if (!response.ok) throw new Error('Failed to fetch API spec');
        
        const data = await response.json();
        const paths = data.paths || {};
        
        // Parse endpoints
        const parsed = [];
        for (const [path, methods] of Object.entries(paths)) {
          for (const [method, details] of Object.entries(methods)) {
            if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
              parsed.push({
                id: `${method}-${path}`.replace(/[^a-z0-9]/gi, '-'),
                path,
                method: method.toUpperCase(),
                category: getCategory(path),
                summary: details.summary || '',
                description: details.description || '',
                tags: details.tags || [],
                parameters: details.parameters || [],
                requestBody: details.requestBody || null,
                responses: details.responses || {}
              });
            }
          }
        }
        
        setEndpoints(parsed);
        setError(null);
      } catch (err) {
        console.error('Error fetching API spec:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchEndpoints();
  }, []);

  // Filter and group endpoints
  const { filteredEndpoints, categories, stats } = useMemo(() => {
    let filtered = endpoints;
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.path.toLowerCase().includes(query) ||
        e.summary.toLowerCase().includes(query) ||
        e.description.toLowerCase().includes(query)
      );
    }
    
    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(e => e.category === selectedCategory);
    }
    
    // Get unique categories with counts
    const cats = {};
    endpoints.forEach(e => {
      cats[e.category] = (cats[e.category] || 0) + 1;
    });
    
    // Stats
    const methodCounts = {};
    endpoints.forEach(e => {
      methodCounts[e.method] = (methodCounts[e.method] || 0) + 1;
    });
    
    return {
      filteredEndpoints: filtered,
      categories: cats,
      stats: {
        total: endpoints.length,
        methods: methodCounts
      }
    };
  }, [endpoints, searchQuery, selectedCategory]);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: colors.bgPrimary, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={32} style={{ color: colors.accent, animation: 'spin 1s linear infinite' }} />
          <p style={{ color: colors.textSecondary, marginTop: '16px' }}>Loading API Documentation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: colors.bgPrimary, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div style={{ textAlign: 'center', color: colors.textSecondary }}>
          <AlertTriangle size={32} style={{ color: '#ef4444' }} />
          <p style={{ marginTop: '16px' }}>Error loading API documentation: {error}</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              backgroundColor: colors.accent,
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.bgPrimary }} data-testid="api-docs-page">
      {/* Header */}
      <div style={{ 
        padding: '24px 32px', 
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.bgSecondary
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h1 style={{ 
                fontSize: '28px', 
                fontWeight: '700', 
                color: colors.textPrimary,
                margin: 0
              }}>
                API Documentation
              </h1>
              <p style={{ color: colors.textSecondary, margin: '8px 0 0' }}>
                {stats.total} endpoints available
              </p>
            </div>
            
            {/* Method stats */}
            <div style={{ display: 'flex', gap: '16px' }}>
              {Object.entries(stats.methods).map(([method, count]) => (
                <div key={method} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  padding: '8px 12px',
                  backgroundColor: colors.bgPrimary,
                  borderRadius: '8px'
                }}>
                  <span style={{ 
                    padding: '2px 8px', 
                    backgroundColor: methodColors[method],
                    color: '#fff',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>
                    {method}
                  </span>
                  <span style={{ color: colors.textSecondary, fontSize: '14px' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Search and filters */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ 
              flex: 1,
              position: 'relative'
            }}>
              <Search size={18} style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)',
                color: colors.textSecondary 
              }} />
              <input
                type="text"
                placeholder="Search endpoints..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 44px',
                  backgroundColor: colors.bgPrimary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  color: colors.textPrimary,
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>
            
            {/* Category filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                padding: '12px 16px',
                backgroundColor: colors.bgPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                color: colors.textPrimary,
                fontSize: '14px',
                cursor: 'pointer',
                outline: 'none',
                minWidth: '180px'
              }}
            >
              <option value="all">All Categories ({stats.total})</option>
              {Object.entries(categories).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                <option key={cat} value={cat}>{cat} ({count})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px 32px' }}>
        {/* Category chips */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
          <button
            onClick={() => setSelectedCategory('all')}
            style={{
              padding: '6px 14px',
              backgroundColor: selectedCategory === 'all' ? colors.accent : colors.bgSecondary,
              color: selectedCategory === 'all' ? '#000' : colors.textSecondary,
              border: 'none',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            All ({stats.total})
          </button>
          {Object.entries(categories).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
            const config = categoryConfig[cat] || categoryConfig.Other;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  backgroundColor: selectedCategory === cat ? config.color : colors.bgSecondary,
                  color: selectedCategory === cat ? '#fff' : colors.textSecondary,
                  border: 'none',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <config.icon size={14} />
                {cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Results count */}
        <p style={{ color: colors.textSecondary, fontSize: '14px', marginBottom: '16px' }}>
          Showing {filteredEndpoints.length} of {stats.total} endpoints
          {searchQuery && ` matching "${searchQuery}"`}
        </p>

        {/* Endpoints list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredEndpoints.map((endpoint) => {
            const isExpanded = expandedEndpoint === endpoint.id;
            const config = categoryConfig[endpoint.category] || categoryConfig.Other;
            
            return (
              <div
                key={endpoint.id}
                style={{
                  backgroundColor: colors.bgSecondary,
                  borderRadius: '12px',
                  border: `1px solid ${isExpanded ? config.color : colors.border}`,
                  overflow: 'hidden',
                  transition: 'border-color 0.2s'
                }}
              >
                {/* Header */}
                <div
                  onClick={() => setExpandedEndpoint(isExpanded ? null : endpoint.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    cursor: 'pointer'
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown size={18} style={{ color: colors.textSecondary }} />
                  ) : (
                    <ChevronRight size={18} style={{ color: colors.textSecondary }} />
                  )}
                  
                  <span style={{
                    padding: '4px 10px',
                    backgroundColor: methodColors[endpoint.method],
                    color: '#fff',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '700',
                    minWidth: '60px',
                    textAlign: 'center'
                  }}>
                    {endpoint.method}
                  </span>
                  
                  <code style={{
                    flex: 1,
                    fontSize: '14px',
                    color: colors.textPrimary,
                    fontFamily: 'monospace'
                  }}>
                    {endpoint.path}
                  </code>
                  
                  <span style={{
                    fontSize: '13px',
                    color: colors.textSecondary,
                    maxWidth: '300px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {endpoint.summary}
                  </span>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(`${API_URL}${endpoint.path}`, endpoint.id);
                    }}
                    style={{
                      padding: '6px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: '4px'
                    }}
                  >
                    {copiedId === endpoint.id ? (
                      <CheckCircle size={16} style={{ color: '#10b981' }} />
                    ) : (
                      <Copy size={16} style={{ color: colors.textSecondary }} />
                    )}
                  </button>
                </div>
                
                {/* Expanded content */}
                {isExpanded && (
                  <div style={{ 
                    padding: '0 16px 16px',
                    borderTop: `1px solid ${colors.border}`,
                    marginTop: '-1px'
                  }}>
                    {/* Description */}
                    {endpoint.description && (
                      <p style={{ 
                        color: colors.textSecondary, 
                        fontSize: '14px',
                        marginTop: '16px',
                        lineHeight: '1.5'
                      }}>
                        {endpoint.description}
                      </p>
                    )}
                    
                    {/* Parameters */}
                    {endpoint.parameters.length > 0 && (
                      <div style={{ marginTop: '16px' }}>
                        <h4 style={{ 
                          color: colors.textPrimary, 
                          fontSize: '13px',
                          fontWeight: '600',
                          marginBottom: '8px'
                        }}>
                          Parameters
                        </h4>
                        <div style={{ 
                          backgroundColor: colors.bgPrimary,
                          borderRadius: '8px',
                          padding: '12px'
                        }}>
                          {endpoint.parameters.map((param, idx) => (
                            <div key={idx} style={{ 
                              display: 'flex', 
                              gap: '12px',
                              padding: '8px 0',
                              borderBottom: idx < endpoint.parameters.length - 1 ? `1px solid ${colors.border}` : 'none'
                            }}>
                              <code style={{ 
                                color: colors.accent,
                                fontSize: '13px',
                                minWidth: '120px'
                              }}>
                                {param.name}
                              </code>
                              <span style={{ 
                                color: colors.textSecondary,
                                fontSize: '12px',
                                padding: '2px 6px',
                                backgroundColor: colors.bgSecondary,
                                borderRadius: '4px'
                              }}>
                                {param.schema?.type || param.type || 'string'}
                              </span>
                              {param.required && (
                                <span style={{ 
                                  color: '#ef4444',
                                  fontSize: '11px',
                                  fontWeight: '600'
                                }}>
                                  required
                                </span>
                              )}
                              <span style={{ 
                                color: colors.textSecondary,
                                fontSize: '13px',
                                flex: 1
                              }}>
                                {param.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Try it */}
                    <div style={{ marginTop: '16px' }}>
                      <a
                        href={`${API_URL}/docs#/default/${endpoint.method.toLowerCase()}_${endpoint.path.replace(/\//g, '_').replace(/[{}]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 16px',
                          backgroundColor: config.color,
                          color: '#fff',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: '500',
                          textDecoration: 'none'
                        }}
                      >
                        <Terminal size={14} />
                        Try in Swagger
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Empty state */}
        {filteredEndpoints.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '64px',
            color: colors.textSecondary 
          }}>
            <Search size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
            <p>No endpoints found matching your search</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiDocsPage;
