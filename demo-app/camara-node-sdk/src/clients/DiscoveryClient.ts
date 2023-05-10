import type { ApiClientConfig, ApiRequestContext } from './ApiClient';
import ApiClient from './ApiClient.js';

export interface Discovery {
  apigateway_url: string;
  authserver_url: string;
  operator_id: string;
}

export interface DiscoveryParams {
  identity_type: 'ipport';
  identity_value: string;
}

export default class DiscoveryClient extends ApiClient {
  constructor(configuration?: ApiClientConfig) {
    super({
      pathname: '/discovery/v1',
      ...configuration,
    });
  }

  async discover(params: DiscoveryParams, context?: ApiRequestContext): Promise<Discovery> {
    const { data } = await this.client.post<Discovery>('/discover', params, context);
    return data;
  }
}
