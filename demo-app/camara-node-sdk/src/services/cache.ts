import type { TokenSet } from '../clients/AuthserverClient.js';
import type { Discovery } from '../clients/DiscoveryClient.js';
import type { CamaraConfig, CamaraSetupId } from '../lib/setup.js';
import { LRUCache } from 'lru-cache';
import type { CamaraTokenSet } from './tokens.js';

export interface CacheService {
  getCache: <T extends CacheId>(id: T) => Promise<CacheType<T>>;
}

interface Cache<K, V> {
  get: (key: K) => Promise<V | undefined>;
  set: (key: K, value: V, opts?: { ttl?: number }) => Promise<void>;
}
type CacheType<T> = T extends 'token' ? TokenCache : T extends 'discovery' ? DiscoveryCache : never;

type CacheId = 'token' | 'discovery';

// Token Cache stuff
type TokenCacheData = 'server:discovery' | `login:${string}`;
export type TokenCacheKey = `${CamaraSetupId}:token:${TokenCacheData}`;
type TokenCache = Cache<TokenCacheKey, CamaraTokenSet>;

// Default cache implementation
const defaultTokenCache = createMemoryCache<TokenCacheKey, CamaraTokenSet>({
  // number of tokens to cache
  max: 100,
  // time to live: 3500 seconds = 58 minutes. 2 minutes less than the token expiration time
  ttl: 1000 * 3500,
});

// Discovery cache stuff
type DiscoveryCacheData = `${string}`;
export type DiscoveryCacheKey = `${CamaraSetupId}:discovery:${DiscoveryCacheData}`;
type DiscoveryCache = Cache<DiscoveryCacheKey, Discovery>;

const defaultDiscoveryCache = createMemoryCache<DiscoveryCacheKey, Discovery>({
  // number of discovers to cache
  max: 1000,
  // time to live: 1 minutes
  ttl: 1000 * 1,
});

const createService = (setupId: CamaraSetupId, config: CamaraConfig): CacheService => {
  // TODO: Let the user provide the cache implementation in the configuration

  async function getCache<T extends CacheId>(id: T): Promise<CacheType<T>> {
    switch (id) {
      case 'token':
        return defaultTokenCache as CacheType<T>;
      case 'discovery':
        return defaultDiscoveryCache as CacheType<T>;
      default:
        assertCacheId(id);
    }
  }
  return {
    getCache,
  };
};

function assertCacheId(id: never): never {
  throw new Error(`Cache ${id} not found`);
}

function createMemoryCache<K extends {}, V extends {}>(options: LRUCache.Options<K, V, any>): Cache<K, V> {
  const cache = new LRUCache(options);
  return {
    get: async (key) => cache.get(key),
    set: async (key, value, opts) => {
      cache.set(key, value, opts);
    },
  };
}

export default createService;
