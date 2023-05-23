# camara-node-sdk

Public SDK used by applications to operate with the OpenGateway platform.
Written in Node.js

# Usage for JWT Bearer Flow

```js
import Camara from 'camara-node-sdk';
import DeviceLocationVerificationClient from 'camara-node-sdk/clients/DeviceLocationVerificationClient';

// Autoconfigure the SDK with env vars
Camara.setup();
const deviceLocationVerificationClient = new DeviceLocationVerificationClient();

// Login with CAMARA using your client IP as identifier
const session = await Camara.login({ ipport: '127.0.0.1:3000' });
// Call CAMARA APIs using the login session
const params = { coordinates: { longitude: 3.8044, latitude: 42.3408 } };
const location = await deviceLocationVerificationClient.verify({ postcode: '28080' }, { session });

console.log(location);
```


# Usage for JWT Authorization Code Flow. Express JS 

```js
import Camara from 'camara-node-sdk';
import { CamaraSetup } from 'camara-node-sdk/lib/setup';
import DeviceLocationVerificationClient from 'camara-node-sdk/clients/DeviceLocationVerificationClient';
import AuthserverClient, { AuthorizeCallbackParams, AuthorizeSession, TokenSet } from 'camara-node-sdk/clients/AuthserverClient';

const camaraSetup: CamaraSetup = Camara.setup();
const authserverClient: AuthserverClient = camaraSetup.authserverClient;
const deviceLocationVerificationClient = new DeviceLocationVerificationClient();

/**
 * Calculate authorize url and redirect to it in order to retrive a Oauth2 code.
 */
app.get('/authcode/verify', async (req, res, next) => {

  const state = req.query.state ?? '';

  try {

    // We check if we already have an access token. If we have one, we call the API using it.
    if (req.session && req.session.token) {
      const location = await deviceLocationVerificationClient.verify(
        { coordinates: { longitude: 3.8044, latitude: 42.3408 } },
        {
          getToken: () => req.session?.token?.access_token,
        }
      );
  
      res.render('pages/verify', { 
        phonenumber: req.session?.login?.phonenumber,
        result: JSON.stringify(location, null, 4),
        state: uuid()
      });
    }


    // Store the operation in the session
    if (!req.session) {
      console.warn('Not valid session')
      return res.redirect('/logout');
    } 
    req.session.operation = "verify";

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
  
    if ( operation === "verify") {
      // We call the API using the access_token and render the view.
      const location = await deviceLocationVerificationClient.verify(
        { coordinates: { longitude: 3.8044, latitude: 42.3408 } },
        {
          getToken: () => req.session?.token?.access_token,
        }
      );
  
      res.render('pages/verify', { 
        phonenumber: req.session?.login?.phonenumber,
        result: JSON.stringify(location, null, 4),
        state: uuid()
      });
    }
  } catch(err) {
    next(err);
  }
});
```

