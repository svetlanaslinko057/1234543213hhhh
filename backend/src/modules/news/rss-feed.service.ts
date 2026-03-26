/**
 * RSS Feed Service
 * 
 * BLOCK 2: Real-time news ingestion from crypto RSS feeds
 * 
 * Sources:
 * - CoinDesk, Cointelegraph, TheBlock, Decrypt, DLNews
 * 
 * Pipeline:
 * RSS → fetch → deduplicate → store → trigger news_intelligence
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import * as crypto from 'crypto';

export interface RssFeed {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  tier: number; // 1 = primary, 2 = secondary, 3 = tertiary
  category: string;
  lastFetchedAt?: Date;
  lastArticleAt?: Date;
  fetchIntervalMinutes: number;
  successCount: number;
  errorCount: number;
  lastError?: string;
}

export interface RssArticle {
  id: string;
  feedId: string;
  title: string;
  link: string;
  pubDate: Date;
  description?: string;
  content?: string;
  author?: string;
  categories?: string[];
  contentHash: string;
  source: string;
  processed: boolean;
  createdAt: Date;
}

// Crypto RSS feeds
const DEFAULT_FEEDS: Omit<RssFeed, 'lastFetchedAt' | 'lastArticleAt' | 'successCount' | 'errorCount'>[] = [
  // Tier 1 - Primary sources
  { id: 'coindesk', name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', enabled: true, tier: 1, category: 'news', fetchIntervalMinutes: 10 },
  { id: 'cointelegraph', name: 'Cointelegraph', url: 'https://cointelegraph.com/rss', enabled: true, tier: 1, category: 'news', fetchIntervalMinutes: 10 },
  { id: 'theblock', name: 'The Block', url: 'https://www.theblock.co/rss.xml', enabled: true, tier: 1, category: 'news', fetchIntervalMinutes: 10 },
  
  // Tier 2 - Secondary
  { id: 'decrypt', name: 'Decrypt', url: 'https://decrypt.co/feed', enabled: true, tier: 2, category: 'news', fetchIntervalMinutes: 15 },
  { id: 'dlnews', name: 'DL News', url: 'https://www.dlnews.com/arc/outboundfeeds/rss/', enabled: true, tier: 2, category: 'news', fetchIntervalMinutes: 15 },
  { id: 'cryptoslate', name: 'CryptoSlate', url: 'https://cryptoslate.com/feed/', enabled: true, tier: 2, category: 'news', fetchIntervalMinutes: 15 },
  
  // Tier 3 - Additional
  { id: 'bitcoinmagazine', name: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com/feed', enabled: true, tier: 3, category: 'bitcoin', fetchIntervalMinutes: 30 },
  { id: 'blockworks', name: 'Blockworks', url: 'https://blockworks.co/feed/', enabled: true, tier: 3, category: 'defi', fetchIntervalMinutes: 30 },
];

@Injectable()
export class RssFeedService {
  private readonly logger = new Logger(RssFeedService.name);
  private feeds: Map<string, RssFeed> = new Map();
  private seenHashes: Set<string> = new Set();

  constructor(
    @InjectModel('news_articles') private articlesModel: Model<any>,
    @InjectModel('rss_feeds') private feedsModel: Model<any>,
  ) {
    this.initializeFeeds();
  }

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════

  private async initializeFeeds(): Promise<void> {
    // Load from DB or use defaults
    try {
      const dbFeeds = await this.feedsModel.find({}).lean();
      
      if (dbFeeds.length > 0) {
        for (const f of dbFeeds) {
          this.feeds.set(f.id, f as unknown as RssFeed);
        }
        this.logger.log(`[RSS] Loaded ${this.feeds.size} feeds from DB`);
      } else {
        // Initialize with defaults
        for (const feed of DEFAULT_FEEDS) {
          const fullFeed: RssFeed = {
            ...feed,
            successCount: 0,
            errorCount: 0,
          };
          this.feeds.set(feed.id, fullFeed);
          await this.feedsModel.create(fullFeed).catch(() => {});
        }
        this.logger.log(`[RSS] Initialized ${this.feeds.size} default feeds`);
      }

      // Load recent hashes for deduplication
      const recentArticles = await this.articlesModel
        .find({})
        .select('contentHash')
        .sort({ createdAt: -1 })
        .limit(10000)
        .lean();
      
      for (const a of recentArticles) {
        if (a.contentHash) {
          this.seenHashes.add(a.contentHash);
        }
      }
      
      this.logger.log(`[RSS] Loaded ${this.seenHashes.size} content hashes for deduplication`);
    } catch (e: any) {
      this.logger.error(`[RSS] Init failed: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // FETCH ALL FEEDS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Fetch all enabled feeds
   */
  async fetchAll(): Promise<{
    fetched: number;
    newArticles: number;
    errors: number;
    feeds: Array<{ id: string; articles: number; error?: string }>;
  }> {
    const results: Array<{ id: string; articles: number; error?: string }> = [];
    let totalNew = 0;
    let errors = 0;

    const enabledFeeds = Array.from(this.feeds.values())
      .filter(f => f.enabled)
      .sort((a, b) => a.tier - b.tier);

    for (const feed of enabledFeeds) {
      try {
        const articles = await this.fetchFeed(feed.id);
        results.push({ id: feed.id, articles: articles.length });
        totalNew += articles.length;
      } catch (e: any) {
        results.push({ id: feed.id, articles: 0, error: e.message });
        errors++;
      }
    }

    this.logger.log(
      `[RSS] Fetched ${enabledFeeds.length} feeds: ${totalNew} new articles, ${errors} errors`
    );

    return {
      fetched: enabledFeeds.length,
      newArticles: totalNew,
      errors,
      feeds: results,
    };
  }

  /**
   * Fetch a single feed
   */
  async fetchFeed(feedId: string): Promise<RssArticle[]> {
    const feed = this.feeds.get(feedId);
    if (!feed) {
      throw new Error(`Feed ${feedId} not found`);
    }

    const now = new Date();
    const articles: RssArticle[] = [];

    try {
      const response = await axios.get(feed.url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FOMOBot/1.0)',
          'Accept': 'application/rss+xml, application/xml, text/xml',
        },
      });

      const items = this.parseRss(response.data);

      for (const item of items) {
        const contentHash = this.hashContent(item.title + item.link);

        // Deduplicate
        if (this.seenHashes.has(contentHash)) {
          continue;
        }

        const article: RssArticle = {
          id: `${feedId}_${contentHash.slice(0, 12)}`,
          feedId,
          title: item.title,
          link: item.link,
          pubDate: item.pubDate || now,
          description: item.description,
          content: item.content,
          author: item.author,
          categories: item.categories,
          contentHash,
          source: feed.name,
          processed: false,
          createdAt: now,
        };

        // Save to DB
        await this.articlesModel.create({
          ...article,
          published_at: article.pubDate,
          source: feed.name,
          source_id: feedId,
          title: article.title,
          content: article.content || article.description,
          summary: article.description,
          url: article.link,
        }).catch(() => {});

        this.seenHashes.add(contentHash);
        articles.push(article);
      }

      // Update feed stats
      feed.lastFetchedAt = now;
      feed.successCount++;
      if (articles.length > 0) {
        feed.lastArticleAt = now;
      }
      feed.lastError = undefined;

      await this.feedsModel.updateOne(
        { id: feedId },
        { $set: feed },
      ).catch(() => {});

      this.logger.log(`[RSS] ${feed.name}: ${articles.length} new articles`);
      return articles;

    } catch (e: any) {
      feed.errorCount++;
      feed.lastError = e.message;
      
      await this.feedsModel.updateOne(
        { id: feedId },
        { $set: { errorCount: feed.errorCount, lastError: feed.lastError } },
      ).catch(() => {});

      this.logger.error(`[RSS] ${feed.name} failed: ${e.message}`);
      throw e;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RSS PARSING
  // ═══════════════════════════════════════════════════════════════

  private parseRss(xml: string): Array<{
    title: string;
    link: string;
    description?: string;
    content?: string;
    pubDate?: Date;
    author?: string;
    categories?: string[];
  }> {
    const items: any[] = [];

    // Simple regex-based parsing (works for most RSS feeds)
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];

      const title = this.extractTag(itemXml, 'title');
      const link = this.extractTag(itemXml, 'link') || this.extractTag(itemXml, 'guid');
      const description = this.extractTag(itemXml, 'description');
      const content = this.extractTag(itemXml, 'content:encoded') || this.extractTag(itemXml, 'content');
      const pubDateStr = this.extractTag(itemXml, 'pubDate');
      const author = this.extractTag(itemXml, 'author') || this.extractTag(itemXml, 'dc:creator');

      // Extract categories
      const categories: string[] = [];
      const catRegex = /<category[^>]*>([\s\S]*?)<\/category>/gi;
      let catMatch;
      while ((catMatch = catRegex.exec(itemXml)) !== null) {
        const cat = this.stripCdata(catMatch[1]).trim();
        if (cat) categories.push(cat);
      }

      if (title && link) {
        items.push({
          title: this.stripCdata(title).trim(),
          link: this.stripCdata(link).trim(),
          description: description ? this.stripHtml(this.stripCdata(description)).trim() : undefined,
          content: content ? this.stripHtml(this.stripCdata(content)).trim().slice(0, 5000) : undefined,
          pubDate: pubDateStr ? new Date(pubDateStr) : undefined,
          author: author ? this.stripCdata(author).trim() : undefined,
          categories: categories.length > 0 ? categories : undefined,
        });
      }
    }

    return items;
  }

  private extractTag(xml: string, tag: string): string | null {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : null;
  }

  private stripCdata(text: string): string {
    return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // ═══════════════════════════════════════════════════════════════
  // FEED MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  getFeeds(): RssFeed[] {
    return Array.from(this.feeds.values()).sort((a, b) => a.tier - b.tier);
  }

  getFeed(feedId: string): RssFeed | null {
    return this.feeds.get(feedId) || null;
  }

  async enableFeed(feedId: string): Promise<void> {
    const feed = this.feeds.get(feedId);
    if (feed) {
      feed.enabled = true;
      await this.feedsModel.updateOne({ id: feedId }, { $set: { enabled: true } }).catch(() => {});
    }
  }

  async disableFeed(feedId: string): Promise<void> {
    const feed = this.feeds.get(feedId);
    if (feed) {
      feed.enabled = false;
      await this.feedsModel.updateOne({ id: feedId }, { $set: { enabled: false } }).catch(() => {});
    }
  }

  async addFeed(feed: Omit<RssFeed, 'successCount' | 'errorCount'>): Promise<void> {
    const fullFeed: RssFeed = {
      ...feed,
      successCount: 0,
      errorCount: 0,
    };
    this.feeds.set(feed.id, fullFeed);
    await this.feedsModel.create(fullFeed).catch(() => {});
  }

  getStats(): {
    totalFeeds: number;
    enabledFeeds: number;
    articlesCached: number;
    feedStats: Array<{
      id: string;
      name: string;
      tier: number;
      enabled: boolean;
      successCount: number;
      errorCount: number;
      lastFetchedAt?: Date;
    }>;
  } {
    const feeds = this.getFeeds();
    return {
      totalFeeds: feeds.length,
      enabledFeeds: feeds.filter(f => f.enabled).length,
      articlesCached: this.seenHashes.size,
      feedStats: feeds.map(f => ({
        id: f.id,
        name: f.name,
        tier: f.tier,
        enabled: f.enabled,
        successCount: f.successCount,
        errorCount: f.errorCount,
        lastFetchedAt: f.lastFetchedAt,
      })),
    };
  }
}
