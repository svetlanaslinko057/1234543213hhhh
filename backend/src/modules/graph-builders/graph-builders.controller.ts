/**
 * Graph Builders Controller
 * 
 * API endpoints for building derived edges
 */

import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { DerivedEdgesService } from './derived-edges.service';

@Controller('graph-builders')
export class GraphBuildersController {
  constructor(private readonly derivedEdgesService: DerivedEdgesService) {}

  // ═══════════════════════════════════════════════════════════════
  // BUILD
  // ═══════════════════════════════════════════════════════════════

  @Post('derived/build-all')
  async buildAllDerivedEdges() {
    return this.derivedEdgesService.buildAllDerivedEdges();
  }

  @Post('derived/build/coinvested')
  async buildCoinvestedEdges() {
    return this.derivedEdgesService.buildCoinvestedEdges();
  }

  @Post('derived/build/worked-together')
  async buildWorkedTogetherEdges() {
    return this.derivedEdgesService.buildWorkedTogetherEdges();
  }

  @Post('derived/build/shared-investor')
  async buildSharedInvestorEdges() {
    return this.derivedEdgesService.buildSharedInvestorEdges();
  }

  @Post('derived/build/shared-founder')
  async buildSharedFounderEdges() {
    return this.derivedEdgesService.buildSharedFounderEdges();
  }

  // ═══════════════════════════════════════════════════════════════
  // QUERIES
  // ═══════════════════════════════════════════════════════════════

  @Get('derived/stats')
  async getStats() {
    return this.derivedEdgesService.getStats();
  }

  @Get('derived/node/:nodeId')
  async getDerivedEdgesForNode(@Param('nodeId') nodeId: string) {
    return this.derivedEdgesService.getDerivedEdgesForNode(nodeId);
  }

  @Get('derived/related/:nodeId')
  async getRelatedNodes(
    @Param('nodeId') nodeId: string,
    @Query('type') relationType?: string,
  ) {
    const relatedIds = await this.derivedEdgesService.getRelatedNodes(nodeId, relationType);
    return { node_id: nodeId, related: relatedIds, count: relatedIds.length };
  }
}
