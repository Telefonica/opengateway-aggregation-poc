import DeviceLocationVerificationClient from 'camara-node-sdk/clients/DeviceLocationVerificationClient';
import express from 'express';
import cookieSession from 'cookie-session';
import Camara from 'camara-node-sdk';

////////////////////////////
// Setup the Contracting Operator credentials in the server
////////////////////////////
process.env.CAMARA_API_URL = process.env.CAMARA_API_URL ?? 'http://localhost:11111'; // telefonica
process.env.CAMARA_AUTH_URL = process.env.CAMARA_AUTH_URL ?? 'http://localhost:9010/es/oauth2/authorize'; // telefonica
process.env.CAMARA_ISSUER = process.env.CAMARA_ISSUER ?? 'http://localhost:3000'; // our app issuer
process.env.CAMARA_CLIENT_ID = process.env.CAMARA_CLIENT_ID ?? '73902489-c201-4819-bdf9-3708a484fe21'; // our app client id
// base64 encoded PEM with our app client key (to perform a private_key_jwt authentication)
process.env.CAMARA_CLIENT_KEY =
  process.env.CAMARA_CLIENT_KEY ??
  'LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlCT1FJQkFBSkJBTDhVcnl6TEg1UEU1bnBXYTJhUGt6TUQrWnIrMTdtZUYzZ1NnejhQSHRCdWk5UVcySmNUCnlJY0wrYk8rcDVNaWFvY0tSMDQxYWdVdjZxWldXei90M05rQ0F3RUFBUUpBTW9UV2Q2SlFlL0lQK1lKRnJQMEMKcnZjN0UvYVN0SG1Pdk9rd0dBajRYYVNYUXNJeVdVRURMYUc1MjBBaGhqV2N3RU5yVWZPU2Y4ZnBjVFI0RXo4WApNUUloQU8zZy9Lc3Z4aUVuMGN4OWQ1TjE0WjNkWGovSmc0cjZHQ2lsSnVDSStodE5BaUVBemFNUHMxZjZDYXcvCnNmS1lZdjJ4UjRBNkJRdWwybE16b2w3VUVJaWFDYjBDSUZYeG1aaEgxRythTVdTT1dDdUF4WmtCcDlHbi9zeXgKZXhVRVJqMk5mNzlwQWg4N2NPY1k4RlZXZG5QeS9DMFFjRVRPWmtKZk12NitIVTdQb0ptc0xkQlpBaUVBcUpsegpubiswdmVTd0xqL3JFbDhtS3MvSW5vQkUzVTh2ODhLY2NGWmhKNzQ9Ci0tLS0tRU5EIFJTQSBQUklWQVRFIEtFWS0tLS0tCg==';
// Enable if you want basic authentication
// process.env.CAMARA_CLIENT_SECRET = '3184428a-1ea4-4e1c-9969-b623f36fbc2f'; // our app client id

Camara.setup();

const deviceLocationVerificationClient = new DeviceLocationVerificationClient();

const app = express();

app.enable('trust proxy');
app.use(cookieSession({ keys: ['secret'] }));

app.get('/', (req, res) => {
  res.send(`<html><body><a href="/verify">Verify</a></body></html>`);
});

app.get('/verify', async (req, res, next) => {
  console.log('/verify', req.session);
  try {
    if (!req.session?.camara) {
      req.session = req.session || {};
      req.session.camara = await Camara.login({
        ipport: `127.0.0.0:3000`,
      });
    }
    const location = await deviceLocationVerificationClient.verify(
      { postcode: '28080' },
      { session: req.session.camara }
    );
    console.log(location);
    res.json(location);
  } catch (err) {
    next(err);
  }
});

/**
 * expose jwks endpoint in the server
 * http://localhost:3000/api/jwks must be registered in the Contracting Operator Authserver as the client jwks_uri
 */
app.get('/api/jwks', async (req, res, next) => {
  console.log('/api/jwks', req.session);
  try {
    res.json(await Camara.jwks());
  } catch (err) {
    next(err);
  }
});

app.listen(3000, () => {
  console.log('Example listening on http://localhost:3000');
});
