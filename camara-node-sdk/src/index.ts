import type { CamaraSetupId, Setup } from './lib/setup.js';
import type { Login } from './lib/login.js';
import type { Passport } from './lib/passport.js';
import { createSetup, getSetup } from './lib/setup.js';
import { login } from './lib/login.js';
import { passport } from './lib/passport.js';

interface Camara {
  setup: Setup;
  login: Login;
  passport: Passport;
  jwks: (setupId?: string) => Promise<object>;
}

const Camara: Camara = {
  setup: (config, id) => {
    return createSetup(config, id);
  },
  login,
  passport,
  jwks: async (setupId: CamaraSetupId = 'default') => {
    const setup = getSetup(setupId);
    return setup.jwks();
  },
};

export default Camara;
