import logging

import requests
from django.conf import settings

from aggregator.middleware.telcorouter import AggregatorMiddleware
from aggregator.utils.exceptions import log_exception, ServerErrorException
from aggregator.utils.http import do_request_call
from aggregator.utils.utils import Singleton

logger = logging.getLogger(settings.LOGGING_PREFIX)


class TelcoFinderClient(object, metaclass=Singleton):

    def get_routing_metadata(self, identity_type, identifier):
        api_name = 'Telco Finder'
        try:
            headers = {AggregatorMiddleware.AGGREGATOR_CORRELATOR_HEADER: AggregatorMiddleware.get_correlator(AggregatorMiddleware.get_current_request())}
            response = do_request_call(api_name, 'GET', settings.TELCO_FINDER_HOST + settings.TELCO_FINDER_IDENTITY_PATH.format(identity_type=identity_type, identifier=identifier),
                                       headers=headers, verify=settings.API_VERIFY_CERTIFICATE, timeout=settings.API_HTTP_TIMEOUT)
            if response.status_code == requests.codes.ok:  # @UndefinedVariable
                return response.json()
            elif response.status_code == requests.codes.not_found:  # @UndefinedVariable
                return None
        except Exception as e:
            log_exception(e)
        raise ServerErrorException(f'{api_name} is unavailable')

    def get_telcos(self):
        api_name = 'Telcos Finder'
        try:
            headers = {AggregatorMiddleware.AGGREGATOR_CORRELATOR_HEADER: AggregatorMiddleware.get_correlator(AggregatorMiddleware.get_current_request())}
            response = do_request_call(api_name, 'GET', settings.TELCO_FINDER_HOST + settings.TELCO_FINDER_TELCOS_PATH,
                                       headers=headers, verify=settings.API_VERIFY_CERTIFICATE, timeout=settings.API_HTTP_TIMEOUT)
            if response.status_code == requests.codes.ok:  # @UndefinedVariable
                return response.json()
            elif response.status_code == requests.codes.not_found:  # @UndefinedVariable
                return None
        except Exception as e:
            log_exception(e)
        raise ServerErrorException(f'{api_name} is unavailable')

