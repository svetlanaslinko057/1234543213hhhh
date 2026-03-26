/**
 * Extended Market Data Controller
 * Derivatives, Spot, On-chain endpoints from legacy API
 */

import { Controller, Get, Query, Param, HttpException, HttpStatus } from '@nestjs/common';
import { MarketGatewayService } from './market-gateway.service';

@Controller('market')
export class MarketExtendedController {
  constructor(private readonly gateway: MarketGatewayService) {}

  // ═══════════════════════════════════════════════════════════════
  // DERIVATIVES
  // ═══════════════════════════════════════════════════════════════

  @Get('derivatives/funding')
  async getDerivativesFunding() {
    try {
      return await this.gateway.getFundingRates();
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('derivatives/funding/:symbol')
  async getSymbolFunding(@Param('symbol') symbol: string) {
    try {
      const data = await this.gateway.getFundingRates();
      const funding = data.funding_rates?.find((f: any) => 
        f.coin?.toUpperCase() === symbol.toUpperCase()
      );
      return { ok: true, symbol, funding };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('derivatives/funding/extremes')
  async getFundingExtremes() {
    try {
      const data = await this.gateway.getFundingRates();
      const rates = data.funding_rates || [];
      
      const sorted = rates.sort((a: any, b: any) => 
        Math.abs(b.fundingAnnualized || 0) - Math.abs(a.fundingAnnualized || 0)
      );
      
      return {
        ok: true,
        ts: Date.now(),
        most_positive: sorted.filter((r: any) => r.fundingAnnualized > 0).slice(0, 10),
        most_negative: sorted.filter((r: any) => r.fundingAnnualized < 0).slice(0, 10),
      };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('derivatives/open-interest')
  async getOpenInterest() {
    try {
      const data = await this.gateway.getPerpsOverview();
      return {
        ok: true,
        ts: Date.now(),
        total_oi: data.totalOpenInterest,
        total_volume_24h: data.totalVolume24h,
        assets: data.universe?.length || 0,
      };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('derivatives/liquidations')
  async getLiquidations() {
    // Placeholder - would need WebSocket data
    return {
      ok: true,
      ts: Date.now(),
      message: 'Liquidations require real-time WebSocket connection',
      source: 'hyperliquid',
    };
  }

  @Get('derivatives/long-short')
  async getLongShortRatio() {
    try {
      const data = await this.gateway.getFundingRates();
      const rates = data.funding_rates || [];
      
      // Positive funding = more longs, negative = more shorts
      const bullish = rates.filter((r: any) => r.funding > 0).length;
      const bearish = rates.filter((r: any) => r.funding < 0).length;
      
      return {
        ok: true,
        ts: Date.now(),
        bullish_count: bullish,
        bearish_count: bearish,
        ratio: bullish / (bearish || 1),
        sentiment: bullish > bearish ? 'bullish' : 'bearish',
      };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SPOT MARKET
  // ═══════════════════════════════════════════════════════════════

  @Get('spot/top')
  async getSpotTop(@Query('limit') limit: string = '20') {
    try {
      const assets = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC'];
      const quotes = await this.gateway.getBulkQuotes(assets.slice(0, parseInt(limit, 10)));
      return { ok: true, ts: Date.now(), quotes };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('spot/gainers')
  async getSpotGainers() {
    return {
      ok: true,
      ts: Date.now(),
      message: 'Requires price history for % change calculation',
      source: 'defilama',
    };
  }

  @Get('spot/losers')
  async getSpotLosers() {
    return {
      ok: true,
      ts: Date.now(),
      message: 'Requires price history for % change calculation',
      source: 'defilama',
    };
  }

  @Get('spot/volume-leaders')
  async getVolumeLeaders() {
    try {
      const overview = await this.gateway.getOverview();
      return { ok: true, ts: Date.now(), data: overview };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ON-CHAIN DATA
  // ═══════════════════════════════════════════════════════════════

  @Get('onchain/tvl')
  async getOnchainTvl() {
    try {
      const data = await this.gateway.getOverview();
      return {
        ok: true,
        ts: Date.now(),
        tvl: data,
        source: 'defillama',
      };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('onchain/tvl/:chain')
  async getChainTvl(@Param('chain') chain: string) {
    return {
      ok: true,
      ts: Date.now(),
      chain,
      message: 'Chain-specific TVL requires DeFiLlama chains endpoint',
    };
  }

  @Get('onchain/protocols')
  async getProtocols() {
    return {
      ok: true,
      ts: Date.now(),
      message: 'Protocol list available via DeFiLlama /protocols',
      source: 'defillama',
    };
  }

  @Get('onchain/stablecoins')
  async getStablecoins() {
    return {
      ok: true,
      ts: Date.now(),
      message: 'Stablecoin data available via DeFiLlama /stablecoins',
      source: 'defillama',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // GLOBAL MARKET
  // ═══════════════════════════════════════════════════════════════

  @Get('global/stats')
  async getGlobalStats() {
    try {
      const [overview, perps] = await Promise.all([
        this.gateway.getOverview(),
        this.gateway.getPerpsOverview(),
      ]);
      
      return {
        ok: true,
        ts: Date.now(),
        spot: overview,
        derivatives: perps,
      };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('global/dominance')
  async getDominance() {
    try {
      const btc = await this.gateway.getQuote('BTC');
      const eth = await this.gateway.getQuote('ETH');
      
      return {
        ok: true,
        ts: Date.now(),
        btc_price: btc.price,
        eth_price: eth.price,
        message: 'Dominance requires total market cap data',
      };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('global/fear-greed')
  async getFearGreed() {
    return {
      ok: true,
      ts: Date.now(),
      message: 'Fear & Greed requires external API (alternative.me)',
      source: 'alternative.me',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // EXCHANGE-SPECIFIC
  // ═══════════════════════════════════════════════════════════════

  @Get('exchanges/list')
  async listExchanges() {
    return {
      ok: true,
      exchanges: [
        { id: 'coinbase', name: 'Coinbase', type: 'spot', status: 'active' },
        { id: 'hyperliquid', name: 'HyperLiquid', type: 'perps', status: 'active' },
        { id: 'defillama', name: 'DeFiLlama', type: 'aggregator', status: 'active' },
        { id: 'binance', name: 'Binance', type: 'spot', status: 'disabled', reason: 'proxy required' },
        { id: 'bybit', name: 'Bybit', type: 'perps', status: 'disabled', reason: 'proxy required' },
      ],
    };
  }

  @Get('exchanges/:exchange/status')
  async getExchangeStatus(@Param('exchange') exchange: string) {
    try {
      const health = await this.gateway.getProvidersHealth();
      const provider = health.providers?.[exchange];
      
      return {
        ok: true,
        exchange,
        status: provider?.status || 'unknown',
        latency: provider?.latency_ms || null,
      };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('exchanges/:exchange/pairs')
  async getExchangePairs(@Param('exchange') exchange: string) {
    return {
      ok: true,
      exchange,
      message: 'Pair listing requires exchange-specific API call',
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ASSET-SPECIFIC
  // ═══════════════════════════════════════════════════════════════

  @Get('asset/:symbol')
  async getAssetData(@Param('symbol') symbol: string) {
    try {
      const [spot, perp] = await Promise.all([
        this.gateway.getQuote(symbol).catch(() => null),
        this.gateway.getPerpsQuote(symbol).catch(() => null),
      ]);
      
      return {
        ok: true,
        symbol: symbol.toUpperCase(),
        ts: Date.now(),
        spot,
        perp,
      };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('asset/:symbol/full')
  async getAssetFullData(@Param('symbol') symbol: string) {
    try {
      const [quote, orderbook, candles] = await Promise.all([
        this.gateway.getQuote(symbol),
        this.gateway.getOrderbook(symbol, 'coinbase', 10).catch(() => null),
        this.gateway.getCandles(symbol, '1h', 24).catch(() => null),
      ]);
      
      return {
        ok: true,
        symbol: symbol.toUpperCase(),
        ts: Date.now(),
        quote,
        orderbook,
        candles,
      };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // HISTORICAL
  // ═══════════════════════════════════════════════════════════════

  @Get('historical/:symbol')
  async getHistorical(
    @Param('symbol') symbol: string,
    @Query('interval') interval: string = '1d',
    @Query('days') days: string = '30'
  ) {
    try {
      const candles = await this.gateway.getCandles(symbol, interval, parseInt(days, 10));
      return { ok: true, symbol, interval, candles };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('historical/:symbol/ohlcv')
  async getOHLCV(
    @Param('symbol') symbol: string,
    @Query('interval') interval: string = '1h',
    @Query('limit') limit: string = '100'
  ) {
    try {
      const candles = await this.gateway.getCandles(symbol, interval, parseInt(limit, 10));
      return { ok: true, symbol, interval, data: candles };
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
