/**
 * Market Gateway Data Models
 */

export enum ProviderStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  DOWN = 'down',
  UNKNOWN = 'unknown',
}

export interface QuoteData {
  asset: string;
  price: number;
  change24h?: number;
  change7d?: number;
  volume24h?: number;
  marketCap?: number;
  source: string;
  timestamp: number;
}

export interface MarketOverview {
  ts: number;
  marketCapTotal: number;
  btcDominance: number;
  ethDominance?: number;
  volume24h: number;
  activeCryptocurrencies?: number;
  source: string;
}

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ExchangeInfo {
  exchange: string;
  symbol: string;
  price?: number;
  volume24h?: number;
  bid?: number;
  ask?: number;
  spread?: number;
  status: string;
}

export interface OrderbookEntry {
  price: number;
  amount: number;
}

export interface TradeData {
  id: string;
  price: number;
  amount: number;
  side: string;
  timestamp: number;
}

export interface ProviderHealth {
  id: string;
  name: string;
  status: ProviderStatus;
  latencyMs?: number;
  lastCheck?: Date;
  error?: string;
}

export interface AdapterResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  source: string;
  latencyMs: number;
}
