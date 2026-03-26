/**
 * RootData API Client
 * 
 * Handles all HTTP requests to RootData API
 * Includes retry logic and rate limiting
 */

import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface RootDataProject {
  id: number;
  name: string;
  slug: string;
  logo?: string;
  description?: string;
  category?: string;
  website?: string;
  twitter?: string;
  total_funding?: number;
  team_size?: number;
  founded_date?: string;
}

export interface RootDataFund {
  id: number;
  name: string;
  slug: string;
  logo?: string;
  description?: string;
  type?: string;
  aum?: number;
  portfolio_count?: number;
  website?: string;
  twitter?: string;
  founded_year?: number;
}

export interface RootDataPerson {
  id: number;
  name: string;
  slug: string;
  avatar?: string;
  title?: string;
  bio?: string;
  twitter?: string;
  linkedin?: string;
  organizations?: Array<{
    id: number;
    name: string;
    role: string;
    current: boolean;
  }>;
}

export interface RootDataRound {
  id: number;
  project_id: number;
  project_name: string;
  round: string;
  amount?: number;
  valuation?: number;
  date?: string;
  investors: Array<{
    id: number;
    name: string;
    lead?: boolean;
  }>;
}

@Injectable()
export class RootDataClient {
  private readonly logger = new Logger(RootDataClient.name);
  private readonly client: AxiosInstance;
  private readonly baseUrl = 'https://api.rootdata.com/open';
  
  // Rate limiting
  private lastRequestTime = 0;
  private readonly minRequestInterval = 200; // 200ms between requests

  constructor() {
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FOMO-Intelligence/2.0',
      },
    });
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private async requestWithRetry<T>(
    endpoint: string,
    params: Record<string, any> = {},
    retries = 3,
  ): Promise<T | null> {
    await this.rateLimit();

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.client.get(endpoint, { params });
        
        if (response.status === 200 && response.data) {
          return response.data;
        }
        
        this.logger.warn(`[RootData] ${endpoint} returned ${response.status}`);
        return null;
      } catch (error: any) {
        const isLastAttempt = attempt === retries;
        
        if (error.response?.status === 429) {
          // Rate limited - wait longer
          const waitTime = Math.pow(2, attempt) * 1000;
          this.logger.warn(`[RootData] Rate limited, waiting ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        if (isLastAttempt) {
          this.logger.error(`[RootData] ${endpoint} failed after ${retries} attempts: ${error.message}`);
          return null;
        }
        
        // Exponential backoff
        const waitTime = Math.pow(2, attempt) * 500;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // PROJECTS
  // ═══════════════════════════════════════════════════════════════

  async fetchProjects(page = 1, limit = 50): Promise<RootDataProject[]> {
    const data = await this.requestWithRetry<any>('/item', { page, limit });
    
    if (!data?.data?.list) {
      return [];
    }
    
    return data.data.list.map((item: any) => ({
      id: item.id,
      name: item.name,
      slug: item.slug || this.slugify(item.name),
      logo: item.logo,
      description: item.description,
      category: item.category,
      website: item.website,
      twitter: item.twitter,
      total_funding: item.total_funding,
      team_size: item.team_size,
      founded_date: item.founded_date,
    }));
  }

  async fetchProjectDetails(projectId: number): Promise<RootDataProject | null> {
    const data = await this.requestWithRetry<any>(`/item/${projectId}`);
    
    if (!data?.data) {
      return null;
    }
    
    const item = data.data;
    return {
      id: item.id,
      name: item.name,
      slug: item.slug || this.slugify(item.name),
      logo: item.logo,
      description: item.description,
      category: item.category,
      website: item.website,
      twitter: item.twitter,
      total_funding: item.total_funding,
      team_size: item.team_size,
      founded_date: item.founded_date,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // FUNDS / INVESTORS
  // ═══════════════════════════════════════════════════════════════

  async fetchFunds(page = 1, limit = 50): Promise<RootDataFund[]> {
    const data = await this.requestWithRetry<any>('/org', { page, limit, type: 'vc' });
    
    if (!data?.data?.list) {
      return [];
    }
    
    return data.data.list.map((item: any) => ({
      id: item.id,
      name: item.name,
      slug: item.slug || this.slugify(item.name),
      logo: item.logo,
      description: item.description,
      type: item.type || 'vc',
      aum: item.aum,
      portfolio_count: item.portfolio_count,
      website: item.website,
      twitter: item.twitter,
      founded_year: item.founded_year,
    }));
  }

  async fetchFundDetails(fundId: number): Promise<RootDataFund | null> {
    const data = await this.requestWithRetry<any>(`/org/${fundId}`);
    
    if (!data?.data) {
      return null;
    }
    
    const item = data.data;
    return {
      id: item.id,
      name: item.name,
      slug: item.slug || this.slugify(item.name),
      logo: item.logo,
      description: item.description,
      type: item.type || 'vc',
      aum: item.aum,
      portfolio_count: item.portfolio_count,
      website: item.website,
      twitter: item.twitter,
      founded_year: item.founded_year,
    };
  }

  async fetchFundPortfolio(fundId: number): Promise<any[]> {
    const data = await this.requestWithRetry<any>(`/org/${fundId}/portfolio`);
    return data?.data?.list || [];
  }

  // ═══════════════════════════════════════════════════════════════
  // PEOPLE / TEAM
  // ═══════════════════════════════════════════════════════════════

  async fetchPeople(page = 1, limit = 50): Promise<RootDataPerson[]> {
    const data = await this.requestWithRetry<any>('/people', { page, limit });
    
    if (!data?.data?.list) {
      return [];
    }
    
    return data.data.list.map((item: any) => ({
      id: item.id,
      name: item.name,
      slug: item.slug || this.slugify(item.name),
      avatar: item.avatar,
      title: item.title,
      bio: item.bio,
      twitter: item.twitter,
      linkedin: item.linkedin,
      organizations: item.organizations?.map((org: any) => ({
        id: org.id,
        name: org.name,
        role: org.role,
        current: org.current ?? true,
      })) || [],
    }));
  }

  async fetchProjectTeam(projectId: number): Promise<RootDataPerson[]> {
    const data = await this.requestWithRetry<any>(`/item/${projectId}/team`);
    
    if (!data?.data?.list) {
      return [];
    }
    
    return data.data.list.map((item: any) => ({
      id: item.id,
      name: item.name,
      slug: item.slug || this.slugify(item.name),
      avatar: item.avatar,
      title: item.title || item.role,
      bio: item.bio,
      twitter: item.twitter,
      linkedin: item.linkedin,
      organizations: [],
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  // FUNDING ROUNDS
  // ═══════════════════════════════════════════════════════════════

  async fetchFundingRounds(page = 1, limit = 50): Promise<RootDataRound[]> {
    const data = await this.requestWithRetry<any>('/ser_inv', { page, limit });
    
    if (!data?.data?.list) {
      return [];
    }
    
    return data.data.list.map((item: any) => ({
      id: item.id,
      project_id: item.project_id,
      project_name: item.project_name,
      round: item.round || 'Unknown',
      amount: item.amount,
      valuation: item.valuation,
      date: item.date,
      investors: item.investors?.map((inv: any) => ({
        id: inv.id,
        name: inv.name,
        lead: inv.lead || false,
      })) || [],
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  private slugify(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async healthCheck(): Promise<{ ok: boolean; latency: number }> {
    const start = Date.now();
    try {
      const data = await this.requestWithRetry<any>('/item', { page: 1, limit: 1 }, 1);
      return {
        ok: data !== null,
        latency: Date.now() - start,
      };
    } catch {
      return { ok: false, latency: Date.now() - start };
    }
  }
}
