/**
 * Sentiment API Controller
 */

import { Controller, Get, Post, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { SentimentEngineService, ProviderType } from './sentiment-engine.service';

// Request DTOs
interface AnalyzeRequest {
  text: string;
  context?: Record<string, any>;
}

interface BatchAnalyzeRequest {
  texts: string[];
}

@Controller('sentiment')
export class SentimentController {
  constructor(private readonly engine: SentimentEngineService) {}

  @Get('status')
  async getStatus() {
    return this.engine.getStatus();
  }

  @Post('analyze')
  async analyzeSentiment(@Body() request: AnalyzeRequest) {
    if (!request.text || request.text.trim().length < 10) {
      throw new HttpException('Text must be at least 10 characters', HttpStatus.BAD_REQUEST);
    }

    const result = await this.engine.analyze(request.text, request.context);

    return {
      consensus: {
        score: result.consensusScore,
        confidence: result.consensusConfidence,
        label: result.consensusLabel,
        providers_used: result.providersUsed,
      },
      fomo: {
        score: result.fomoScore,
        confidence: result.fomoConfidence,
        available: result.fomoAvailable,
        label: result.fomoScore > 0.15 ? 'positive' : (result.fomoScore < -0.15 ? 'negative' : 'neutral'),
      },
      providers: result.providers.map(p => ({
        provider: p.provider,
        model: p.model,
        score: p.score,
        confidence: p.confidence,
        label: p.label,
        factors: p.factors,
        latency_ms: p.latencyMs,
        error: p.error,
      })),
      meta: {
        analyzed_at: result.analyzedAt,
        text_preview: result.textPreview,
        providers_available: result.providersAvailable,
      },
    };
  }

  @Post('analyze/batch')
  async analyzeBatch(@Body() request: BatchAnalyzeRequest) {
    if (!request.texts || request.texts.length === 0) {
      throw new HttpException('At least one text required', HttpStatus.BAD_REQUEST);
    }
    if (request.texts.length > 50) {
      throw new HttpException('Maximum 50 texts per batch', HttpStatus.BAD_REQUEST);
    }

    const results = await this.engine.analyzeBatch(request.texts);

    return results.map(result => ({
      consensus: {
        score: result.consensusScore,
        confidence: result.consensusConfidence,
        label: result.consensusLabel,
        providers_used: result.providersUsed,
      },
      fomo: {
        score: result.fomoScore,
        confidence: result.fomoConfidence,
        available: result.fomoAvailable,
        label: result.fomoScore > 0.15 ? 'positive' : (result.fomoScore < -0.15 ? 'negative' : 'neutral'),
      },
      providers: result.providers.map(p => ({
        provider: p.provider,
        model: p.model,
        score: p.score,
        confidence: p.confidence,
        label: p.label,
        factors: p.factors,
        latency_ms: p.latencyMs,
        error: p.error,
      })),
      meta: {
        analyzed_at: result.analyzedAt,
        text_preview: result.textPreview,
        providers_available: result.providersAvailable,
      },
    }));
  }

  @Get('providers')
  async listProviders() {
    const status = this.engine.getStatus();
    const providers = [];

    // FOMO - always available
    providers.push({
      id: 'fomo',
      name: 'FOMO Sentiment',
      model: 'fomo-sentiment-v1',
      weight: 1.5,
      enabled: true,
      available: true,
      description: 'FOMO proprietary crypto sentiment model with keyword analysis',
    });

    // OpenAI
    const openaiAvailable = status.has_api_key;
    providers.push({
      id: 'openai',
      name: 'OpenAI GPT',
      model: 'gpt-4o',
      weight: 1.0,
      enabled: true,
      available: openaiAvailable,
      description: 'AI-powered deep semantic analysis with context understanding',
    });

    return {
      providers,
      summary: {
        total: providers.length,
        available: providers.filter(p => p.available).length,
        has_api_key: status.has_api_key,
      },
    };
  }

  @Post('providers/:providerId/enable')
  async enableProvider(
    @Query('provider_id') providerId: string,
    @Query('enabled') enabled: boolean = true,
  ) {
    // This would enable/disable providers dynamically
    return {
      ok: true,
      provider: providerId,
      enabled,
      message: `Provider ${providerId} ${enabled ? 'enabled' : 'disabled'}`,
    };
  }
}
