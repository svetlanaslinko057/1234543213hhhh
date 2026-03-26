import { create } from 'zustand';

export const useFeedStore = create((set, get) => ({
  // Data
  events: [],
  articles: [],
  stats: null,
  sentimentStats: null,
  breakingNews: null,
  
  // UI State
  loading: false,
  error: null,
  selectedEvent: null,
  
  // Filters
  filters: {
    sentiment: 'all',
    eventType: 'all',
    search: ''
  },
  
  // Pagination
  cursor: null,
  hasMore: true,

  // Actions
  setEvents: (events) => set({ events }),
  appendEvents: (newEvents) => set(state => ({ 
    events: [...state.events, ...newEvents].slice(0, 2000) // Memory limit
  })),
  prependEvent: (event) => set(state => ({
    events: [event, ...state.events].slice(0, 2000)
  })),
  
  setArticles: (articles) => set({ articles }),
  setStats: (stats) => set({ stats }),
  setSentimentStats: (sentimentStats) => set({ sentimentStats }),
  setBreakingNews: (breakingNews) => set({ breakingNews }),
  clearBreakingNews: () => set({ breakingNews: null }),
  
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  
  setSelectedEvent: (event) => set({ selectedEvent: event }),
  clearSelectedEvent: () => set({ selectedEvent: null }),
  
  setFilters: (filters) => set(state => ({ 
    filters: { ...state.filters, ...filters } 
  })),
  
  setCursor: (cursor) => set({ cursor }),
  setHasMore: (hasMore) => set({ hasMore }),
  
  reset: () => set({
    events: [],
    articles: [],
    loading: false,
    error: null,
    cursor: null,
    hasMore: true
  })
}));
