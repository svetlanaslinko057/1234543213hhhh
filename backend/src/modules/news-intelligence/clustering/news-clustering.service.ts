/**
 * News Clustering Service
 * 
 * BLOCK 6: Groups related news articles into clusters/events
 * - By topic (funding, launch, partnership)
 * - By entities (same project/fund mentioned)
 * - By time proximity
 */

import { Injectable, Logger } from '@nestjs/common';

export interface NewsEvent {
  id: string;
  title: string;
  source: string;
  publishedAt: Date;
  type: string;
  entities: Array<{
    canonicalId: string;
    type: string;
    confidence: number;
  }>;
  content?: string;
}

export interface NewsCluster {
  id: string;
  type: string;
  mainEntity: string;
  entities: string[];
  events: NewsEvent[];
  eventCount: number;
  score: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  sources: string[];
}

@Injectable()
export class NewsClusteringService {
  private readonly logger = new Logger(NewsClusteringService.name);

  /**
   * Cluster news events by topic and entities
   */
  cluster(events: NewsEvent[]): NewsCluster[] {
    const clusters: Map<string, NewsCluster> = new Map();

    for (const event of events) {
      const key = this.buildClusterKey(event);

      if (!clusters.has(key)) {
        clusters.set(key, {
          id: key,
          type: event.type,
          mainEntity: event.entities[0]?.canonicalId || 'unknown',
          entities: [],
          events: [],
          eventCount: 0,
          score: 0,
          firstSeenAt: event.publishedAt,
          lastSeenAt: event.publishedAt,
          sources: [],
        });
      }

      const cluster = clusters.get(key)!;

      // Add event
      cluster.events.push(event);
      cluster.eventCount++;

      // Update entities (deduplicated)
      for (const e of event.entities) {
        if (!cluster.entities.includes(e.canonicalId)) {
          cluster.entities.push(e.canonicalId);
        }
      }

      // Update timestamps
      if (event.publishedAt < cluster.firstSeenAt) {
        cluster.firstSeenAt = event.publishedAt;
      }
      if (event.publishedAt > cluster.lastSeenAt) {
        cluster.lastSeenAt = event.publishedAt;
      }

      // Update sources
      if (!cluster.sources.includes(event.source)) {
        cluster.sources.push(event.source);
      }

      // Update score (frequency-based)
      cluster.score = cluster.eventCount;
    }

    // Merge similar clusters
    const mergedClusters = this.mergeSimilarClusters([...clusters.values()]);

    this.logger.log(
      `[NewsClusteringService] Created ${mergedClusters.length} clusters from ${events.length} events`
    );

    return mergedClusters;
  }

  /**
   * Build cluster key from event
   * Format: type:mainEntity
   */
  private buildClusterKey(event: NewsEvent): string {
    const mainEntity = event.entities[0]?.canonicalId || 'unknown';
    const type = event.type || 'generic';
    
    // Include date bucket for time-based separation (daily)
    const dateBucket = event.publishedAt.toISOString().split('T')[0];
    
    return `${type}:${mainEntity}:${dateBucket}`;
  }

  /**
   * Merge clusters with high entity overlap
   */
  private mergeSimilarClusters(clusters: NewsCluster[]): NewsCluster[] {
    if (clusters.length < 2) return clusters;

    const merged: NewsCluster[] = [];
    const used = new Set<string>();

    // Sort by score descending
    clusters.sort((a, b) => b.score - a.score);

    for (const cluster of clusters) {
      if (used.has(cluster.id)) continue;

      // Find similar clusters to merge
      const toMerge = [cluster];
      used.add(cluster.id);

      for (const other of clusters) {
        if (used.has(other.id)) continue;
        if (cluster.type !== other.type) continue;

        // Check entity overlap
        const overlap = this.calculateOverlap(cluster.entities, other.entities);
        
        // Merge if >50% overlap
        if (overlap > 0.5) {
          toMerge.push(other);
          used.add(other.id);
        }
      }

      // Merge clusters
      if (toMerge.length > 1) {
        merged.push(this.mergeClusterGroup(toMerge));
      } else {
        merged.push(cluster);
      }
    }

    return merged;
  }

  /**
   * Calculate Jaccard overlap between entity sets
   */
  private calculateOverlap(a: string[], b: string[]): number {
    const setA = new Set(a);
    const setB = new Set(b);
    
    const intersection = [...setA].filter(x => setB.has(x)).length;
    const union = new Set([...a, ...b]).size;
    
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Merge a group of clusters into one
   */
  private mergeClusterGroup(clusters: NewsCluster[]): NewsCluster {
    const allEvents = clusters.flatMap(c => c.events);
    const allEntities = [...new Set(clusters.flatMap(c => c.entities))];
    const allSources = [...new Set(clusters.flatMap(c => c.sources))];

    // Find time bounds
    const firstSeenAt = new Date(Math.min(...clusters.map(c => c.firstSeenAt.getTime())));
    const lastSeenAt = new Date(Math.max(...clusters.map(c => c.lastSeenAt.getTime())));

    // Use type and main entity from highest-scored cluster
    const main = clusters[0];

    return {
      id: `merged:${main.type}:${main.mainEntity}`,
      type: main.type,
      mainEntity: main.mainEntity,
      entities: allEntities,
      events: allEvents,
      eventCount: allEvents.length,
      score: allEvents.length,
      firstSeenAt,
      lastSeenAt,
      sources: allSources,
    };
  }
}
