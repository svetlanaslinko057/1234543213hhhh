export const config = {
  // WebSocket
  WS_RECONNECT_INTERVAL: 3000,
  WS_MAX_RETRIES: 5,
  
  // Pagination
  DEFAULT_PAGE_SIZE: 50,
  MAX_FEED_SIZE: 2000,
  
  // Cache
  CACHE_TTL: 30000,
  
  // Refresh intervals
  DASHBOARD_REFRESH: 30000,
  FEED_REFRESH: 60000,
  
  // UI
  DEBOUNCE_DELAY: 500,
  TOAST_DURATION: 5000
};

export default config;
