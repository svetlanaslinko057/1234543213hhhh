/**
 * Market Gateway Controller
 * Full market data API with multiple exchange support
 */

import { Controller, Get, Query, Param, HttpException, HttpStatus } from '@nestjs/common';
import { MarketGatewayService } from './market-gateway.service';

@Controller('market')
export class MarketGatewayController {
  constructor(private readonly gateway: MarketGatewayService) {}

  // ═══════════════════════════════════════════════════════════════
  // QUOTE ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  @Get('quote')
  async getQuote(@Query('asset') asset: string) {
    if (!asset) {
      throw new HttpException('Asset parameter is required', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.gateway.getQuote(asset);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('quotes')
  async getBulkQuotes(@Query('assets') assets: string) {
    if (!assets) {
      throw new HttpException('Assets parameter is required', HttpStatus.BAD_REQUEST);
    }
    try {
      const assetList = assets.split(',').map(a => a.trim());
      return await this.gateway.getBulkQuotes(assetList);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MARKET OVERVIEW
  // ═══════════════════════════════════════════════════════════════

  @Get('overview')
  async getOverview() {
    try {
      return await this.gateway.getOverview();
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('tvl')
  async getTvl() {
    try {
      return await this.gateway.getOverview();
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CANDLES / OHLCV
  // ═══════════════════════════════════════════════════════════════

  @Get('candles')
  async getCandles(
    @Query('asset') asset: string,
    @Query('interval') interval: string = '1h',
    @Query('limit') limit: string = '100',
  ) {
    if (!asset) {
      throw new HttpException('Asset parameter is required', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.gateway.getCandles(asset, interval, parseInt(limit, 10));
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('candles/:asset')
  async getCandlesByAsset(
    @Param('asset') asset: string,
    @Query('interval') interval: string = '1h',
    @Query('limit') limit: string = '100',
  ) {
    try {
      return await this.gateway.getCandles(asset, interval, parseInt(limit, 10));
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // EXCHANGE DATA
  // ═══════════════════════════════════════════════════════════════

  @Get('exchanges/:asset')
  async getExchanges(@Param('asset') asset: string) {
    try {
      return await this.gateway.getExchanges(asset);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('orderbook')
  async getOrderbookByQuery(
    @Query('asset') asset: string,
    @Query('exchange') exchange: string = 'coinbase',
    @Query('limit') limit: string = '20',
  ) {
    if (!asset) {
      throw new HttpException('Asset parameter is required', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.gateway.getOrderbook(asset, exchange, parseInt(limit, 10));
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('orderbook/:asset')
  async getOrderbook(
    @Param('asset') asset: string,
    @Query('exchange') exchange: string = 'coinbase',
    @Query('limit') limit: string = '20',
  ) {
    try {
      return await this.gateway.getOrderbook(asset, exchange, parseInt(limit, 10));
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('trades')
  async getTradesByQuery(
    @Query('asset') asset: string,
    @Query('exchange') exchange: string = 'coinbase',
    @Query('limit') limit: string = '50',
  ) {
    if (!asset) {
      throw new HttpException('Asset parameter is required', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.gateway.getTrades(asset, exchange, parseInt(limit, 10));
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('trades/:asset')
  async getTrades(
    @Param('asset') asset: string,
    @Query('exchange') exchange: string = 'coinbase',
    @Query('limit') limit: string = '50',
  ) {
    try {
      return await this.gateway.getTrades(asset, exchange, parseInt(limit, 10));
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PERPETUALS (HyperLiquid)
  // ═══════════════════════════════════════════════════════════════

  @Get('perps/funding')
  async getFundingRates() {
    try {
      return await this.gateway.getFundingRates();
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('perps/overview')
  async getPerpsOverview() {
    try {
      return await this.gateway.getPerpsOverview();
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('perps/quote')
  async getPerpsQuote(@Query('asset') asset: string) {
    if (!asset) {
      throw new HttpException('Asset parameter is required', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.gateway.getPerpsQuote(asset);
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // HEALTH & STATUS
  // ═══════════════════════════════════════════════════════════════

  @Get('providers/health')
  async getProvidersHealth() {
    try {
      return await this.gateway.getProvidersHealth();
    } catch (e: any) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('providers/list')
  async listProviders() {
    return {
      ts: Date.now(),
      providers: [
        { id: 'defillama', name: 'DefiLlama', type: 'aggregator', status: 'active', proxy_required: false },
        { id: 'coinbase', name: 'Coinbase', type: 'cex', status: 'active', proxy_required: false },
        { id: 'hyperliquid', name: 'HyperLiquid', type: 'dex_perps', status: 'active', proxy_required: false },
        { id: 'binance', name: 'Binance', type: 'cex', status: 'disabled', proxy_required: true },
        { id: 'bybit', name: 'Bybit', type: 'cex', status: 'disabled', proxy_required: true },
      ],
      active: ['defillama', 'coinbase', 'hyperliquid'],
      disabled: ['binance', 'bybit'],
      reason_disabled: 'Proxy required for Binance/Bybit due to geo-restrictions',
    };
  }

  @Get('cache/stats')
  async getCacheStats() {
    return this.gateway.getCacheStats();
  }
}
