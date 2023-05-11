import type { InternalAxiosRequestConfig } from 'axios';
import type { ApiRequestContext, ApiClientConfig } from './ApiClient.js';
import type { CamaraSession } from '../lib/session.js';
import ApiClient from './ApiClient.js';
import { v4 as uuid } from 'uuid';
import { restoreSession } from '../lib/session.js';

interface WithSessionSupport {
  session?: CamaraSession;
}
export interface CamaraClientConfig extends ApiClientConfig {}
export interface CamaraRequestContext extends ApiRequestContext, WithSessionSupport {}

/**
 * Base implementation for a Camara API Client
 */
export default abstract class CamaraClient extends ApiClient {
  constructor(configuration?: CamaraClientConfig) {
    super(configuration);

    this.client.interceptors.request.use(signRequest);
    this.client.interceptors.request.use(handleSession);
  }
}

const handleSession = async (context: InternalAxiosRequestConfig & CamaraRequestContext) => {
  const { session } = context;

  if (session) {
    const camaraSession = await restoreSession(session);

    context.getToken = async () => camaraSession.access_token;
    context.session = camaraSession;
  }

  return context;
};
const signRequest = async (context: InternalAxiosRequestConfig & CamaraRequestContext) => {
  // TODO: Make a real signature for the payload
  context.headers['X-Signature'] = uuid();
  return context;
};
