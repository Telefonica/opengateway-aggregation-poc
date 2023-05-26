import ipaddress
import os

from flask import Flask, jsonify
from gevent.pywsgi import WSGIServer
from ipwhois import IPWhois

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
# XXX: It could be implemented as a standard webfinger protocol and extended to support
# IP + port.
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


#
# Telco resolution logic using ipwhois, that uses Regional Internet Registries.
# This PoC uses the REST API. It is a naive implementation for demo purposes
# that works for Telefónica and Vodafone.
#
# It should evolve to use a local copy of a registry database or other smarter
# approaches.
#
def _resolve_serving_operator(identifier_type, identifier_value):
    try:
        # Default value for private IPs
        if ipaddress.ip_address(identifier_value).is_private:
            return OPERATOR_DATABASE["ORG-TDE1-RIPE"]

        # example 83.58.58.57 (Telefónica)
        # example 109.42.3.0 (Vodafone)
        whois = IPWhois(identifier_value).lookup_whois()
        print(whois, flush=True)
        asn = int(whois['asn'])  # see https://asrank.caida.org/asns
        return _well_known_endpoints(asn)
    except Exception as e:
        return None


OPERATOR_DATABASE = {
    "ORG-TDE1-RIPE": {
        "apigateway_url": "http://operator-platform-apigateway-1:8000",
        "authserver_url": "http://operator-platform-authserver-1:9010/oauth2/authorize"
    },
    "ORG-VDG1-RIPE": {
        "apigateway_url": "http://operator-platform-apigateway-2:8000",
        "authserver_url": "http://operator-platform-authserver-2:9020/oauth2/authorize"
    }
}

ASN_DATABASE = {
    "ORG-TDE1-RIPE": [12956, 22927, 3352, 10834, 16629, 6805, 6147, 14117, 35228, 262202,
                      6306, 19889, 60793, 19422, 56460, 15311, 263783, 22364, 17069, 40260, 12638, 27680,
                      11815, 29180, 61510, 27877, 22501, 6813, 263777, 49318, 8789, 23416, 52447, 4926,
                      27950, 31418, 263814, 265795, 264819, 204758, 203672, 264652, 269873, 270063, 267858,
                      267903, 22185, 198198, 264123, 19196, 265773
                      ],
    "ORG-VDG1-RIPE": [1273, 55410, 12302, 15924, 3209, 16019, 12430, 12357, 3329, 30722,
                      33915, 24835, 6739, 21334, 12969, 50973, 12353, 55644, 6660, 21183, 48728, 38442,
                      15502, 34912, 5378, 17993, 16338, 133612, 15897, 201917, 36935, 31334, 15480, 8386,
                      25310, 17435, 44957, 12361, 25135, 18291, 211559, 212661, 62211, 31654, 3273, 134927,
                      30995, 133580, 136987, 328794
                      ]
}


def _well_known_endpoints(asn):
    operator_id = [key for key, value in ASN_DATABASE.items() if asn in value][0]
    return OPERATOR_DATABASE[operator_id]


if __name__ == '__main__':
    http_server = WSGIServer(('0.0.0.0', port), app)
    http_server.serve_forever()
