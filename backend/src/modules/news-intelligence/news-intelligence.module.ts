/**
 * News Intelligence Module
 * 
 * BLOCK 6: News processing pipeline for intelligence extraction
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { NewsIntelligenceService } from './news-intelligence.service';
import { NewsIntelligenceController } from './news-intelligence.controller';

import { EntityExtractorService } from './extractors/entity-extractor.service';
import { EntityNormalizerService } from './normalizers/entity-normalizer.service';
import { NewsClusteringService } from './clustering/news-clustering.service';
import { NewsRankingService } from './ranking/news-ranking.service';

// Schemas
const NewsArticleSchema = {
  title: String,
  source: String,
  published_at: Date,
  content: String,
  summary: String,
  url: String,
};

const NewsEventSchema = {
  id: String,
  title: String,
  source: String,
  publishedAt: Date,
  type: String,
  entities: [{
    canonicalId: String,
    type: String,
    confidence: Number,
  }],
  content: String,
  createdAt: Date,
};

const NewsClusterSchema = {
  clusterId: { type: String, index: true },
  type: String,
  mainEntity: String,
  entities: [String],
  eventCount: Number,
  rankScore: { type: Number, index: true },
  rankFactors: {
    frequency: Number,
    recency: Number,
    sourceWeight: Number,
    entityWeight: Number,
  },
  sources: [String],
  firstSeenAt: Date,
  lastSeenAt: { type: Date, index: true },
  createdAt: Date,
};

const CanonicalEntitySchema = {
  canonical_id: String,
  slug: String,
  name: String,
  aliases: [String],
  type: String,
  confidence: Number,
};

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'news_articles', schema: NewsArticleSchema as any },
      { name: 'news_events', schema: NewsEventSchema as any },
      { name: 'news_clusters', schema: NewsClusterSchema as any },
      { name: 'canonical_entities', schema: CanonicalEntitySchema as any },
      { name: 'intel_investors', schema: {} as any },
      { name: 'intel_projects', schema: {} as any },
    ]),
  ],
  controllers: [NewsIntelligenceController],
  providers: [
    NewsIntelligenceService,
    EntityExtractorService,
    EntityNormalizerService,
    NewsClusteringService,
    NewsRankingService,
  ],
  exports: [NewsIntelligenceService],
})
export class NewsIntelligenceModule {}
