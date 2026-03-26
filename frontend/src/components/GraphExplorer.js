import React, { useState, useEffect, useCallback } from 'react';
import { Search, Users, Building2, Briefcase, Network, ChevronLeft, ChevronRight, Database, GitMerge, Shield, Zap, TrendingUp, AlertCircle, CheckCircle, Activity } from 'lucide-react';
import ForceGraphViewer from './ForceGraphViewer';
import EntityTrendChart from './EntityTrendChart';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

// Entity type colors
const TYPE_COLORS = {
  project: '#8b5cf6',
  fund: '#f59e0b',
  person: '#ec4899',
  exchange: '#22c55e',
  token: '#3b82f6',
  asset: '#06b6d4',
  default: '#64748b'
};

const TYPE_ICONS = {
  project: Briefcase,
  fund: Building2,
  person: Users,
  exchange: Network,
  default: Network
};

const GraphExplorer = ({ colors }) => {
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestion, setSuggestion] = useState(null); // Single autocomplete suggestion
  const [isSearching, setIsSearching] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  
  // Relations data
  const [relations, setRelations] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loadingRelations, setLoadingRelations] = useState(false);
  
  // Graph Intelligence data (NEW)
  const [graphStats, setGraphStats] = useState(null);
  const [candidateStats, setCandidateStats] = useState(null);
  const [aliasHealth, setAliasHealth] = useState(null);
  const [cachedNeighbors, setCachedNeighbors] = useState(null);
  const [scopeStats, setScopeStats] = useState(null);
  const [mergeCandidates, setMergeCandidates] = useState(null);
  const [topConnected, setTopConnected] = useState([]);
  const [loadingIntelligence, setLoadingIntelligence] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Load Graph Intelligence data (NEW)
  useEffect(() => {
    const loadGraphIntelligence = async () => {
      setLoadingIntelligence(true);
      try {
        const [statsRes, candidatesRes, aliasRes, cacheRes, scopeRes, mergeRes] = await Promise.all([
          fetch(`${API_URL}/api/graph/stats`),
          fetch(`${API_URL}/api/graph/candidates/stats`),
          fetch(`${API_URL}/api/graph/alias/stability`),
          fetch(`${API_URL}/api/graph/cache/neighbors/stats`),
          fetch(`${API_URL}/api/graph/scope/stats`),
          fetch(`${API_URL}/api/graph/merge/candidates?limit=5`)
        ]);
        
        if (statsRes.ok) setGraphStats(await statsRes.json());
        if (candidatesRes.ok) setCandidateStats(await candidatesRes.json());
        if (aliasRes.ok) setAliasHealth(await aliasRes.json());
        if (cacheRes.ok) setCachedNeighbors(await cacheRes.json());
        if (scopeRes.ok) setScopeStats(await scopeRes.json());
        if (mergeRes.ok) setMergeCandidates(await mergeRes.json());
        
        // Load top connected entities
        const hotEntities = ['fund:a16z', 'fund:paradigm', 'project:ethereum', 'project:solana', 'exchange:binance'];
        const topPromises = hotEntities.map(async (id) => {
          const res = await fetch(`${API_URL}/api/graph/cache/neighbors/${id}`);
          if (res.ok) {
            const data = await res.json();
            return { id, label: id.split(':')[1], type: id.split(':')[0], neighbors: data.neighbor_count || 0 };
          }
          return null;
        });
        const topResults = (await Promise.all(topPromises)).filter(Boolean).sort((a, b) => b.neighbors - a.neighbors);
        setTopConnected(topResults);
        
      } catch (err) {
        console.error('Failed to load graph intelligence:', err);
      } finally {
        setLoadingIntelligence(false);
      }
    };
    loadGraphIntelligence();
  }, []);

  // Get autocomplete suggestion (single best match)
  const getSuggestion = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSuggestion(null);
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await fetch(`${API_URL}/api/graph/entities/search?q=${encodeURIComponent(query)}&limit=1`);
      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          setSuggestion(data.results[0]);
        } else {
          setSuggestion(null);
        }
      }
    } catch (err) {
      console.error('Search failed:', err);
      setSuggestion(null);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced suggestion
  useEffect(() => {
    const timer = setTimeout(() => {
      getSuggestion(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, getSuggestion]);

  // Execute search - resolve and load entity using advanced multi-stage search
  const executeSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;
    
    setIsResolving(true);
    try {
      // Use advanced search endpoint - multi-stage search with auto-create
      const response = await fetch(`${API_URL}/api/graph/search/advanced?q=${encodeURIComponent(query)}&auto_create=true`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.found && data.entity) {
          // Entity found - load it
          const entity = data.entity;
          const entityType = entity.entity_type || entity.type;
          const entityId = entity.entity_id || entity.id?.split(':')[1] || entity.id;
          
          setSelectedEntity({
            id: entity.id || `${entityType}:${entityId}`,
            label: entity.label || query,
            type: entityType,
            entity_id: entityId
          });
          setSuggestion(null);
          
          // Show discovery info if from candidate
          if (data.is_candidate) {
            console.log(`[GraphExplorer] Entity discovered from ${data.stage}, confidence: ${data.confidence}`);
          }
        } else {
          // Not found even with advanced search
          const suggestions = data.suggestions || [];
          if (suggestions.length > 0) {
            alert(`Entity not found: ${query}\n\nDid you mean: ${suggestions.map(s => s.alias).join(', ')}?`);
          } else {
            alert(`Entity not found: ${query}\n\nThis entity is not yet in our database.`);
          }
        }
      } else {
        // API error - try fallback to suggestion
        if (suggestion) {
          setSelectedEntity({
            id: suggestion.id,
            label: suggestion.label,
            type: suggestion.type,
            entity_id: suggestion.entity_id
          });
          setSuggestion(null);
        } else {
          alert(`Search failed for: ${query}`);
        }
      }
    } catch (err) {
      console.error('Search failed:', err);
      // Fallback to suggestion if available
      if (suggestion) {
        setSelectedEntity({
          id: suggestion.id,
          label: suggestion.label,
          type: suggestion.type,
          entity_id: suggestion.entity_id
        });
        setSuggestion(null);
      } else {
        alert(`Search error: ${err.message}`);
      }
    } finally {
      setIsResolving(false);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If suggestion exists and matches, use it directly
      if (suggestion && suggestion.label.toLowerCase().startsWith(searchQuery.toLowerCase())) {
        setSelectedEntity({
          id: suggestion.id,
          label: suggestion.label,
          type: suggestion.type,
          entity_id: suggestion.entity_id
        });
        setSearchQuery(suggestion.label);
        setSuggestion(null);
      } else {
        executeSearch();
      }
    }
  };

  // Accept suggestion (Tab or click)
  const acceptSuggestion = () => {
    if (suggestion) {
      setSearchQuery(suggestion.label);
      setSelectedEntity({
        id: suggestion.id,
        label: suggestion.label,
        type: suggestion.type,
        entity_id: suggestion.entity_id
      });
      setSuggestion(null);
    }
  };

  // Load relations when entity selected
  useEffect(() => {
    if (!selectedEntity) {
      setRelations([]);
      setInsights(null);
      return;
    }

    const loadRelations = async () => {
      setLoadingRelations(true);
      try {
        const [type, id] = selectedEntity.id.split(':');
        
        const edgesRes = await fetch(`${API_URL}/api/graph/edges/${type}/${id}?limit=100`);
        const edgesData = await edgesRes.ok ? await edgesRes.json() : { edges: [] };
        
        const neighborsRes = await fetch(`${API_URL}/api/graph/neighbors/${type}/${id}?limit=100`);
        const neighborsData = await neighborsRes.ok ? await neighborsRes.json() : { neighbors: [] };
        
        // Build relations list with deduplication
        const seenKeys = new Set();
        const relationsList = edgesData.edges
          .map(edge => {
            const isOutgoing = edge.source === selectedEntity.id;
            const targetEntity = isOutgoing ? edge.target : edge.source;
            const targetLabel = isOutgoing ? edge.target_label : edge.source_label;
            const [targetType] = targetEntity.split(':');
            const relation = edge.relation.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            return {
              id: edge.id,
              type: targetType,
              entity: targetLabel || targetEntity.split(':')[1],
              entityId: targetEntity,
              relation: relation,
              status: edge.source_type === 'direct' ? 'Active' : 'Historical',
              weight: edge.weight || 1,
              // Unique key for deduplication
              _key: `${targetEntity}:${relation}`
            };
          })
          .filter(rel => {
            // Deduplicate by entity + relation
            if (seenKeys.has(rel._key)) {
              return false;
            }
            seenKeys.add(rel._key);
            return true;
          });
        
        setRelations(relationsList);
        
        const typeCount = {};
        neighborsData.neighbors.forEach(n => {
          typeCount[n.type] = (typeCount[n.type] || 0) + 1;
        });
        
        setInsights({
          totalRelations: relationsList.length,
          activeCount: relationsList.filter(r => r.status === 'Active').length,
          networkReach: 2,
          canReach: Math.min(400, relationsList.length * 20),
          persons: typeCount.person || 0,
          funds: typeCount.fund || 0,
          projects: typeCount.project || 0,
          exchanges: typeCount.exchange || 0
        });
        
      } catch (err) {
        console.error('Failed to load relations:', err);
      } finally {
        setLoadingRelations(false);
      }
    };

    loadRelations();
    setCurrentPage(1);
  }, [selectedEntity]);

  // Clear selection
  const clearSelection = () => {
    setSelectedEntity(null);
    setSearchQuery('');
    setRelations([]);
    setInsights(null);
    setSuggestion(null);
  };

  // Navigate to entity from table
  const navigateToEntity = (rel) => {
    const [type, id] = rel.entityId.split(':');
    setSelectedEntity({ 
      id: rel.entityId, 
      label: rel.entity, 
      type 
    });
    setSearchQuery(rel.entity);
  };

  // Paginated relations
  const paginatedRelations = relations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(relations.length / itemsPerPage);

  // Empty state
  const EmptyState = () => (
    <div 
      className="flex flex-col items-center justify-center h-full"
      style={{ backgroundColor: '#0a0e1a', minHeight: '400px' }}
    >
      <h3 className="text-xl font-medium text-slate-300 mb-2">
        Start exploring the network
      </h3>
      <p className="text-slate-500 text-sm">
        Enter an entity name and press Search
      </p>
    </div>
  );

  return (
    <div data-testid="graph-explorer" className="h-full flex flex-col">
      {/* Search Bar with Autocomplete */}
      <div className="mb-4 relative">
        <div className="flex gap-2">
          {/* Input with inline suggestion */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            
            {/* Suggestion overlay (ghost text) */}
            {suggestion && searchQuery && suggestion.label.toLowerCase().startsWith(searchQuery.toLowerCase()) && (
              <div 
                className="absolute left-12 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500"
                style={{ color: colors.textSecondary }}
              >
                <span className="invisible">{searchQuery}</span>
                <span className="text-slate-500">{suggestion.label.slice(searchQuery.length)}</span>
              </div>
            )}
            
            <input
              data-testid="graph-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter entity name (e.g., Solana, a16z, Vitalik)..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border transition-all"
              style={{
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.text
              }}
            />
            
            {/* Clear button */}
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSuggestion(null);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xl"
              >
                ×
              </button>
            )}
          </div>
          
          {/* Search Button */}
          <button
            data-testid="graph-search-btn"
            onClick={() => {
              if (suggestion) {
                acceptSuggestion();
              } else {
                executeSearch();
              }
            }}
            disabled={!searchQuery.trim() || isResolving}
            className="px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 disabled:opacity-50"
            style={{
              backgroundColor: '#10b981',
              color: 'white'
            }}
          >
            {isResolving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search
          </button>
        </div>
        
        {/* Single suggestion hint below input */}
        {suggestion && searchQuery && !selectedEntity && (
          <div 
            className="mt-2 px-4 py-2 rounded-lg text-sm flex items-center gap-2 cursor-pointer hover:bg-slate-800"
            style={{ backgroundColor: colors.surface, color: colors.textSecondary }}
            onClick={acceptSuggestion}
          >
            <span 
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: TYPE_COLORS[suggestion.type] || TYPE_COLORS.default }}
            />
            <span>Press Enter or click to search for </span>
            <span className="font-medium" style={{ color: colors.text }}>{suggestion.label}</span>
          </div>
        )}
        
        {/* Loading indicator */}
        {isSearching && (
          <div className="mt-2 px-4 py-2 text-sm text-slate-500 flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            Searching...
          </div>
        )}
      </div>

      {/* Selected Entity Badge */}
      {selectedEntity && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-slate-400">Showing graph for:</span>
          <span 
            className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2"
            style={{ 
              backgroundColor: TYPE_COLORS[selectedEntity.type] || TYPE_COLORS.default,
              color: 'white'
            }}
          >
            {selectedEntity.label}
            <button onClick={clearSelection} className="hover:opacity-70">×</button>
          </span>
        </div>
      )}

      {/* Main Content */}
      {!selectedEntity ? (
        <div 
          className="rounded-2xl border overflow-hidden flex-1"
          style={{ 
            backgroundColor: '#0a0e1a',
            borderColor: colors.border,
            minHeight: '400px'
          }}
        >
          <EmptyState />
        </div>
      ) : (
        <div className="flex flex-col gap-4 flex-1">
          {/* Graph Section - Full Width */}
          <div 
            className="rounded-2xl border overflow-hidden"
            style={{ 
              backgroundColor: '#0a0e1a', 
              borderColor: colors.border,
              height: '450px'
            }}
          >
            <ForceGraphViewer centerEntity={selectedEntity.id} />
          </div>
          
          {/* Graph Intelligence Section - Full Width Below Graph */}
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: colors.background, borderColor: colors.border }}>
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: colors.border }}>
              <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: colors.text }}>
                <Database className="w-5 h-5 text-violet-400" />
                Graph Intelligence
              </h3>
              {graphStats && (
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-slate-400">
                    <span className="text-emerald-400 font-semibold">{graphStats.total_nodes}</span> nodes
                  </span>
                  <span className="text-slate-400">
                    <span className="text-emerald-400 font-semibold">{graphStats.total_edges}</span> edges
                  </span>
                </div>
              )}
            </div>
            
            {loadingIntelligence ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4 p-4">
                {/* Block 1: Entity Distribution */}
                <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Network className="w-4 h-4 text-violet-400" />
                    <span className="text-sm font-medium" style={{ color: colors.text }}>Entity Types</span>
                  </div>
                  {graphStats?.nodes_by_type && (
                    <div className="space-y-2">
                      {Object.entries(graphStats.nodes_by_type)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span 
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: TYPE_COLORS[type] || TYPE_COLORS.default }}
                              />
                              <span className="text-xs text-slate-400 capitalize">{type}</span>
                            </div>
                            <span className="text-sm font-medium" style={{ color: colors.text }}>{count}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                
                {/* Block 2: Relation Types */}
                <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <GitMerge className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium" style={{ color: colors.text }}>Edge Types</span>
                  </div>
                  {graphStats?.edges_by_type && (
                    <div className="space-y-2">
                      {Object.entries(graphStats.edges_by_type)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">{type.replace(/_/g, ' ')}</span>
                            <span className="text-sm font-medium text-emerald-400">{count}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                
                {/* Block 3: Graph Health */}
                <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium" style={{ color: colors.text }}>Graph Health</span>
                    {aliasHealth && (
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded ${aliasHealth.is_healthy ? 'bg-emerald-400/20 text-emerald-400' : 'bg-amber-400/20 text-amber-400'}`}>
                        {aliasHealth.is_healthy ? 'Healthy' : 'Needs Review'}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Health Score</span>
                      <span className="text-sm font-medium text-blue-400">{aliasHealth?.health_score ? (aliasHealth.health_score * 100).toFixed(0) + '%' : '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Alias Conflicts</span>
                      <span className={`text-sm font-medium ${aliasHealth?.conflicts?.count === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {aliasHealth?.conflicts?.count || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Potential Duplicates</span>
                      <span className={`text-sm font-medium ${aliasHealth?.duplicates?.potential_count === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {aliasHealth?.duplicates?.potential_count || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Cached Entities</span>
                      <span className="text-sm font-medium text-blue-400">{cachedNeighbors?.total_cached || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Entity Discovery Stats */}
            {candidateStats && (
              <div className="px-4 pb-4">
                <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-medium" style={{ color: colors.text }}>Entity Discovery Pipeline</span>
                    </div>
                    <span className="text-xs text-slate-400">{candidateStats.total} candidates discovered</span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 mt-3">
                    {candidateStats.by_type && Object.entries(candidateStats.by_type).map(([type, count]) => (
                      <div key={type} className="text-center p-3 rounded-lg" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
                        <div className="text-xl font-bold text-amber-500">{count}</div>
                        <div className="text-xs text-slate-500 capitalize">{type}s</div>
                      </div>
                    ))}
                    <div className="text-center p-3 rounded-lg" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                      <div className="text-xl font-bold text-emerald-500">
                        {candidateStats.by_status?.validated || 0}
                      </div>
                      <div className="text-xs text-slate-500">Validated</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Second Row: Scopes, Top Connected, Merge Review */}
            <div className="grid grid-cols-3 gap-4 px-4 pb-4">
              {/* Entity Scopes */}
              {scopeStats && (
                <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.1)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium" style={{ color: colors.text }}>Entity Scopes</span>
                    <span className="ml-auto text-xs text-slate-400">{(scopeStats.coverage * 100).toFixed(0)}% coverage</span>
                  </div>
                  <div className="space-y-2">
                    {scopeStats.distribution && Object.entries(scopeStats.distribution)
                      .sort((a, b) => b[1] - a[1])
                      .map(([scope, count]) => (
                        <div key={scope} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              scope === 'protocol' ? 'bg-violet-400' :
                              scope === 'token' ? 'bg-blue-400' :
                              scope === 'organization' ? 'bg-amber-400' :
                              scope === 'ecosystem' ? 'bg-emerald-400' : 'bg-slate-400'
                            }`} />
                            <span className="text-xs text-slate-400 capitalize">{scope}</span>
                          </div>
                          <span className="text-sm font-medium text-purple-400">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              
              {/* Entity Trend Chart */}
              {selectedEntity && (
                <EntityTrendChart entityId={selectedEntity.id} colors={colors} />
              )}
              {topConnected.length > 0 && (
                <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.1)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Network className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-medium" style={{ color: colors.text }}>Most Connected</span>
                  </div>
                  <div className="space-y-2">
                    {topConnected.slice(0, 5).map((entity, idx) => (
                      <div key={entity.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 w-4">{idx + 1}.</span>
                          <span 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: TYPE_COLORS[entity.type] || TYPE_COLORS.default }}
                          />
                          <span className="text-xs" style={{ color: colors.text }}>{entity.label}</span>
                        </div>
                        <span className="text-sm font-medium text-cyan-400">{entity.neighbors}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Merge Review */}
              {mergeCandidates && mergeCandidates.count > 0 ? (
                <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <GitMerge className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-medium" style={{ color: colors.text }}>Merge Review</span>
                    <span className="ml-auto text-xs px-2 py-0.5 rounded bg-red-400/20 text-red-400">
                      {mergeCandidates.count} pending
                    </span>
                  </div>
                  <div className="space-y-2">
                    {mergeCandidates.candidates.slice(0, 3).map((candidate, idx) => (
                      <div key={idx} className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium" style={{ color: colors.text }}>{candidate.entity_a_label}</span>
                          <span className="text-slate-400">≈</span>
                          <span className="font-medium" style={{ color: colors.text }}>{candidate.entity_b_label}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-slate-400 capitalize">{candidate.entity_type}</span>
                          <span className="text-xs text-red-400">{(candidate.similarity * 100).toFixed(0)}% similar</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium" style={{ color: colors.text }}>Merge Status</span>
                  </div>
                  <div className="flex flex-col items-center justify-center py-4">
                    <CheckCircle className="w-8 h-8 text-emerald-400 mb-2" />
                    <span className="text-sm text-emerald-400">No duplicates detected</span>
                    <span className="text-xs text-slate-400 mt-1">Graph is clean</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Entity Relations for Selected Entity */}
            {selectedEntity && (
              <div className="border-t" style={{ borderColor: colors.border }}>
                <div className="p-4 flex items-center justify-between">
                  <h4 className="text-sm font-medium flex items-center gap-2" style={{ color: colors.text }}>
                    <Activity className="w-4 h-4 text-violet-400" />
                    Relations for {selectedEntity.label}
                  </h4>
                  {insights && (
                    <div className="flex gap-4 text-sm">
                      <span className="text-slate-400">
                        <span className="text-emerald-400 font-semibold">{insights.totalRelations}</span> relations
                      </span>
                      <span className="text-slate-400">
                        <span className="font-semibold" style={{ color: colors.text }}>{insights.persons}</span> persons
                      </span>
                      <span className="text-slate-400">
                        <span className="font-semibold" style={{ color: colors.text }}>{insights.funds}</span> funds
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Compact Relations Table */}
                <div className="overflow-auto" style={{ maxHeight: '200px' }}>
                  {loadingRelations ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : relations.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-slate-500 text-sm">
                      No relations found
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="sticky top-0" style={{ backgroundColor: colors.background }}>
                        <tr className="text-xs text-slate-400 border-b" style={{ borderColor: colors.border }}>
                          <th className="text-left p-3 w-20">Type</th>
                          <th className="text-left p-3">Entity</th>
                          <th className="text-left p-3">Relation</th>
                          <th className="text-left p-3 w-20">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRelations.map((rel, idx) => {
                          const Icon = TYPE_ICONS[rel.type] || TYPE_ICONS.default;
                          return (
                            <tr 
                              key={rel.id || idx}
                              className="border-b hover:bg-slate-800/50 cursor-pointer transition-colors"
                              style={{ borderColor: colors.border }}
                              onClick={() => navigateToEntity(rel)}
                            >
                              <td className="p-3">
                                <div className="flex items-center gap-1.5">
                                  <span 
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: TYPE_COLORS[rel.type] || TYPE_COLORS.default }}
                                  />
                                  <span className="text-xs text-slate-400 capitalize">{rel.type}</span>
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                                    <Icon className="w-3 h-3 text-slate-400" />
                                  </div>
                                  <span className="text-sm font-medium" style={{ color: colors.text }}>
                                    {rel.entity}
                                  </span>
                                </div>
                              </td>
                              <td className="p-3 text-xs text-slate-400">{rel.relation}</td>
                              <td className="p-3">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  rel.status === 'Active' ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-400 bg-slate-400/10'
                                }`}>
                                  {rel.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="p-3 border-t flex items-center justify-between" style={{ borderColor: colors.border }}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-1 rounded hover:bg-slate-700 disabled:opacity-50"
                      >
                        <ChevronLeft className="w-4 h-4 text-slate-400" />
                      </button>
                      {[...Array(Math.min(5, totalPages))].map((_, i) => {
                        const page = i + 1;
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-7 h-7 rounded text-xs ${
                              currentPage === page 
                                ? 'bg-emerald-500 text-white' 
                                : 'text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-1 rounded hover:bg-slate-700 disabled:opacity-50"
                      >
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                    <span className="text-xs text-slate-500">
                      {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, relations.length)} of {relations.length}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphExplorer;
