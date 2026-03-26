import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
const Parser = require('rss-parser');
import { NEWS_SOURCES, NewsSourceConfig, getActiveSources, getSourcesByTier } from './news-sources.config';

export interface NewsArticle {
  id: string;
  source_id: string;
  source_name: string;
  url: string;
  title: string;
  summary: string;
  content?: string;
  author?: string;
  published_at?: string;
  image_url?: string;
  tags: string[];
  language: string;
  content_hash: string;
}

@Injectable()
export class NewsFetcherService {
  private parser: any;
  private readonly timeout = 30000;

  constructor() {
    this.parser = new Parser({
      timeout: this.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 FOMO/2.0',
      },
    });
  }

  private generateArticleId(url: string, sourceId: string): string {
    const hash = crypto.createHash('md5').update(`${sourceId}:${url}`).digest('hex');
    return `art_${hash.slice(0, 16)}`;
  }

  private generateContentHash(title: string, content: string = ''): string {
    const text = `${title}:${(content || '').slice(0, 500)}`;
    return crypto.createHash('md5').update(text.toLowerCase()).digest('hex');
  }

  private cleanHtml(html: string): string {
    if (!html) return '';
    // Simple HTML tag removal
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);
  }

  private extractImageUrl(item: any): string | undefined {
    // Try multiple sources for image
    if (item['media:content']?.url) return item['media:content'].url;
    if (item['media:thumbnail']?.url) return item['media:thumbnail'].url;
    if (item.enclosure?.url && item.enclosure.type?.startsWith('image/')) {
      return item.enclosure.url;
    }
    // Try to extract from content
    if (item.content || item['content:encoded']) {
      const content = item.content || item['content:encoded'];
      const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch && imgMatch[1].startsWith('http')) {
        return imgMatch[1];
      }
    }
    return undefined;
  }

  async fetchRssSource(source: NewsSourceConfig, limit: number = 30): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];

    try {
      console.log(`[NewsFetcher] Fetching ${source.name}...`);
      const feed = await this.parser.parseURL(source.rss_url);

      for (const item of (feed.items || []).slice(0, limit)) {
        if (!item.link || !item.title) continue;

        const content = item.content || item['content:encoded'] || item.summary || item.description || '';
        const cleanContent = this.cleanHtml(content);

        const article: NewsArticle = {
          id: this.generateArticleId(item.link, source.id),
          source_id: source.id,
          source_name: source.name,
          url: item.link,
          title: item.title.trim(),
          summary: cleanContent.slice(0, 500),
          content: cleanContent,
          author: item.creator || item.author || undefined,
          published_at: item.pubDate || item.isoDate || undefined,
          image_url: this.extractImageUrl(item),
          tags: (item.categories || []).map((c: any) => typeof c === 'string' ? c : c._ || ''),
          language: source.language,
          content_hash: this.generateContentHash(item.title, cleanContent),
        };

        articles.push(article);
      }

      console.log(`[NewsFetcher] ${source.name}: fetched ${articles.length} articles`);
    } catch (error) {
      console.error(`[NewsFetcher] ${source.name} error:`, error.message);
    }

    return articles;
  }

  async fetchSource(sourceId: string, limit: number = 30): Promise<NewsArticle[]> {
    const source = NEWS_SOURCES.find(s => s.id === sourceId);
    if (!source) {
      console.error(`[NewsFetcher] Source not found: ${sourceId}`);
      return [];
    }
    return this.fetchRssSource(source, limit);
  }

  async fetchTierA(limit: number = 30): Promise<{ source: string; articles: NewsArticle[] }[]> {
    console.log('[NewsFetcher] Fetching Tier A sources...');
    const sources = getSourcesByTier('A');
    const results: { source: string; articles: NewsArticle[] }[] = [];

    for (const source of sources) {
      const articles = await this.fetchRssSource(source, limit);
      results.push({ source: source.id, articles });
      await this.sleep(500); // Rate limit
    }

    return results;
  }

  async fetchTierB(limit: number = 30): Promise<{ source: string; articles: NewsArticle[] }[]> {
    console.log('[NewsFetcher] Fetching Tier B sources...');
    const sources = getSourcesByTier('B');
    const results: { source: string; articles: NewsArticle[] }[] = [];

    for (const source of sources) {
      const articles = await this.fetchRssSource(source, limit);
      results.push({ source: source.id, articles });
      await this.sleep(500);
    }

    return results;
  }

  async fetchTierC(limit: number = 20): Promise<{ source: string; articles: NewsArticle[] }[]> {
    console.log('[NewsFetcher] Fetching Tier C sources...');
    const sources = getSourcesByTier('C');
    const results: { source: string; articles: NewsArticle[] }[] = [];

    for (const source of sources) {
      const articles = await this.fetchRssSource(source, limit);
      results.push({ source: source.id, articles });
      await this.sleep(500);
    }

    return results;
  }

  async fetchAll(limit: number = 30): Promise<any> {
    const start = Date.now();
    console.log('[NewsFetcher] Starting full fetch...');

    const allArticles: NewsArticle[] = [];
    const sourceResults: { [key: string]: number } = {};

    const sources = getActiveSources();

    for (const source of sources) {
      try {
        const articles = await this.fetchRssSource(source, limit);
        allArticles.push(...articles);
        sourceResults[source.id] = articles.length;
      } catch (error) {
        console.error(`[NewsFetcher] ${source.id} failed:`, error.message);
        sourceResults[source.id] = 0;
      }
      await this.sleep(300);
    }

    const elapsed = (Date.now() - start) / 1000;

    const result = {
      ts: Date.now(),
      elapsed_sec: Math.round(elapsed * 100) / 100,
      sources_fetched: Object.keys(sourceResults).length,
      total_articles: allArticles.length,
      by_source: sourceResults,
      by_tier: {
        A: allArticles.filter(a => {
          const src = NEWS_SOURCES.find(s => s.id === a.source_id);
          return src?.tier === 'A';
        }).length,
        B: allArticles.filter(a => {
          const src = NEWS_SOURCES.find(s => s.id === a.source_id);
          return src?.tier === 'B';
        }).length,
        C: allArticles.filter(a => {
          const src = NEWS_SOURCES.find(s => s.id === a.source_id);
          return src?.tier === 'C';
        }).length,
      },
      articles: allArticles,
    };

    console.log(`[NewsFetcher] Full fetch complete: ${allArticles.length} articles in ${elapsed.toFixed(1)}s`);
    return result;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
