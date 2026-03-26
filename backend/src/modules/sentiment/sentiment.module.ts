/**
 * Sentiment Module
 */

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Schema } from 'mongoose';
import { SentimentController } from './sentiment.controller';
import { SentimentEngineService } from './sentiment-engine.service';

// Flexible schemas
const SentimentKeySchema = new Schema({}, { strict: false, timestamps: true });
const LLMKeySchema = new Schema({}, { strict: false, timestamps: true });

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'SentimentKey', schema: SentimentKeySchema, collection: 'sentiment_keys' },
      { name: 'LLMKey', schema: LLMKeySchema, collection: 'llm_keys' },
    ]),
  ],
  controllers: [SentimentController],
  providers: [SentimentEngineService],
  exports: [SentimentEngineService],
})
export class SentimentModule {}
