import type { ApiRequestContext } from '../clients/ApiClient.js';
import type { Discovery } from '../clients/DiscoveryClient.js';
import type DiscoveryClient from '../clients/DiscoveryClient.js';
import type { CamaraConfig, CamaraSetupId } from '../lib/setup.js';
import type { CacheService, DiscoveryCacheKey } from './cache.js';
import type { TokenService } from './tokens.js';

export interface DiscoveryService {
  discover: (params: { sub: string }, context?: ApiRequestContext) => Promise<Discovery>;
}

const createService = (
  setupId: CamaraSetupId,
  config: CamaraConfig,
  {
    discoveryClient,
    tokenService,
    cacheService,
  }: { discoveryClient: InstanceType<typeof DiscoveryClient>; cacheService: CacheService; tokenService: TokenService }
): DiscoveryService => {
  const discover: DiscoveryService['discover'] = async ({ sub }, context) => {
    const cache = await cacheService.getCache('discovery');
    const cacheKey: DiscoveryCacheKey = `${setupId}:discovery:${sub}`;
    const discovery = await cache.get(cacheKey);
    if (discovery) {
      return discovery;
    }
    const [identity_type, ...rest] = sub.split(':');
    const identity_value = rest.join(':');

    const data = await discoveryClient.discover(
      // @ts-expect-error XXX: better type guessing. Discovery is going to be deprecated, so who cares?
      { identity_type, identity_value },
      {
        ...context,
        async getToken(context) {
          const { access_token } = await tokenService.getDiscoveryTokenSet(context);
          return access_token;
        },
      }
    );
    await cache.set(cacheKey, data);
    return data;
  };
  return {
    discover,
  };
};

export default createService;
