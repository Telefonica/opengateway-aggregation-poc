import type { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import type { BaseClientConfig, BaseRequestContext } from './BaseClient.js';
import BaseClient from './BaseClient.js';

interface WithTokenGetter {
  getToken?: (context: ApiRequestContext) => Promise<string>;
}

export interface ApiRequestContext extends BaseRequestContext, WithTokenGetter {}

/**
 * options for the API client
 */
export interface ApiClientConfig extends BaseClientConfig, WithTokenGetter {
  /** the path name where the api is located. Ex: /device/v1/verification. Defaults to '/' */
  pathname?: string;
}

/**
 * Base implementation for an API Client
 */
export default abstract class ApiClient extends BaseClient {
  constructor(configuration?: ApiClientConfig) {
    const baseURL = new URL(
      configuration?.pathname || '/',
      configuration?.baseURL || process.env.CAMARA_API_URL
    ).toString();

    const clientConfig: AxiosRequestConfig = {
      ...configuration,
      headers: {
        Accept: 'application/json',
        ...configuration?.headers,
      },
      baseURL,
    };
    super(clientConfig);

    this.client.interceptors.request.use(setupAuthorization(configuration));
  }
}

const setupAuthorization =
  (configuration: ApiClientConfig = {}) =>
  async (context: InternalAxiosRequestConfig & ApiRequestContext) => {
    let token: string | undefined;
    if (context.getToken) {
      token = await context.getToken(extractContext(context));
    } else if (configuration.getToken) {
      token = await configuration.getToken(extractContext(context));
    }
    if (token) {
      context.headers['Authorization'] = `Bearer ${token}`;
    }
    return context;
  };

const extractContext = (context: InternalAxiosRequestConfig & ApiRequestContext): ApiRequestContext => {
  return {
    getToken: context.getToken,
    headers: context.headers,
    timeout: context.timeout,
  };
};
