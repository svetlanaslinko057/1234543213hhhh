/**
 * Graph Pipeline Module
 * 
 * BLOCK 5: Production-ready graph build pipeline
 * 
 * Features:
 * - Stage-based execution
 * - Shared context (no mid-pipeline Mongo queries)
 * - Source Reliability integration
 * - RootData integration
 * - Enrich/Rank/Project stages
 * - Snapshots + Build Logs
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';

// Service & Controller
import { GraphPipelineService } from './graph-pipeline.service';
import { GraphPipelineController } from './graph-pipeline.controller';

// Repositories
import { GraphSnapshotRepository } from './graph-snapshot.repository';
import { GraphBuildLogRepository } from './graph-build-log.repository';

// Builders
import { NodeBuilder } from './builders/node.builder';
import { BaseEdgeBuilder } from './builders/base-edge.builder';
import { DerivedEdgeBuilder } from './builders/derived-edge.builder';
import { NewsEdgeBuilder } from './builders/news-edge.builder';
import { EdgeEnrichmentBuilder } from './builders/edge-enrichment.builder';
import { NodeRankingBuilder } from './builders/node-ranking.builder';
import { ProjectionBuilder } from './builders/projection.builder';

// External modules
import { SourceReliabilityModule } from '../source-reliability/source-reliability.module';
import { RootDataModule } from '../rootdata/rootdata.module';

const FlexibleSchema = new MongooseSchema({}, { strict: false, timestamps: true });

@Module({
  imports: [
    // External modules for Source Reliability + RootData integration
    SourceReliabilityModule,
    RootDataModule,

    // MongoDB collections
    MongooseModule.forFeature([
      // Pipeline output
      { name: 'graph_snapshots', schema: FlexibleSchema },
      { name: 'graph_build_logs', schema: FlexibleSchema },
      
      // Data sources for loading
      { name: 'intel_fundraising', schema: FlexibleSchema },
      { name: 'intel_investors', schema: FlexibleSchema },
      { name: 'intel_projects', schema: FlexibleSchema },
      { name: 'coinvest_relations', schema: FlexibleSchema },
      { name: 'canonical_entities', schema: FlexibleSchema },
      
      // RootData
      { name: 'rootdata_projects', schema: FlexibleSchema },
      { name: 'rootdata_funds', schema: FlexibleSchema },
      { name: 'rootdata_people', schema: FlexibleSchema },
      { name: 'rootdata_links', schema: FlexibleSchema },
      
      // News
      { name: 'news_articles', schema: FlexibleSchema },
      { name: 'news_events', schema: FlexibleSchema },
    ]),
  ],
  controllers: [GraphPipelineController],
  providers: [
    // Main service
    GraphPipelineService,
    
    // Repositories
    GraphSnapshotRepository,
    GraphBuildLogRepository,
    
    // Builders
    NodeBuilder,
    BaseEdgeBuilder,
    DerivedEdgeBuilder,
    NewsEdgeBuilder,
    EdgeEnrichmentBuilder,
    NodeRankingBuilder,
    ProjectionBuilder,
  ],
  exports: [GraphPipelineService],
})
export class GraphPipelineModule {}
