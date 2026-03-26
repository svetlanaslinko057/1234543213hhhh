import { apiGet, apiPost, apiPut, apiDelete } from './apiClient';

export const adminApi = {
  // Health & Status
  getHealth: () => apiGet('/api/health'),
  getSystemStats: () => apiGet('/api/system/stats'),
  
  // Scheduler
  getSchedulerStatus: () => apiGet('/api/scheduler/status'),
  getSchedulerHealth: () => apiGet('/api/scheduler/health'),
  getSchedulerTiers: () => apiGet('/api/scheduler/tiers'),
  getSchedulerAlerts: () => apiGet('/api/scheduler/alerts'),
  triggerJob: (jobId) => apiPost(`/api/scheduler/trigger/${jobId}`),

  // Proxies
  getProxies: () => apiGet('/api/admin/proxies'),
  addProxy: (proxy) => apiPost('/api/admin/proxies', proxy),
  deleteProxy: (id) => apiDelete(`/api/admin/proxies/${id}`),
  testProxy: (id) => apiPost(`/api/admin/proxies/${id}/test`),

  // API Keys
  getApiKeys: () => apiGet('/api/admin/api-keys'),
  addApiKey: (key) => apiPost('/api/admin/api-keys', key),
  updateApiKey: (id, data) => apiPut(`/api/admin/api-keys/${id}`, data),
  deleteApiKey: (id) => apiDelete(`/api/admin/api-keys/${id}`),

  // LLM Keys
  getLlmKeys: () => apiGet('/api/admin/llm-keys'),
  addLlmKey: (key) => apiPost('/api/admin/llm-keys', key),
  deleteLlmKey: (id) => apiDelete(`/api/admin/llm-keys/${id}`),
  testLlmKey: (id) => apiPost(`/api/admin/llm-keys/${id}/test`),

  // Providers
  getProviders: () => apiGet('/api/admin/providers'),
  getProviderPool: () => apiGet('/api/admin/provider-pool'),

  // News Sources
  getNewsSources: () => apiGet('/api/news/sources'),
  addNewsSource: (source) => apiPost('/api/news/sources', source),
  updateNewsSource: (id, data) => apiPut(`/api/news/sources/${id}`, data),
  deleteNewsSource: (id) => apiDelete(`/api/news/sources/${id}`)
};
