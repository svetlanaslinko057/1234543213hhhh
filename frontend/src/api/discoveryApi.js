import { apiGet, apiPost } from './apiClient';

export const discoveryApi = {
  getSources: () => apiGet('/api/discovery/sources'),
  
  getEndpoints: (params = {}) => {
    const query = new URLSearchParams(params);
    return apiGet(`/api/discovery/endpoints?${query}`);
  },

  discoverDomain: (domain) => 
    apiPost(`/api/discovery/domain/${encodeURIComponent(domain)}`),

  browserDiscovery: (domain) =>
    apiPost(`/api/discovery/browser/${encodeURIComponent(domain)}`),

  rediscover: (domain) =>
    apiPost(`/api/discovery/rediscover/${encodeURIComponent(domain)}`),

  registerEndpoint: (endpointId, providerName) =>
    apiPost(`/api/discovery/endpoints/${endpointId}/register?provider_name=${providerName}`),

  search: (query, type = null, limit = 20) => {
    const params = new URLSearchParams({ q: query, limit });
    if (type) params.append('type', type);
    return apiGet(`/api/discovery/search?${params}`);
  }
};
