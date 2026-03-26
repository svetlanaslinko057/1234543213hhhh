/**
 * Graph Builders Module
 * 
 * CRITICAL: Builds derived edges for intelligent graph
 * Restored from Python version
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import { DerivedEdgesService } from './derived-edges.service';
import { GraphBuildersController } from './graph-builders.controller';

const FlexibleSchema = new MongooseSchema({}, { strict: false, timestamps: true });

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'graph_nodes', schema: FlexibleSchema },
      { name: 'graph_edges', schema: FlexibleSchema },
      { name: 'graph_derived_edges', schema: FlexibleSchema },
      { name: 'graph_snapshots', schema: FlexibleSchema },
      // Source data for building
      { name: 'intel_investors', schema: FlexibleSchema },
      { name: 'intel_fundraising', schema: FlexibleSchema },
      { name: 'intel_projects', schema: FlexibleSchema },
      { name: 'rootdata_links', schema: FlexibleSchema },
      { name: 'rootdata_people', schema: FlexibleSchema },
      // Pre-computed relations (138k+ records!)
      { name: 'coinvest_relations', schema: FlexibleSchema },
      { name: 'canonical_investors', schema: FlexibleSchema },
    ]),
  ],
  controllers: [GraphBuildersController],
  providers: [DerivedEdgesService],
  exports: [DerivedEdgesService],
})
export class GraphBuildersModule {}
