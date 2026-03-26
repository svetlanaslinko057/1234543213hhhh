/**
 * Knowledge Graph Module
 */

import { Module } from '@nestjs/common';
import { MongooseModule, Schema as MongooseSchema } from '@nestjs/mongoose';
import { Schema } from 'mongoose';
import { KnowledgeGraphController } from './knowledge-graph.controller';
import { GraphResolverService } from './resolver.service';
import { GraphBuilderService } from './builder.service';
import { GraphQueryService } from './query.service';

// Flexible schemas for graph collections with explicit id field
const GraphNodeSchema = new Schema({
  id: { type: String, required: true, index: true },
  entity_type: { type: String, required: true },
  entity_id: { type: String, required: true },
  label: String,
  slug: String,
  status: String,
  metadata: Schema.Types.Mixed,
  created_at: Date,
  updated_at: Date,
}, { strict: false, timestamps: true });

const GraphEdgeSchema = new Schema({
  id: { type: String, index: true },
  from_node_id: { type: String, required: true, index: true },
  to_node_id: { type: String, required: true, index: true },
  relation_type: { type: String, required: true, index: true },
  weight: Number,
  directionality: String,
  source_type: String,
  source_ref: String,
  confidence: Number,
  scope: String,
  metadata: Schema.Types.Mixed,
  created_at: Date,
  updated_at: Date,
}, { strict: false, timestamps: true });

const GraphEdgeTypeSchema = new Schema({}, { strict: false, timestamps: true });
const GraphSnapshotSchema = new Schema({}, { strict: false, timestamps: true });
const IntelProjectSchema = new Schema({}, { strict: false, timestamps: true });

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'GraphNode', schema: GraphNodeSchema, collection: 'graph_nodes' },
      { name: 'GraphEdge', schema: GraphEdgeSchema, collection: 'graph_edges' },
      { name: 'GraphEdgeType', schema: GraphEdgeTypeSchema, collection: 'graph_edge_types' },
      { name: 'GraphSnapshot', schema: GraphSnapshotSchema, collection: 'graph_snapshots' },
      { name: 'IntelProject', schema: IntelProjectSchema, collection: 'intel_projects' },
    ]),
  ],
  controllers: [KnowledgeGraphController],
  providers: [GraphResolverService, GraphBuilderService, GraphQueryService],
  exports: [GraphResolverService, GraphBuilderService, GraphQueryService],
})
export class KnowledgeGraphModule {}
