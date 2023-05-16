import logging

from django.conf import settings
from oauthlib.oauth2.rfc6749.tokens import BearerToken
from oauthlib.openid.connect.core.tokens import JWTToken

from aggregator.oauth2.telcorouter.endpoints import AggregatorTokenEndpoint, AggregatorApiEndpoint
from aggregator.oauth2.telcorouter.grant_types import AggregatorJWTBearerGrant, GRANT_TYPE_JWT_BEARER
from aggregator.oauth2.telcorouter.tokens import access_token_expires_in

logger = logging.getLogger(settings.LOGGING_PREFIX)


class AggregatorServer(AggregatorTokenEndpoint, AggregatorApiEndpoint):

    def __init__(self, request_validator, token_expires_in=None, token_generator=None, refresh_token_generator=None, *args, **kwargs):

        self.bearer = BearerToken(request_validator, token_generator, access_token_expires_in, refresh_token_generator)
        self.jwt = JWTToken(request_validator, token_generator, token_expires_in, refresh_token_generator)

        self.jwt_bearer_grant = AggregatorJWTBearerGrant(request_validator)

        AggregatorTokenEndpoint.__init__(self, default_grant_type=None,
                                     grant_types={
                                         GRANT_TYPE_JWT_BEARER: self.jwt_bearer_grant,
                                     },
                                     default_token_type=self.bearer)

        AggregatorApiEndpoint.__init__(self, request_validator)