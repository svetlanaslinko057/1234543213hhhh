import { useEffect, useCallback } from 'react';
import { useDiscoveryStore } from '../store/discoveryStore';
import { discoveryApi } from '../api/discoveryApi';
import { adminApi } from '../api/adminApi';

export function useDiscovery() {
  const {
    sources,
    endpoints,
    searchResults,
    pipelineStatus,
    sourceHealth,
    tierStatus,
    healthAlerts,
    loading,
    searchLoading,
    error,
    searchQuery,
    discoveryType,
    setSources,
    setEndpoints,
    setSearchResults,
    setPipelineStatus,
    setSourceHealth,
    setTierStatus,
    setHealthAlerts,
    setAlertStats,
    setLoading,
    setSearchLoading,
    setError,
    setParsingProgress
  } = useDiscoveryStore();

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const data = await discoveryApi.getSources();
      setSources(data.sources || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [setSources, setLoading, setError]);

  const fetchEndpoints = useCallback(async () => {
    try {
      const data = await discoveryApi.getEndpoints({ limit: 50 });
      setEndpoints(data.endpoints || []);
    } catch (e) {
      console.error('Failed to fetch endpoints:', e);
    }
  }, [setEndpoints]);

  const fetchHealthData = useCallback(async () => {
    try {
      const [healthRes, tiersRes, alertsRes] = await Promise.all([
        adminApi.getSchedulerHealth(),
        adminApi.getSchedulerTiers(),
        adminApi.getSchedulerAlerts()
      ]);
      
      setSourceHealth(healthRes.sources || {});
      setTierStatus(tiersRes || {});
      setHealthAlerts(alertsRes.alerts || []);
      setAlertStats(alertsRes.stats || {});
    } catch (e) {
      console.error('Failed to fetch health data:', e);
    }
  }, [setSourceHealth, setTierStatus, setHealthAlerts, setAlertStats]);

  const search = useCallback(async (query, type = null) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setSearchLoading(true);
    try {
      const data = await discoveryApi.search(query, type);
      setSearchResults(data.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setSearchLoading(false);
    }
  }, [setSearchResults, setSearchLoading, setError]);

  const discoverDomain = useCallback(async (domain) => {
    const cleanDomain = domain.replace(/https?:\/\//, '').split('/')[0].replace('www.', '');
    setParsingProgress(cleanDomain, 'discovering');
    
    try {
      const data = await discoveryApi.discoverDomain(cleanDomain);
      const activeEndpoints = data.endpoints?.filter(ep => ep.status === 'active') || [];
      
      if (activeEndpoints.length > 0) {
        setParsingProgress(cleanDomain, 'success');
        fetchEndpoints();
        return data;
      }
      
      setParsingProgress(cleanDomain, 'browser_discovery');
      const browserData = await discoveryApi.browserDiscovery(cleanDomain);
      
      if (browserData.ok) {
        setParsingProgress(cleanDomain, 'running');
        setTimeout(() => {
          fetchEndpoints();
          setParsingProgress(cleanDomain, 'success');
        }, 15000);
      } else {
        setParsingProgress(cleanDomain, 'no_endpoints');
      }
      
      return browserData;
    } catch (e) {
      setParsingProgress(cleanDomain, 'error');
      throw e;
    }
  }, [setParsingProgress, fetchEndpoints]);

  useEffect(() => {
    fetchSources();
    fetchEndpoints();
    fetchHealthData();
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timer = setTimeout(() => {
        search(searchQuery, discoveryType);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, discoveryType, search]);

  return {
    sources,
    endpoints,
    searchResults,
    pipelineStatus,
    sourceHealth,
    tierStatus,
    healthAlerts,
    loading,
    searchLoading,
    error,
    fetchSources,
    fetchEndpoints,
    fetchHealthData,
    search,
    discoverDomain
  };
}

export default useDiscovery;
