import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

interface Proxy {
  host: string;
  httpPort: number;
  socks5Port?: number;
  username: string;
  password: string;
  active: boolean;
}

@Controller('admin')
export class AdminController {
  constructor(
    @InjectModel('admin_proxies') private proxyModel: Model<any>,
    @InjectModel('admin_api_keys') private apiKeyModel: Model<any>,
    @InjectModel('admin_llm_keys') private llmKeyModel: Model<any>,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // PROXIES
  // ═══════════════════════════════════════════════════════════════

  @Get('proxies')
  async getProxies() {
    const proxies = await this.proxyModel.find({}, { password: 0 }).lean();
    return { ok: true, proxies };
  }

  @Post('proxies')
  async addProxy(@Body() proxy: Proxy) {
    const doc = {
      host: proxy.host,
      httpPort: proxy.httpPort,
      socks5Port: proxy.socks5Port,
      username: proxy.username,
      password: proxy.password,
      active: proxy.active !== false,
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    const result = await this.proxyModel.create(doc);
    console.log(`[Admin] Added proxy: ${proxy.host}:${proxy.httpPort}`);
    
    return { ok: true, proxy: { ...doc, _id: result._id, password: '***' } };
  }

  @Delete('proxies/:id')
  async deleteProxy(@Param('id') id: string) {
    await this.proxyModel.deleteOne({ _id: id });
    console.log(`[Admin] Deleted proxy: ${id}`);
    return { ok: true };
  }

  @Post('proxies/:id/test')
  async testProxy(@Param('id') id: string) {
    const proxy = await this.proxyModel.findById(id);
    if (!proxy) {
      return { ok: false, error: 'Proxy not found' };
    }

    try {
      // Test proxy connectivity
      const proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.httpPort}`;
      const { execSync } = require('child_process');
      const result = execSync(
        `curl -x "${proxyUrl}" -s --connect-timeout 10 https://api.ipify.org`,
        { encoding: 'utf8', timeout: 15000 }
      ).trim();
      
      console.log(`[Admin] Proxy test ${proxy.host}: IP = ${result}`);
      return { ok: true, ip: result };
    } catch (error) {
      console.error(`[Admin] Proxy test failed: ${error.message}`);
      return { ok: false, error: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // API KEYS
  // ═══════════════════════════════════════════════════════════════

  @Get('api-keys')
  async getApiKeys() {
    const keys = await this.apiKeyModel.find({}, { key: 0 }).lean();
    return { ok: true, keys };
  }

  @Post('api-keys')
  async addApiKey(@Body() data: { name: string; key: string; provider: string }) {
    const doc = {
      name: data.name,
      key: data.key,
      provider: data.provider,
      active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    const result = await this.apiKeyModel.create(doc);
    console.log(`[Admin] Added API key: ${data.name} (${data.provider})`);
    
    return { ok: true, key: { ...doc, _id: result._id, key: '***' } };
  }

  @Delete('api-keys/:id')
  async deleteApiKey(@Param('id') id: string) {
    await this.apiKeyModel.deleteOne({ _id: id });
    console.log(`[Admin] Deleted API key: ${id}`);
    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════════════
  // LLM KEYS
  // ═══════════════════════════════════════════════════════════════

  @Get('llm-keys')
  async getLlmKeys() {
    const keys = await this.llmKeyModel.find({}, { key: 0 }).lean();
    return { ok: true, keys };
  }

  @Post('llm-keys')
  async addLlmKey(@Body() data: { name: string; key: string; provider: string }) {
    const doc = {
      name: data.name,
      key: data.key,
      provider: data.provider,
      active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };
    
    const result = await this.llmKeyModel.create(doc);
    console.log(`[Admin] Added LLM key: ${data.name} (${data.provider})`);
    
    return { ok: true, key: { ...doc, _id: result._id, key: '***' } };
  }

  @Delete('llm-keys/:id')
  async deleteLlmKey(@Param('id') id: string) {
    await this.llmKeyModel.deleteOne({ _id: id });
    console.log(`[Admin] Deleted LLM key: ${id}`);
    return { ok: true };
  }

  @Post('llm-keys/:id/test')
  async testLlmKey(@Param('id') id: string) {
    const key = await this.llmKeyModel.findById(id);
    if (!key) {
      return { ok: false, error: 'Key not found' };
    }
    // Basic validation - just check key format
    return { ok: true, provider: key.provider, valid: key.key?.length > 10 };
  }

  // ═══════════════════════════════════════════════════════════════
  // PROVIDERS
  // ═══════════════════════════════════════════════════════════════

  @Get('providers')
  async getProviders() {
    return {
      ok: true,
      providers: [
        { name: 'dropstab', status: 'active', type: 'scraper' },
        { name: 'cryptorank', status: 'active', type: 'scraper' },
        { name: 'defillama', status: 'active', type: 'api' },
        { name: 'binance', status: 'active', type: 'api' },
        { name: 'bybit', status: 'active', type: 'api' },
      ],
    };
  }

  @Get('provider-pool')
  async getProviderPool() {
    return {
      ok: true,
      pool: {
        scrapers: ['dropstab', 'cryptorank'],
        apis: ['defillama', 'binance', 'bybit'],
        active: true,
      },
    };
  }
}
