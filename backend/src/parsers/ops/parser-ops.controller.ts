/**
 * Parser Operations Controller
 * 
 * Endpoints:
 * - GET  /api/parsers/ops/status       - Full status of all parsers
 * - GET  /api/parsers/ops/report/daily - Daily ingestion report
 * - GET  /api/parsers/ops/logs/:id     - Logs for specific parser
 * - POST /api/parsers/ops/rerun/:id    - Rerun single parser
 * - POST /api/parsers/ops/rerun-failed - Rerun all failed/degraded
 * - GET  /api/parsers/ops/quarantine   - List quarantined parsers
 * - POST /api/parsers/ops/recover/:id  - Recover from quarantine
 * - POST /api/parsers/ops/disable/:id  - Disable parser
 * - POST /api/parsers/ops/enable/:id   - Enable parser
 * - GET  /api/parsers/ops/quality      - Source quality scores
 */

import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ParserOpsService } from './parser-ops.service';
import { ParserLogService } from './parser-log.service';

@Controller('parsers/ops')
export class ParserOpsController {
  constructor(
    private readonly opsService: ParserOpsService,
    private readonly logService: ParserLogService,
  ) {}

  /**
   * GET /api/parsers/ops/status
   * Full status of all parsers
   */
  @Get('status')
  async getStatus() {
    return this.opsService.getStatus();
  }

  /**
   * GET /api/parsers/ops/report/daily
   * Daily ingestion report
   */
  @Get('report/daily')
  async getDailyReport() {
    return this.opsService.getDailyReport();
  }

  /**
   * GET /api/parsers/ops/logs/:id
   * Logs for specific parser
   */
  @Get('logs/:id')
  async getLogs(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.opsService.getLogs(id, limitNum);
  }

  /**
   * GET /api/parsers/ops/logs
   * Latest logs across all parsers
   */
  @Get('logs')
  async getLatestLogs(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.logService.getLatest(limitNum);
  }

  /**
   * POST /api/parsers/ops/rerun/:id
   * Rerun single parser
   */
  @Post('rerun/:id')
  async rerunOne(@Param('id') id: string) {
    return this.opsService.rerunOne(id);
  }

  /**
   * POST /api/parsers/ops/rerun-failed
   * Rerun all failed/degraded parsers
   */
  @Post('rerun-failed')
  async rerunFailed() {
    return this.opsService.rerunFailed();
  }

  /**
   * GET /api/parsers/ops/quarantine
   * List quarantined parsers
   */
  @Get('quarantine')
  async getQuarantine() {
    return this.opsService.getQuarantine();
  }

  /**
   * POST /api/parsers/ops/recover/:id
   * Recover parser from quarantine
   */
  @Post('recover/:id')
  async recover(@Param('id') id: string) {
    return this.opsService.recover(id);
  }

  /**
   * POST /api/parsers/ops/disable/:id
   * Disable a parser
   */
  @Post('disable/:id')
  async disable(@Param('id') id: string) {
    return this.opsService.disable(id);
  }

  /**
   * POST /api/parsers/ops/enable/:id
   * Enable a parser
   */
  @Post('enable/:id')
  async enable(@Param('id') id: string) {
    return this.opsService.enable(id);
  }

  /**
   * GET /api/parsers/ops/quality
   * Source quality scores
   */
  @Get('quality')
  async getQualityScores() {
    return this.opsService.getQualityScores();
  }

  /**
   * GET /api/parsers/ops/failed
   * Get failed parsers in last 24h
   */
  @Get('failed')
  async getFailedParsers() {
    return this.logService.getFailedParsers24h();
  }
}
