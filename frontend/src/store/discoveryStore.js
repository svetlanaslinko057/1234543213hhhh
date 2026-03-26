import { create } from 'zustand';

export const useDiscoveryStore = create((set, get) => ({
  // Data
  sources: [],
  endpoints: [],
  searchResults: [],
  sourcesUsed: [],
  
  // Pipeline Status
  pipelineStatus: null,
  sourceHealth: {},
  tierStatus: {},
  healthAlerts: [],
  alertStats: {},
  exchangeStatus: {},
  
  // UI State
  loading: false,
  searchLoading: false,
  error: null,
  parsingInProgress: {},
  lastUpdated: null,
  
  // Filters
  sourceFilter: 'all',
  tierFilter: 'all',
  searchQuery: '',
  discoveryType: null,

  // Actions
  setSources: (sources) => set({ sources }),
  setEndpoints: (endpoints) => set({ endpoints }),
  setSearchResults: (results) => set({ searchResults: results }),
  setSourcesUsed: (sources) => set({ sourcesUsed: sources }),
  
  setPipelineStatus: (status) => set({ pipelineStatus: status }),
  setSourceHealth: (health) => set({ sourceHealth: health }),
  setTierStatus: (status) => set({ tierStatus: status }),
  setHealthAlerts: (alerts) => set({ healthAlerts: alerts }),
  setAlertStats: (stats) => set({ alertStats: stats }),
  setExchangeStatus: (status) => set({ exchangeStatus: status }),
  
  setLoading: (loading) => set({ loading }),
  setSearchLoading: (loading) => set({ searchLoading: loading }),
  setError: (error) => set({ error }),
  setLastUpdated: (ts) => set({ lastUpdated: ts }),
  
  setParsingProgress: (domain, status) => set(state => ({
    parsingInProgress: { ...state.parsingInProgress, [domain]: status }
  })),
  
  setSourceFilter: (filter) => set({ sourceFilter: filter }),
  setTierFilter: (filter) => set({ tierFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setDiscoveryType: (type) => set({ discoveryType: type }),
  
  // Getters
  getSource: (id) => get().sources.find(s => s.id === id),
  
  reset: () => set({
    sources: [],
    endpoints: [],
    searchResults: [],
    loading: false,
    error: null,
    lastUpdated: null
  })
}));
