import express from 'express';
import cookieSession from 'cookie-session';
import { v4 as uuid } from 'uuid';
import jose from 'node-jose';
import { createHash } from 'node:crypto'
import Camara from 'camara-node-sdk';
import { CamaraSetup } from 'camara-node-sdk/lib/setup';
import DeviceLocationVerificationClient from 'camara-node-sdk/clients/DeviceLocationVerificationClient';
import NumberVerificationClient from 'camara-node-sdk/clients/NumberVerificationClient';
import AuthserverClient, { AuthorizeCallbackParams, AuthorizeSession, TokenSet } from 'camara-node-sdk/clients/AuthserverClient';

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

app.get('/', (req, res) => {
  const userLogged = req.session?.login?.phonenumber;
  if (userLogged) {
    res.render('pages/verify', {phonenumber: req.session?.login?.phonenumber, result:'', state: uuid()});
  } else {
    res.render('pages/login');
  }
});

app.post('/login', (req, res) => {
  let body = req.body
  console.log(JSON.stringify(body))
  req.session = req.session || {}
  req.session.login = {
    phonenumber: body.phonenumber || "+3462534724337623",
    ipport: body.ipport
  }
  res.redirect('/')
});

app.get('/logout', (req, res) => {
  if (req.session) {
    delete req.session.login
    delete req.session.camara
  }
  res.redirect('/')
});

app.get('/jwtbearer/verify', async (req, res, next) => {
  console.log('/verify', req.session);

  if (!req.session?.login?.phonenumber) {
    res.redirect('/')
  } else {
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
          ipport: req.session?.login?.ipport,
        });
      }

      /**
       * Once we have a token, we can consume a CAMARA API.
       */
      const params = { coordinates: { longitude: 3.8044, latitude: 42.3408 } };
      const location = await deviceLocationVerificationClient.verify(params, { session: req.session.camara }
      );
      res.render('pages/verify', { 
        phonenumber: req.session?.login?.phonenumber,
        result: JSON.stringify(location, null, 4),
        state: uuid()
      });
    } catch (err) {
      next(err);
    }
  }
});


/**
 * Authcode Section
 */

/**
 * Calculate authorize url and redirect to it in order to retrive a Oauth2 code.
 */
app.get('/authcode/numberverify', async (req, res, next) => {

  const state = req.query.state ?? '';

  if (!req.session?.login || !req.session.login.phonenumber) {
    return res.redirect('/logout');
  }
  const phonenumber = req.session.login.phonenumber;
  try {

    // We check if we already have an access token. If we have one, we call the API using it.
    if (req.session && req.session.token) {
      const verification = await numberVerificationClient.verify(
        { hashed_phone_number: createHash('sha256').update(phonenumber).digest('hex')},
        {
          getToken: () => req.session?.token?.access_token,
        }
      );
  
      res.render('pages/verify', { 
        phonenumber,
        result: JSON.stringify(verification, null, 4),
        state: uuid()
      });
    }


    // Store the operation in the session
    if (!req.session) {
      console.warn('Not valid session')
      return res.redirect('/logout');
    } 
    req.session.operation = "numberVerify";

    // Set the right scopes, redirect_uri and state to perform the flow.
    const authorizeParams: any = {
      scope: 'device-location-verification-verify-read',
      redirect_uri: `http://localhost:3000/authcode/callback`,
    };
    if (state) {
      authorizeParams.state = state;
    }

    // Retrieve the authorized url and the session data.
    const { url, session } = await authserverClient.authorize(authorizeParams);
    // Store the sessión data in the session
    req.session.oauth = session;

    // Redirect to the Authorize Endpoint.
    // res.redirect(url);
    res.status(200).json({ url, session });
  } catch (err) {
    next(err);
  }

});

/**
 * Get an access_token by using a code and perform the API call. Callback url mus be configured in the application redirect_uri.
 */
app.get('/authcode/callback', async (req, res, next) => {

  try {

    const phonenumber = req.session?.login.phonenumber;
    if (!phonenumber) {
      console.warn('Phonenumber not found. Please, complete the flow again.');
      return res.redirect('/logout');
    }

    // Get code, state parameters to request an access token.
    const code = req.query.code as string;
    if (!code) {
      console.warn('Code not found. Please, complete the flow again.');
      return res.redirect('/logout');
    }
  
    const state = req.session?.oauth?.state;
  
    // Recover the operation from the previous step in order to perform the API call.
    const operation = req.session?.operation;
    if (!operation) {
      console.warn('Operation undefined. Please, complete the flow again.');
      return res.redirect('/logout');
    }
  
    // Build the Callback Parameters
    const params: AuthorizeCallbackParams = { code: code };
    if (state) {
      params.state = req.session?.oauth?.state;
    }
  
    // Recover the Authorized sessión from the previous step.
    const authorizeSession: AuthorizeSession = req.session?.oauth;
  
    // We get the access_token and other information such as refresh_token, id_token, etc....
    const tokenSet: TokenSet = await authserverClient.getAuthorizationCodeToken(params, authorizeSession);
  
    // We store the token in the session for future uses
    if (req.session) req.session.token = tokenSet;
  
    if ( operation === "numberVerify") {
      // We call the API using the access_token and render the view.
      const verification = await numberVerificationClient.verify(
        { hashed_phone_number: createHash('sha256').update(phonenumber).digest('hex')},
        {
          getToken: () => req.session?.token?.access_token,
        }
      );
  
      res.render('pages/verify', { 
        phonenumber,
        result: JSON.stringify(verification, null, 4),
        state: uuid()
      });
    }
  } catch(err) {
    next(err);
  }
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
