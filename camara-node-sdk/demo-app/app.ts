import express from 'express';
import cookieSession from 'cookie-session';
import { v4 as uuid } from 'uuid';
import jose from 'node-jose';
import { createHash } from 'node:crypto'
import Camara from 'camara-node-sdk';
import DeviceLocationVerificationClient from 'camara-node-sdk/clients/DeviceLocationVerificationClient';
import NumberVerificationClient from 'camara-node-sdk/clients/NumberVerificationClient';

/////////////////////////////////////////////////
// Initialize the SDK offering networking services (device location verification in the example)
// When the aggregator is an hyperscaler, this could be its own SDK (e.g., Azure SDK)
/////////////////////////////////////////////////
Camara.setup();
const deviceLocationVerificationClient = new DeviceLocationVerificationClient();
const numberVerificationClient = new NumberVerificationClient();
const camaraPassportDevLocation = Camara.passport({
  redirect_uri: `${process.env.HOST}/authcode/devloc/callback`,
  fixed_scope: "device-location-verification-verify-read"
});
const camaraPassportNumVerification = Camara.passport({
  redirect_uri: `${process.env.HOST}/authcode/numver/callback`,
  fixed_scope: "openid number-verification-verify-hashed-read"
});

const app = express();

app.enable('trust proxy');
app.use(cookieSession({ keys: ['secret'] }));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }))

app.use(express.json())

const getIpAddress = (req: any) : string => {
  let ips = (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress || ''
  ).split(',');

  return ips[0].trim();
}

/**
 * JWTbearer Section
 */
app.get('/jwtbearer/verify', async (req, res, next) => {
  console.log('jwtbearer device location verify', req.session);
  if (!req.session?.login?.phonenumber) {
    return res.redirect('/')
  }

  try {
    if (!req.session?.camara) {
      req.session = req.session || {};

      /**
       * We perform the SDK login operation that internally gets an access token using
       * the jwt bearer flow (3 legged token). We store the token in the session to reuse it.
       *
       * The user identifier is the ip:port but the model is generic to be extended
       * with other identifiers (MSISDN, etc).
       */
      req.session.camara = await Camara.login({
        ipport: req.query.ip as string,
      });
    }

    /**
     * Once we have a token, we can consume a CAMARA API.
     */
    const params = { coordinates: { longitude: 3.8044, latitude: 42.3408 } };
    const location = await deviceLocationVerificationClient.verify(params, { session: req.session.camara });
    delete req.session.camara;
    res.render('pages/verify', { 
      phonenumber: req.session?.login?.phonenumber,
      result: JSON.stringify(location, null, 4),
      state: uuid(),
      clientIp: getIpAddress(req)
    });
  } catch (err) {
    next(err);
  }
});
/**
 * End JWTbearer Section
 */


/**
 * Authcode Section - Number Verification API. Scope openid number-verification-verify-hashed-read.
 */
/**
 * Calculate authorize url and redirect to it in order to retrive a Oauth2 code.
 */

app.get('/authcode/numver/flow', camaraPassportNumVerification.authorize);


/**
 * Get an access_token by using a code and perform the API call. Callback url must be configured in the application redirect_uri.
 */
app.get('/authcode/numver/callback', camaraPassportNumVerification.callback, async (req, res, next) => {
  try {
    // We set how are we going to retrieve our access_token. Prepared to use other system like cache or database.
    const getToken = () => new Promise<string>((resolve) => {
      resolve(res.locals.token as string);
    });
    //We consume the number verification API
    const result = await numberVerificationClient.verify(
      { 
        hashed_phone_number: createHash('sha256').update(res.locals.phonenumber).digest('hex')
      },{
        getToken,
      });
    
    // We render the view with the API result.
    return res.render('pages/verify', { 
      phonenumber: res.locals.phonenumber,
      result: JSON.stringify(result, null, 4),
      state: uuid(),
      clientIp: getIpAddress(req)
    });
  } catch(err) {
    next(err);
  }
});
/**
 * End Authcode Section - Number Verification API.
 */

/**
 * Authcode Section - Device Location Verification API. Scope device-location-verification-verify-read.
 */
/**
 * Calculate authorize url and redirect to it in order to retrive a Oauth2 code.
 */

app.get('/authcode/devloc/flow', camaraPassportDevLocation.authorize);


/**
 * Get an access_token by using a code and perform the API call. Callback url must be configured in the application redirect_uri.
 */
app.get('/authcode/devloc/callback', camaraPassportDevLocation.callback, async (req, res, next) => {
  try {
    // We set how are we going to retrieve our access_token. Prepared to use other system like cache or database.
    const getToken = () => new Promise<string>((resolve) => {
      resolve(res.locals.token as string);
    });
    //We consume the number verification API
    const params = { coordinates: { longitude: 3.8044, latitude: 42.3408 } };
    const result = await deviceLocationVerificationClient.verify(params, {
      getToken
    });

    // We render the view with the API result.
    return res.render('pages/verify', { 
      phonenumber: res.locals.phonenumber,
      result: JSON.stringify(result, null, 4),
      state: uuid(),
      clientIp: getIpAddress(req)
    });
  } catch(err) {
    next(err);
  }
});
/**
 * End Authcode Section -  Device Location Verification API.
 */


app.get('/', (req, res) => {
  console.log('Client IP Address: ' + getIpAddress(req));
  const userLogged = req.session?.login?.phonenumber;
  if (userLogged) {
    res.render('pages/verify', {phonenumber: req.session?.login?.phonenumber, result:'', state: uuid(), clientIp: getIpAddress(req)});
  } else {
    res.render('pages/login', { clientIp: getIpAddress(req) });
  }
});

app.post('/login', (req, res) => {
  let body = req.body
  console.log(JSON.stringify(body))
  req.session = req.session || {}
  req.session.login = {
    phonenumber: body.phonenumber || "+3462534724337623",
  }
  res.redirect('/authcode/numver/flow?state=' + uuid())
});

app.get('/authcode/verify', async (req, res, next) => {
  
  if (!req.session) {
    console.warn('Not valid session. Doing logout')
    return res.redirect('/logout');
  }
  delete req.session?.login.token;
  delete req.session?.camara;
  return res.redirect('/authcode/devloc/flow?state=' + uuid())
});

app.get('/logout', (req, res) => {
  if (req.session) {
    delete req.session.login;
    delete req.session.camara;
  }
  res.redirect('/')
});



/**
 * expose jwks endpoint in the server
 * http://localhost:3000/api/jwks must be registered in the Aggregator Authserver as the client jwks_uri
 */
app.get('/api/jwks', async (req, res, next) => {
  console.log('/api/jwks', req.session);
  try {
    res.json(await Camara.jwks());
  } catch (err) {
    next(err);
  }
});


/**
 * JWT Bearer POSTMan Helper Endpoint. Helps to retrieve signed assertions.
 */
app.post('/api/assertion', async (req, res, next) => {
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload: JWT = {
    ...req.body,
    jti: uuid(),
    exp: now + 600,
    iat: now,
  };
  try {
    const clientKey = process.env.CAMARA_CLIENT_KEY;
    const decodedKey = Buffer.from(clientKey, 'base64').toString('utf8');
    const keystore = jose.JWK.createKeyStore();
    await keystore.add(decodedKey, 'pem');
    const assertion = await jose.JWS.createSign({ format: 'compact' }, keystore.all({ alg: 'RS256' }))
      .update(JSON.stringify(jwtPayload), 'utf-8')
      .final();
    res.json({ assertion: assertion })
  } catch (cause) {
    throw new Error('Unable to sign JWT', { cause });
  }
})

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Demo App listening on http://localhost:${PORT}`);
});
