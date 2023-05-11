import logging

from django.conf import settings
from oauthlib.oauth2.rfc6749.tokens import BearerToken
from oauthlib.openid.connect.core.tokens import JWTToken

from aggregator.oauth2.baikal.endpoints import BaikalTokenEndpoint, BaikalApiEndpoint
from aggregator.oauth2.baikal.grant_types import BaikalJWTBearerGrant, GRANT_TYPE_JWT_BEARER
from aggregator.oauth2.baikal.tokens import access_token_expires_in

logger = logging.getLogger(settings.LOGGING_PREFIX)


class BaikalServer(BaikalTokenEndpoint, BaikalApiEndpoint):

    def __init__(self, request_validator, token_expires_in=None, token_generator=None, refresh_token_generator=None, *args, **kwargs):

        self.bearer = BearerToken(request_validator, token_generator, access_token_expires_in, refresh_token_generator)
        self.jwt = JWTToken(request_validator, token_generator, token_expires_in, refresh_token_generator)

        self.jwt_bearer_grant = BaikalJWTBearerGrant(request_validator)

        BaikalTokenEndpoint.__init__(self, default_grant_type=None,
                                     grant_types={
                                         GRANT_TYPE_JWT_BEARER: self.jwt_bearer_grant,
                                     },
                                     default_token_type=self.bearer)

        BaikalApiEndpoint.__init__(self, request_validator)