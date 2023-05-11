import json
from datetime import datetime

import requests_mock
from django.conf import settings
from django.test.client import Client
from freezegun.api import freeze_time

from aggregator.oauth2.tests.tests_basic import get_signed_jwt, SP_JWT_PRIVATE_KEY
from aggregator.oauth2.tests.tests_token_jwt_bearer import JwtBearerTokenTestCase


class ApiTestCase(JwtBearerTokenTestCase):

    @classmethod
    def do_mocking(cls, m, jwks_uri_params=None):
        super().do_mocking(m, jwks_uri_params)

        m.post("http://api.operator.com/myapi",
               headers={
                   'X-Foo': 'bar',
                   'Content-Type': 'application/json'
               },
               json={
                   'quux': 'corge'
               })

    @classmethod
    def do_api(cls, json_obj, headers, **kwargs):
        client = Client()
        return client.post('/' + settings.AGGREGATOR_PATH_PREFIX + 'api/myapi?baz=qux', data=json.dumps(json_obj), content_type='application/json', **headers)


class ApiOkTestCase(ApiTestCase):

    @freeze_time(datetime.utcnow(), tz_offset=0)
    @requests_mock.mock()
    def test_api(self, m):
        self.do_mocking(m)

        token_params = self.get_token_request_parameters()
        token_params['client_assertion_type'] = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'
        token_params['client_assertion'] = get_signed_jwt(self.get_default_client_assertion(), settings.SP_JWT_SIGNING_ALGORITHM, settings.SP_JWT_KID, SP_JWT_PRIVATE_KEY)
        response = self.do_token(token_params, {})
        token, _, _ = self.assertAccessTokenOK(response, refresh_token=False, id_token=False)

        headers = {
            'HTTP_X_CORRELATOR': '8d085f36-8a06-40c9-a8c3-65073093cd23',
            'HTTP_AUTHORIZATION': f'Bearer {token["access_token"]}'
        }
        payload = {'foo': 'bar'}

        response = self.do_api(payload, headers)
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertDictEqual(body, {'quux': 'corge'})
        self.assertDictContainsSubset({'X-Foo': 'bar', 'Content-Type': 'application/json'}, dict(response.headers))

        operator_request = self.get_request_from_history(m, -1)
        self.assertEqual(operator_request.url, 'http://api.operator.com/myapi?baz=qux')
        self.assertDictContainsSubset({'X-Correlator': '8d085f36-8a06-40c9-a8c3-65073093cd23', 'Content-Type': 'application/json'}, operator_request.headers)
        self.assertDictEqual(operator_request.body, payload)


class ApiErrorTestCase(ApiTestCase):

    @freeze_time(datetime.utcnow(), tz_offset=0)
    @requests_mock.mock()
    def test_no_authorization_header(self, m):
        headers = {
            'X-Correlator': '8d085f36-8a06-40c9-a8c3-65073093cd23'
        }
        payload = {'foo': 'bar'}

        response = self.do_api(payload, headers)
        self.assertJsonError(response, 401, 'invalid_token', 'The access token provided is expired, revoked, malformed, or invalid for other reasons.')

    @freeze_time(datetime.utcnow(), tz_offset=0)
    @requests_mock.mock()
    def test_invalid_token(self, m):
        headers = {
            'X-Correlator': '8d085f36-8a06-40c9-a8c3-65073093cd23',
            'Authorization': 'Bearer foo}'
        }
        payload = {'foo': 'bar'}

        response = self.do_api(payload, headers)
        self.assertJsonError(response, 401, 'invalid_token', 'The access token provided is expired, revoked, malformed, or invalid for other reasons.')

