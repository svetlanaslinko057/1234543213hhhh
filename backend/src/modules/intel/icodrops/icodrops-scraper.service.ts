import { Injectable } from '@nestjs/common';
import { BrowserService } from '../../../common/browser.service';

const BASE_URL = 'https://icodrops.com';

export interface IcoProject {
  key: string;
  source: string;
  name: string;
  slug: string;
  symbol?: string;
  status: string;  // upcoming, active, ended
  category?: string;
  raise_goal?: number;
  raise_actual?: number;
  price?: number;
  roi?: number;
  roi_ath?: number;
  start_date?: string;
  end_date?: string;
  website?: string;
  whitepaper?: string;
  social?: {
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
  investors?: string[];
  description?: string;
  rating?: string;
}

@Injectable()
export class IcoDropsScraperService {
  constructor(private readonly browserService: BrowserService) {}

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ═══════════════════════════════════════════════════════════════
  // ACTIVE ICOs
  // ═══════════════════════════════════════════════════════════════

  async scrapeActiveIcos(): Promise<IcoProject[]> {
    console.log('[IcoDropsScraper] Scraping active ICOs...');
    return this.scrapeIcoList('/ico-live');
  }

  // ═══════════════════════════════════════════════════════════════
  // UPCOMING ICOs
  // ═══════════════════════════════════════════════════════════════

  async scrapeUpcomingIcos(): Promise<IcoProject[]> {
    console.log('[IcoDropsScraper] Scraping upcoming ICOs...');
    return this.scrapeIcoList('/upcoming-ico');
  }

  // ═══════════════════════════════════════════════════════════════
  // ENDED ICOs (multiple pages)
  // ═══════════════════════════════════════════════════════════════

  async scrapeEndedIcos(maxPages: number = 50): Promise<IcoProject[]> {
    console.log(`[IcoDropsScraper] Scraping ended ICOs (up to ${maxPages} pages)...`);
    const allIcos: IcoProject[] = [];

    for (let page = 1; page <= maxPages; page++) {
      const url = page === 1 ? `${BASE_URL}/ico-ended` : `${BASE_URL}/ico-ended/page/${page}/`;
      
      try {
        const icos = await this.scrapeIcoListFromUrl(url, 'ended');
        
        if (icos.length === 0) {
          console.log(`[IcoDropsScraper] No more ICOs found at page ${page}`);
          break;
        }

        allIcos.push(...icos);
        console.log(`[IcoDropsScraper] Page ${page}: found ${icos.length} ended ICOs`);

      } catch (error) {
        console.error(`[IcoDropsScraper] Error on page ${page}:`, error.message);
        break;
      }

      if (page < maxPages) {
        await this.sleep(2000 + Math.random() * 1000);
      }
    }

    console.log(`[IcoDropsScraper] Total ended ICOs: ${allIcos.length}`);
    return allIcos;
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPER: Scrape ICO list page
  // ═══════════════════════════════════════════════════════════════

  private async scrapeIcoList(path: string): Promise<IcoProject[]> {
    const url = `${BASE_URL}${path}`;
    return this.scrapeIcoListFromUrl(url, this.getStatusFromPath(path));
  }

  private async scrapeIcoListFromUrl(url: string, status: string): Promise<IcoProject[]> {
    const icos: IcoProject[] = [];

    try {
      const html = await this.browserService.fetchHtml(url);
      if (!html) return icos;

      // Parse ICO cards from HTML
      const cardMatches = html.matchAll(/<div class="[^"]*ico-card[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi);

      for (const match of cardMatches) {
        const cardHtml = match[0];
        const ico = this.parseIcoCard(cardHtml, status);
        if (ico) {
          icos.push(ico);
        }
      }

      // Alternative: parse from a-ico-card elements
      if (icos.length === 0) {
        const altMatches = html.matchAll(/<a[^>]*class="[^"]*a-ico[^"]*"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/gi);
        
        for (const match of altMatches) {
          const [, href, name] = match;
          const slug = href?.split('/').filter(Boolean).pop() || '';
          
          if (name && slug) {
            icos.push({
              key: `icodrops:${slug}`,
              source: 'icodrops',
              name: name.trim(),
              slug,
              status,
            });
          }
        }
      }

    } catch (error) {
      console.error(`[IcoDropsScraper] Error scraping ${url}:`, error.message);
    }

    return icos;
  }

  private parseIcoCard(html: string, status: string): IcoProject | null {
    try {
      // Extract name
      const nameMatch = html.match(/<h3[^>]*>([^<]+)<\/h3>/i);
      const name = nameMatch?.[1]?.trim();
      if (!name) return null;

      // Extract link/slug
      const linkMatch = html.match(/href="\/ico\/([^"\/]+)/i);
      const slug = linkMatch?.[1] || name.toLowerCase().replace(/\s+/g, '-');

      // Extract symbol
      const symbolMatch = html.match(/\(([A-Z0-9]{2,10})\)/);
      const symbol = symbolMatch?.[1];

      // Extract goal
      const goalMatch = html.match(/Goal:\s*\$?([\d,\.]+[KMB]?)/i);
      const raise_goal = this.parseAmount(goalMatch?.[1]);

      // Extract ROI
      const roiMatch = html.match(/ROI[:\s]*([\d\.]+)x/i);
      const roi = roiMatch ? parseFloat(roiMatch[1]) : undefined;

      // Extract category
      const catMatch = html.match(/class="[^"]*category[^"]*"[^>]*>([^<]+)/i);
      const category = catMatch?.[1]?.trim();

      return {
        key: `icodrops:${slug}`,
        source: 'icodrops',
        name,
        slug,
        symbol,
        status,
        category,
        raise_goal,
        roi,
      };

    } catch (error) {
      return null;
    }
  }

  private parseAmount(str: string | undefined): number | undefined {
    if (!str) return undefined;
    
    const clean = str.replace(/[,$]/g, '');
    let value = parseFloat(clean);
    
    if (clean.endsWith('K')) value *= 1000;
    else if (clean.endsWith('M')) value *= 1000000;
    else if (clean.endsWith('B')) value *= 1000000000;
    
    return isNaN(value) ? undefined : value;
  }

  private getStatusFromPath(path: string): string {
    if (path.includes('live')) return 'active';
    if (path.includes('upcoming')) return 'upcoming';
    if (path.includes('ended')) return 'ended';
    return 'unknown';
  }

  // ═══════════════════════════════════════════════════════════════
  // SCRAPE ALL
  // ═══════════════════════════════════════════════════════════════

  async scrapeAll(endedPages: number = 50): Promise<any> {
    const start = Date.now();
    console.log('[IcoDropsScraper] Starting FULL scrape...');

    const active = await this.scrapeActiveIcos();
    await this.sleep(2000);

    const upcoming = await this.scrapeUpcomingIcos();
    await this.sleep(2000);

    const ended = await this.scrapeEndedIcos(endedPages);

    const elapsed = (Date.now() - start) / 1000;

    const result = {
      ts: Date.now(),
      source: 'icodrops',
      elapsed_sec: Math.round(elapsed * 100) / 100,
      datasets: {
        active: { count: active.length, data: active },
        upcoming: { count: upcoming.length, data: upcoming },
        ended: { count: ended.length, data: ended },
      },
      summary: {
        active: active.length,
        upcoming: upcoming.length,
        ended: ended.length,
        total: active.length + upcoming.length + ended.length,
      },
    };

    console.log(`[IcoDropsScraper] Full scrape complete in ${elapsed.toFixed(1)}s:`, result.summary);
    return result;
  }
}
