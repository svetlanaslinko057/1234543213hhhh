import { create } from 'zustand';

export const useAdminStore = create((set) => ({
  // Data
  proxies: [],
  apiKeys: [],
  llmKeys: [],
  providers: [],
  providerPool: [],
  newsSources: [],
  schedulerStatus: null,
  systemStats: null,
  
  // UI State
  loading: false,
  error: null,
  activeSection: 'overview',

  // Actions
  setProxies: (proxies) => set({ proxies }),
  addProxy: (proxy) => set(state => ({ 
    proxies: [...state.proxies, proxy] 
  })),
  removeProxy: (id) => set(state => ({ 
    proxies: state.proxies.filter(p => p.id !== id) 
  })),
  
  setApiKeys: (keys) => set({ apiKeys: keys }),
  addApiKey: (key) => set(state => ({ 
    apiKeys: [...state.apiKeys, key] 
  })),
  removeApiKey: (id) => set(state => ({ 
    apiKeys: state.apiKeys.filter(k => k.id !== id) 
  })),
  
  setLlmKeys: (keys) => set({ llmKeys: keys }),
  addLlmKey: (key) => set(state => ({ 
    llmKeys: [...state.llmKeys, key] 
  })),
  removeLlmKey: (id) => set(state => ({ 
    llmKeys: state.llmKeys.filter(k => k.id !== id) 
  })),
  
  setProviders: (providers) => set({ providers }),
  setProviderPool: (pool) => set({ providerPool: pool }),
  setNewsSources: (sources) => set({ newsSources: sources }),
  setSchedulerStatus: (status) => set({ schedulerStatus: status }),
  setSystemStats: (stats) => set({ systemStats: stats }),
  
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setActiveSection: (section) => set({ activeSection: section }),
  
  reset: () => set({
    proxies: [],
    apiKeys: [],
    llmKeys: [],
    loading: false,
    error: null
  })
}));
