import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CryptoRankController } from './cryptorank.controller';
import { CryptoRankScraperService } from './cryptorank-scraper.service';
import { CryptoRankSyncService } from './cryptorank-sync.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'intel_fundraising', schema: {} },
      { name: 'intel_investors', schema: {} },
      { name: 'intel_unlocks', schema: {} },
      { name: 'intel_categories', schema: {} },
      { name: 'intel_launchpads', schema: {} },
      { name: 'intel_market', schema: {} },
    ]),
  ],
  controllers: [CryptoRankController],
  providers: [CryptoRankScraperService, CryptoRankSyncService],
  exports: [CryptoRankScraperService, CryptoRankSyncService],
})
export class CryptoRankModule {}
