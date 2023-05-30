import express from 'express';
import { v4 as uuid } from 'uuid';
import jose from 'node-jose';
import type JWT from 'camara-node-sdk/src/clients/AuthserverClient'
import Camara from 'camara-node-sdk/src';

const ApiRoutes = () => {
  const router = express.Router();

  /**
  * Expose jwks endpoint in the server
  * http://localhost:3000/api/jwks must be registered in the Aggregator Authserver as the client jwks_uri
  */
  router.get('/jwks', async (req, res, next) => {
    console.log('/api/jwks', req.session);
    try {
      res.json(await Camara.jwks());
    } catch (err) {
      next(err);
    }
  });

  /**
   * POSTMan Helper method
   */
  router.post('/assertion', async (req, res, next) => {
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload: JWT = {
      ...req.body,
      jti: uuid(),
      exp: now + 600,
      iat: now,
    };
    try {
      const clientKey: string = process.env.CAMARA_CLIENT_KEY as string;
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

  return router;
};

export default ApiRoutes;
