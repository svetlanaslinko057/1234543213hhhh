import { useState, useEffect, useCallback, useRef } from 'react';
import { WS_URL } from '../constants';

// WebSocket Hook for real-time updates
export function useWebSocket(channel = 'all') {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [breakingNews, setBreakingNews] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    try {
      wsRef.current = new WebSocket(`${WS_URL}/ws/${channel}`);
      
      wsRef.current.onopen = () => {
        console.log(`[WS] Connected to ${channel}`);
        setIsConnected(true);
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          
          // Handle breaking news specially
          if (data.type === 'breaking') {
            setBreakingNews(data);
            // Auto-dismiss after 30 seconds
            setTimeout(() => setBreakingNews(null), 30000);
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };
      
      wsRef.current.onclose = () => {
        console.log('[WS] Disconnected');
        setIsConnected(false);
        // Reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
      };
      
      wsRef.current.onerror = (err) => {
        console.error('[WS] Error:', err);
      };
    } catch (err) {
      console.error('[WS] Connection failed:', err);
    }
  }, [channel]);
  
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);
  
  const clearBreakingNews = useCallback(() => {
    setBreakingNews(null);
  }, []);
  
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);
  
  return { isConnected, lastMessage, breakingNews, clearBreakingNews };
}
