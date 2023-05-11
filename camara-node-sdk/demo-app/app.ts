import DeviceLocationVerificationClient from 'camara-node-sdk/clients/DeviceLocationVerificationClient';
import express from 'express';
import cookieSession from 'cookie-session';
import Camara from 'camara-node-sdk';

/////////////////////////////////////////////////
// Initialize the SDK offering networking services (device location verification in the example)
// When the aggregator is an hyperscaler, this could be its own SDK (e.g., Azure SDK)
/////////////////////////////////////////////////
Camara.setup();
const deviceLocationVerificationClient = new DeviceLocationVerificationClient();

const app = express();

app.enable('trust proxy');
app.use(cookieSession({ keys: ['secret'] }));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }))

app.use(express.json())

app.get('/', (req, res) => {
  const userLogged = req.session?.login?.username;
  if (userLogged) {
    res.render('pages/verify', {username: req.session?.login?.username, result:''});
  } else {
    res.render('pages/login');
  }
});

app.post('/login', (req, res) => {
  let body = req.body
  console.log(JSON.stringify(body))
  req.session = req.session || {}
  req.session.login = {
    username: body.username || "John Doe",
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

app.get('/verify', async (req, res, next) => {
  console.log('/verify', req.session);

  if (!req.session?.login?.username) {
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
      res.render('pages/verify', {username: req.session?.login?.username, result: JSON.stringify(location, null, 4)});
    } catch (err) {
      next(err);
    }
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Demo App listening on http://localhost:${PORT}`);
});
