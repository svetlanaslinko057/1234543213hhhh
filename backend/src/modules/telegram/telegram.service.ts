/**
 * Telegram Service
 * 
 * Alert Types:
 * - price: Price crosses threshold
 * - funding: New funding announced
 * - unlock: Token unlock within 24h
 * - news: High-importance news
 * - momentum: Unusual momentum detected
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';

export type AlertType = 'price' | 'funding' | 'unlock' | 'news' | 'momentum' | 'system';

export interface TelegramAlert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  entityId?: string;
  entityType?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  sent: boolean;
  sentAt?: Date;
  error?: string;
  createdAt: Date;
}

// Alert templates (RU)
const ALERT_TEMPLATES: Record<AlertType, (data: any) => string> = {
  funding: (d) => `🚀 *FUNDING*\n\n*${d.project}* привлёк *$${d.amount}M*\n\nИнвесторы: ${d.investors?.join(', ') || 'N/A'}\nРаунд: ${d.roundType || 'N/A'}\n\n#funding #${d.project?.replace(/\s/g, '')}`,
  
  price: (d) => `📈 *PRICE ALERT*\n\n*${d.symbol}* пробил *$${d.price}*\nИзменение: ${d.change > 0 ? '+' : ''}${d.change}%\n\n#price #${d.symbol}`,
  
  unlock: (d) => `🔓 *TOKEN UNLOCK*\n\n*${d.project}* разлочит *${d.amount}* токенов\nДата: ${d.date}\nСтоимость: ~$${d.valueUsd}M\n\n#unlock #${d.project?.replace(/\s/g, '')}`,
  
  news: (d) => `📰 *NEWS*\n\n*${d.title}*\n\n${d.summary || ''}\n\nИсточник: ${d.source}\n\n#news`,
  
  momentum: (d) => `🔥 *MOMENTUM*\n\n*${d.project}* показывает аномальную активность\n\nТип: ${d.signalType}\nСила: ${d.strength}/10\n\n#momentum #${d.project?.replace(/\s/g, '')}`,
  
  system: (d) => `⚙️ *SYSTEM*\n\n${d.message}\n\n#system`,
};

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  
  private botToken: string | null = null;
  private chatId: string | null = null;
  private isRunning = false;
  private lastError: string | null = null;

  constructor(
    @InjectModel('telegram_alerts') private alertsModel: Model<any>,
    @InjectModel('telegram_config') private configModel: Model<any>,
  ) {}

  async onModuleInit() {
    await this.loadConfig();
  }

  // ═══════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════

  private async loadConfig() {
    try {
      // Try env first
      this.botToken = process.env.TELEGRAM_BOT_TOKEN || null;
      this.chatId = process.env.TELEGRAM_CHAT_ID || null;

      // Then DB
      const config = await this.configModel.findOne({}).lean() as any;
      if (config) {
        this.botToken = this.botToken || config.botToken;
        this.chatId = this.chatId || config.chatId;
      }

      if (this.botToken) {
        this.isRunning = true;
        this.logger.log(`[Telegram] Bot configured, token: ${this.botToken.slice(0, 10)}...`);
      } else {
        this.logger.warn('[Telegram] No bot token configured');
      }
    } catch (e: any) {
      this.logger.error(`[Telegram] Config load failed: ${e.message}`);
    }
  }

  async configure(botToken: string, chatId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate token
      const resp = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`, { timeout: 10000 });
      
      if (!resp.data?.ok) {
        return { success: false, error: 'Invalid bot token' };
      }

      this.botToken = botToken;
      this.chatId = chatId || this.chatId;
      this.isRunning = true;

      // Save to DB
      await this.configModel.updateOne(
        {},
        { $set: { botToken, chatId, updatedAt: new Date() } },
        { upsert: true },
      );

      this.logger.log(`[Telegram] Bot configured: @${resp.data.result.username}`);
      
      return { success: true };
    } catch (e: any) {
      this.lastError = e.message;
      return { success: false, error: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // SEND MESSAGE
  // ═══════════════════════════════════════════════════════════════

  async sendMessage(
    chatId: string,
    text: string,
    options: { parseMode?: 'Markdown' | 'HTML'; disableNotification?: boolean } = {},
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!this.botToken) {
      return { success: false, error: 'Bot not configured' };
    }

    try {
      const resp = await axios.post(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          chat_id: chatId,
          text,
          parse_mode: options.parseMode || 'Markdown',
          disable_notification: options.disableNotification || false,
        },
        { timeout: 30000 },
      );

      if (resp.data?.ok) {
        return { success: true, messageId: resp.data.result.message_id };
      }
      
      return { success: false, error: resp.data?.description || 'Send failed' };
    } catch (e: any) {
      this.lastError = e.message;
      return { success: false, error: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ALERTS
  // ═══════════════════════════════════════════════════════════════

  async emitAlert(
    type: AlertType,
    data: Record<string, any>,
    options: { chatId?: string; priority?: 'low' | 'medium' | 'high' | 'critical' } = {},
  ): Promise<{ success: boolean; alertId?: string; error?: string }> {
    const chatId = options.chatId || this.chatId;
    
    if (!chatId) {
      return { success: false, error: 'No chat ID configured' };
    }

    const template = ALERT_TEMPLATES[type];
    if (!template) {
      return { success: false, error: `Unknown alert type: ${type}` };
    }

    const message = template(data);
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Save alert
    const alert: TelegramAlert = {
      id: alertId,
      type,
      title: data.title || type,
      message,
      entityId: data.entityId,
      entityType: data.entityType,
      priority: options.priority || 'medium',
      sent: false,
      createdAt: new Date(),
    };

    await this.alertsModel.create(alert).catch(() => {});

    // Send message
    const result = await this.sendMessage(chatId, message);

    // Update alert
    await this.alertsModel.updateOne(
      { id: alertId },
      { 
        $set: { 
          sent: result.success, 
          sentAt: result.success ? new Date() : undefined,
          error: result.error,
        } 
      },
    ).catch(() => {});

    if (result.success) {
      this.logger.log(`[Telegram] Alert sent: ${type} to ${chatId}`);
    } else {
      this.logger.warn(`[Telegram] Alert failed: ${result.error}`);
    }

    return { success: result.success, alertId, error: result.error };
  }

  // ═══════════════════════════════════════════════════════════════
  // REPORTS
  // ═══════════════════════════════════════════════════════════════

  async sendDailyReport(chatId?: string): Promise<{ success: boolean; error?: string }> {
    const targetChat = chatId || this.chatId;
    if (!targetChat) {
      return { success: false, error: 'No chat ID' };
    }

    // Get stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alertCount = await this.alertsModel.countDocuments({ 
      createdAt: { $gte: today },
      sent: true,
    });

    const report = `📊 *DAILY REPORT*\n\n` +
      `Дата: ${new Date().toLocaleDateString('ru-RU')}\n\n` +
      `Алертов за день: ${alertCount}\n` +
      `Статус бота: ${this.isRunning ? '✅ Активен' : '❌ Остановлен'}\n\n` +
      `#report #daily`;

    return this.sendMessage(targetChat, report);
  }

  // ═══════════════════════════════════════════════════════════════
  // STATUS
  // ═══════════════════════════════════════════════════════════════

  async getStatus(): Promise<{
    configured: boolean;
    running: boolean;
    botUsername?: string;
    chatId?: string;
    lastError?: string;
  }> {
    let botUsername: string | undefined;

    if (this.botToken) {
      try {
        const resp = await axios.get(`https://api.telegram.org/bot${this.botToken}/getMe`, { timeout: 5000 });
        if (resp.data?.ok) {
          botUsername = resp.data.result.username;
        }
      } catch {}
    }

    return {
      configured: !!this.botToken,
      running: this.isRunning,
      botUsername,
      chatId: this.chatId || undefined,
      lastError: this.lastError || undefined,
    };
  }

  async getRecentAlerts(limit = 20): Promise<TelegramAlert[]> {
    const alerts = await this.alertsModel
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    
    return alerts as unknown as TelegramAlert[];
  }

  async getAlertStats(): Promise<{
    total: number;
    sent: number;
    failed: number;
    byType: Record<string, number>;
    last24h: number;
  }> {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [total, sent, last24h, byType] = await Promise.all([
      this.alertsModel.countDocuments({}),
      this.alertsModel.countDocuments({ sent: true }),
      this.alertsModel.countDocuments({ createdAt: { $gte: yesterday } }),
      this.alertsModel.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
    ]);

    return {
      total,
      sent,
      failed: total - sent,
      byType: Object.fromEntries(byType.map((t: any) => [t._id, t.count])),
      last24h,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // TEST
  // ═══════════════════════════════════════════════════════════════

  async testBot(chatId?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const targetChat = chatId || this.chatId;
    
    if (!targetChat) {
      return { success: false, error: 'No chat ID provided' };
    }

    const testMessage = `🤖 *FOMO Bot Test*\n\n` +
      `Бот успешно подключен!\n` +
      `Время: ${new Date().toLocaleString('ru-RU')}\n\n` +
      `#test`;

    const result = await this.sendMessage(targetChat, testMessage);
    
    return {
      success: result.success,
      message: result.success ? 'Test message sent' : undefined,
      error: result.error,
    };
  }
}
