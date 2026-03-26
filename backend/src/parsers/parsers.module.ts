/**
 * Parsers Module - NestJS module for new parser architecture
 * 
 * Includes:
 * - Parser orchestrators (Dropstab, CryptoRank)
 * - Investor extraction
 * - Data normalization & deduplication
 * - Data validation
 * - Entity Resolution Engine (Arkham-level)
 * - Smart Money Intelligence
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ParserOrchestrator } from './application/parser.orchestrator';
import { MasterOrchestrator } from './application/master.orchestrator';
import { InvestorExtractionService } from './extraction/investor-extraction.service';
import { InvestorNormalizationService } from './normalization/investor-normalization.service';
import { DataValidationService } from './validation/data-validation.service';
import { EntityResolutionService } from './resolution/entity-resolution.service';
import { SmartMoneyService } from './resolution/smart-money.service';
import { ParserController } from './parser.controller';
import { DataQualityController } from './data-quality.controller';
import { EntityResolutionController } from './resolution/entity-resolution.controller';
import { SmartMoneyController } from './resolution/smart-money.controller';
// Unified Parser Registry
import { UnifiedParserOrchestrator } from './registry/unified.orchestrator';
import { UnifiedParserController } from './registry/unified.controller';
// Anti-block layer
import {
  HttpFingerprintService,
  ProxyPoolService,
  CircuitBreakerService,
  ResilientFetchService,
  ParserHealthService,
  ParserGuardService,
} from './antiblock';
// Enhanced Proxy with failover + persistence
import { EnhancedProxyPoolService } from './antiblock/enhanced-proxy-pool.service';
import { ProxyAdminController } from './antiblock/proxy-admin.controller';
// Stable orchestrator
import { StableParserOrchestrator } from './registry/stable.orchestrator';
import { ParserHealthController } from './registry/parser-health.controller';
// RSS Fallback
import { HtmlParserService } from './fallback/html-parser.service';
import { RssFallbackEngine } from './fallback/rss-fallback.engine';
import { RssFallbackController } from './fallback/rss-fallback.controller';
// Parser Operations Layer
import {
  ParserRuntimeStateService,
  ParserLogService,
  ParserReportService,
  ParserOpsService,
  ParserOpsController,
} from './ops';
// Self-Learning Intelligence Layer
import {
  SchemaDriftService,
  StrategyLearningService,
  PayloadDiscoveryService,
  AnomalyDetectionService,
  AutoRecoveryService,
  IntelligenceController,
} from './intelligence';

// Schemas (reuse from intel module)
const IntelSchemas = [
  { name: 'intel_investors', schema: { key: String, source: String, name: String, slug: String, tier: {}, type: String, category: String, image: String, investments_count: Number, portfolio_value: Number, website: String, twitter: String, description: String, rounds_count: Number, total_invested: Number, projects: Array, first_seen: Date, last_seen: Date, updated_at: Date } },
  { name: 'intel_fundraising', schema: { key: String, source: String, project: String, project_key: String, symbol: String, round: String, date: Number, amount: Number, valuation: Number, investors: Array, investors_count: Number, lead_investors: Array, category: String, updated_at: Date } },
  { name: 'intel_unlocks', schema: { key: String, source: String, project_key: String, symbol: String, name: String, unlock_date: String, unlock_usd: Number, tokens_percent: Number, allocation: String, updated_at: Date } },
  { name: 'intel_categories', schema: { key: String, source: String, name: String, slug: String, coins_count: Number, market_cap: Number, updated_at: Date } },
  { name: 'news_articles', schema: { id: String, source_id: String, source_name: String, url: String, title: String, summary: String, published_at: Date } },
  // Normalized investors collection (old)
  { name: 'normalized_investors', schema: { 
    canonical_id: String, 
    canonical_name: String, 
    aliases: Array, 
    sources: Array, 
    rounds_count: Number, 
    total_invested: Number, 
    projects: Array, 
    tier: Number, 
    confidence: Number, 
    original_records: Array, 
    updated_at: Date 
  } },
  // Canonical investors (Entity Resolution)
  { name: 'canonical_investors', schema: {
    canonical_id: String,
    display_name: String,
    normalized: String,
    aliases: Array,
    sources: Array,
    confidence: Number,
    metrics: Object,
    tier: String,
    score: Number,
    enhanced_score: Number,
    smart_money_tier: String,
    recency_score: Number,
    early_score: Number,
    leader_score: Number,
    projects: Array,
    original_keys: Array,
    created_at: Date,
    updated_at: Date,
  } },
  // Coinvest relations
  { name: 'coinvest_relations', schema: {
    investor_a: String,
    investor_b: String,
    count: Number,
    volume: Number,
    projects: Array,
    first_together: Number,
    last_together: Number,
    quality_score: Number,
  } },
  // Smart Money Profiles
  { name: 'smart_money_profiles', schema: {
    canonical_id: String,
    display_name: String,
    smart_money_score: Number,
    smart_money_tier: String,
    early_investor_score: Number,
    seed_rounds_count: Number,
    pre_seed_count: Number,
    series_a_count: Number,
    early_ratio: Number,
    leader_score: Number,
    lead_rounds_count: Number,
    lead_ratio: Number,
    follow_score: Number,
    follows_tier1: Number,
    followed_by_tier1: Number,
    recency_score: Number,
    last_investment_date: Number,
    investments_last_90_days: Number,
    investments_last_year: Number,
    enhanced_score: Number,
    base_score: Number,
    tier: String,
    tier1_coinvest_count: Number,
    avg_coinvest_tier: Number,
    updated_at: Date,
  } },
  // Follow Relations
  { name: 'follow_relations', schema: {
    leader_id: String,
    follower_id: String,
    follow_count: Number,
    follow_ratio: Number,
    avg_delay_days: Number,
    sample_projects: Array,
  } },
  // ICOs collection
  { name: 'intel_icos', schema: {
    key: String,
    source: String,
    name: String,
    slug: String,
    symbol: String,
    status: String,
    category: String,
    raise_goal: Number,
    raise_actual: Number,
    price: Number,
    roi: Number,
    roi_ath: Number,
    start_date: String,
    end_date: String,
    website: String,
    whitepaper: String,
    social: Object,
    investors: Array,
    description: String,
    rating: String,
    updated_at: Date,
  } },
];

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature(
      IntelSchemas.map(s => ({ name: s.name, schema: new (require('mongoose').Schema)(s.schema, { strict: false }) }))
    ),
  ],
  controllers: [
    ParserController, 
    DataQualityController, 
    EntityResolutionController, 
    SmartMoneyController, 
    UnifiedParserController,
    ParserHealthController,
    RssFallbackController,
    ParserOpsController,
    IntelligenceController,
    // NEW: Enhanced Proxy Admin
    ProxyAdminController,
  ],
  providers: [
    // Core services
    ParserOrchestrator, 
    MasterOrchestrator, 
    InvestorExtractionService,
    InvestorNormalizationService,
    DataValidationService,
    EntityResolutionService,
    SmartMoneyService,
    UnifiedParserOrchestrator,
    // Anti-block layer
    HttpFingerprintService,
    ProxyPoolService,
    CircuitBreakerService,
    ResilientFetchService,
    ParserHealthService,
    ParserGuardService,
    // NEW: Enhanced Proxy with failover + persistence
    EnhancedProxyPoolService,
    // Stable orchestrator
    StableParserOrchestrator,
    // RSS Fallback
    HtmlParserService,
    RssFallbackEngine,
    // Parser Operations Layer
    ParserRuntimeStateService,
    ParserLogService,
    ParserReportService,
    ParserOpsService,
    // Self-Learning Intelligence
    SchemaDriftService,
    StrategyLearningService,
    PayloadDiscoveryService,
    AnomalyDetectionService,
    AutoRecoveryService,
  ],
  exports: [
    ParserOrchestrator, 
    MasterOrchestrator, 
    InvestorExtractionService,
    InvestorNormalizationService,
    DataValidationService,
    EntityResolutionService,
    SmartMoneyService,
    UnifiedParserOrchestrator,
    StableParserOrchestrator,
    ParserHealthService,
    CircuitBreakerService,
    RssFallbackEngine,
    ParserRuntimeStateService,
    ParserLogService,
    ParserReportService,
    ParserOpsService,
    SchemaDriftService,
    StrategyLearningService,
    AnomalyDetectionService,
    AutoRecoveryService,
  ],
})
export class ParsersModule {}
