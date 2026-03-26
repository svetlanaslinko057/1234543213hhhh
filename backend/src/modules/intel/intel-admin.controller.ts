/**
 * Intel Admin Controller
 * Compatible with frontend proxy management UI
 */

import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

interface ProxyInput {
  server: string;
  username?: string;
  password?: string;
  priority?: number;
}

@Controller('intel/admin')
export class IntelAdminController {
  constructor(
    @InjectModel('admin_proxies') private proxyModel: Model<any>,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // PROXY MANAGEMENT (Frontend compatible endpoints)
  // ═══════════════════════════════════════════════════════════════

  @Get('proxy/status')
  async getProxyStatus() {
    const proxies = await this.proxyModel.find({}).lean();
    
    const result = proxies.map((p: any) => ({
      id: p._id.toString(),
      server: `${p.type || 'http'}://${p.host}:${p.httpPort}`,
      host: p.host,
      port: p.httpPort,
      type: p.type || 'http',
      username: p.username,
      priority: p.priority || 1,
      enabled: p.active !== false,
      lastUsed: p.last_used_at,
      successRate: p.success_rate || 100,
      latency: p.avg_latency || 0,
      created_at: p.created_at,
    }));

    return {
      ok: true,
      proxies: result,
      total: result.length,
      active: result.filter((p: any) => p.enabled).length,
    };
  }

  @Post('proxy/add')
  async addProxy(@Body() input: ProxyInput) {
    // Parse server URL: http://host:port or https://host:port
    const serverMatch = input.server.match(/^(https?|socks5):\/\/([^:]+):(\d+)$/);
    
    if (!serverMatch) {
      return { ok: false, error: 'Invalid server format. Use: http://host:port' };
    }

    const [, type, host, port] = serverMatch;

    const doc = {
      host,
      httpPort: parseInt(port, 10),
      socks5Port: type === 'socks5' ? parseInt(port, 10) : null,
      type,
      username: input.username || null,
      password: input.password || null,
      priority: input.priority || 1,
      active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await this.proxyModel.create(doc);
    console.log(`[Intel Admin] Added proxy: ${host}:${port}`);

    return {
      ok: true,
      proxy: {
        id: result._id.toString(),
        server: input.server,
        host,
        port: parseInt(port, 10),
        type,
        username: input.username,
        priority: input.priority || 1,
        enabled: true,
      },
    };
  }

  @Delete('proxy/:id')
  async deleteProxy(@Param('id') id: string) {
    await this.proxyModel.deleteOne({ _id: id });
    console.log(`[Intel Admin] Deleted proxy: ${id}`);
    return { ok: true };
  }

  @Post('proxy/:id/toggle')
  async toggleProxy(@Param('id') id: string, @Query('enabled') enabled: string) {
    const isEnabled = enabled === 'true';
    await this.proxyModel.updateOne(
      { _id: id },
      { $set: { active: isEnabled, updated_at: new Date() } }
    );
    console.log(`[Intel Admin] Toggled proxy ${id}: ${isEnabled}`);
    return { ok: true, enabled: isEnabled };
  }

  @Post('proxy/:id/test')
  async testProxy(@Param('id') id: string) {
    const proxy = await this.proxyModel.findById(id);
    if (!proxy) {
      return { ok: false, error: 'Proxy not found' };
    }

    try {
      const proxyUrl = proxy.username && proxy.password
        ? `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.httpPort}`
        : `http://${proxy.host}:${proxy.httpPort}`;
      
      const { execSync } = require('child_process');
      const start = Date.now();
      const result = execSync(
        `curl -x "${proxyUrl}" -s --connect-timeout 10 https://api.ipify.org`,
        { encoding: 'utf8', timeout: 15000 }
      ).trim();
      const latency = Date.now() - start;

      // Update proxy stats
      await this.proxyModel.updateOne(
        { _id: id },
        { 
          $set: { 
            last_used_at: new Date(),
            avg_latency: latency,
            success_rate: 100,
          } 
        }
      );

      console.log(`[Intel Admin] Proxy test ${proxy.host}: IP = ${result}, latency = ${latency}ms`);
      return { ok: true, ip: result, latency, working: true };
    } catch (error: any) {
      console.error(`[Intel Admin] Proxy test failed: ${error.message}`);
      return { ok: false, error: error.message, working: false };
    }
  }

  @Post('proxy/test-all')
  async testAllProxies() {
    const proxies = await this.proxyModel.find({ active: true }).lean();
    const results: any[] = [];

    for (const proxy of proxies) {
      try {
        const proxyUrl = proxy.username && proxy.password
          ? `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.httpPort}`
          : `http://${proxy.host}:${proxy.httpPort}`;

        const { execSync } = require('child_process');
        const start = Date.now();
        const ip = execSync(
          `curl -x "${proxyUrl}" -s --connect-timeout 10 https://api.ipify.org`,
          { encoding: 'utf8', timeout: 15000 }
        ).trim();
        const latency = Date.now() - start;

        results.push({
          id: (proxy as any)._id.toString(),
          host: proxy.host,
          working: true,
          ip,
          latency,
        });
      } catch (error: any) {
        results.push({
          id: (proxy as any)._id.toString(),
          host: proxy.host,
          working: false,
          error: error.message,
        });
      }
    }

    return {
      ok: true,
      results,
      working: results.filter(r => r.working).length,
      failed: results.filter(r => !r.working).length,
    };
  }
}
