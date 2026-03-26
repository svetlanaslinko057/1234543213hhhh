import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IcoDropsScraperService, IcoProject } from './icodrops-scraper.service';

@Injectable()
export class IcoDropsSyncService {
  constructor(
    private readonly scraper: IcoDropsScraperService,
    @InjectModel('intel_icos') private icosModel: Model<any>,
    @InjectModel('intel_projects') private projectsModel: Model<any>,
  ) {}

  async syncActive(): Promise<any> {
    console.log('[IcoDropsSync] Syncing active ICOs...');
    const icos = await this.scraper.scrapeActiveIcos();
    return this.saveIcos(icos, 'active');
  }

  async syncUpcoming(): Promise<any> {
    console.log('[IcoDropsSync] Syncing upcoming ICOs...');
    const icos = await this.scraper.scrapeUpcomingIcos();
    return this.saveIcos(icos, 'upcoming');
  }

  async syncEnded(maxPages: number = 50): Promise<any> {
    console.log(`[IcoDropsSync] Syncing ended ICOs (${maxPages} pages)...`);
    const icos = await this.scraper.scrapeEndedIcos(maxPages);
    return this.saveIcos(icos, 'ended');
  }

  async syncAll(endedPages: number = 50): Promise<any> {
    console.log('[IcoDropsSync] Starting FULL ICO sync...');

    const results: any = {
      source: 'icodrops',
      method: 'puppeteer',
      ts: Date.now(),
      syncs: {},
    };

    try {
      results.syncs.active = await this.syncActive();
    } catch (error) {
      results.syncs.active = { error: error.message };
    }

    try {
      results.syncs.upcoming = await this.syncUpcoming();
    } catch (error) {
      results.syncs.upcoming = { error: error.message };
    }

    try {
      results.syncs.ended = await this.syncEnded(endedPages);
    } catch (error) {
      results.syncs.ended = { error: error.message };
    }

    console.log('[IcoDropsSync] Full sync complete');
    return results;
  }

  private async saveIcos(icos: IcoProject[], status: string): Promise<any> {
    if (!icos.length) {
      return { total: 0, changed: 0, note: 'No data from scraper' };
    }

    let changed = 0;

    for (const ico of icos) {
      const doc = {
        key: ico.key,
        source: 'icodrops',
        name: ico.name,
        slug: ico.slug,
        symbol: ico.symbol,
        status,
        category: ico.category,
        raise_goal: ico.raise_goal,
        raise_actual: ico.raise_actual,
        price: ico.price,
        roi: ico.roi,
        roi_ath: ico.roi_ath,
        start_date: ico.start_date,
        end_date: ico.end_date,
        website: ico.website,
        investors: ico.investors || [],
        description: ico.description,
        rating: ico.rating,
        updated_at: new Date(),
      };

      const existing = await this.icosModel.findOne({ key: doc.key });
      
      if (!existing) {
        await this.icosModel.create(doc);
        changed++;
      } else {
        // Check for changes
        let hasChanges = false;
        for (const k of Object.keys(doc)) {
          if (k === 'updated_at' || k === '_id') continue;
          if (JSON.stringify(existing[k]) !== JSON.stringify(doc[k])) {
            hasChanges = true;
            break;
          }
        }
        if (hasChanges) {
          await this.icosModel.updateOne({ key: doc.key }, { $set: doc });
          changed++;
        }
      }

      // Also add to projects collection
      const projectDoc = {
        key: `icodrops:project:${ico.slug}`,
        source: 'icodrops',
        slug: ico.slug,
        symbol: ico.symbol,
        name: ico.name,
        type: 'ico',
        status,
        category: ico.category,
        raise_goal: ico.raise_goal,
        roi: ico.roi,
        updated_at: new Date(),
      };

      await this.projectsModel.updateOne(
        { key: projectDoc.key },
        { $set: projectDoc },
        { upsert: true }
      );
    }

    console.log(`[IcoDropsSync] ${status}: ${icos.length} scraped, ${changed} changed`);
    return { total: icos.length, changed };
  }
}
