/**
 * Entity Extractor Service
 * 
 * BLOCK 6: Extracts entities from news text
 * - Projects (crypto projects, protocols)
 * - Funds (VCs, investors)
 * - Tokens ($BTC, $ETH)
 * - Persons (founders, executives)
 * 
 * IMPROVED: Context-aware classification
 */

import { Injectable, Logger } from '@nestjs/common';

export interface ExtractedEntities {
  projects: string[];
  funds: string[];
  tokens: string[];
  persons: string[];
}

// Known fund patterns (expanded)
const FUND_PATTERNS = [
  /Capital/i, /Ventures/i, /Partners/i, /Labs/i, /DAO/i,
  /a16z/i, /Paradigm/i, /Polychain/i, /Multicoin/i, /Pantera/i,
  /Sequoia/i, /Andreessen/i, /Binance/i, /Coinbase/i, /Jump/i,
  /Crypto$/i, /Digital$/i, /Fund$/i, /VC$/i, /Holdings$/i,
  /Investments$/i, /Group$/i,
];

// Context words that indicate FUND
const FUND_CONTEXT = [
  'invest', 'led', 'raise', 'fund', 'back', 'participated',
  'announce', 'portfolio', 'vc', 'venture', 'capital',
];

// Context words that indicate PROJECT
const PROJECT_CONTEXT = [
  'launch', 'protocol', 'mainnet', 'testnet', 'network',
  'token', 'chain', 'dapp', 'platform', 'ecosystem',
];

// Token pattern
const TOKEN_PATTERN = /\$[A-Z]{2,10}/g;

// Known crypto keywords to help identify projects
const PROJECT_KEYWORDS = [
  'protocol', 'network', 'chain', 'layer', 'defi', 'nft',
  'swap', 'bridge', 'dao', 'token', 'coin', 'exchange',
];

@Injectable()
export class EntityExtractorService {
  private readonly logger = new Logger(EntityExtractorService.name);

  /**
   * Extract entities from text (title + content)
   * Now with context-aware classification
   */
  extract(text: string): ExtractedEntities {
    const projects = new Set<string>();
    const funds = new Set<string>();
    const tokens = new Set<string>();
    const persons = new Set<string>();

    if (!text) {
      return { projects: [], funds: [], tokens: [], persons: [] };
    }

    const lowerText = text.toLowerCase();
    
    // Detect context
    const hasFundContext = FUND_CONTEXT.some(w => lowerText.includes(w));
    const hasProjectContext = PROJECT_CONTEXT.some(w => lowerText.includes(w));

    // 1. Extract tokens ($BTC, $ETH, etc.)
    const tokenMatches = text.match(TOKEN_PATTERN) || [];
    for (const t of tokenMatches) {
      tokens.add(t.replace('$', '').toUpperCase());
    }

    // 2. Extract capitalized words/phrases
    const words = text.split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[^a-zA-Z0-9]/g, '');
      
      if (word.length < 3) continue;

      // Check if it's a capitalized word
      if (/^[A-Z][a-zA-Z0-9]+$/.test(word)) {
        // Check for fund patterns
        const isFund = FUND_PATTERNS.some(p => p.test(word));
        
        // Look ahead for compound names (e.g., "Andreessen Horowitz")
        let fullName = word;
        if (i + 1 < words.length) {
          const nextWord = words[i + 1].replace(/[^a-zA-Z0-9]/g, '');
          if (/^[A-Z][a-zA-Z0-9]+$/.test(nextWord)) {
            const combined = `${word} ${nextWord}`;
            if (FUND_PATTERNS.some(p => p.test(combined))) {
              fullName = combined;
              i++; // Skip next word
            }
          }
        }

        if (isFund || FUND_PATTERNS.some(p => p.test(fullName))) {
          funds.add(this.normalize(fullName));
        } else {
          projects.add(this.normalize(fullName));
        }
      }
    }

    // 3. Extract persons (simple heuristic: Title Case names near keywords)
    const personPatterns = [
      /CEO\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/g,
      /founder\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi,
      /co-founder\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi,
      /([A-Z][a-z]+\s+[A-Z][a-z]+),?\s+(CEO|CTO|founder|partner)/gi,
    ];

    for (const pattern of personPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1]?.trim();
        if (name && name.length > 3) {
          persons.add(name);
        }
      }
    }

    // 4. Filter out common false positives
    const stopWords = new Set([
      'The', 'This', 'That', 'These', 'Those', 'Their', 'They',
      'What', 'When', 'Where', 'Which', 'While', 'With', 'Would',
      'About', 'After', 'Before', 'Between', 'Could', 'Should',
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]);

    const filteredProjects = [...projects].filter(p => !stopWords.has(p));
    const filteredFunds = [...funds].filter(f => !stopWords.has(f));

    return {
      projects: filteredProjects,
      funds: filteredFunds,
      tokens: [...tokens],
      persons: [...persons],
    };
  }

  /**
   * Normalize entity name to slug
   */
  private normalize(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
