import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import { NewsController } from './news.controller';
import { NewsIntelligenceController } from './news-intelligence.controller';
import { NewsFetcherService } from './news-fetcher.service';
import { NewsSyncService } from './news-sync.service';

const FlexibleSchema = new MongooseSchema({}, { strict: false, timestamps: true });

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'news_articles', schema: FlexibleSchema },
      { name: 'news_sources', schema: FlexibleSchema },
    ]),
  ],
  controllers: [NewsController, NewsIntelligenceController],
  providers: [NewsFetcherService, NewsSyncService],
  exports: [NewsFetcherService, NewsSyncService],
})
export class NewsModule {}
