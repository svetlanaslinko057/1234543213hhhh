/**
 * Graph Builder - Builds graph from normalized data
 * 
 * Responsibilities:
 * - Build direct edges from source collections
 * - Build derived edges (coinvested_with, worked_together, etc.)
 * - Manage edge upserts and deduplication
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { GraphResolverService } from './resolver.service';
import { GraphEdge, GraphSnapshot, EDGE_TYPES, RELATION_SCOPE, generateId } from './models';
import { REAL_INVESTMENTS, FUND_TEAM_MEMBERS, PROJECT_TEAM_MEMBERS } from './real-investments';

@Injectable()
export class GraphBuilderService {
  private readonly logger = new Logger(GraphBuilderService.name);

  constructor(
    private resolver: GraphResolverService,
    @InjectModel('GraphEdge') private edgeModel: Model<any>,
    @InjectModel('GraphEdgeType') private edgeTypeModel: Model<any>,
    @InjectModel('GraphSnapshot') private snapshotModel: Model<any>,
    @InjectModel('IntelProject') private projectModel: Model<any>,
    @InjectConnection() private connection: Connection,
  ) {}

  async ensureIndexes(): Promise<void> {
    await this.resolver.ensureIndexes();

    // Edge indexes
    await this.edgeModel.collection.createIndex({ from_node_id: 1 }, { name: 'idx_from_node' });
    await this.edgeModel.collection.createIndex({ to_node_id: 1 }, { name: 'idx_to_node' });
    await this.edgeModel.collection.createIndex({ relation_type: 1 }, { name: 'idx_relation' });
    await this.edgeModel.collection.createIndex(
      { from_node_id: 1, relation_type: 1 },
      { name: 'idx_from_relation' }
    );
    await this.edgeModel.collection.createIndex(
      { to_node_id: 1, relation_type: 1 },
      { name: 'idx_to_relation' }
    );
    await this.edgeModel.collection.createIndex({ source_type: 1 }, { name: 'idx_source_type' });
    await this.edgeModel.collection.createIndex({ source_ref: 1 }, { name: 'idx_source_ref' });
    await this.edgeModel.collection.createIndex(
      { from_node_id: 1, to_node_id: 1, relation_type: 1 },
      { name: 'idx_edge_lookup' }
    );

    // Edge types indexes
    await this.edgeTypeModel.collection.createIndex(
      { relation_type: 1, from_entity_type: 1, to_entity_type: 1 },
      { unique: true, name: 'unique_edge_type' }
    );

    this.logger.log('Indexes created for graph collections');
  }

  async initEdgeTypes(): Promise<void> {
    for (const [relationType, config] of Object.entries(EDGE_TYPES)) {
      try {
        await this.edgeTypeModel.updateOne(
          { relation_type: relationType },
          {
            $set: {
              relation_type: relationType,
              from_entity_type: config.from,
              to_entity_type: config.to,
              directed: config.directed,
              derived: config.derived,
              updated_at: new Date(),
            },
          },
          { upsert: true }
        );
      } catch (e: any) {
        this.logger.warn(`Failed to init edge type ${relationType}: ${e.message}`);
      }
    }
    this.logger.log(`Initialized ${Object.keys(EDGE_TYPES).length} edge types`);
  }

  async addEdge(
    fromNodeId: string,
    toNodeId: string,
    relationType: string,
    weight: number = 1.0,
    sourceType: string = 'direct',
    sourceRef?: string,
    confidence?: number,
    metadata?: Record<string, any>,
    directionality: string = 'directed'
  ): Promise<string> {
    const now = new Date();
    const filter: any = {
      from_node_id: fromNodeId,
      to_node_id: toNodeId,
      relation_type: relationType,
    };
    if (sourceRef) {
      filter.source_ref = sourceRef;
    }

    const existing = await this.edgeModel.findOne(filter);

    if (existing) {
      const updateData: any = { weight, updated_at: now };
      if (metadata) {
        updateData.metadata = { ...existing.metadata, ...metadata };
      }
      if (confidence !== undefined) {
        updateData.confidence = confidence;
      }
      await this.edgeModel.updateOne({ id: existing.id }, { $set: updateData });
      return existing.id;
    }

    // Create new edge
    const edge: GraphEdge = {
      id: generateId(),
      from_node_id: fromNodeId,
      to_node_id: toNodeId,
      relation_type: relationType,
      weight,
      directionality,
      source_type: sourceType,
      source_ref: sourceRef,
      confidence,
      scope: RELATION_SCOPE[relationType],
      metadata: metadata || {},
      created_at: now,
      updated_at: now,
    };

    await this.edgeModel.create(edge);
    this.logger.debug(`Created edge: ${fromNodeId} --[${relationType}]--> ${toNodeId}`);
    return edge.id;
  }

  async addEdgeByEntity(
    fromType: string,
    fromId: string,
    fromLabel: string,
    toType: string,
    toId: string,
    toLabel: string,
    relationType: string,
    options: {
      weight?: number;
      sourceType?: string;
      sourceRef?: string;
      confidence?: number;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<{ fromNodeId: string; toNodeId: string; edgeId: string }> {
    const fromNodeId = await this.resolver.resolve(fromType, fromId, fromLabel);
    const toNodeId = await this.resolver.resolve(toType, toId, toLabel);

    const edgeId = await this.addEdge(
      fromNodeId,
      toNodeId,
      relationType,
      options.weight,
      options.sourceType,
      options.sourceRef,
      options.confidence,
      options.metadata
    );

    return { fromNodeId, toNodeId, edgeId };
  }

  // Build from source collections
  async buildProjectsGraph(): Promise<number> {
    let count = 0;
    const cursor = this.projectModel.find({}).cursor();

    for await (const project of cursor) {
      try {
        const projectId = project.slug || project.key?.split(':').pop();
        await this.resolver.resolve(
          'project',
          projectId,
          project.name || projectId,
          project.slug,
          {
            category: project.category,
            symbol: project.symbol,
            source: project.source,
          }
        );
        count++;

        // If project has token symbol
        if (project.symbol) {
          const tokenId = project.symbol.toLowerCase();
          await this.addEdgeByEntity(
            'project', projectId, project.name || projectId,
            'token', tokenId, project.symbol,
            'has_token',
            {
              sourceType: 'direct',
              sourceRef: `project:${projectId}`,
              metadata: { symbol: project.symbol },
            }
          );
          count++;
        }
      } catch (e: any) {
        this.logger.error(`Failed to process project: ${e.message}`);
      }
    }

    this.logger.log(`Built ${count} nodes/edges from projects`);
    return count;
  }

  async buildExchangesGraph(): Promise<number> {
    let count = 0;
    const exchanges = [
      { id: 'binance', name: 'Binance', type: 'cex' },
      { id: 'coinbase', name: 'Coinbase', type: 'cex' },
      { id: 'kraken', name: 'Kraken', type: 'cex' },
      { id: 'okx', name: 'OKX', type: 'cex' },
      { id: 'bybit', name: 'Bybit', type: 'cex' },
      { id: 'gate', name: 'Gate.io', type: 'cex' },
      { id: 'kucoin', name: 'KuCoin', type: 'cex' },
      { id: 'htx', name: 'HTX', type: 'cex' },
      { id: 'uniswap', name: 'Uniswap', type: 'dex' },
      { id: 'sushiswap', name: 'SushiSwap', type: 'dex' },
    ];

    for (const exchange of exchanges) {
      await this.resolver.resolve(
        'exchange',
        exchange.id,
        exchange.name,
        exchange.id,
        { exchange_type: exchange.type }
      );
      count++;
    }

    this.logger.log(`Built ${count} exchange nodes`);
    return count;
  }

  async buildRealInvestmentsNetwork(): Promise<number> {
    let count = 0;

    const fundNames: Record<string, string> = {
      'a16z': 'a16z Crypto',
      'paradigm': 'Paradigm',
      'coinbase-ventures': 'Coinbase Ventures',
      'binance-labs': 'Binance Labs',
      'polychain': 'Polychain Capital',
      'pantera': 'Pantera Capital',
      'dragonfly': 'Dragonfly Capital',
      'multicoin': 'Multicoin Capital',
      'sequoia': 'Sequoia Capital',
      'galaxy': 'Galaxy Digital',
      'jump-crypto': 'Jump Crypto',
      'framework': 'Framework Ventures',
      'hack-vc': 'Hack VC',
      'animoca': 'Animoca Brands',
      'spartan': 'Spartan Group',
      'delphi': 'Delphi Ventures',
      'dcg': 'Digital Currency Group',
      'placeholder': 'Placeholder VC',
      'robot-ventures': 'Robot Ventures',
    };

    // Create fund nodes
    for (const [fundSlug, fundName] of Object.entries(fundNames)) {
      await this.resolver.resolve('fund', fundSlug, fundName, fundSlug, { type: 'vc', tier: 1 });
      count++;
    }

    // Build investment edges
    for (const [fundSlug, investments] of Object.entries(REAL_INVESTMENTS)) {
      const fundName = fundNames[fundSlug] || fundSlug;

      for (const inv of investments) {
        await this.resolver.resolve('project', inv.project, inv.name, inv.project);

        const sourceRef = `investment:${fundSlug}_${inv.project}_${inv.round || 'Private'}_${inv.year || 2023}`;
        
        await this.addEdgeByEntity(
          'fund', fundSlug, fundName,
          'project', inv.project, inv.name,
          'invested_in',
          {
            weight: Math.min(1.0, inv.amount > 0 ? inv.amount / 100000000 : 0.5),
            sourceType: 'direct',
            sourceRef,
            metadata: {
              amount_usd: inv.amount,
              round: inv.round,
              year: inv.year,
            },
          }
        );
        count++;
      }
    }

    // Build fund team members
    for (const [fundSlug, members] of Object.entries(FUND_TEAM_MEMBERS)) {
      const fundName = fundNames[fundSlug] || fundSlug;

      for (const member of members) {
        await this.resolver.resolve('person', member.id, member.name, member.id, { role: member.role });
        count++;

        await this.addEdgeByEntity(
          'person', member.id, member.name,
          'fund', fundSlug, fundName,
          'works_at',
          {
            sourceType: 'direct',
            sourceRef: `team:${member.id}_${fundSlug}`,
            metadata: { role: member.role },
          }
        );
        count++;
      }
    }

    // Build project team members
    for (const [projectId, members] of Object.entries(PROJECT_TEAM_MEMBERS)) {
      const projectNode = await this.resolver.getNodeByKey('project', projectId);
      const projectName = projectNode?.label || projectId;

      for (const member of members) {
        const relationType = member.role?.toLowerCase().includes('founder') ? 'founded' : 'works_at';

        await this.resolver.resolve('person', member.id, member.name, member.id, { role: member.role });
        count++;

        await this.addEdgeByEntity(
          'person', member.id, member.name,
          'project', projectId, projectName,
          relationType,
          {
            sourceType: 'direct',
            sourceRef: `team:${member.id}_${projectId}`,
            metadata: { role: member.role },
          }
        );
        count++;
      }
    }

    // Token mappings
    const tokenMappings = [
      ['arbitrum', 'arb', 'ARB'],
      ['optimism', 'op', 'OP'],
      ['polygon', 'matic', 'MATIC'],
      ['uniswap', 'uni', 'UNI'],
      ['ethereum', 'eth', 'ETH'],
      ['solana', 'sol', 'SOL'],
      ['cosmos', 'atom', 'ATOM'],
      ['aptos', 'apt', 'APT'],
      ['sui', 'sui', 'SUI'],
      ['near', 'near', 'NEAR'],
      ['avalanche', 'avax', 'AVAX'],
      ['lido', 'ldo', 'LDO'],
      ['aave', 'aave', 'AAVE'],
      ['compound', 'comp', 'COMP'],
      ['dydx', 'dydx', 'DYDX'],
      ['chainlink', 'link', 'LINK'],
      ['polkadot', 'dot', 'DOT'],
      ['filecoin', 'fil', 'FIL'],
      ['render', 'rndr', 'RNDR'],
      ['injective', 'inj', 'INJ'],
      ['worldcoin', 'wld', 'WLD'],
      ['eigenlayer', 'eigen', 'EIGEN'],
      ['layerzero', 'zro', 'ZRO'],
    ];

    for (const [projectId, tokenId, symbol] of tokenMappings) {
      const projectNode = await this.resolver.getNodeByKey('project', projectId);
      if (projectNode) {
        await this.addEdgeByEntity(
          'project', projectId, projectNode.label || projectId,
          'token', tokenId, symbol,
          'has_token',
          { sourceType: 'direct', sourceRef: `token:${projectId}_${tokenId}` }
        );
        count++;
      }

      // Token -> asset
      await this.addEdgeByEntity(
        'token', tokenId, symbol,
        'asset', tokenId, symbol,
        'mapped_to_asset',
        { sourceType: 'direct', sourceRef: `token_asset:${tokenId}` }
      );
      count++;

      // Asset -> exchanges
      for (const exchangeId of ['binance', 'coinbase', 'kraken']) {
        await this.addEdgeByEntity(
          'asset', tokenId, symbol,
          'exchange', exchangeId, exchangeId.charAt(0).toUpperCase() + exchangeId.slice(1),
          'traded_on',
          {
            sourceType: 'direct',
            sourceRef: `listing:${tokenId}_${exchangeId}`,
            metadata: { symbol: `${symbol}/USDT` },
          }
        );
        count++;
      }
    }

    this.logger.log(`Built ${count} REAL investment network nodes/edges`);
    return count;
  }

  async buildCoinvestedEdges(): Promise<number> {
    let count = 0;

    const pipeline = [
      { $match: { relation_type: 'invested_in' } },
      { $group: { _id: '$to_node_id', investors: { $addToSet: '$from_node_id' } } },
      { $match: { 'investors.1': { $exists: true } } },
    ];

    const groups = await this.edgeModel.aggregate(pipeline);

    for (const group of groups) {
      const investors = group.investors as string[];
      const projectNodeId = group._id;

      for (let i = 0; i < investors.length; i++) {
        for (let j = i + 1; j < investors.length; j++) {
          const existing = await this.edgeModel.findOne({
            $or: [
              { from_node_id: investors[i], to_node_id: investors[j], relation_type: 'coinvested_with' },
              { from_node_id: investors[j], to_node_id: investors[i], relation_type: 'coinvested_with' },
            ],
          });

          if (existing) {
            const sharedProjects = existing.metadata?.shared_projects || [];
            if (!sharedProjects.includes(projectNodeId)) {
              sharedProjects.push(projectNodeId);
              await this.edgeModel.updateOne(
                { id: existing.id },
                {
                  $set: {
                    'metadata.shared_projects': sharedProjects,
                    'metadata.shared_count': sharedProjects.length,
                    weight: Math.min(1.0, sharedProjects.length * 0.2),
                    updated_at: new Date(),
                  },
                }
              );
            }
          } else {
            await this.addEdge(
              investors[i],
              investors[j],
              'coinvested_with',
              0.2,
              'derived',
              undefined,
              undefined,
              { shared_projects: [projectNodeId], shared_count: 1 },
              'undirected'
            );
            count++;
          }
        }
      }
    }

    this.logger.log(`Built ${count} coinvested_with edges`);
    return count;
  }

  async fullRebuild(): Promise<GraphSnapshot> {
    this.logger.log('Starting full graph rebuild...');

    await this.ensureIndexes();
    await this.initEdgeTypes();
    this.resolver.clearCache();

    let totalCount = 0;
    totalCount += await this.buildExchangesGraph();
    totalCount += await this.buildProjectsGraph();
    totalCount += await this.buildRealInvestmentsNetwork();
    totalCount += await this.buildCoinvestedEdges();

    const nodeCount = await this.connection.db.collection('graph_nodes').countDocuments({});
    const edgeCount = await this.connection.db.collection('graph_edges').countDocuments({});

    const snapshot: GraphSnapshot = {
      id: generateId(),
      snapshot_type: 'full_rebuild',
      node_count: nodeCount,
      edge_count: edgeCount,
      metadata: {
        total_operations: totalCount,
        rebuild_time: new Date().toISOString(),
      },
      created_at: new Date(),
    };

    await this.snapshotModel.create(snapshot);

    this.logger.log(`Full rebuild complete: ${nodeCount} nodes, ${edgeCount} edges`);
    return snapshot;
  }
}
