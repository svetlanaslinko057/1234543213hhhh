/**
 * Data Validation Service
 * 
 * Валидация схемы данных перед сохранением
 * Решает проблему: amount=null, date кривой, investors пустой
 */

import { Injectable } from '@nestjs/common';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitized: any;
}

export interface FundingRoundSchema {
  project: string;
  project_key?: string;
  symbol?: string;
  round: string;
  date: number | null;
  amount: number | null;
  valuation?: number | null;
  investors: any[];
  investors_count: number;
  lead_investors?: string[];
  category?: string;
  source: string;
}

export interface InvestorSchema {
  name: string;
  slug: string;
  tier?: number | null;
  type?: string;
  category?: string;
  investments_count: number;
  portfolio_value?: number;
  source: string;
}

@Injectable()
export class DataValidationService {
  /**
   * Валидация funding round
   */
  validateFundingRound(data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const sanitized: Partial<FundingRoundSchema> = {};

    // Required: project name
    if (!data.project && !data.name && !data.coin_name) {
      errors.push('Missing required field: project');
    } else {
      sanitized.project = data.project || data.name || data.coin_name;
    }

    // Required: round type
    if (!data.round && !data.stage) {
      warnings.push('Missing round type, defaulting to "unknown"');
      sanitized.round = 'unknown';
    } else {
      sanitized.round = data.round || data.stage;
    }

    // Date validation
    if (data.date !== undefined && data.date !== null) {
      const date = this.parseDate(data.date);
      if (date === null) {
        warnings.push(`Invalid date format: ${data.date}`);
      } else {
        sanitized.date = date;
      }
    } else {
      warnings.push('Missing date');
      sanitized.date = null;
    }

    // Amount validation
    if (data.amount !== undefined && data.amount !== null) {
      const amount = this.parseAmount(data.amount);
      if (amount === null || amount < 0) {
        warnings.push(`Invalid amount: ${data.amount}`);
        sanitized.amount = null;
      } else {
        sanitized.amount = amount;
      }
    } else {
      sanitized.amount = null;
    }

    // Investors validation
    if (!Array.isArray(data.investors) || data.investors.length === 0) {
      warnings.push('No investors provided');
      sanitized.investors = [];
      sanitized.investors_count = 0;
    } else {
      // Фильтруем и нормализуем инвесторов
      sanitized.investors = data.investors
        .map((inv: any) => this.normalizeInvestorRef(inv))
        .filter((inv: any) => inv !== null);
      sanitized.investors_count = sanitized.investors.length;
    }

    // Source - required
    if (!data.source) {
      errors.push('Missing required field: source');
    } else {
      sanitized.source = data.source;
    }

    // Optional fields
    sanitized.project_key = data.project_key || data.slug || this.slugify(sanitized.project);
    sanitized.symbol = data.symbol ? String(data.symbol).toUpperCase() : undefined;
    sanitized.valuation = data.valuation ? this.parseAmount(data.valuation) : null;
    sanitized.lead_investors = Array.isArray(data.lead_investors) ? data.lead_investors : [];
    sanitized.category = data.category;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitized: sanitized as FundingRoundSchema,
    };
  }

  /**
   * Валидация investor
   */
  validateInvestor(data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const sanitized: Partial<InvestorSchema> = {};

    // Required: name
    if (!data.name) {
      errors.push('Missing required field: name');
    } else {
      sanitized.name = String(data.name).trim();
    }

    // Required: slug
    if (!data.slug && !data.key) {
      sanitized.slug = this.slugify(data.name);
    } else {
      sanitized.slug = data.slug || data.key;
    }

    // Tier validation (1-5)
    if (data.tier !== undefined && data.tier !== null) {
      const tier = parseInt(data.tier, 10);
      if (isNaN(tier) || tier < 1 || tier > 10) {
        warnings.push(`Invalid tier: ${data.tier}, ignoring`);
        sanitized.tier = null;
      } else {
        sanitized.tier = tier;
      }
    } else {
      sanitized.tier = null;
    }

    // investments_count
    sanitized.investments_count = parseInt(data.investments_count || data.rounds_count || 0, 10);
    if (isNaN(sanitized.investments_count)) {
      sanitized.investments_count = 0;
    }

    // Source - required
    if (!data.source) {
      errors.push('Missing required field: source');
    } else {
      sanitized.source = data.source;
    }

    // Optional
    sanitized.type = data.type || data.ventureType;
    sanitized.category = data.category;
    sanitized.portfolio_value = data.portfolio_value ? this.parseAmount(data.portfolio_value) : undefined;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitized: sanitized as InvestorSchema,
    };
  }

  /**
   * Batch validation с статистикой
   */
  validateBatch(items: any[], type: 'funding' | 'investor'): {
    valid: any[];
    invalid: any[];
    stats: {
      total: number;
      valid: number;
      invalid: number;
      warnings_count: number;
    };
  } {
    const valid: any[] = [];
    const invalid: any[] = [];
    let warningsCount = 0;

    for (const item of items) {
      const result = type === 'funding' 
        ? this.validateFundingRound(item)
        : this.validateInvestor(item);

      warningsCount += result.warnings.length;

      if (result.valid) {
        valid.push({
          ...result.sanitized,
          _validation: {
            warnings: result.warnings,
            validated_at: new Date(),
          },
        });
      } else {
        invalid.push({
          original: item,
          errors: result.errors,
          warnings: result.warnings,
        });
      }
    }

    return {
      valid,
      invalid,
      stats: {
        total: items.length,
        valid: valid.length,
        invalid: invalid.length,
        warnings_count: warningsCount,
      },
    };
  }

  /**
   * Health check для данных в БД
   */
  async checkDataHealth(model: any, type: 'funding' | 'investor'): Promise<{
    total: number;
    healthy: number;
    issues: {
      missing_date: number;
      missing_amount: number;
      empty_investors: number;
      invalid_tier: number;
    };
  }> {
    const total = await model.countDocuments({});
    
    let issues = {
      missing_date: 0,
      missing_amount: 0,
      empty_investors: 0,
      invalid_tier: 0,
    };

    if (type === 'funding') {
      [
        issues.missing_date,
        issues.missing_amount,
        issues.empty_investors,
      ] = await Promise.all([
        model.countDocuments({ $or: [{ date: null }, { date: { $exists: false } }] }),
        model.countDocuments({ $or: [{ amount: null }, { amount: { $exists: false } }] }),
        model.countDocuments({ $or: [
          { investors: { $size: 0 } },
          { investors: { $exists: false } },
          { investors_count: 0 },
        ] }),
      ]);
    } else {
      issues.invalid_tier = await model.countDocuments({
        tier: { $nin: [null, 1, 2, 3, 4, 5] },
      });
    }

    const issueCount = Object.values(issues).reduce((a, b) => a + b, 0);
    
    return {
      total,
      healthy: Math.max(0, total - issueCount),
      issues,
    };
  }

  // === Helper methods ===

  private parseDate(value: any): number | null {
    if (value === null || value === undefined) return null;
    
    if (typeof value === 'number') {
      // Unix timestamp
      return value < 1e12 ? value : Math.floor(value / 1000);
    }
    
    if (typeof value === 'string') {
      try {
        const dt = new Date(value);
        if (isNaN(dt.getTime())) return null;
        return Math.floor(dt.getTime() / 1000);
      } catch {
        return null;
      }
    }
    
    if (value instanceof Date) {
      return Math.floor(value.getTime() / 1000);
    }
    
    return null;
  }

  private parseAmount(value: any): number | null {
    if (value === null || value === undefined) return null;
    
    if (typeof value === 'number') {
      return value >= 0 ? value : null;
    }
    
    if (typeof value === 'string') {
      // Удаляем $, запятые, пробелы
      const cleaned = value.replace(/[$,\s]/g, '');
      
      // Обрабатываем M (millions), B (billions), K (thousands)
      const multipliers: Record<string, number> = {
        'k': 1000,
        'm': 1000000,
        'b': 1000000000,
      };
      
      const match = cleaned.match(/^([\d.]+)([kmb])?$/i);
      if (match) {
        const num = parseFloat(match[1]);
        const mult = match[2] ? multipliers[match[2].toLowerCase()] : 1;
        return isNaN(num) ? null : num * mult;
      }
      
      const num = parseFloat(cleaned);
      return isNaN(num) ? null : num;
    }
    
    return null;
  }

  private normalizeInvestorRef(inv: any): any | null {
    if (!inv) return null;
    
    if (typeof inv === 'string') {
      const trimmed = inv.trim();
      return trimmed.length > 0 ? { name: trimmed } : null;
    }
    
    if (typeof inv === 'object') {
      const name = inv.name || inv.fundName || inv.investor;
      if (!name || String(name).trim().length === 0) return null;
      
      return {
        name: String(name).trim(),
        slug: inv.slug || inv.key,
        tier: inv.tier,
        type: inv.type,
        lead: inv.lead || false,
      };
    }
    
    return null;
  }

  private slugify(text: string | undefined): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
