import type { CamaraSetupId, Setup } from './lib/setup.js';
import type { Login } from './lib/login.js';
import { createSetup, getSetup } from './lib/setup.js';
import { login } from './lib/login.js';

interface Camara {
  setup: Setup;
  login: Login;
  jwks: (setupId?: string) => Promise<object>;
}

const Camara: Camara = {
  setup: (config, id) => {
    // userland setups cannot start by 'sdk', as they are internal sdk setups due to discovery
    if (id?.startsWith('sdk:')) {
      throw new Error('Setup id cannot start with "sdk:"');
    }
    return createSetup(config, id);
  },
  login,
  jwks: async (setupId: CamaraSetupId = 'default') => {
    const setup = getSetup(setupId);
    return setup.jwks();
  },
};

export default Camara;
