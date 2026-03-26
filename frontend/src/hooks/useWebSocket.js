import { useEffect, useRef, useCallback } from 'react';
import { useFeedStore } from '../store/feedStore';

const WS_URL = (process.env.REACT_APP_BACKEND_URL || '')
  .replace('https://', 'wss://')
  .replace('http://', 'ws://');

export function useWebSocket(channel = 'all') {
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxRetries = 5;

  const { prependEvent, setBreakingNews } = useFeedStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      wsRef.current = new WebSocket(`${WS_URL}/ws/${channel}`);

      wsRef.current.onopen = () => {
        console.log(`[WS] Connected to ${channel}`);
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'news_event' || data.type === 'article') {
            prependEvent(data.payload || data);
          }
          
          if (data.type === 'breaking' || data.fomo_score >= 85) {
            setBreakingNews(data);
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      wsRef.current.onclose = () => {
        console.log('[WS] Disconnected');
        
        if (reconnectAttempts.current < maxRetries) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('[WS] Error:', error);
      };
    } catch (e) {
      console.error('[WS] Connection failed:', e);
    }
  }, [channel, prependEvent, setBreakingNews]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return {
    connected: wsRef.current?.readyState === WebSocket.OPEN,
    send,
    reconnect: connect
  };
}

export default useWebSocket;
