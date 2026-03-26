/**
 * Graph Query Service - Query graph data
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { GraphNetworkResponse, GraphStatsResponse, RELATION_SCOPE } from './models';

@Injectable()
export class GraphQueryService {
  private readonly logger = new Logger(GraphQueryService.name);

  constructor(
    @InjectModel('GraphNode') private nodeModel: Model<any>,
    @InjectModel('GraphEdge') private edgeModel: Model<any>,
    @InjectModel('GraphSnapshot') private snapshotModel: Model<any>,
    @InjectConnection() private connection: Connection,
  ) {}

  async getNode(entityType: string, entityId: string): Promise<any | null> {
    const node: any = await this.nodeModel.findOne({
      entity_type: entityType,
      entity_id: entityId,
    }).lean();

    if (node) {
      // Count edges
      const edgeCount = await this.edgeModel.countDocuments({
        $or: [{ from_node_id: node.id }, { to_node_id: node.id }],
      });
      return { ...node, edge_count: edgeCount };
    }
    return null;
  }

  async getNodeById(nodeId: string): Promise<any | null> {
    return this.nodeModel.findOne({ id: nodeId }).lean();
  }

  async getEdges(
    entityType: string,
    entityId: string,
    relationType?: string,
    direction: string = 'both',
    limit: number = 100
  ): Promise<any[]> {
    const node: any = await this.nodeModel.findOne({
      entity_type: entityType,
      entity_id: entityId,
    }).lean();

    if (!node) return [];

    const filter: any = {};
    if (relationType) {
      filter.relation_type = relationType;
    }

    if (direction === 'outgoing') {
      filter.from_node_id = node.id;
    } else if (direction === 'incoming') {
      filter.to_node_id = node.id;
    } else {
      filter.$or = [{ from_node_id: node.id }, { to_node_id: node.id }];
    }

    return this.edgeModel.find(filter).limit(limit).lean();
  }

  async getNeighbors(
    entityType: string,
    entityId: string,
    neighborType?: string,
    relationType?: string,
    limit: number = 50
  ): Promise<any[]> {
    const node: any = await this.nodeModel.findOne({
      entity_type: entityType,
      entity_id: entityId,
    }).lean();

    if (!node) return [];

    // Get all edges for this node
    const edgeFilter: any = {
      $or: [{ from_node_id: node.id }, { to_node_id: node.id }],
    };
    if (relationType) {
      edgeFilter.relation_type = relationType;
    }

    const edges: any[] = await this.edgeModel.find(edgeFilter).lean();

    // Get neighbor node IDs
    const neighborIds = new Set<string>();
    for (const edge of edges) {
      if (edge.from_node_id !== node.id) neighborIds.add(edge.from_node_id);
      if (edge.to_node_id !== node.id) neighborIds.add(edge.to_node_id);
    }

    // Fetch neighbor nodes
    const nodeFilter: any = { id: { $in: Array.from(neighborIds) } };
    if (neighborType) {
      nodeFilter.entity_type = neighborType;
    }

    return this.nodeModel.find(nodeFilter).limit(limit).lean();
  }

  async search(query: string, entityType?: string, limit: number = 20): Promise<any[]> {
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

    const nodes = await this.nodeModel.find(filter).limit(limit).lean();
    
    return nodes.map(node => ({
      id: `${node.entity_type}:${node.entity_id}`,
      label: node.label,
      type: node.entity_type,
      entity_id: node.entity_id,
      slug: node.slug,
      metadata: node.metadata,
    }));
  }

  async getRelated(entityType: string, entityId: string, limit: number = 10): Promise<any[]> {
    // Get node
    const node: any = await this.nodeModel.findOne({
      entity_type: entityType,
      entity_id: entityId,
    }).lean();

    if (!node) return [];

    // Get direct connections
    const edges: any[] = await this.edgeModel.find({
      $or: [{ from_node_id: node.id }, { to_node_id: node.id }],
    }).lean();

    // Get neighbor IDs
    const neighborIds = new Set<string>();
    for (const edge of edges) {
      if (edge.from_node_id !== node.id) neighborIds.add(edge.from_node_id);
      if (edge.to_node_id !== node.id) neighborIds.add(edge.to_node_id);
    }

    // Find entities connected to the same neighbors (2-hop)
    const secondHopEdges: any[] = await this.edgeModel.find({
      $or: [
        { from_node_id: { $in: Array.from(neighborIds) } },
        { to_node_id: { $in: Array.from(neighborIds) } },
      ],
    }).lean();

    // Count shared connections
    const relatedCount = new Map<string, number>();
    for (const edge of secondHopEdges) {
      const otherId = neighborIds.has(edge.from_node_id) ? edge.to_node_id : edge.from_node_id;
      if (otherId !== node.id && !neighborIds.has(otherId)) {
        relatedCount.set(otherId, (relatedCount.get(otherId) || 0) + 1);
      }
    }

    // Sort by shared connections
    const sortedIds = Array.from(relatedCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    // Fetch related nodes
    const relatedNodes = await this.nodeModel.find({ id: { $in: sortedIds } }).lean();

    return relatedNodes.map(n => ({
      id: `${n.entity_type}:${n.entity_id}`,
      label: n.label,
      type: n.entity_type,
      shared_connections: relatedCount.get(n.id) || 0,
    }));
  }

  async getNetwork(
    centerType?: string,
    centerId?: string,
    depth: number = 1,
    limitNodes: number = 200,
    limitEdges: number = 500,
    nodeTypes?: string[],
    relationTypes?: string[]
  ): Promise<GraphNetworkResponse> {
    let nodeIds = new Set<string>();
    let allEdges: any[] = [];

    if (centerType && centerId) {
      // Ego-network around center
      const centerNode: any = await this.nodeModel.findOne({
        entity_type: centerType,
        entity_id: centerId,
      }).lean();

      if (!centerNode) {
        return { nodes: [], edges: [], stats: { error: 'Center node not found' } };
      }

      nodeIds.add(centerNode.id);
      let currentLayer = new Set([centerNode.id]);

      for (let d = 0; d < depth; d++) {
        const edgeFilter: any = {
          $or: [
            { from_node_id: { $in: Array.from(currentLayer) } },
            { to_node_id: { $in: Array.from(currentLayer) } },
          ],
        };
        if (relationTypes) {
          edgeFilter.relation_type = { $in: relationTypes };
        }

        const edges = await this.edgeModel.find(edgeFilter).lean();
        allEdges.push(...edges);

        const nextLayer = new Set<string>();
        for (const edge of edges) {
          if (!nodeIds.has(edge.from_node_id)) {
            nextLayer.add(edge.from_node_id);
            nodeIds.add(edge.from_node_id);
          }
          if (!nodeIds.has(edge.to_node_id)) {
            nextLayer.add(edge.to_node_id);
            nodeIds.add(edge.to_node_id);
          }
          if (nodeIds.size >= limitNodes) break;
        }
        currentLayer = nextLayer;
        if (nodeIds.size >= limitNodes) break;
      }
    } else {
      // Sample network
      const nodeFilter: any = {};
      if (nodeTypes) {
        nodeFilter.entity_type = { $in: nodeTypes };
      }

      const sampleNodes = await this.nodeModel.find(nodeFilter).limit(limitNodes).lean();
      for (const n of sampleNodes) {
        nodeIds.add(n.id);
      }

      const edgeFilter: any = {
        $or: [
          { from_node_id: { $in: Array.from(nodeIds) } },
          { to_node_id: { $in: Array.from(nodeIds) } },
        ],
      };
      if (relationTypes) {
        edgeFilter.relation_type = { $in: relationTypes };
      }

      allEdges = await this.edgeModel.find(edgeFilter).limit(limitEdges).lean();
    }

    // Fetch nodes
    let nodeFilter: any = { id: { $in: Array.from(nodeIds) } };
    if (nodeTypes) {
      nodeFilter.entity_type = { $in: nodeTypes };
    }
    const nodes = await this.nodeModel.find(nodeFilter).lean();

    // Format for frontend
    const formattedNodes = nodes.map(n => ({
      id: `${n.entity_type}:${n.entity_id}`,
      label: n.label,
      type: n.entity_type,
      entity_id: n.entity_id,
      slug: n.slug,
      metadata: n.metadata,
      _nodeId: n.id,
    }));

    // Create node ID map for edge lookup
    const nodeIdMap = new Map(nodes.map(n => [n.id, `${n.entity_type}:${n.entity_id}`]));

    const formattedEdges = allEdges
      .slice(0, limitEdges)
      .filter(e => nodeIdMap.has(e.from_node_id) && nodeIdMap.has(e.to_node_id))
      .map(e => ({
        source: nodeIdMap.get(e.from_node_id),
        target: nodeIdMap.get(e.to_node_id),
        relation: e.relation_type,
        weight: e.weight || 1,
        scope: e.scope || RELATION_SCOPE[e.relation_type],
        source_type: e.source_type,
        metadata: e.metadata,
      }));

    return {
      nodes: formattedNodes,
      edges: formattedEdges,
      stats: {
        node_count: formattedNodes.length,
        edge_count: formattedEdges.length,
        depth,
        center: centerType && centerId ? `${centerType}:${centerId}` : null,
      },
    };
  }

  async getStats(): Promise<GraphStatsResponse> {
    const totalNodes = await this.nodeModel.countDocuments({});
    const totalEdges = await this.edgeModel.countDocuments({});

    // Nodes by type
    const nodesByType = await this.nodeModel.aggregate([
      { $group: { _id: '$entity_type', count: { $sum: 1 } } },
    ]);

    // Edges by type
    const edgesByType = await this.edgeModel.aggregate([
      { $group: { _id: '$relation_type', count: { $sum: 1 } } },
    ]);

    // Last rebuild
    const lastSnapshot: any = await this.snapshotModel
      .findOne({})
      .sort({ created_at: -1 })
      .lean();

    return {
      total_nodes: totalNodes,
      total_edges: totalEdges,
      nodes_by_type: Object.fromEntries(nodesByType.map((d: any) => [d._id, d.count])),
      edges_by_type: Object.fromEntries(edgesByType.map((d: any) => [d._id, d.count])),
      last_rebuild: lastSnapshot?.created_at,
    };
  }
}
