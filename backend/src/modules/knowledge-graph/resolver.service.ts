/**
 * Graph Resolver - Resolves entities to graph nodes
 * 
 * Responsibilities:
 * - Find or create nodes for entities
 * - Normalize business keys
 * - Maintain node uniqueness (entity_type, entity_id)
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GraphNode, NODE_TYPES, generateId } from './models';

@Injectable()
export class GraphResolverService {
  private readonly logger = new Logger(GraphResolverService.name);
  private cache: Map<string, string> = new Map();

  constructor(
    @InjectModel('GraphNode') private nodeModel: Model<any>,
  ) {}

  async ensureIndexes(): Promise<void> {
    await this.nodeModel.collection.createIndex(
      { entity_type: 1, entity_id: 1 },
      { unique: true, name: 'unique_entity' }
    );
    await this.nodeModel.collection.createIndex({ entity_type: 1 }, { name: 'idx_entity_type' });
    await this.nodeModel.collection.createIndex({ entity_id: 1 }, { name: 'idx_entity_id' });
    await this.nodeModel.collection.createIndex({ slug: 1 }, { name: 'idx_slug' });
    await this.nodeModel.collection.createIndex(
      { label: 'text' },
      { name: 'text_label' }
    );
    this.logger.log('Indexes created for graph_nodes');
  }

  makeNodeKey(entityType: string, entityId: string): string {
    return `${entityType}:${entityId}`;
  }

  async resolve(
    entityType: string,
    entityId: string,
    label: string,
    slug?: string,
    metadata?: Record<string, any>,
    status: string = 'active'
  ): Promise<string> {
    if (!NODE_TYPES.includes(entityType as any)) {
      this.logger.warn(`Unknown entity type: ${entityType}`);
    }

    const nodeKey = this.makeNodeKey(entityType, entityId);

    // Check cache first
    if (this.cache.has(nodeKey)) {
      return this.cache.get(nodeKey)!;
    }

    // Try to find existing node
    const existing = await this.nodeModel.findOne({
      entity_type: entityType,
      entity_id: entityId,
    });

    if (existing) {
      const nodeId = existing.id;
      this.cache.set(nodeKey, nodeId);

      // Update if label changed
      if (existing.label !== label) {
        await this.nodeModel.updateOne(
          { id: nodeId },
          { $set: { label, updated_at: new Date() } }
        );
      }
      return nodeId;
    }

    // Create new node
    const node: GraphNode = {
      id: generateId(),
      entity_type: entityType,
      entity_id: entityId,
      label,
      slug: slug || entityId,
      status,
      metadata: metadata || {},
      created_at: new Date(),
      updated_at: new Date(),
    };

    try {
      await this.nodeModel.create(node);
      this.cache.set(nodeKey, node.id);
      this.logger.debug(`Created node: ${nodeKey} -> ${node.id}`);
      return node.id;
    } catch (e: any) {
      // Handle race condition
      this.logger.warn(`Insert failed, retrying lookup: ${e.message}`);
      const retry = await this.nodeModel.findOne({
        entity_type: entityType,
        entity_id: entityId,
      });
      if (retry) {
        this.cache.set(nodeKey, retry.id);
        return retry.id;
      }
      throw e;
    }
  }

  async resolveBatch(
    entities: Array<{
      entity_type: string;
      entity_id: string;
      label: string;
      slug?: string;
      metadata?: Record<string, any>;
      status?: string;
    }>
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    for (const entity of entities) {
      try {
        const nodeId = await this.resolve(
          entity.entity_type,
          entity.entity_id,
          entity.label,
          entity.slug,
          entity.metadata,
          entity.status || 'active'
        );
        const nodeKey = this.makeNodeKey(entity.entity_type, entity.entity_id);
        results.set(nodeKey, nodeId);
      } catch (e: any) {
        this.logger.error(`Failed to resolve entity: ${JSON.stringify(entity)}, error: ${e.message}`);
      }
    }
    return results;
  }

  async getNodeByKey(entityType: string, entityId: string): Promise<any | null> {
    return this.nodeModel.findOne({
      entity_type: entityType,
      entity_id: entityId,
    });
  }

  async getNodeById(nodeId: string): Promise<any | null> {
    return this.nodeModel.findOne({ id: nodeId });
  }

  async searchNodes(
    query: string,
    entityType?: string,
    limit: number = 20
  ): Promise<any[]> {
    const filter: any = {};
    if (entityType) {
      filter.entity_type = entityType;
    }
    if (query) {
      filter.$or = [
        { label: { $regex: query, $options: 'i' } },
        { slug: { $regex: query, $options: 'i' } },
        { entity_id: { $regex: query, $options: 'i' } },
      ];
    }
    return this.nodeModel.find(filter).limit(limit).lean();
  }

  clearCache(): void {
    this.cache.clear();
  }
}
