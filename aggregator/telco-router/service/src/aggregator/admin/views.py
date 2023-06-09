import logging
from copy import deepcopy

from django.conf import settings
from django.urls import reverse
from pymongo.errors import DuplicateKeyError
from rest_framework.response import Response
from rest_framework.status import HTTP_200_OK, HTTP_204_NO_CONTENT, HTTP_201_CREATED

from aggregator.admin.models import ApplicationCollection
from aggregator.clients.operator import OperatorClient
from aggregator.clients.telco_finder import TelcoFinderClient
from aggregator.utils.exceptions import NotFoundError, ConflictError, InvalidParameterValueError
from aggregator.utils.schemas import APPLICATION_VALIDATOR, FIELD_APP_ID
from aggregator.utils.views import publish_to_middleware, JSONBasicAuthenticatedView

logger = logging.getLogger(settings.LOGGING_PREFIX)


def get_returned_app(app):
    returned_app = {k: v for k, v in app.items() if k not in [ApplicationCollection.FIELD_ID, ApplicationCollection.FIELD_SECTOR_IDENTIFIER]}
    return returned_app


@publish_to_middleware(response_content_type='application/json', operation='APPLICATION')
class ApplicationView(JSONBasicAuthenticatedView):

    scopes = {
        'get': ['admin:apps:read'],
        'put': ['admin:apps:create'],
        'delete': ['admin:apps:create'],
    }

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def get(self, request, client_id):
        application = ApplicationCollection.find_one_by_id(client_id, False)
        if application is None:
            raise NotFoundError(request.path)

        return Response(get_returned_app(application), HTTP_200_OK)

    def put(self, request, client_id):
        application = request.data

        APPLICATION_VALIDATOR.validate(application)

        if application[FIELD_APP_ID] != client_id:
            raise InvalidParameterValueError(message="App identifier does not match the one in the URL path")

        application[ApplicationCollection.FIELD_ID] = client_id
        update_result = ApplicationCollection.update(application)
        if update_result.matched_count == 0:
            raise NotFoundError(request.path)

        del application[ApplicationCollection.FIELD_ID]

        operator_application = deepcopy(application)
        operator_application[ApplicationCollection.FIELD_REDIRECT_URI] = [settings.AGGREGATOR_HOST + reverse('aggregator-callback')]
        telcos = TelcoFinderClient().get_telcos()
        for telco in telcos:
            OperatorClient().update_app(telco, operator_application)

        return Response(get_returned_app(application), HTTP_200_OK)

    def delete(self, request, client_id):
        deletion_result = ApplicationCollection.remove(client_id)
        if deletion_result.deleted_count == 0:
            raise NotFoundError(request.path)
        telcos = TelcoFinderClient().get_telcos()
        for telco in telcos:
            OperatorClient().delete_app(telco, client_id)
        return Response(HTTP_204_NO_CONTENT)


@publish_to_middleware(response_content_type='application/json', operation='APPLICATIONS')
class ApplicationsView(JSONBasicAuthenticatedView):

    scopes = {'post': ['admin:apps:create']}

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def post(self, request):
        application = request.data

        APPLICATION_VALIDATOR.validate(application)

        try:
            ApplicationCollection.insert(application)
        except DuplicateKeyError:
            raise ConflictError(f'{request.path}/{application[ApplicationCollection.FIELD_ID]}')

        del application[ApplicationCollection.FIELD_ID]

        operator_application = deepcopy(application)
        operator_application[ApplicationCollection.FIELD_REDIRECT_URI] = [settings.AGGREGATOR_HOST + reverse('aggregator-callback')]
        telcos = TelcoFinderClient().get_telcos()
        for telco in telcos:
            OperatorClient().create_app(telco, operator_application)

        response = Response(get_returned_app(application), status=HTTP_201_CREATED)
        response.headers["Location"] = f'{settings.AGGREGATOR_HOST}/{reverse("applications")}/{application[FIELD_APP_ID]}'
        return response
