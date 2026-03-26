import { create } from 'zustand';

export const useGraphStore = create((set) => ({
  // Data
  nodes: [],
  edges: [],
  stats: null,
  searchResults: [],
  selectedNode: null,
  neighbors: [],
  
  // UI State
  loading: false,
  searchLoading: false,
  error: null,
  
  // View settings
  depth: 2,
  layout: 'force',

  // Actions
  setGraph: (nodes, edges) => set({ nodes, edges }),
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setStats: (stats) => set({ stats }),
  setSearchResults: (results) => set({ searchResults: results }),
  
  setSelectedNode: (node) => set({ selectedNode: node }),
  clearSelectedNode: () => set({ selectedNode: null, neighbors: [] }),
  setNeighbors: (neighbors) => set({ neighbors }),
  
  setLoading: (loading) => set({ loading }),
  setSearchLoading: (loading) => set({ searchLoading: loading }),
  setError: (error) => set({ error }),
  
  setDepth: (depth) => set({ depth }),
  setLayout: (layout) => set({ layout }),
  
  reset: () => set({
    nodes: [],
    edges: [],
    searchResults: [],
    selectedNode: null,
    neighbors: [],
    loading: false,
    error: null
  })
}));
