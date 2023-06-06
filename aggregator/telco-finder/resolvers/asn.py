import ipaddress

from ipwhois import IPWhois

# Non exhaustive list of ASNs for Telefónica and Vodafone.
ASN_DATABASE = {
    "ORG-TDE1-RIPE": [
        12956, 22927, 3352, 10834, 16629, 6805, 6147, 14117, 35228, 262202,
        6306, 19889, 60793, 19422, 56460, 15311, 263783, 22364, 17069, 40260, 12638, 27680,
        11815, 29180, 61510, 27877, 22501, 6813, 263777, 49318, 8789, 23416, 52447, 4926,
        27950, 31418, 263814, 265795, 264819, 204758, 203672, 264652, 269873, 270063, 267858,
        267903, 22185, 198198, 264123, 19196, 265773
    ],
    "ORG-VDG1-RIPE": [
        1273, 55410, 12302, 15924, 3209, 16019, 12430, 12357, 3329, 30722,
        33915, 24835, 6739, 21334, 12969, 50973, 12353, 55644, 6660, 21183, 48728, 38442,
        15502, 34912, 5378, 17993, 16338, 133612, 15897, 201917, 36935, 31334, 15480, 8386,
        25310, 17435, 44957, 12361, 25135, 18291, 211559, 212661, 62211, 31654, 3273, 134927,
        30995, 133580, 136987, 328794
    ]
}

#
# Telco resolution logic using ipwhois, that uses Regional Internet Registries.
# This PoC uses the REST API. It is a naive implementation for demo purposes
# that works for Telefónica and Vodafone only. The RIPE resolver is more complete.
#
def resolve(identifier_type, identifier_value):
    try:
        # example 83.58.58.57 (Telefónica)
        # example 109.42.3.0 (Vodafone)
        whois = IPWhois(identifier_value).lookup_whois()
        print(whois, flush=True)
        asn = int(whois['asn'])  # see https://asrank.caida.org/asns
        return _find_operator_by_asn(asn)
    except Exception as e:
        print(f"Error resolving {identifier_value}: {e}")
        return None

def _find_operator_by_asn(asn):
    operator_id = [key for key, value in ASN_DATABASE.items() if asn in value][0]
    return operator_id
