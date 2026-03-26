import { create } from 'zustand';

/**
 * Event Store - Central source of truth for events
 * 
 * Architecture:
 * API → Hydration → Store → UI
 * 
 * Rules:
 * - Components NEVER fetch directly
 * - Components NEVER mutate state
 * - All data flows through actions
 */
export const useEventStore = create((set, get) => ({
  // Normalized data structure for O(1) updates
  events: {},           // { [id]: event }
  eventList: [],        // [id1, id2, ...] - ordered
  
  // Metadata
  totalCount: 0,
  cursor: null,
  hasMore: true,
  lastUpdated: null,
  
  // UI state
  loading: false,
  loadingMore: false,
  error: null,
  selectedEventId: null,

  // ========== ACTIONS ==========
  
  /**
   * Load feed - replaces all events
   */
  loadFeed: async (feedApi, params = {}) => {
    set({ loading: true, error: null });
    
    try {
      const data = await feedApi.getFeed(params);
      const events = data.articles || data.events || [];
      
      const map = {};
      const list = [];
      
      events.forEach(e => {
        const id = e.id || e._id;
        map[id] = e;
        list.push(id);
      });
      
      set({
        events: map,
        eventList: list,
        cursor: data.next_cursor || null,
        hasMore: !!data.next_cursor || events.length >= 50,
        totalCount: data.total || list.length,
        lastUpdated: Date.now(),
        loading: false
      });
      
      return events;
    } catch (e) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },

  /**
   * Load more - appends events (pagination)
   */
  loadMore: async (feedApi, params = {}) => {
    const { cursor, hasMore, loadingMore } = get();
    if (!hasMore || loadingMore) return;
    
    set({ loadingMore: true });
    
    try {
      const data = await feedApi.getFeed({ ...params, cursor });
      const events = data.articles || data.events || [];
      
      set(state => {
        const newMap = { ...state.events };
        const newIds = [];
        
        events.forEach(e => {
          const id = e.id || e._id;
          if (!newMap[id]) {
            newMap[id] = e;
            newIds.push(id);
          }
        });
        
        return {
          events: newMap,
          eventList: [...state.eventList, ...newIds].slice(0, 2000), // Memory limit
          cursor: data.next_cursor || null,
          hasMore: !!data.next_cursor,
          loadingMore: false
        };
      });
    } catch (e) {
      set({ loadingMore: false });
    }
  },

  /**
   * Add single event (WebSocket)
   */
  addEvent: (event) => {
    const id = event.id || event._id;
    
    set(state => {
      // Update existing or prepend new
      if (state.events[id]) {
        return {
          events: { ...state.events, [id]: { ...state.events[id], ...event } }
        };
      }
      
      return {
        events: { ...state.events, [id]: event },
        eventList: [id, ...state.eventList].slice(0, 2000)
      };
    });
  },

  /**
   * Update single event
   */
  updateEvent: (id, updates) => {
    set(state => {
      if (!state.events[id]) return state;
      
      return {
        events: {
          ...state.events,
          [id]: { ...state.events[id], ...updates }
        }
      };
    });
  },

  /**
   * Select event
   */
  selectEvent: (id) => set({ selectedEventId: id }),
  clearSelection: () => set({ selectedEventId: null }),

  /**
   * Get event by ID (for hydration)
   */
  getEvent: (id) => get().events[id],
  
  /**
   * Get events array (derived)
   */
  getEventsList: () => {
    const { events, eventList } = get();
    return eventList.map(id => events[id]).filter(Boolean);
  },

  /**
   * Check if event exists
   */
  hasEvent: (id) => !!get().events[id],

  /**
   * Reset store
   */
  reset: () => set({
    events: {},
    eventList: [],
    cursor: null,
    hasMore: true,
    loading: false,
    error: null,
    selectedEventId: null
  })
}));

// ========== SELECTORS (for optimized subscriptions) ==========
export const selectEventIds = (state) => state.eventList;
export const selectEvent = (id) => (state) => state.events[id];
export const selectLoading = (state) => state.loading;
export const selectLoadingMore = (state) => state.loadingMore;
export const selectHasMore = (state) => state.hasMore;
export const selectSelectedEvent = (state) => state.events[state.selectedEventId];
export const selectError = (state) => state.error;
