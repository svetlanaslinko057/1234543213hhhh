/**
 * Deduplication utilities
 */

/**
 * Deduplicate items by key function
 */
export function dedupeByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = keyFn(item);
    if (key && !map.has(key)) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}

/**
 * Deduplicate by multiple keys
 */
export function dedupeByKeys<T>(items: T[], keys: (keyof T)[]): T[] {
  return dedupeByKey(items, (item) => {
    return keys.map(k => String(item[k] ?? '')).join(':');
  });
}

/**
 * Merge arrays with deduplication
 */
export function mergeWithDedupe<T>(
  existing: T[], 
  newItems: T[], 
  keyFn: (item: T) => string
): T[] {
  const map = new Map<string, T>();
  
  // Add existing first
  for (const item of existing) {
    const key = keyFn(item);
    if (key) map.set(key, item);
  }
  
  // Add/update with new items
  for (const item of newItems) {
    const key = keyFn(item);
    if (key) map.set(key, item);
  }
  
  return [...map.values()];
}

/**
 * Get unique IDs from items
 */
export function getUniqueIds<T>(items: T[], idFn: (item: T) => string): string[] {
  const ids = new Set<string>();
  for (const item of items) {
    const id = idFn(item);
    if (id) ids.add(id);
  }
  return [...ids];
}

/**
 * Count duplicates
 */
export function countDuplicates<T>(items: T[], keyFn: (item: T) => string): number {
  const seen = new Set<string>();
  let duplicates = 0;
  
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      duplicates++;
    } else {
      seen.add(key);
    }
  }
  
  return duplicates;
}
