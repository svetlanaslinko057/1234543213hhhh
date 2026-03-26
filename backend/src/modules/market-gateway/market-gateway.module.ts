/**
 * Market Gateway Module
 * Providers: DefiLlama, Coinbase, HyperLiquid
 * (Binance/Bybit disabled - need proxy)
 */

import { Module } from '@nestjs/common';
import { MarketGatewayController } from './market-gateway.controller';
import { MarketExtendedController } from './market-extended.controller';
import { MarketGatewayService } from './market-gateway.service';
import { DefiLlamaAdapter } from './adapters/defillama.adapter';
import { ExchangeAdapter } from './adapters/exchange.adapter';
import { CoinbaseAdapter } from './adapters/coinbase.adapter';
import { HyperLiquidAdapter } from './adapters/hyperliquid.adapter';

@Module({
  controllers: [MarketGatewayController, MarketExtendedController],
  providers: [
    MarketGatewayService,
    DefiLlamaAdapter,
    ExchangeAdapter,
    CoinbaseAdapter,
    HyperLiquidAdapter,
  ],
  exports: [MarketGatewayService],
})
export class MarketGatewayModule {}
