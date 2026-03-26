/**
 * HTML PARSER SERVICE
 * 
 * Fallback parser using Cheerio for HTML scraping
 */

import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { ResilientFetchService } from '../antiblock/resilient-fetch.service';
import { SourceConfig } from './source.config';

export interface ParsedArticle {
  title: string;
  url: string;
  summary?: string;
  publishedAt?: Date;
  source: string;
  method: 'rss' | 'html' | 'browser';
}

@Injectable()
export class HtmlParserService {
  constructor(
    private readonly fetchService: ResilientFetchService,
  ) {}

  /**
   * Parse HTML page for articles
   */
  async parseHtml(source: SourceConfig): Promise<ParsedArticle[]> {
    const htmlUrl = source.fallback.htmlUrl || source.rssUrl.replace('/feed', '');
    
    console.log(`[HtmlParser] Fetching ${source.name} from ${htmlUrl}`);
    
    const html = await this.fetchService.getText(htmlUrl, {
      kind: 'html',
      timeout: 20000,
      retries: 2,
    });

    const $ = cheerio.load(html);
    const articles: ParsedArticle[] = [];
    const selectors = source.fallback.selectors || this.getDefaultSelectors();

    // Try multiple container selectors
    const containerSelectors = selectors.container?.split(', ') || [
      'article',
      '.post',
      '.post-card',
      '.news-item',
      '.article-card',
      '[class*="article"]',
      '[class*="post"]',
    ];

    for (const containerSel of containerSelectors) {
      $(containerSel).each((_, el) => {
        const $el = $(el);
        
        // Extract title
        const titleSel = selectors.title || 'h2, h3, .title';
        let title = $el.find(titleSel).first().text().trim();
        
        // Fallback: try any heading
        if (!title) {
          title = $el.find('h1, h2, h3, h4').first().text().trim();
        }
        
        // Extract link
        const linkSel = selectors.link || 'a';
        let link = $el.find(linkSel).first().attr('href');
        
        // Fallback: container might be the link itself
        if (!link && $el.is('a')) {
          link = $el.attr('href');
        }
        
        // Skip if no title or link
        if (!title || !link) return;
        
        // Normalize URL
        const url = this.normalizeUrl(link, htmlUrl);
        if (!url) return;
        
        // Skip duplicates
        if (articles.some(a => a.url === url)) return;
        
        // Extract summary
        const summarySel = selectors.summary || 'p, .excerpt, .summary';
        const summary = $el.find(summarySel).first().text().trim().substring(0, 300);
        
        articles.push({
          title,
          url,
          summary: summary || undefined,
          source: source.id,
          method: 'html',
        });
      });

      // If we found articles, stop trying other selectors
      if (articles.length > 0) break;
    }

    // Aggressive fallback: find all links with titles
    if (articles.length === 0) {
      $('a').each((_, el) => {
        const $a = $(el);
        const href = $a.attr('href');
        const title = $a.text().trim();
        
        // Filter: must look like an article
        if (!href || !title) return;
        if (title.length < 20 || title.length > 300) return;
        if (!href.includes('/') || href.startsWith('#')) return;
        
        const url = this.normalizeUrl(href, htmlUrl);
        if (!url) return;
        if (articles.some(a => a.url === url)) return;
        
        articles.push({
          title,
          url,
          source: source.id,
          method: 'html',
        });
      });
    }

    console.log(`[HtmlParser] ${source.name}: found ${articles.length} articles`);
    return articles.slice(0, 50); // Limit to 50
  }

  /**
   * Parse replacement URL (for deprecated RSS)
   */
  async parseReplacement(source: SourceConfig): Promise<ParsedArticle[]> {
    const url = source.fallback.replacementUrl || source.fallback.htmlUrl;
    if (!url) {
      throw new Error(`No replacement URL for ${source.id}`);
    }

    // Use same HTML parsing logic
    const modifiedSource: SourceConfig = {
      ...source,
      fallback: {
        ...source.fallback,
        htmlUrl: url,
      },
    };

    return this.parseHtml(modifiedSource);
  }

  private getDefaultSelectors() {
    return {
      container: 'article, .post, .post-card, .news-item',
      title: 'h2, h3, .title',
      link: 'a',
      summary: 'p, .excerpt',
    };
  }

  private normalizeUrl(href: string, baseUrl: string): string | null {
    try {
      // Already absolute
      if (href.startsWith('http://') || href.startsWith('https://')) {
        return href;
      }
      
      // Protocol-relative
      if (href.startsWith('//')) {
        return 'https:' + href;
      }
      
      // Relative to root
      if (href.startsWith('/')) {
        const base = new URL(baseUrl);
        return `${base.protocol}//${base.host}${href}`;
      }
      
      // Relative to current
      const base = new URL(baseUrl);
      return new URL(href, base).href;
      
    } catch {
      return null;
    }
  }
}
