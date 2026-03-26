/**
 * Telegram Module
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';

const TelegramAlertSchema = {
  id: { type: String, index: true },
  type: String,
  title: String,
  message: String,
  entityId: String,
  entityType: String,
  priority: String,
  sent: Boolean,
  sentAt: Date,
  error: String,
  createdAt: { type: Date, index: true },
};

const TelegramConfigSchema = {
  botToken: String,
  chatId: String,
  updatedAt: Date,
};

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'telegram_alerts', schema: TelegramAlertSchema as any },
      { name: 'telegram_config', schema: TelegramConfigSchema as any },
    ]),
  ],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
