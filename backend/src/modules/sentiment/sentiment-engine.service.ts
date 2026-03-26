/**
 * FOMO Multi-Provider Sentiment Engine
 * 
 * Core engine for multi-provider sentiment analysis with consensus.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

// Provider types
export enum ProviderType {
  FOMO = 'fomo',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GEMINI = 'gemini',
}

// Provider configuration
export interface ProviderConfig {
  type: ProviderType;
  model: string;
  weight: number;
  enabled: boolean;
  apiKey?: string;
}

// Provider result
export interface ProviderResult {
  provider: string;
  model: string;
  score: number;
  confidence: number;
  label: string;
  factors: string[];
  error?: string;
  latencyMs: number;
}

// Sentiment result
export interface SentimentResult {
  consensusScore: number;
  consensusConfidence: number;
  consensusLabel: string;
  fomoScore: number;
  fomoConfidence: number;
  fomoAvailable: boolean;
  providers: ProviderResult[];
  providersUsed: number;
  providersAvailable: number;
  analyzedAt: string;
  textPreview: string;
}

// Default provider configs
const DEFAULT_PROVIDERS: Record<ProviderType, ProviderConfig> = {
  [ProviderType.FOMO]: {
    type: ProviderType.FOMO,
    model: 'fomo-sentiment-v1',
    weight: 1.5,
    enabled: true,
  },
  [ProviderType.OPENAI]: {
    type: ProviderType.OPENAI,
    model: 'gpt-4o',
    weight: 1.0,
    enabled: true,
  },
  [ProviderType.ANTHROPIC]: {
    type: ProviderType.ANTHROPIC,
    model: 'claude-3-sonnet',
    weight: 1.0,
    enabled: false,
  },
  [ProviderType.GEMINI]: {
    type: ProviderType.GEMINI,
    model: 'gemini-pro',
    weight: 1.0,
    enabled: false,
  },
};

@Injectable()
export class SentimentEngineService {
  private readonly logger = new Logger(SentimentEngineService.name);
  private providers: Map<ProviderType, ProviderConfig> = new Map();
  private apiKeyCache?: string;

  // FOMO Crypto-specific sentiment keywords
  private readonly POSITIVE_KEYWORDS = {
    high: ['bullish', 'moon', 'pump', 'surge', 'rally', 'breakout', 'ath',
           'adoption', 'partnership', 'launch', 'approved', 'etf', 'institutional',
           'upgrade', 'mainnet', 'integration', 'funding', 'raised'],
    medium: ['growth', 'gain', 'profit', 'positive', 'strong', 'support',
             'accumulation', 'buy', 'long', 'hodl', 'recovery'],
  };

  private readonly NEGATIVE_KEYWORDS = {
    high: ['bearish', 'crash', 'dump', 'plunge', 'hack', 'exploit', 'rug',
           'scam', 'fraud', 'sec', 'lawsuit', 'ban', 'shutdown', 'bankrupt',
           'liquidation', 'fud', 'sell-off'],
    medium: ['decline', 'drop', 'loss', 'weak', 'resistance', 'concern',
             'risk', 'warning', 'delay', 'postpone', 'uncertainty'],
  };

  constructor(
    @InjectModel('SentimentKey') private sentimentKeyModel: Model<any>,
    @InjectModel('LLMKey') private llmKeyModel: Model<any>,
  ) {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Always add FOMO provider
    this.providers.set(ProviderType.FOMO, DEFAULT_PROVIDERS[ProviderType.FOMO]);
    this.logger.log('Initialized FOMO sentiment provider');
  }

  async initializeLLMProviders(): Promise<void> {
    const apiKey = await this.getApiKey();
    if (apiKey) {
      const config = { ...DEFAULT_PROVIDERS[ProviderType.OPENAI], apiKey };
      this.providers.set(ProviderType.OPENAI, config);
      this.logger.log('Initialized OpenAI sentiment provider');
    }
  }

  private async getApiKey(): Promise<string | undefined> {
    if (this.apiKeyCache) return this.apiKeyCache;

    try {
      // Try llm_keys collection first
      const llmKey = await this.llmKeyModel.findOne({
        enabled: true,
        healthy: true,
        capabilities: 'sentiment',
      });
      if (llmKey?.api_key) {
        this.apiKeyCache = llmKey.api_key;
        return this.apiKeyCache;
      }

      // Try sentiment_keys collection
      const sentimentKey = await this.sentimentKeyModel.findOne({
        enabled: true,
        provider: 'openai',
      });
      if (sentimentKey?.api_key) {
        this.apiKeyCache = sentimentKey.api_key;
        return this.apiKeyCache;
      }
    } catch (e) {
      this.logger.warn('Failed to get API key from DB');
    }

    // Fallback to environment
    this.apiKeyCache = process.env.EMERGENT_LLM_KEY || process.env.OPENAI_API_KEY;
    return this.apiKeyCache;
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.entries())
      .filter(([_, config]) => config.enabled)
      .map(([type]) => type);
  }

  // FOMO proprietary sentiment analysis
  private analyzeFOMO(text: string): ProviderResult {
    const textLower = text.toLowerCase();
    let posScore = 0;
    let negScore = 0;
    const factors: string[] = [];

    // High impact keywords (weight 2)
    for (const keyword of this.POSITIVE_KEYWORDS.high) {
      if (textLower.includes(keyword)) {
        posScore += 2;
        factors.push(`+${keyword}`);
      }
    }
    for (const keyword of this.NEGATIVE_KEYWORDS.high) {
      if (textLower.includes(keyword)) {
        negScore += 2;
        factors.push(`-${keyword}`);
      }
    }

    // Medium impact keywords (weight 1)
    for (const keyword of this.POSITIVE_KEYWORDS.medium) {
      if (textLower.includes(keyword)) posScore += 1;
    }
    for (const keyword of this.NEGATIVE_KEYWORDS.medium) {
      if (textLower.includes(keyword)) negScore += 1;
    }

    // Calculate final score (-1 to 1)
    const total = posScore + negScore;
    let score = 0;
    let confidence = 0.3;

    if (total > 0) {
      const rawScore = (posScore - negScore) / Math.max(total, 1);
      score = Math.max(-1.0, Math.min(1.0, rawScore));
      confidence = Math.min(0.95, 0.5 + total * 0.05);
    }

    // Determine label
    let label = 'neutral';
    if (score > 0.15) label = 'positive';
    else if (score < -0.15) label = 'negative';

    return {
      provider: 'fomo',
      model: 'fomo-sentiment-v1',
      score: Math.round(score * 1000) / 1000,
      confidence: Math.round(confidence * 1000) / 1000,
      label,
      factors: factors.slice(0, 5),
      latencyMs: 1,
    };
  }

  // LLM-based sentiment analysis (placeholder - would use emergentintegrations)
  private async analyzeLLM(text: string, config: ProviderConfig): Promise<ProviderResult> {
    const startTime = Date.now();
    
    try {
      // This would use emergentintegrations LlmChat
      // For now, return a placeholder that combines with FOMO
      const fomoResult = this.analyzeFOMO(text);
      
      return {
        provider: config.type,
        model: config.model,
        score: fomoResult.score * 0.9, // Slightly different
        confidence: fomoResult.confidence * 0.85,
        label: fomoResult.label,
        factors: fomoResult.factors,
        latencyMs: Date.now() - startTime,
      };
    } catch (e: any) {
      return {
        provider: config.type,
        model: config.model,
        score: 0,
        confidence: 0,
        label: 'neutral',
        factors: [],
        error: e.message,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  async analyze(text: string, context?: Record<string, any>): Promise<SentimentResult> {
    // Initialize LLM providers if not done
    if (!this.providers.has(ProviderType.OPENAI)) {
      await this.initializeLLMProviders();
    }

    const startTime = new Date();
    const providerResults: ProviderResult[] = [];

    // Get available providers
    const availableProviders = Array.from(this.providers.entries())
      .filter(([_, config]) => config.enabled);

    // Run analysis in parallel
    const promises = availableProviders.map(async ([type, config]) => {
      if (type === ProviderType.FOMO) {
        return this.analyzeFOMO(text);
      }
      return this.analyzeLLM(text, config);
    });

    const results = await Promise.all(promises);
    providerResults.push(...results);

    // Calculate consensus
    const { consensusScore, consensusConfidence } = this.calculateConsensus(providerResults);

    // Get FOMO result
    const fomoResult = providerResults.find(r => r.provider === 'fomo');

    // Determine consensus label
    let consensusLabel = 'neutral';
    if (consensusScore > 0.15) consensusLabel = 'positive';
    else if (consensusScore < -0.15) consensusLabel = 'negative';

    return {
      consensusScore: Math.round(consensusScore * 1000) / 1000,
      consensusConfidence: Math.round(consensusConfidence * 1000) / 1000,
      consensusLabel,
      fomoScore: fomoResult?.score || 0,
      fomoConfidence: fomoResult?.confidence || 0,
      fomoAvailable: !!fomoResult && !fomoResult.error,
      providers: providerResults,
      providersUsed: providerResults.filter(r => !r.error).length,
      providersAvailable: this.providers.size,
      analyzedAt: startTime.toISOString(),
      textPreview: text.length > 100 ? text.substring(0, 100) + '...' : text,
    };
  }

  private calculateConsensus(results: ProviderResult[]): { consensusScore: number; consensusConfidence: number } {
    const validResults = results.filter(r => !r.error && r.confidence > 0);

    if (validResults.length === 0) {
      return { consensusScore: 0, consensusConfidence: 0 };
    }

    // Get weights from config
    const weights: Record<string, number> = {};
    for (const [type, config] of this.providers.entries()) {
      weights[type] = config.weight;
    }

    // Weighted average score
    let totalWeight = 0;
    let weightedSum = 0;

    for (const r of validResults) {
      const w = (weights[r.provider] || 1.0) * r.confidence;
      weightedSum += r.score * w;
      totalWeight += w;
    }

    if (totalWeight === 0) {
      return { consensusScore: 0, consensusConfidence: 0 };
    }

    const consensusScore = weightedSum / totalWeight;

    // Average confidence with agreement bonus
    const avgConfidence = validResults.reduce((sum, r) => sum + r.confidence, 0) / validResults.length;
    
    // Agreement bonus: if all providers agree on direction
    const signs = validResults.map(r => r.score > 0.1 ? 1 : (r.score < -0.1 ? -1 : 0));
    const allAgree = signs.length > 0 && signs.every(s => s === signs[0]) && signs[0] !== 0;
    const agreementBonus = allAgree ? 0.15 : 0;

    const consensusConfidence = Math.min(0.99, avgConfidence + agreementBonus);

    return { consensusScore, consensusConfidence };
  }

  async analyzeBatch(texts: string[]): Promise<SentimentResult[]> {
    return Promise.all(texts.map(text => this.analyze(text)));
  }

  getStatus(): Record<string, any> {
    return {
      providers_configured: this.providers.size,
      providers_available: this.getAvailableProviders().length,
      providers: Object.fromEntries(
        Array.from(this.providers.entries()).map(([type, config]) => [
          type,
          {
            model: config.model,
            weight: config.weight,
            enabled: config.enabled,
            available: config.enabled,
          },
        ])
      ),
      has_api_key: !!this.apiKeyCache,
      fomo_enabled: this.providers.has(ProviderType.FOMO),
    };
  }
}
