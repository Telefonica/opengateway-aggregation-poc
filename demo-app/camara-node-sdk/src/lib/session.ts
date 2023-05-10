import type { Discovery } from '../clients/DiscoveryClient.js';
import type { CamaraRequestContext } from '../clients/CamaraClient.js';
import type { CamaraTokenSet } from 'src/services/tokens.js';
import { login } from '../lib/login.js';

/**
 * Session for the Camara SDK
 */
export interface CamaraSession {
  access_token: string;
  expires_at: number;
  discovery: Discovery;
  // This should not be needed if we use refresh tokens
  login: {
    ipport?: string;
    scope?: string;
    setupId: string;
  };
}

export interface SessionService {
  createSession: (args: {
    camaraTokenSet: CamaraTokenSet;
    discovery: Discovery;
    login: { ipport?: string; scope?: string; setupId: string };
  }) => Promise<CamaraSession>;
  restoreSession: (args: CamaraSession, context?: CamaraRequestContext) => Promise<CamaraSession>;
}

export const createSession: SessionService['createSession'] = async ({ discovery, login, camaraTokenSet }) => {
  const session: CamaraSession = {
    discovery,
    login,
    access_token: camaraTokenSet.access_token,
    expires_at: camaraTokenSet.expires_at,
  };
  return session;
};

export const restoreSession: SessionService['restoreSession'] = async (session, context) => {
  const {
    login: { setupId, ipport, scope },
    expires_at,
  } = session;

  if (!setupId || !ipport) {
    throw new Error('Missing login information in session');
  }

  const now = Date.now();
  const isExpired = expires_at < now;
  // TODO: We may use a refresh token here (if available)
  if (isExpired) {
    session = await login({ ipport, scope }, { ...context, setupId });
  }

  return session;
};
