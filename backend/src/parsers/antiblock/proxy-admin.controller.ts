/**
 * Proxy Admin Controller
 * 
 * Admin API for proxy management
 */

import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { EnhancedProxyPoolService } from './enhanced-proxy-pool.service';

@Controller('admin/proxy')
export class ProxyAdminController {
  constructor(private readonly proxyService: EnhancedProxyPoolService) {}

  @Get('status')
  getStatus() {
    return this.proxyService.getStatus();
  }

  @Post('add')
  async addProxy(
    @Body() body: { server: string; username?: string; password?: string; priority?: number },
  ) {
    return this.proxyService.addProxy(
      body.server,
      body.username,
      body.password,
      body.priority,
    );
  }

  @Delete('remove/:id')
  async removeProxy(@Param('id') id: string) {
    return this.proxyService.removeProxy(parseInt(id, 10));
  }

  @Post('priority/:id')
  async setPriority(
    @Param('id') id: string,
    @Body() body: { priority: number },
  ) {
    return this.proxyService.setPriority(parseInt(id, 10), body.priority);
  }

  @Post('enable/:id')
  async enableProxy(@Param('id') id: string) {
    return this.proxyService.enableProxy(parseInt(id, 10));
  }

  @Post('disable/:id')
  async disableProxy(@Param('id') id: string) {
    return this.proxyService.disableProxy(parseInt(id, 10));
  }

  @Post('clear')
  async clearAll() {
    await this.proxyService.clearAll();
    return { ok: true };
  }

  @Post('test')
  async testProxy(@Query('id') id?: string) {
    return this.proxyService.testProxy(id ? parseInt(id, 10) : undefined);
  }

  @Post('reload')
  async reload() {
    await this.proxyService.loadFromDb();
    return { ok: true, status: this.proxyService.getStatus() };
  }
}
