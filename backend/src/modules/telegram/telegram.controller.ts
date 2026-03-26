/**
 * Telegram Controller
 * 
 * API Endpoints:
 * GET  /api/telegram/bot/status
 * POST /api/telegram/bot/configure
 * POST /api/telegram/bot/test
 * POST /api/telegram/bot/send-report
 * POST /api/telegram/alerts/emit
 * GET  /api/telegram/alerts/recent
 * GET  /api/telegram/alerts/stats
 */

import { Controller, Get, Post, Body, Query, Logger } from '@nestjs/common';
import { TelegramService, AlertType } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(private readonly telegram: TelegramService) {}

  // ═══════════════════════════════════════════════════════════════
  // BOT ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  @Get('bot/status')
  async getBotStatus() {
    const status = await this.telegram.getStatus();
    return { ok: true, ...status };
  }

  @Post('bot/configure')
  async configurBot(@Body() body: { botToken: string; chatId?: string }) {
    if (!body.botToken) {
      return { ok: false, error: 'botToken required' };
    }
    
    const result = await this.telegram.configure(body.botToken, body.chatId);
    return { ok: result.success, ...result };
  }

  @Post('bot/test')
  async testBot(@Body() body: { chatId?: string }) {
    const result = await this.telegram.testBot(body.chatId);
    return { ok: result.success, ...result };
  }

  @Post('bot/send-report')
  async sendReport(@Body() body: { chatId?: string; type?: 'daily' | 'weekly' }) {
    const result = await this.telegram.sendDailyReport(body.chatId);
    return { ok: result.success, ...result };
  }

  // ═══════════════════════════════════════════════════════════════
  // ALERT ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  @Post('alerts/emit')
  async emitAlert(
    @Body() body: {
      type: AlertType;
      data: Record<string, any>;
      chatId?: string;
      priority?: 'low' | 'medium' | 'high' | 'critical';
    },
  ) {
    if (!body.type || !body.data) {
      return { ok: false, error: 'type and data required' };
    }

    const result = await this.telegram.emitAlert(body.type, body.data, {
      chatId: body.chatId,
      priority: body.priority,
    });

    return { ok: result.success, ...result };
  }

  @Get('alerts/recent')
  async getRecentAlerts(@Query('limit') limit?: string) {
    const alerts = await this.telegram.getRecentAlerts(parseInt(limit || '20', 10));
    return { ok: true, count: alerts.length, alerts };
  }

  @Get('alerts/stats')
  async getAlertStats() {
    const stats = await this.telegram.getAlertStats();
    return { ok: true, ...stats };
  }

  // ═══════════════════════════════════════════════════════════════
  // QUICK ALERTS (convenience endpoints)
  // ═══════════════════════════════════════════════════════════════

  @Post('alerts/funding')
  async alertFunding(
    @Body() body: {
      project: string;
      amount: number;
      investors?: string[];
      roundType?: string;
      chatId?: string;
    },
  ) {
    return this.telegram.emitAlert('funding', body, { chatId: body.chatId, priority: 'high' });
  }

  @Post('alerts/news')
  async alertNews(
    @Body() body: {
      title: string;
      summary?: string;
      source: string;
      chatId?: string;
    },
  ) {
    return this.telegram.emitAlert('news', body, { chatId: body.chatId });
  }

  @Post('alerts/price')
  async alertPrice(
    @Body() body: {
      symbol: string;
      price: number;
      change: number;
      chatId?: string;
    },
  ) {
    const priority = Math.abs(body.change) > 10 ? 'high' : 'medium';
    return this.telegram.emitAlert('price', body, { chatId: body.chatId, priority });
  }
}
