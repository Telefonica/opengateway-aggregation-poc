import type { Passport } from './lib/passport.js';
import { passport } from './lib/passport.js';

interface CamaraExpress {
  passport: Passport;
}

const CamaraExpress: CamaraExpress = {
  passport,
};

export default CamaraExpress;
