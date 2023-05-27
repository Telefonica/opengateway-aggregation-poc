import type { BaseRequestContext } from '../clients/BaseClient.js';
import type { CamaraSetupId } from './setup.js';
import { defaultSetupId, getSetup } from './setup.js';
import type { AuthorizeParams, AuthorizeCallbackParams, AuthorizeSession } from '../clients/AuthserverClient.js';
import type { TokenSet } from '../clients/AuthserverClient.js';

export interface PassportContext extends BaseRequestContext {
  /** the setup id containing sdk configuration to use. Defaults to 'default' */
  setupId?: CamaraSetupId;
}

export type Passport = (
  { redirect_uri, fixed_scope }: { redirect_uri: string, fixed_scope?: string },
  context?: PassportContext
) => { authorize: any, callback: any}


const retrieveParametersFromRequest = (req: any) => {
  const state: string = (req.query.state ?? '') as string;
  const scope: string = req.session?.scope as string;
  let error = '';
  // if (!scope) {
  //   error = 'No scope stablished. Performing logout';
  // }

  // XXX it's not ok to have a phonenumber in the SDKs
  if (!req.session?.login || !req.session.login.phonenumber) {
    error = "No phone number found. Performing logout";
  }
  const phonenumber = req.session.login.phonenumber;

  return {
    state,
    scope,
    phonenumber,
    error
  }
};

export const passport: Passport = ({ redirect_uri, fixed_scope }, context = {}) => {
  const { setupId = defaultSetupId } = context;
  const setup = getSetup(setupId);
  const { authserverClient } = setup;


  const authorize =  async function (req: any, res: any, next: any) {
    const {scope, state, error } = retrieveParametersFromRequest(req);

    if (error) {
      console.log(error);
      return res.redirect('/logout');
    }

    try {
      // Set the right scopes, redirect_uri and state to perform the flow.
      const authorizeParams: AuthorizeParams = {
        scope: '',
        redirect_uri,
      };
      if (state) {
        authorizeParams.state = state;
      }
      if (scope) {
        authorizeParams.scope = scope;
      }

      if (fixed_scope) {
        authorizeParams.scope = fixed_scope;
      }

      // Retrieve the authorized url and the session data.
      const { url, session } = await authserverClient.authorize(authorizeParams);
      // Store the session data in the cookie session
      if (req.session) req.session.oauth = session;

      // Redirect to the Authorize Endpoint.
      return res.redirect(url);

    } catch (err) {
      next(err);
    }
  };

  const callback = async function (req: any, res: any, next: any) {
    const {phonenumber, error} = retrieveParametersFromRequest(req);

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

    // We store the token in the request context for future uses
    res.locals = {
      token: tokenSet.access_token,
      phonenumber
    };
    if (req.session) {
      delete req.session.oauth;
    }
    next();
  } catch(err) {
    next(err);
  }
  };

  return {
    authorize,
    callback
  }
};
