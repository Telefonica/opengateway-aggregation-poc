import type { CamaraConfig, CamaraSetupId } from '../lib/setup.js';
import type { AuthserverRequestContext, TokenSet } from '../clients/AuthserverClient.js';
import type AuthserverClient from '../clients/AuthserverClient.js';
import type { CacheService, TokenCacheKey } from './cache.js';

export interface CamaraTokenSet extends TokenSet {
  expires_at: number;
}
export interface TokenService {
  getDiscoveryTokenSet: (context?: AuthserverRequestContext) => Promise<CamaraTokenSet>;
  getLoginTokenSet: (
    params: { sub: string; scope?: string },
    context?: AuthserverRequestContext
  ) => Promise<CamaraTokenSet>;
}

const createService = (
  id: CamaraSetupId,
  config: CamaraConfig,
  {
    authserverClient,
    cacheService,
  }: { authserverClient: InstanceType<typeof AuthserverClient>; cacheService: CacheService }
): TokenService => {
  // TODO: Let the user configure?
  /** Safe period where the token is considered expired (seconds) */
  const TOKEN_EXPIRATION_SAFE_WINDOW = 2 * 60;

  const getDiscoveryTokenSet: TokenService['getDiscoveryTokenSet'] = async (context) => {
    const cache = await cacheService.getCache('token');
    const cacheKey: TokenCacheKey = `${id}:token:server:discovery`;
    const token = await cache.get(cacheKey);
    if (token) {
      return token;
    }

    const tokenSet = await authserverClient.getClientCredentialsToken({ scope: 'discovery:read' }, context);
    const camaraTokenSet = toCamaraTokenSet(tokenSet);

    cache.set(cacheKey, camaraTokenSet, {
      ttl: tokenSet.expires_in,
    });
    return camaraTokenSet;
  };

  const getLoginTokenSet: TokenService['getLoginTokenSet'] = async ({ sub, scope }, context) => {
    const cache = await cacheService.getCache('token');
    const cacheKey: TokenCacheKey = `${id}:token:login:${sub}`;
    const token = await cache.get(cacheKey);
    if (token) {
      return token;
    }
    // TODO: we still dont know what will be the authorization method used.
    // For now, we will use the JWT Bearer Token with an ipport subject with an special syntax (ipport@ip:port)
    const tokenSet = await authserverClient.getJWTBearerToken({ sub, scope }, context);
    const camaraTokenSet = toCamaraTokenSet(tokenSet);

    cache.set(`${id}:token:login:${sub}`, camaraTokenSet, {
      ttl: tokenSet.expires_in,
    });
    return camaraTokenSet;
  };

  function toCamaraTokenSet(tokenSet: TokenSet): CamaraTokenSet {
    return {
      ...tokenSet,
      expires_at: Date.now() + (tokenSet.expires_in - TOKEN_EXPIRATION_SAFE_WINDOW) * 1000,
    };
  }

  return {
    getDiscoveryTokenSet,
    getLoginTokenSet,
  };
};

export default createService;
