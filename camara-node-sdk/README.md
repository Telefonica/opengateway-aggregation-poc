# camara-node-dk

Public SDK used by applications to operate with the OpenGateway platform.
Written in Node.js

# Usage

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
