/**
 * API Registry Controller
 * Manages legacy endpoints registry - tracks what's implemented, working, etc.
 */

import { Controller, Get, Post, Put, Query, Param, Body } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

interface EndpointDoc {
  _id: string;
  method: string;
  path: string;
  summary: string;
  category: string;
  tags: string[];
  source_file: string;
  status: string;
  priority: string;
  working: boolean | null;
  implemented: boolean;
  notes: string;
  last_tested: Date | null;
  test_results: any[];
}

@Controller('api-registry')
export class ApiRegistryController {
  constructor(
    @InjectModel('api_endpoints_registry') private registryModel: Model<any>,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // STATS & OVERVIEW
  // ═══════════════════════════════════════════════════════════════

  @Get('stats')
  async getStats() {
    const [
      total,
      implemented,
      working,
      notWorking,
      highPriority,
    ] = await Promise.all([
      this.registryModel.countDocuments(),
      this.registryModel.countDocuments({ implemented: true }),
      this.registryModel.countDocuments({ working: true }),
      this.registryModel.countDocuments({ working: false }),
      this.registryModel.countDocuments({ priority: 'high' }),
    ]);

    const byCategory = await this.registryModel.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const byStatus = await this.registryModel.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    return {
      ok: true,
      ts: Date.now(),
      summary: {
        total,
        implemented,
        working,
        notWorking,
        unknown: total - working - notWorking,
        highPriority,
      },
      byCategory: byCategory.reduce((acc, c) => ({ ...acc, [c._id]: c.count }), {}),
      byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // LIST ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  @Get('endpoints')
  async listEndpoints(
    @Query('category') category?: string,
    @Query('priority') priority?: string,
    @Query('working') working?: string,
    @Query('implemented') implemented?: string,
    @Query('limit') limit: string = '100',
    @Query('offset') offset: string = '0',
  ) {
    const filter: any = {};
    
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (working === 'true') filter.working = true;
    if (working === 'false') filter.working = false;
    if (working === 'null') filter.working = null;
    if (implemented === 'true') filter.implemented = true;
    if (implemented === 'false') filter.implemented = false;

    const [endpoints, total] = await Promise.all([
      this.registryModel
        .find(filter)
        .sort({ category: 1, path: 1 })
        .skip(parseInt(offset, 10))
        .limit(parseInt(limit, 10))
        .lean(),
      this.registryModel.countDocuments(filter),
    ]);

    return {
      ok: true,
      total,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      endpoints,
    };
  }

  @Get('endpoints/high-priority')
  async getHighPriorityEndpoints() {
    const endpoints = await this.registryModel
      .find({ priority: 'high' })
      .sort({ category: 1, path: 1 })
      .lean();

    const grouped: Record<string, any[]> = {};
    for (const ep of endpoints) {
      const cat = (ep as any).category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(ep);
    }

    return {
      ok: true,
      total: endpoints.length,
      categories: Object.keys(grouped),
      grouped,
    };
  }

  @Get('endpoints/category/:category')
  async getEndpointsByCategory(@Param('category') category: string) {
    const endpoints = await this.registryModel
      .find({ category })
      .sort({ method: 1, path: 1 })
      .lean();

    return {
      ok: true,
      category,
      total: endpoints.length,
      endpoints,
    };
  }

  @Get('endpoints/not-working')
  async getNotWorkingEndpoints() {
    const endpoints = await this.registryModel
      .find({ working: false })
      .sort({ priority: -1, category: 1 })
      .lean();

    return {
      ok: true,
      total: endpoints.length,
      endpoints,
    };
  }

  @Get('endpoints/not-implemented')
  async getNotImplementedEndpoints(@Query('priority') priority?: string) {
    const filter: any = { implemented: false };
    if (priority) filter.priority = priority;

    const endpoints = await this.registryModel
      .find(filter)
      .sort({ priority: -1, category: 1, path: 1 })
      .lean();

    return {
      ok: true,
      total: endpoints.length,
      endpoints,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // UPDATE ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  @Put('endpoints/:id')
  async updateEndpoint(
    @Param('id') id: string,
    @Body() update: Partial<EndpointDoc>,
  ) {
    const allowed = ['working', 'implemented', 'status', 'notes'];
    const safeUpdate: any = { updated_at: new Date() };
    
    for (const key of allowed) {
      if (update[key as keyof EndpointDoc] !== undefined) {
        safeUpdate[key] = update[key as keyof EndpointDoc];
      }
    }

    await this.registryModel.updateOne({ _id: id }, { $set: safeUpdate });
    const updated = await this.registryModel.findById(id).lean();

    return { ok: true, endpoint: updated };
  }

  @Post('endpoints/:id/mark-working')
  async markWorking(@Param('id') id: string) {
    await this.registryModel.updateOne(
      { _id: id },
      { $set: { working: true, status: 'verified', updated_at: new Date() } }
    );
    return { ok: true, message: 'Marked as working' };
  }

  @Post('endpoints/:id/mark-not-working')
  async markNotWorking(@Param('id') id: string, @Body('reason') reason?: string) {
    await this.registryModel.updateOne(
      { _id: id },
      { 
        $set: { 
          working: false, 
          status: 'broken',
          notes: reason || '',
          updated_at: new Date(),
        } 
      }
    );
    return { ok: true, message: 'Marked as not working' };
  }

  @Post('endpoints/:id/mark-implemented')
  async markImplemented(@Param('id') id: string) {
    await this.registryModel.updateOne(
      { _id: id },
      { $set: { implemented: true, updated_at: new Date() } }
    );
    return { ok: true, message: 'Marked as implemented' };
  }

  @Post('endpoints/batch-update')
  async batchUpdate(@Body() body: { ids: string[], update: Partial<EndpointDoc> }) {
    const { ids, update } = body;
    const allowed = ['working', 'implemented', 'status', 'notes'];
    const safeUpdate: any = { updated_at: new Date() };
    
    for (const key of allowed) {
      if (update[key as keyof EndpointDoc] !== undefined) {
        safeUpdate[key] = update[key as keyof EndpointDoc];
      }
    }

    const result = await this.registryModel.updateMany(
      { _id: { $in: ids } },
      { $set: safeUpdate }
    );

    return { ok: true, modified: result.modifiedCount };
  }

  // ═══════════════════════════════════════════════════════════════
  // SEARCH
  // ═══════════════════════════════════════════════════════════════

  @Get('search')
  async searchEndpoints(@Query('q') query: string) {
    const regex = new RegExp(query, 'i');
    const endpoints = await this.registryModel
      .find({
        $or: [
          { path: regex },
          { summary: regex },
          { category: regex },
          { tags: regex },
        ],
      })
      .limit(50)
      .lean();

    return { ok: true, count: endpoints.length, endpoints };
  }

  // ═══════════════════════════════════════════════════════════════
  // CATEGORIES
  // ═══════════════════════════════════════════════════════════════

  @Get('categories')
  async getCategories() {
    const categories = await this.registryModel.aggregate([
      {
        $group: {
          _id: '$category',
          total: { $sum: 1 },
          implemented: { $sum: { $cond: ['$implemented', 1, 0] } },
          working: { $sum: { $cond: [{ $eq: ['$working', true] }, 1, 0] } },
          notWorking: { $sum: { $cond: [{ $eq: ['$working', false] }, 1, 0] } },
          highPriority: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } },
        },
      },
      { $sort: { highPriority: -1, total: -1 } },
    ]);

    return {
      ok: true,
      categories: categories.map((c) => ({
        name: c._id,
        total: c.total,
        implemented: c.implemented,
        working: c.working,
        notWorking: c.notWorking,
        unknown: c.total - c.working - c.notWorking,
        highPriority: c.highPriority,
        coverage: Math.round((c.implemented / c.total) * 100),
      })),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════════════════════

  @Get('export')
  async exportAll() {
    const endpoints = await this.registryModel.find({}).lean();
    return {
      ok: true,
      exported_at: new Date().toISOString(),
      total: endpoints.length,
      endpoints,
    };
  }

  @Get('export/openapi')
  async exportOpenApi() {
    const implemented = await this.registryModel.find({ implemented: true }).lean();
    
    const paths: Record<string, any> = {};
    for (const ep of implemented) {
      const e = ep as any;
      const path = e.path.replace('/api', '');
      if (!paths[path]) paths[path] = {};
      
      paths[path][e.method.toLowerCase()] = {
        tags: [e.category],
        summary: e.summary || `${e.method} ${path}`,
        responses: {
          200: { description: 'Success' },
        },
      };
    }

    return {
      openapi: '3.0.0',
      info: {
        title: 'FOMO Crypto Intelligence API',
        version: '2.5.0',
      },
      paths,
    };
  }
}
