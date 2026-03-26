import { create } from 'zustand';

export const useAppStore = create((set) => ({
  // Global UI state
  activeTab: 'dashboard',
  loading: false,
  wsConnected: false,
  
  // Global data
  health: null,
  stats: null,
  exchangeHealth: [],
  trustScores: [],
  
  // Actions
  setActiveTab: (tab) => set({ activeTab: tab }),
  setLoading: (loading) => set({ loading }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setHealth: (health) => set({ health }),
  setStats: (stats) => set({ stats }),
  setExchangeHealth: (health) => set({ exchangeHealth: health }),
  setTrustScores: (scores) => set({ trustScores: scores })
}));
