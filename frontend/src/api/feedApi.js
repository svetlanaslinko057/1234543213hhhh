import { apiGet, apiPost } from './apiClient';

export const feedApi = {
  getFeed: (params = {}) => {
    const { limit = 50, offset = 0, sentiment, event_type, cursor } = params;
    const query = new URLSearchParams();
    if (limit) query.append('limit', limit);
    if (offset) query.append('offset', offset);
    if (sentiment) query.append('sentiment', sentiment);
    if (event_type) query.append('event_type', event_type);
    if (cursor) query.append('cursor', cursor);
    return apiGet(`/api/news/feed?${query}`);
  },

  getEvents: (params = {}) => {
    const query = new URLSearchParams(params);
    return apiGet(`/api/news/events?${query}`);
  },

  getEvent: (id) => apiGet(`/api/news/events/${id}`),

  getStats: () => apiGet('/api/news/stats'),

  getSentimentStats: () => apiGet('/api/news/sentiment/stats'),

  getBreaking: () => apiGet('/api/news/breaking'),

  search: (query, limit = 20) => 
    apiGet(`/api/news/search?q=${encodeURIComponent(query)}&limit=${limit}`)
};
