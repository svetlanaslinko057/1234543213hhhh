/**
 * Base Adapter Interface
 */

import { AdapterResult } from '../models';

export abstract class BaseAdapter {
  abstract name: string;
  abstract priority: number;
  
  protected _latency: number = 0;
  protected _errorCount: number = 0;
  protected _successCount: number = 0;
  protected _lastError?: string;
  protected _isHealthy: boolean = true;

  get latency(): number { return this._latency; }
  get isHealthy(): boolean { return this._isHealthy; }
  get successRate(): number {
    const total = this._successCount + this._errorCount;
    return total > 0 ? this._successCount / total : 1;
  }

  protected recordSuccess(latencyMs: number): void {
    this._latency = latencyMs;
    this._successCount++;
    this._isHealthy = true;
  }

  protected recordError(error: string): void {
    this._errorCount++;
    this._lastError = error;
    if (this._errorCount >= 5) {
      this._isHealthy = false;
    }
  }

  abstract getQuote(asset: string): Promise<AdapterResult>;
  abstract getBulkQuotes(assets: string[]): Promise<AdapterResult>;
  abstract getOverview(): Promise<AdapterResult>;
  abstract getCandles(asset: string, interval: string, limit: number): Promise<AdapterResult>;
  abstract healthCheck(): Promise<AdapterResult>;
}
