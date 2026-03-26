/**
 * DefiLlama Adapter
 * Free, reliable market data provider
 */

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { BaseAdapter } from './base.adapter';
import { AdapterResult } from '../models';

@Injectable()
export class DefiLlamaAdapter extends BaseAdapter {
  private readonly logger = new Logger(DefiLlamaAdapter.name);
  
  name = 'DefiLlama';
  priority = 100;
  
  private readonly baseUrl = 'https://api.llama.fi';
  private readonly coinsUrl = 'https://coins.llama.fi';

  async getQuote(asset: string): Promise<AdapterResult> {
    const start = Date.now();
    try {
      // DefiLlama uses coingecko IDs
      const coinId = this.mapAssetToCoinId(asset);
      const response = await axios.get(`${this.coinsUrl}/prices/current/coingecko:${coinId}`, {
        timeout: 5000,
      });

      const data = response.data.coins[`coingecko:${coinId}`];
      if (!data) {
        throw new Error(`No data for ${asset}`);
      }

      const result = {
        asset: asset.toUpperCase(),
        price: data.price,
        change24h: data.change24h,
        timestamp: Date.now(),
      };

      this.recordSuccess(Date.now() - start);
      return { success: true, data: result, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  async getBulkQuotes(assets: string[]): Promise<AdapterResult> {
    const start = Date.now();
    try {
      const coinIds = assets.map(a => `coingecko:${this.mapAssetToCoinId(a)}`).join(',');
      const response = await axios.get(`${this.coinsUrl}/prices/current/${coinIds}`, {
        timeout: 10000,
      });

      const quotes = [];
      for (const asset of assets) {
        const key = `coingecko:${this.mapAssetToCoinId(asset)}`;
        const data = response.data.coins[key];
        if (data) {
          quotes.push({
            asset: asset.toUpperCase(),
            price: data.price,
            change24h: data.change24h,
            timestamp: Date.now(),
            source: this.name,
          });
        }
      }

      this.recordSuccess(Date.now() - start);
      return { success: true, data: quotes, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  async getOverview(): Promise<AdapterResult> {
    const start = Date.now();
    try {
      const [tvlResponse, chainsResponse] = await Promise.all([
        axios.get(`${this.baseUrl}/v2/historicalChainTvl`, { timeout: 5000 }),
        axios.get(`${this.baseUrl}/v2/chains`, { timeout: 5000 }),
      ]);

      const totalTvl = chainsResponse.data.reduce((sum: number, chain: any) => sum + (chain.tvl || 0), 0);

      const result = {
        ts: Date.now(),
        totalValueLocked: totalTvl,
        chains: chainsResponse.data.length,
        source: this.name,
      };

      this.recordSuccess(Date.now() - start);
      return { success: true, data: result, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  async getCandles(asset: string, interval: string, limit: number): Promise<AdapterResult> {
    const start = Date.now();
    try {
      const coinId = this.mapAssetToCoinId(asset);
      const response = await axios.get(
        `${this.coinsUrl}/chart/coingecko:${coinId}?span=${limit}&period=${interval}`,
        { timeout: 10000 }
      );

      const candles = response.data.coins[`coingecko:${coinId}`]?.prices?.map((p: any) => ({
        timestamp: p.timestamp * 1000,
        open: p.price,
        high: p.price,
        low: p.price,
        close: p.price,
        volume: 0,
      })) || [];

      this.recordSuccess(Date.now() - start);
      return { success: true, data: candles, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  async healthCheck(): Promise<AdapterResult> {
    const start = Date.now();
    try {
      await axios.get(`${this.baseUrl}/v2/chains`, { timeout: 3000 });
      this.recordSuccess(Date.now() - start);
      return { success: true, source: this.name, latencyMs: Date.now() - start };
    } catch (e: any) {
      this.recordError(e.message);
      return { success: false, error: e.message, source: this.name, latencyMs: Date.now() - start };
    }
  }

  private mapAssetToCoinId(asset: string): string {
    const mapping: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'SOL': 'solana',
      'BNB': 'binancecoin',
      'XRP': 'ripple',
      'ADA': 'cardano',
      'DOGE': 'dogecoin',
      'AVAX': 'avalanche-2',
      'DOT': 'polkadot',
      'MATIC': 'matic-network',
      'LINK': 'chainlink',
      'UNI': 'uniswap',
      'ATOM': 'cosmos',
      'LTC': 'litecoin',
      'ARB': 'arbitrum',
      'OP': 'optimism',
      'APT': 'aptos',
      'SUI': 'sui',
      'NEAR': 'near',
      'FIL': 'filecoin',
      'AAVE': 'aave',
      'LDO': 'lido-dao',
      'INJ': 'injective-protocol',
    };
    return mapping[asset.toUpperCase()] || asset.toLowerCase();
  }
}
