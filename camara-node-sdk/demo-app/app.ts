import express from 'express';
import cookieSession from 'cookie-session';
import { v4 as uuid } from 'uuid';
import jose from 'node-jose';
import { createHash } from 'node:crypto'
import Camara from 'camara-node-sdk';
import { CamaraSetup } from 'camara-node-sdk/lib/setup';
import DeviceLocationVerificationClient from 'camara-node-sdk/clients/DeviceLocationVerificationClient';
import NumberVerificationClient from 'camara-node-sdk/clients/NumberVerificationClient';
import AuthserverClient, { AuthorizeCallbackParams, AuthorizeParams, AuthorizeSession, TokenSet } from 'camara-node-sdk/clients/AuthserverClient';

/////////////////////////////////////////////////
// Initialize the SDK offering networking services (device location verification in the example)
// When the aggregator is an hyperscaler, this could be its own SDK (e.g., Azure SDK)
/////////////////////////////////////////////////
const camaraSetup: CamaraSetup = Camara.setup();
const authserverClient: AuthserverClient = camaraSetup.authserverClient;
const deviceLocationVerificationClient = new DeviceLocationVerificationClient();
const numberVerificationClient = new NumberVerificationClient();

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

const retrieveParametersFromRequest = (req: any) => {
  const state: string = (req.query.state ?? '') as string;
  const operation: string = req.session?.operation as string;
  let error = '';
  if (!operation) {
    error = 'No operation stablished. Performing logout';
  }

  if (!req.session?.login || !req.session.login.phonenumber) {
    error = "No phone number found. Performing logout";
  }
  const phonenumber = req.session.login.phonenumber;

  return {
    state,
    operation,
    phonenumber,
    error
  }
};

const consumeCamaraAPI = async (req: any, phonenumber: string, operation: string) => {
  const getToken = () => new Promise<string>((resolve) => {
    resolve(req.session.token as string);
  });
  let result;
  if (operation === "numberVerify") {
    result = await numberVerificationClient.verify(
      { 
        hashed_phone_number: createHash('sha256').update(phonenumber).digest('hex')
      },{
        getToken,
      });
  } else if (operation === "devVerify") {
    const params = { coordinates: { longitude: 3.8044, latitude: 42.3408 } };
    result = await deviceLocationVerificationClient.verify(params, {
      getToken
    });
  }
  return result;
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
 * Authcode Section
 */
/**
 * Calculate authorize url and redirect to it in order to retrive a Oauth2 code.
 */
app.get('/authcode/flow', async (req, res, next) => {


  //scope, state phoneNumber

  
  const {phonenumber, operation, state, error} = retrieveParametersFromRequest(req);

  if (error) {
    console.log(error);
    return res.redirect('/logout');
  }



  try {
    // Access token already exists
    if (req.session && req.session.token) {

      let result = await consumeCamaraAPI(req, phonenumber, operation);

      return res.render('pages/verify', { 
        phonenumber,
        result: JSON.stringify(result, null, 4),
        state: uuid(),
        clientIp: getIpAddress(req)
      });
    }

    // Set the right scopes, redirect_uri and state to perform the flow.
    const authorizeParams: AuthorizeParams = {
      scope: '',
      redirect_uri: `${process.env.HOST}/authcode/callback`,
    };
    if (state) {
      authorizeParams.state = state;
    }
    if (operation === "numberVerify") {
      authorizeParams.scope = 'openid number-verification-verify-hashed-read';
    } else if (operation === "devVerify") {
      authorizeParams.scope = 'device-location-verification-verify-read';
    }

    // Retrieve the authorized url and the session data.
    const { url, session } = await authserverClient.authorize(authorizeParams);
    // Store the session data in the cookie session
    if (req.session) req.session.oauth = session;




    // Redirect to the Authorize Endpoint.
    return res.redirect(url);

  } catch(err) {
    next(err);
  }
   
});

/**
 * Get an access_token by using a code and perform the API call. Callback url mus be configured in the application redirect_uri.
 */
app.get('/authcode/callback', async (req, res, next) => {

  const {phonenumber, operation, error} = retrieveParametersFromRequest(req);

  if (error) {
    console.log(error);
    return res.redirect('/logout');
  }

  try {

    // Get code value to request an access token.
    const code = req.query.code as string;
    if (!code) {
      console.warn('Code not found. Please, complete the flow again.');
      return res.redirect('/logout');
    }

  
    // Build the Callback Parameters
    const params: AuthorizeCallbackParams = { code: code };
    const state = req.session?.oauth?.state as string;
    if (state) {
      params.state = state;
    }

    // Recover the Authorized sessión from the previous step.
    const authorizeSession: AuthorizeSession = req.session?.oauth;
  
    // We get the access_token and other information such as refresh_token, id_token, etc....
    const tokenSet: TokenSet = await authserverClient.getAuthorizationCodeToken(params, authorizeSession);
  
    // We store the token in the session for future uses
    
    if (req.session) req.session.token = tokenSet.access_token;
  
    let result = await consumeCamaraAPI(req, phonenumber, operation);

    if (req.session) {
      delete req.session.token;
      delete req.session.oauth;
    }
    
    return res.render('pages/verify', { 
      phonenumber,
      result: JSON.stringify(result, null, 4),
      state: uuid(),
      clientIp: getIpAddress(req)
    });

  } catch(err) {
    next(err);
  }
});
/**
 * End Authcode Section
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
  req.session.operation = "numberVerify";
  res.redirect('/authcode/flow?state=' + uuid())
});

app.get('/authcode/verify', async (req, res, next) => {
  
  if (!req.session) {
    console.warn('Not valid session. Doing logout')
    return res.redirect('/logout');
  }
  delete req.session?.login.token;
  delete req.session?.camara;
  req.session.operation = "devVerify";
  return res.redirect('/authcode/flow?state=' + uuid())
});

app.get('/logout', (req, res) => {
  if (req.session) {
    delete req.session.login;
    delete req.session.operation;
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
