from django.utils.decorators import classonlymethod
from django.views.generic.base import View
from rest_framework.authentication import BasicAuthentication
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.renderers import JSONRenderer
from rest_framework.views import APIView

from .exceptions import NotFoundError
from .parsers import BaikalJSONParser
from ..oauth2.models import ApplicationCollection, Grant


class Handler404(View):

    def dispatch(self, request, *args, **kwargs):
        raise NotFoundError(request.path)


class GrantScopePermissions(BasePermission):
    """
    Allows access only to view scopes.
    """

    def has_permission(self, request, view):
        if request.user and request.user.is_authenticated:
            for grant in request.user.data[ApplicationCollection.FIELD_GRANTS]:
                if grant[Grant.FIELD_GRANT_TYPE] in view.grant_types and len(set(grant[Grant.FIELD_SCOPES]) & set(view.scopes)):
                    return True
        return False


class JSONBasicAuthenticatedView(APIView):

    parser_classes = (BaikalJSONParser,)
    renderer_classes = (JSONRenderer,)

    authentication_classes = (BasicAuthentication,)
    permission_classes = (IsAuthenticated, GrantScopePermissions)

    scopes = []
    grant_types = ['basic']


def publish_to_middleware(**kwargs):

    def wrapper(class_view):

        def as_view(cls, **initkwargs):
            view = super(cls, cls).as_view(**initkwargs)
            for k, v in kwargs.items():
                setattr(view, k, v)
            return view

        return type(class_view.__name__, (class_view,), {
            'as_view': classonlymethod(as_view),
        })

    return wrapper
