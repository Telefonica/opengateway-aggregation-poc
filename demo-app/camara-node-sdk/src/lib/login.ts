import type { BaseRequestContext } from '../clients/BaseClient.js';
import type { CamaraSetupId } from './setup.js';
import type { CamaraSession } from './session.js';
import { createSession } from './session.js';
import { defaultSetupId, getSetup, createSetup } from './setup.js';

export interface LoginContext extends BaseRequestContext {
  /** the setup id containing sdk configuration to use. Defaults to 'default' */
  setupId?: CamaraSetupId;
}

export type Login = (
  { ipport, scope }: { ipport: string; scope?: string },
  context?: LoginContext
) => Promise<CamaraSession>;

export const login: Login = async ({ ipport, scope }, context = {}) => {
  const { setupId = defaultSetupId } = context;
  const sub = `ipport:${ipport}`;
  const setup = getSetup(setupId);
  const { discoveryService } = setup;

  const discovery = await discoveryService.discover({ sub }, context);

  const setupDiscovered = createSetup(
    {
      apiBaseURL: discovery.apigateway_url,
      authBaseURL: discovery.authserver_url,
    },
    `sdk:${discovery.operator_id}`
  );

  const { tokenService } = setupDiscovered;
  const camaraTokenSet = await tokenService.getLoginTokenSet({ sub, scope }, context);
  const session = await createSession({ camaraTokenSet, discovery, login: { ipport, scope, setupId } });
  return session;
};
