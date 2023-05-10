import type { InternalAxiosRequestConfig } from 'axios';
import type { ApiRequestContext, ApiClientConfig } from './ApiClient.js';
import type { Discovery } from './DiscoveryClient.js';
import type { CamaraSession } from '../lib/session.js';
import ApiClient from './ApiClient.js';
import { v4 as uuid } from 'uuid';
import { restoreSession } from '../lib/session.js';

interface WithDiscoveryGetter {
  getDiscovery?: (context: CamaraRequestContext) => Promise<Discovery>;
}
interface WithSessionSupport {
  session?: CamaraSession;
}
export interface CamaraClientConfig extends ApiClientConfig {}
export interface CamaraRequestContext extends ApiRequestContext, WithDiscoveryGetter, WithSessionSupport {}

/**
 * Base implementation for a Camara API Client
 */
export default abstract class CamaraClient extends ApiClient {
  constructor(configuration?: CamaraClientConfig) {
    super(configuration);

    this.client.interceptors.request.use(signRequest);
    this.client.interceptors.request.use(routeToOperator(configuration));
    this.client.interceptors.request.use(handleSession);
  }
}

const handleSession = async (context: InternalAxiosRequestConfig & CamaraRequestContext) => {
  const { session } = context;

  if (session) {
    const camaraSession = await restoreSession(session);

    context.getToken = async () => camaraSession.access_token;
    context.getDiscovery = async () => camaraSession.discovery;
    context.session = camaraSession;
  }

  return context;
};
const signRequest = async (context: InternalAxiosRequestConfig & CamaraRequestContext) => {
  // TODO: Make a real signature for the payload
  context.headers['X-Signature'] = uuid();
  return context;
};

const routeToOperator =
  (configuration: CamaraClientConfig = {}) =>
  async (context: InternalAxiosRequestConfig & CamaraRequestContext) => {
    let discovery: Discovery | undefined;
    if (context.getDiscovery) {
      discovery = await context.getDiscovery(extractContext(context));
    }
    if (!discovery) {
      throw new Error('Discovery not found. You should provide a getDiscovery function in the context');
    }
    context.baseURL = new URL(configuration.pathname ?? '/', discovery.apigateway_url).toString();

    return context;
  };

const extractContext = (context: InternalAxiosRequestConfig & CamaraRequestContext): CamaraRequestContext => {
  return {
    getToken: context.getToken,
    getDiscovery: context.getDiscovery,
    headers: context.headers,
    timeout: context.timeout,
  };
};
