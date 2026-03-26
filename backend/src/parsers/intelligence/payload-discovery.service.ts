/**
 * Payload Discovery Engine
 * 
 * Automatically discovers API endpoints through browser interception:
 * - Intercepts XHR/Fetch requests during browser sessions
 * - Identifies candidate payloads (arrays, data objects)
 * - Stores endpoint patterns for future direct API access
 */

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export interface PayloadCandidate {
  sourceId: string;
  sourceUrl: string;
  
  // Discovered endpoint
  endpoint: string;
  method: 'GET' | 'POST';
  
  // Request details
  requestHeaders?: Record<string, string>;
  requestBody?: any;
  
  // Response analysis
  responseKeys: string[];
  itemKeys: string[];
  itemCount: number;
  
  // Scoring
  score: number;
  confidence: number;
  
  // Metadata
  detectedAt: Date;
  lastVerifiedAt?: Date;
  verified: boolean;
  
  // Pagination hints
  paginationHints?: {
    type: 'page' | 'cursor' | 'offset' | 'none';
    paramName?: string;
    totalPages?: number;
  };
}

interface InterceptedRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
  response?: any;
}

@Injectable()
export class PayloadDiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(PayloadDiscoveryService.name);
  private candidatesCollection: any;
  private candidates: Map<string, PayloadCandidate[]> = new Map();

  constructor(
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async onModuleInit() {
    this.candidatesCollection = this.connection.collection('payload_candidates');
    
    await this.candidatesCollection.createIndex({ sourceId: 1, endpoint: 1 }, { unique: true });
    await this.candidatesCollection.createIndex({ score: -1 });
    await this.candidatesCollection.createIndex({ verified: 1 });
    
    // Load verified candidates
    const docs = await this.candidatesCollection.find({ verified: true }).toArray();
    for (const doc of docs) {
      const existing = this.candidates.get(doc.sourceId) || [];
      existing.push(doc);
      this.candidates.set(doc.sourceId, existing);
    }
    
    this.logger.log(`Loaded ${docs.length} verified payload candidates`);
  }

  /**
   * Check if a response body looks like a data payload
   */
  isCandidatePayload(body: any): boolean {
    if (!body) return false;
    
    // Direct array
    if (Array.isArray(body) && body.length > 0) return true;
    
    // Common wrapper patterns
    const wrapperKeys = ['data', 'items', 'results', 'list', 'records', 'rows', 'entries', 'content'];
    
    for (const key of wrapperKeys) {
      if (body[key] && Array.isArray(body[key]) && body[key].length > 0) {
        return true;
      }
    }
    
    // GraphQL response
    if (body.data && typeof body.data === 'object') {
      for (const key of Object.keys(body.data)) {
        if (Array.isArray(body.data[key]) && body.data[key].length > 0) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Extract items array from response
   */
  extractItems(body: any): any[] | null {
    if (Array.isArray(body)) return body;
    
    const wrapperKeys = ['data', 'items', 'results', 'list', 'records', 'rows', 'entries', 'content'];
    
    for (const key of wrapperKeys) {
      if (body[key] && Array.isArray(body[key])) {
        return body[key];
      }
    }
    
    // GraphQL
    if (body.data) {
      for (const key of Object.keys(body.data)) {
        if (Array.isArray(body.data[key])) {
          return body.data[key];
        }
      }
    }
    
    return null;
  }

  /**
   * Detect pagination pattern
   */
  detectPagination(url: string, body: any): PayloadCandidate['paginationHints'] {
    const urlObj = new URL(url, 'https://example.com');
    const params = urlObj.searchParams;
    
    // Check URL params
    if (params.has('page') || params.has('p')) {
      return { type: 'page', paramName: params.has('page') ? 'page' : 'p' };
    }
    if (params.has('offset') || params.has('skip')) {
      return { type: 'offset', paramName: params.has('offset') ? 'offset' : 'skip' };
    }
    if (params.has('cursor') || params.has('after')) {
      return { type: 'cursor', paramName: params.has('cursor') ? 'cursor' : 'after' };
    }
    
    // Check response for pagination hints
    if (body) {
      if (body.nextCursor || body.cursor || body.next_cursor) {
        return { type: 'cursor', paramName: 'cursor' };
      }
      if (body.totalPages || body.total_pages || body.pageCount) {
        return { 
          type: 'page', 
          paramName: 'page',
          totalPages: body.totalPages || body.total_pages || body.pageCount,
        };
      }
      if (body.hasMore || body.has_more || body.hasNextPage) {
        return { type: 'page', paramName: 'page' };
      }
    }
    
    return { type: 'none' };
  }

  /**
   * Process an intercepted request
   */
  async processIntercepted(
    sourceId: string,
    sourceUrl: string,
    request: InterceptedRequest
  ): Promise<PayloadCandidate | null> {
    const { url, method, headers, body, response } = request;
    
    // Skip non-data URLs
    if (!url.includes('api') && !url.includes('graphql') && !url.includes('.json')) {
      // Also check for common API patterns
      if (!url.match(/\/v\d+\//)) {
        return null;
      }
    }
    
    // Check if response is candidate
    if (!this.isCandidatePayload(response)) {
      return null;
    }
    
    const items = this.extractItems(response);
    if (!items || items.length === 0) return null;
    
    const sample = items[0];
    const itemKeys = Object.keys(sample).sort();
    const responseKeys = Object.keys(response).sort();
    
    // Calculate score
    const score = this.calculateScore(items, itemKeys, url);
    
    const candidate: PayloadCandidate = {
      sourceId,
      sourceUrl,
      endpoint: url,
      method: method.toUpperCase() as 'GET' | 'POST',
      requestHeaders: headers,
      requestBody: body,
      responseKeys,
      itemKeys,
      itemCount: items.length,
      score,
      confidence: Math.min(1, score / 100),
      detectedAt: new Date(),
      verified: false,
      paginationHints: this.detectPagination(url, response),
    };
    
    // Save to DB
    await this.candidatesCollection.updateOne(
      { sourceId, endpoint: url },
      { $set: candidate },
      { upsert: true }
    );
    
    this.logger.log(`Discovered payload endpoint for ${sourceId}: ${url} (${items.length} items, score: ${score})`);
    
    return candidate;
  }

  /**
   * Calculate quality score for candidate
   */
  private calculateScore(items: any[], itemKeys: string[], url: string): number {
    let score = 0;
    
    // Item count (up to 30 points)
    score += Math.min(30, items.length);
    
    // Item richness - keys per item (up to 30 points)
    score += Math.min(30, itemKeys.length * 2);
    
    // API-like URL (up to 20 points)
    if (url.includes('/api/')) score += 10;
    if (url.includes('graphql')) score += 15;
    if (url.match(/\/v\d+\//)) score += 5;
    if (url.includes('.json')) score += 5;
    
    // Key quality (up to 20 points)
    const goodKeys = ['id', 'name', 'title', 'url', 'date', 'created', 'updated', 'slug'];
    const matchedKeys = itemKeys.filter(k => 
      goodKeys.some(gk => k.toLowerCase().includes(gk))
    ).length;
    score += Math.min(20, matchedKeys * 5);
    
    return Math.round(score);
  }

  /**
   * Get best candidate for a source
   */
  getBestCandidate(sourceId: string): PayloadCandidate | null {
    const sourceCandidates = this.candidates.get(sourceId);
    if (!sourceCandidates || sourceCandidates.length === 0) {
      return null;
    }
    return sourceCandidates.sort((a, b) => b.score - a.score)[0];
  }

  /**
   * Get all candidates for a source
   */
  getCandidates(sourceId: string): PayloadCandidate[] {
    return this.candidates.get(sourceId) || [];
  }

  /**
   * Get all high-scoring candidates
   */
  async getTopCandidates(minScore = 50, limit = 100): Promise<PayloadCandidate[]> {
    return this.candidatesCollection
      .find({ score: { $gte: minScore } })
      .sort({ score: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Mark a candidate as verified (manually confirmed working)
   */
  async verifyCandidate(sourceId: string, endpoint: string): Promise<void> {
    await this.candidatesCollection.updateOne(
      { sourceId, endpoint },
      { $set: { verified: true, lastVerifiedAt: new Date() } }
    );
    
    // Update cache
    const doc = await this.candidatesCollection.findOne({ sourceId, endpoint });
    if (doc) {
      const existing = this.candidates.get(sourceId) || [];
      const idx = existing.findIndex(c => c.endpoint === endpoint);
      if (idx >= 0) {
        existing[idx] = doc;
      } else {
        existing.push(doc);
      }
      this.candidates.set(sourceId, existing);
    }
    
    this.logger.log(`Verified candidate endpoint: ${sourceId} → ${endpoint}`);
  }

  /**
   * Create Puppeteer intercept handler
   */
  createInterceptHandler(sourceId: string, sourceUrl: string) {
    return async (response: any) => {
      try {
        const url = response.url();
        const request = response.request();
        
        // Only process JSON responses
        const contentType = response.headers()['content-type'] || '';
        if (!contentType.includes('json')) return;
        
        // Try to get response body
        let body;
        try {
          body = await response.json();
        } catch {
          return;
        }
        
        await this.processIntercepted(sourceId, sourceUrl, {
          url,
          method: request.method(),
          headers: request.headers(),
          body: request.postData() ? JSON.parse(request.postData()) : undefined,
          response: body,
        });
      } catch (error) {
        // Silently ignore errors in intercept
      }
    };
  }
}
