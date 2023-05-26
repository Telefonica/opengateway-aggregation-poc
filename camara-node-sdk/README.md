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
import NumberVerificationClient from 'camara-node-sdk/clients/NumberVerificationClient';
import AuthserverClient, { AuthorizeCallbackParams, AuthorizeParams, AuthorizeSession, TokenSet } from 'camara-node-sdk/clients/AuthserverClient';

const camaraSetup: CamaraSetup = Camara.setup();
const authserverClient: AuthserverClient = camaraSetup.authserverClient;
const numberVerificationClient = new NumberVerificationClient();


/**
 * Calculate a redirect to the authorized endpoint.
 */
app.get('/authcode/flow', async (req, res, next) => {
  
  const {phonenumber, operation, state, error} = retrieveParametersFromRequest(req);
  if (error) {
    console.log(error);
    return res.redirect('/logout');
  }

  // Set the right scopes, redirect_uri and state to perform the flow.
  const authorizeParams: AuthorizeParams = {
    scope: 'openid number-verification-verify-hashed-read device-location-verification-verify-read',
    redirect_uri: `${process.env.HOST}/authcode/callback`,
  };
  
  if (state) {
    authorizeParams.state = state;
  }

  // Retrieve the authorized url and the session data.
  const { url, session } = await authserverClient.authorize(authorizeParams);
  // Store the session data in the cookie session
  if (req.session) req.session.oauth = session;

  // Redirect to the Authorize Endpoint.
  return res.redirect(url);
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

  // Recover the Authorized session from the previous step.
  const authorizeSession: AuthorizeSession = req.session?.oauth;

  // We get the access_token and other information such as refresh_token, id_token, etc....
  const tokenSet: TokenSet = await authserverClient.getAuthorizationCodeToken(params, authorizeSession);
  
  // We consume the Number Verification API using the access token.
  const result = await numberVerificationClient.verify(
    { 
      hashed_phone_number: createHash('sha256').update(phonenumber).digest('hex')
    },{
      getToken: () => new Promise<string>((resolve) => {
        resolve(tokenSet.access_token as string);
      })
    });
  
  // We render the data returned by the API.
  return res.render('pages/verify', { 
    phonenumber,
    result: JSON.stringify(result, null, 4),
    state: uuid(),
    clientIp: getIpAddress(req)
  });

});

```

