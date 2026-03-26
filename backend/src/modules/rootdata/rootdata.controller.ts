/**
 * RootData Controller
 * 
 * API endpoints for RootData module
 */

import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { RootDataService } from './rootdata.service';
import { RootDataSyncService } from './rootdata.sync.service';

@Controller('rootdata')
export class RootDataController {
  constructor(
    private readonly service: RootDataService,
    private readonly syncService: RootDataSyncService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // SYNC
  // ═══════════════════════════════════════════════════════════════

  @Post('sync')
  async syncAll(@Query('pages') pages?: string) {
    const maxPages = pages ? parseInt(pages, 10) : 10;
    return this.syncService.syncAll(maxPages);
  }

  @Get('stats')
  async getStats() {
    return this.syncService.getStats();
  }

  @Get('health')
  async healthCheck() {
    return this.service.healthCheck();
  }

  // ═══════════════════════════════════════════════════════════════
  // PROJECTS
  // ═══════════════════════════════════════════════════════════════

  @Get('projects')
  async getProjects(
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.service.getProjects(
      limit ? parseInt(limit, 10) : 50,
      skip ? parseInt(skip, 10) : 0,
    );
  }

  @Get('projects/:slug')
  async getProject(@Param('slug') slug: string) {
    return this.service.getProjectBySlug(slug);
  }

  @Get('projects/:slug/investors')
  async getProjectInvestors(@Param('slug') slug: string) {
    return this.service.getInvestorsForProject(slug);
  }

  @Get('projects/:slug/team')
  async getProjectTeam(@Param('slug') slug: string) {
    return this.service.getTeamForProject(slug);
  }

  // ═══════════════════════════════════════════════════════════════
  // FUNDS
  // ═══════════════════════════════════════════════════════════════

  @Get('funds')
  async getFunds(
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.service.getFunds(
      limit ? parseInt(limit, 10) : 50,
      skip ? parseInt(skip, 10) : 0,
    );
  }

  @Get('funds/:slug')
  async getFund(@Param('slug') slug: string) {
    return this.service.getFundBySlug(slug);
  }

  @Get('funds/:slug/investments')
  async getFundInvestments(@Param('slug') slug: string) {
    return this.service.getInvestmentsForFund(slug);
  }

  // ═══════════════════════════════════════════════════════════════
  // PEOPLE
  // ═══════════════════════════════════════════════════════════════

  @Get('people')
  async getPeople(
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.service.getPeople(
      limit ? parseInt(limit, 10) : 50,
      skip ? parseInt(skip, 10) : 0,
    );
  }

  @Get('people/:slug')
  async getPerson(@Param('slug') slug: string) {
    return this.service.getPersonBySlug(slug);
  }

  // ═══════════════════════════════════════════════════════════════
  // ROUNDS
  // ═══════════════════════════════════════════════════════════════

  @Get('rounds')
  async getRounds(
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.service.getRounds(
      limit ? parseInt(limit, 10) : 50,
      skip ? parseInt(skip, 10) : 0,
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════

  @Get('export/graph')
  async exportForGraph() {
    return this.service.exportForGraph();
  }
}
