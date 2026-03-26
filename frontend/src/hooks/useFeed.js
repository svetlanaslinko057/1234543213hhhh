import { useEffect, useCallback } from 'react';
import { useFeedStore } from '../store/feedStore';
import { feedApi } from '../api/feedApi';

export function useFeed() {
  const {
    events,
    articles,
    stats,
    loading,
    error,
    filters,
    cursor,
    hasMore,
    setEvents,
    appendEvents,
    setStats,
    setLoading,
    setError,
    setCursor,
    setHasMore
  } = useFeedStore();

  const fetchFeed = useCallback(async (reset = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const params = {
        limit: 50,
        cursor: reset ? null : cursor,
        sentiment: filters.sentiment !== 'all' ? filters.sentiment : undefined,
        event_type: filters.eventType !== 'all' ? filters.eventType : undefined
      };
      
      const data = await feedApi.getFeed(params);
      
      if (reset) {
        setEvents(data.articles || data.events || []);
      } else {
        appendEvents(data.articles || data.events || []);
      }
      
      setCursor(data.next_cursor || null);
      setHasMore(!!data.next_cursor);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [cursor, filters, setEvents, appendEvents, setLoading, setError, setCursor, setHasMore]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await feedApi.getStats();
      setStats(data);
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  }, [setStats]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchFeed(false);
    }
  }, [loading, hasMore, fetchFeed]);

  const refresh = useCallback(() => {
    fetchFeed(true);
  }, [fetchFeed]);

  useEffect(() => {
    fetchFeed(true);
    fetchStats();
  }, [filters]);

  return {
    events,
    articles,
    stats,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  };
}

export default useFeed;
