import type { CamaraSetupId, Setup } from './lib/setup.js';
import type { Login } from './lib/login.js';
import { createSetup, getSetup } from './lib/setup.js';
import { login as session } from './lib/login.js';

interface Camara {
  setup: Setup;
  session: Login;
  jwks: (setupId?: string) => Promise<object>;
}

const Camara: Camara = {
  setup: (config, id) => {
    return createSetup(config, id);
  },
  session,
  jwks: async (setupId: CamaraSetupId = 'default') => {
    const setup = getSetup(setupId);
    return setup.jwks();
  }
};

export default Camara;
