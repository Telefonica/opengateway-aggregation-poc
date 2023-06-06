import os
import sys
import signal
import ipaddress
import importlib
import json

from flask import Flask, jsonify
from gevent.pywsgi import WSGIServer

# The module that resolves the mapping between the user identifier and the serving operator
# is dynamically loaded based on the IDENTITY_RESOLVER environment variable. This allows
# to easily switch or add different implementations.
resolve_module = importlib.import_module(f"resolvers.{os.environ.get('IDENTITY_RESOLVER', 'ripe')}")
resolve = resolve_module.resolve

app = Flask(__name__)
port = int(os.environ.get('PORT', 5000))


# Telco Finder
#
# Each aggregator is able to resolve the serving operator for a given identifier
# passed in the request. The identifier might be an IP address and port, a MSISDN,
# or any other kind of subscriber identifier.
#
# This is a simplified example that only supports IP addresses as identifiers.
#
# XXX: It could be implemented as a standard webfinger protocol.
#
@app.route('/telcofinder/v1/<identifier_type>/<identifier_value>', methods=['GET'])
def telcofinder(identifier_type, identifier_value):
    # Additional identity types can be supported
    if identifier_type != 'ipport':
        return f'Unsupported identity_type {identifier_type}', 400

    serving_operator_info = _resolve_serving_operator(identifier_type, identifier_value)
    if serving_operator_info is not None:
        return jsonify(serving_operator_info)
    else:
        return 'Not able to resolve serving operator', 404


@app.route('/healthz')
def healthz():
    return 'OK'


def _resolve_serving_operator(identifier_type, identifier_value):
    # Default value for private IPs
    # Used for testing in development environments only.
    if ipaddress.ip_address(identifier_value).is_private:
        operator_id = "ORG-TDE1-RIPE"
    else:
        operator_id = resolve(identifier_type, identifier_value)

    return _well_known_endpoints(operator_id) if operator_id else None


with open("operators.json") as file:
    OPERATORS_DATABASE = json.load(file)


def _well_known_endpoints(operator_id):
    return OPERATORS_DATABASE[operator_id]


def handle_shutdown(signal, frame):
    print("Stopping the Flask app...")
    sys.exit(0)


if __name__ == '__main__':
    signal.signal(signal.SIGINT, handle_shutdown)
    http_server = WSGIServer(('0.0.0.0', port), app)
    http_server.serve_forever()
