import logging
from json.decoder import JSONDecoder
import ujson as json
from django.conf import settings
from django.http.response import HttpResponse
from django.views.generic.base import View
from django.urls import reverse
from oauthlib.oauth2.rfc6749.errors import InvalidRequestFatalError
from pymongo.errors import DuplicateKeyError

from authserver.oauth2.baikal.validators import BaikalRequestValidator
from authserver.utils.exceptions import NotFoundError, ServerError, ConflictError, InvalidParameterValueError
from authserver.utils.parsers import object_pairs_hook
from authserver.utils.schemas import APPLICATION_VALIDATOR
from authserver.utils.views import publish_to_middleware, JSONBasicAuthenticatedView
from authserver.oauth2.models import ApplicationCollection

logger = logging.getLogger(settings.LOGGING_PREFIX)

validator = BaikalRequestValidator()


def build_response(headers, body, status):
    response = HttpResponse(body, status=status)
    for header in headers:
        response[header] = headers[header]
    return response


def get_json_data(data):
    try:
        decoder = JSONDecoder(object_pairs_hook=object_pairs_hook)
        return decoder.decode(data)
    except Exception as e:
        raise Exception(f'Invalid JSON: {e.args[0]}')


def get_body_from_request(request):
    try:
        content_type = request.headers.get('Content-Type', None)
        if content_type.startswith('application/json'):
            return get_json_data(request.body.decode('utf-8'))
        elif content_type.startswith('application/x-www-form-urlencoded'):
            return request.body
    except Exception as e:
        raise InvalidRequestFatalError(description=str(e.args[0]))

    raise InvalidRequestFatalError(description='Invalid content type')


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
        return build_response({"Content-Type": "application/json"},
                              json.dumps(application, escape_forward_slashes=False), 200)

    def put(self, request, client_id):
        application = get_body_from_request(request)
        application[ApplicationCollection.FIELD_ID] = client_id
        try:
            APPLICATION_VALIDATOR.validate(application)
        except Exception as e:
            logger.warning('Error processing application: %s', str(e.args[0]))
            raise InvalidParameterValueError(message=str(e.args[0]))
        try:
            update_result = ApplicationCollection.update(application)
        except Exception as e:
            raise ServerError()
        if update_result is None:
            raise NotFoundError(request.path)
        return build_response({"Content-Type": "application/json"},
                              json.dumps(application, escape_forward_slashes=False), 200)

    def delete(self, request, client_id):
        delete_result = ApplicationCollection.remove(client_id)
        if delete_result is None:
            raise NotFoundError(request.path)
        return build_response({"Content-Type": "application/json"}, None, 204)


@publish_to_middleware(response_content_type='application/json', operation='APPLICATIONS')
class ApplicationsView(JSONBasicAuthenticatedView):

    scopes = {'post': ['admin:apps:create']}

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def post(self, request):
        application = get_body_from_request(request)
        try:
            APPLICATION_VALIDATOR.validate(application)
        except Exception as e:
            logger.warning('Error processing application: %s', str(e.args[0]))
            raise InvalidParameterValueError(message=str(e.args[0]))
        try:
            result = ApplicationCollection.insert(application)
        except DuplicateKeyError as dke:
            raise ConflictError(f'{request.path}/{application[ApplicationCollection.FIELD_ID]}')
        except Exception as e:
            raise ServerError()
        return build_response({
            "Content-Type": "application/json",
            "Location": f'{request.scheme}://{request.headers.get("Host")}{reverse("applications")}/'
                        f'{application[ApplicationCollection.FIELD_ID]}'
        }, json.dumps(application, escape_forward_slashes=False), 201)
