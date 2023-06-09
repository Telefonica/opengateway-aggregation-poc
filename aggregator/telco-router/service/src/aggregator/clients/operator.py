import json
import logging

import requests
from django.conf import settings
from retry import retry

from aggregator.clients.oidc import OidcClient
from aggregator.middleware.telcorouter import AggregatorMiddleware
from aggregator.utils.exceptions import InvalidAccessTokenException, log_exception, ServerErrorException
from aggregator.utils.http import do_request_call
from aggregator.utils.utils import Singleton

logger = logging.getLogger(settings.LOGGING_PREFIX)


class OperatorClient(object, metaclass=Singleton):

    @retry(exceptions=InvalidAccessTokenException, tries=2, delay=0, logger=logger)
    def create_app(self, telco, app):
        resource = 'AuthServer App Creation'
        token = OidcClient().get_cc_access_token(telco['authserver_url'], settings.OPERATOR_CLIENT_ID, settings.OPERATOR_APPS_SCOPES)
        try:
            headers = {
                'Authorization': f'Bearer {token["access_token"]}',
                'Content-Type': 'application/json',
                AggregatorMiddleware.AGGREGATOR_CORRELATOR_HEADER: AggregatorMiddleware.get_correlator(AggregatorMiddleware.get_current_request())
            }
            response = do_request_call(resource, 'post', telco['apigateway_url'] + settings.OPERATOR_APPS_PATH,
                                       headers=headers, data=json.dumps(app),
                                       verify=settings.OIDC_VERIFY_CERTIFICATE, timeout=settings.OIDC_HTTP_TIMEOUT)
            if response.status_code == requests.codes.created:  # @UndefinedVariable
                return response.json()
            elif response.status_code == requests.codes.unauthorized:  # @UndefinedVariable
                OidcClient().remove_cached_access_token(token["access_token"])
                raise InvalidAccessTokenException(f'{resource} is unavailable (Invalid access token)')
        except InvalidAccessTokenException:
            raise
        except Exception as e:
            log_exception(e)
        raise ServerErrorException(f'{resource} is unavailable')

    @retry(exceptions=InvalidAccessTokenException, tries=2, delay=0, logger=logger)
    def update_app(self, telco, app):
        resource = 'AuthServer App Update'
        token = OidcClient().get_cc_access_token(telco['authserver_url'], settings.OPERATOR_CLIENT_ID, settings.OPERATOR_APPS_SCOPES)
        try:
            headers = {
                'Authorization': f'Bearer {token["access_token"]}',
                'Content-Type': 'application/json',
                AggregatorMiddleware.AGGREGATOR_CORRELATOR_HEADER: AggregatorMiddleware.get_correlator(AggregatorMiddleware.get_current_request())
            }
            response = do_request_call(resource, 'put', telco['apigateway_url'] + settings.OPERATOR_APPS_PATH + '/' + app['id'],
                                       headers=headers, data=json.dumps(app),
                                       verify=settings.OIDC_VERIFY_CERTIFICATE, timeout=settings.OIDC_HTTP_TIMEOUT)
            if response.status_code == requests.codes.ok:  # @UndefinedVariable
                return response.json()
            elif response.status_code == requests.codes.unauthorized:  # @UndefinedVariable
                OidcClient().remove_cached_access_token(token["access_token"])
                raise InvalidAccessTokenException(f'{resource} is unavailable (Invalid access token)')
        except InvalidAccessTokenException:
            raise
        except Exception as e:
            log_exception(e)
        raise ServerErrorException(f'{resource} is unavailable')

    @retry(exceptions=InvalidAccessTokenException, tries=2, delay=0, logger=logger)
    def delete_app(self, telco, app_id):
        resource = 'AuthServer App Deletion'
        token = OidcClient().get_cc_access_token(telco['authserver_url'], settings.OPERATOR_CLIENT_ID, settings.OPERATOR_APPS_SCOPES)
        try:
            headers = {
                'Authorization': f'Bearer {token["access_token"]}',
                AggregatorMiddleware.AGGREGATOR_CORRELATOR_HEADER: AggregatorMiddleware.get_correlator(AggregatorMiddleware.get_current_request())
            }
            response = do_request_call(resource, 'delete', telco['apigateway_url'] + settings.OPERATOR_APPS_PATH + '/' + app_id,
                                       headers=headers,
                                       verify=settings.OIDC_VERIFY_CERTIFICATE, timeout=settings.OIDC_HTTP_TIMEOUT)
            if response.status_code == requests.codes.no_content or response.status_code == requests.codes.not_found:  # @UndefinedVariable
                return
            elif response.status_code == requests.codes.unauthorized:  # @UndefinedVariable
                OidcClient().remove_cached_access_token(token["access_token"])
                raise InvalidAccessTokenException(f'{resource} is unavailable (Invalid access token)')
        except InvalidAccessTokenException:
            raise
        except Exception as e:
            log_exception(e)
        raise ServerErrorException(f'{resource} is unavailable')


