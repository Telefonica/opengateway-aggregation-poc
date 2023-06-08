import logging

from django.conf import settings
from django.urls import reverse
from pymongo.errors import DuplicateKeyError
from rest_framework.response import Response
from rest_framework.status import HTTP_201_CREATED, HTTP_204_NO_CONTENT, HTTP_200_OK

from authserver.admin.models import ApplicationCollection
from authserver.utils.exceptions import NotFoundError, ConflictError, InvalidParameterValueError
from authserver.utils.schemas import APPLICATION_VALIDATOR, FIELD_APP_ID
from authserver.utils.views import publish_to_middleware, JSONBasicAuthenticatedView

logger = logging.getLogger(settings.LOGGING_PREFIX)


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

        application[FIELD_APP_ID] = application[ApplicationCollection.FIELD_ID]
        del application[ApplicationCollection.FIELD_ID]
        return Response(application, status=HTTP_200_OK)

    def put(self, request, client_id):
        application = request.data
        APPLICATION_VALIDATOR.validate(application)

        if FIELD_APP_ID in application:
            if application[FIELD_APP_ID] != client_id:
                raise InvalidParameterValueError(message="App identifier does not match the one in the URL path")
        else:
            application[FIELD_APP_ID] = client_id

        application[ApplicationCollection.FIELD_ID] = client_id
        update_result = ApplicationCollection.update(application)
        if update_result.matched_count == 0:
            raise NotFoundError(request.path)

        del application[ApplicationCollection.FIELD_ID]
        return Response(application, status=HTTP_200_OK)

    def delete(self, request, client_id):
        deletion_result = ApplicationCollection.remove(client_id)
        if deletion_result.deleted_count == 0:
            raise NotFoundError(request.path)
        return Response(status=HTTP_204_NO_CONTENT)


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
        response = Response(application, status=HTTP_201_CREATED)
        response.headers["Location"] = f'{settings.AUTHSERVER_HOST}/{reverse("applications")}/{application[FIELD_APP_ID]}'
        return response

