/**
 * Knowledge Graph Data Models
 * 
 * Collections:
 * - graph_nodes: Entity nodes in the graph
 * - graph_edges: Relationships between nodes
 * - graph_edge_types: Dictionary of valid edge types
 * - graph_snapshots: Graph rebuild history
 */

import { v4 as uuidv4 } from 'uuid';

// Node Types
export const NODE_TYPES = [
  'project',
  'token',
  'asset',
  'fund',
  'person',
  'exchange',
  'activity',
  'funding_round',
  'unlock_event',
  'ico_sale',
] as const;

export type NodeType = typeof NODE_TYPES[number];

// G3: Graph Context Layer - Relation Scopes
export const RELATION_SCOPE: Record<string, string> = {
  // Investment scope
  invested_in: 'investment',
  investor: 'investment',
  led_round: 'investment',
  has_funding_round: 'investment',
  
  // Founder scope
  founded: 'founder',
  founder: 'founder',
  co_founded_by: 'founder',
  
  // Ecosystem scope
  built_on: 'ecosystem',
  built_by: 'ecosystem',
  ecosystem: 'ecosystem',
  has_token: 'ecosystem',
  belongs_to_project: 'ecosystem',
  
  // Partnership scope
  partner: 'partnership',
  partnership: 'partnership',
  coinvested_with: 'partnership',
  coinvested: 'partnership',
  
  // Market scope
  listed_on: 'market',
  listing: 'market',
  traded_on: 'market',
  has_pair: 'market',
  
  // Event scope
  event_linked: 'event',
  event: 'event',
  has_activity: 'event',
  has_unlock: 'event',
  
  // Mention scope (lowest priority)
  mention: 'mention',
  mentioned: 'mention',
  related_to: 'mention',
  related: 'mention',
};

// Edge Types Dictionary
export const EDGE_TYPES: Record<string, { from: string; to: string; directed: boolean; derived: boolean }> = {
  // Direct - Funds / Persons / Projects
  invested_in: { from: 'fund', to: 'project', directed: true, derived: false },
  led_round: { from: 'fund', to: 'funding_round', directed: true, derived: false },
  works_at: { from: 'person', to: 'fund', directed: true, derived: false },
  worked_at: { from: 'person', to: 'fund', directed: true, derived: false },
  founded: { from: 'person', to: 'project', directed: true, derived: false },
  advisor_of: { from: 'person', to: 'project', directed: true, derived: false },
  partner_at: { from: 'person', to: 'fund', directed: true, derived: false },
  
  // Direct - Projects / Tokens / Assets
  has_token: { from: 'project', to: 'token', directed: true, derived: false },
  mapped_to_asset: { from: 'token', to: 'asset', directed: true, derived: false },
  belongs_to_project: { from: 'asset', to: 'project', directed: true, derived: false },
  
  // Direct - Market / Exchanges
  traded_on: { from: 'asset', to: 'exchange', directed: true, derived: false },
  listed_on: { from: 'project', to: 'exchange', directed: true, derived: false },
  has_pair: { from: 'exchange', to: 'asset', directed: true, derived: false },
  
  // Direct - Intel / Events
  has_activity: { from: 'project', to: 'activity', directed: true, derived: false },
  has_unlock: { from: 'project', to: 'unlock_event', directed: true, derived: false },
  has_funding_round: { from: 'project', to: 'funding_round', directed: true, derived: false },
  has_ico: { from: 'project', to: 'ico_sale', directed: true, derived: false },
  
  // Derived - Network relations
  coinvested_with: { from: 'fund', to: 'fund', directed: false, derived: true },
  worked_together: { from: 'person', to: 'person', directed: false, derived: true },
  shares_investor_with: { from: 'project', to: 'project', directed: false, derived: true },
  shares_founder_with: { from: 'project', to: 'project', directed: false, derived: true },
  shares_ecosystem_with: { from: 'project', to: 'project', directed: false, derived: true },
  related_to: { from: '*', to: '*', directed: false, derived: true },
};

// Generate short ID
export function generateId(): string {
  return uuidv4().substring(0, 12);
}

// Graph Node interface
export interface GraphNode {
  id: string;
  entity_type: string;
  entity_id: string;
  label: string;
  slug?: string;
  status?: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// Graph Edge interface
export interface GraphEdge {
  id: string;
  from_node_id: string;
  to_node_id: string;
  relation_type: string;
  weight: number;
  directionality: string;
  source_type: string;
  source_ref?: string;
  confidence?: number;
  scope?: string;
  context?: string;
  event_timestamp?: Date;
  data_source?: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// Graph Snapshot interface
export interface GraphSnapshot {
  id: string;
  snapshot_type: string;
  node_count: number;
  edge_count: number;
  metadata: Record<string, any>;
  created_at: Date;
}

// API Response interfaces
export interface GraphNodeResponse {
  id: string;
  entity_type: string;
  entity_id: string;
  label: string;
  slug?: string;
  status?: string;
  metadata: Record<string, any>;
  neighbor_count: number;
  edge_count: number;
}

export interface GraphEdgeResponse {
  id: string;
  source: string;
  target: string;
  relation: string;
  weight: number;
  source_type: string;
  metadata: Record<string, any>;
}

export interface GraphNetworkResponse {
  nodes: any[];
  edges: any[];
  stats: Record<string, any>;
}

export interface GraphStatsResponse {
  total_nodes: number;
  total_edges: number;
  nodes_by_type: Record<string, number>;
  edges_by_type: Record<string, number>;
  last_rebuild?: Date;
}
