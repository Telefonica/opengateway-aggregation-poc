import logging

import oauthlib.oauth2.rfc6749.grant_types.base
import requests
import ujson as json
from django.conf import settings
from oauthlib.oauth2.rfc6749.errors import InvalidRequestFatalError, InvalidClientError, CustomOAuth2Error

from aggregator.clients.oidc import OidcClient
from aggregator.clients.telco_finder import TelcoFinderClient
from aggregator.middleware.telcorouter import AggregatorMiddleware
from aggregator.utils.exceptions import MissingParameterError, InvalidParameterValueError
from aggregator.utils.http import do_request_call
from aggregator.utils.schemas import FIELD_SUB, FIELD_SCOPE

logger = logging.getLogger(settings.LOGGING_PREFIX)

GRANT_TYPE_JWT_BEARER = 'urn:ietf:params:oauth:grant-type:jwt-bearer'


class AggregatorJWTBearerGrant(oauthlib.oauth2.rfc6749.grant_types.base.GrantTypeBase):

    def validate_token_request(self, request):
        for validator in self.custom_validators.pre_token:
            validator(request)
        # First check duplicate parameters
        required_params = ['grant_type', 'assertion']
        for param in required_params:
            try:
                duplicate_params = request.duplicate_params
            except ValueError:
                raise InvalidRequestFatalError(description='Unable to parse query string.', request=request)
            if param in duplicate_params:
                raise InvalidRequestFatalError(description='Duplicate %s parameter.' % param, request=request)

        for param in required_params:
            if getattr(request, param, None) is None:
                raise MissingParameterError(param, request=request)

        for param, value in [('grant_type', GRANT_TYPE_JWT_BEARER)]:
            if getattr(request, param) != value:
                raise InvalidParameterValueError(param, request=request)

        if not self.request_validator.authenticate_client(request):
            raise InvalidClientError(request=request)
        else:
            if not hasattr(request.client, 'client_id'):
                raise NotImplementedError('Authenticate client must set the request.client.client_id attribute in authenticate_client.', request=request)

        self.validate_grant_type(request)

        for validator in self.custom_validators.post_token:
            validator(request)

    def _get_routing_token(self, request):
        index = request.auth[FIELD_SUB].find(":")
        request.routing = TelcoFinderClient().get_routing_metadata(request.auth[FIELD_SUB][0:index], request.auth[FIELD_SUB][index+1:])

        metadata = OidcClient().get_metadata(request.routing['authserver_url'])

        headers = {AggregatorMiddleware.AGGREGATOR_CORRELATOR_HEADER: AggregatorMiddleware.get_correlator(AggregatorMiddleware.get_current_request()),
                   'Content-Type': 'application/x-www-form-urlencoded'}
        response = do_request_call('Routing Token', 'POST', metadata['token_endpoint'],
                        headers=headers, data=request.body, verify=settings.API_VERIFY_CERTIFICATE, timeout=settings.API_HTTP_TIMEOUT)

        if response.status_code == requests.codes.ok:  # @UndefinedVariable
            return response.json()
        else:
            body = response.json()
            raise CustomOAuth2Error(body['error'], status_code=response.status_code, description=body['error_description'])

    def _generate_token(self, request, token_handler):
        request.refresh_token = None
        request.extra_credentials = None
        request.token = self._get_routing_token(request)
        if FIELD_SCOPE in request.token:
            request.scopes = request.token[FIELD_SCOPE].split(' ')
        token = token_handler.create_token(request, refresh_token=False)
        for modifier in self._token_modifiers:
            token = modifier(token, token_handler, request)
        self.request_validator.save_token(token, request)
        return token

    def create_token_response(self, request, token_handler):
        headers = self._get_default_headers()
        self.validate_token_request(request)
        if self.request_validator.validate_assertion(request):
            token = self._generate_token(request, token_handler)
        return headers, json.dumps(token, escape_forward_slashes=False), 200
