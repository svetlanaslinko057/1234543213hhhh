/**
 * Data Hydration Layer
 * 
 * Purpose: Single entry point for all data loading
 * - Prevents duplicate API calls
 * - Caches data in stores
 * - Batch loading support
 * 
 * Usage:
 *   const event = await hydrateEvent(id);
 *   const project = await hydrateProject(id);
 */

import { useEventStore } from '../store/eventStore';
import { useDiscoveryStore } from '../store/discoveryStore';
import { useGraphStore } from '../store/graphStore';
import { feedApi, discoveryApi, graphApi } from '../api';

// ========== EVENT HYDRATION ==========

/**
 * Hydrate single event
 * Returns cached if exists, fetches if not
 */
export async function hydrateEvent(id) {
  const store = useEventStore.getState();
  
  // Return cached
  if (store.events[id]) {
    return store.events[id];
  }
  
  // Fetch and cache
  try {
    const event = await feedApi.getEvent(id);
    store.addEvent(event);
    return event;
  } catch (e) {
    console.error(`Failed to hydrate event ${id}:`, e);
    return null;
  }
}

/**
 * Hydrate multiple events (batch)
 */
export async function hydrateEvents(ids) {
  const store = useEventStore.getState();
  const missing = ids.filter(id => !store.events[id]);
  
  if (missing.length === 0) {
    return ids.map(id => store.events[id]);
  }
  
  // Batch fetch missing
  try {
    const events = await Promise.all(
      missing.map(id => feedApi.getEvent(id).catch(() => null))
    );
    
    events.filter(Boolean).forEach(event => {
      store.addEvent(event);
    });
  } catch (e) {
    console.error('Failed to batch hydrate events:', e);
  }
  
  return ids.map(id => store.getEvent(id)).filter(Boolean);
}

// ========== SOURCE HYDRATION ==========

/**
 * Hydrate discovery sources
 */
export async function hydrateSources() {
  const store = useDiscoveryStore.getState();
  
  // Return cached if fresh (5 min)
  if (store.sources.length > 0 && store.lastUpdated) {
    const age = Date.now() - store.lastUpdated;
    if (age < 5 * 60 * 1000) {
      return store.sources;
    }
  }
  
  try {
    store.setLoading(true);
    const data = await discoveryApi.getSources();
    const sources = data.sources || [];
    store.setSources(sources);
    store.setLastUpdated(Date.now());
    return sources;
  } catch (e) {
    store.setError(e.message);
    return [];
  } finally {
    store.setLoading(false);
  }
}

/**
 * Hydrate endpoints
 */
export async function hydrateEndpoints(params = {}) {
  const store = useDiscoveryStore.getState();
  
  try {
    const data = await discoveryApi.getEndpoints(params);
    const endpoints = data.endpoints || [];
    store.setEndpoints(endpoints);
    return endpoints;
  } catch (e) {
    console.error('Failed to hydrate endpoints:', e);
    return [];
  }
}

// ========== GRAPH HYDRATION ==========

/**
 * Hydrate graph node
 */
export async function hydrateNode(type, id) {
  const store = useGraphStore.getState();
  const key = `${type}:${id}`;
  
  // Check cache
  const cached = store.nodes.find(n => n.type === type && n.id === id);
  if (cached) {
    return cached;
  }
  
  try {
    const node = await graphApi.getNode(type, id);
    // Add to store
    store.setNodes([...store.nodes.filter(n => !(n.type === type && n.id === id)), node]);
    return node;
  } catch (e) {
    console.error(`Failed to hydrate node ${key}:`, e);
    return null;
  }
}

/**
 * Hydrate graph neighbors
 */
export async function hydrateNeighbors(type, id, depth = 1) {
  const store = useGraphStore.getState();
  
  try {
    const data = await graphApi.getNeighbors(type, id, depth);
    const neighbors = data.neighbors || [];
    store.setNeighbors(neighbors);
    return neighbors;
  } catch (e) {
    console.error(`Failed to hydrate neighbors for ${type}:${id}:`, e);
    return [];
  }
}

/**
 * Hydrate graph stats
 */
export async function hydrateGraphStats() {
  const store = useGraphStore.getState();
  
  try {
    const stats = await graphApi.getStats();
    store.setStats(stats);
    return stats;
  } catch (e) {
    console.error('Failed to hydrate graph stats:', e);
    return null;
  }
}

// ========== UTILS ==========

/**
 * Clear all hydration caches
 */
export function clearHydrationCache() {
  useEventStore.getState().reset();
  useDiscoveryStore.getState().reset();
  useGraphStore.getState().reset();
}

/**
 * Prefetch common data on app load
 */
export async function prefetchCommonData() {
  await Promise.all([
    hydrateSources(),
    hydrateGraphStats()
  ]);
}
