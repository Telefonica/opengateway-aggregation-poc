import os
from flask import Flask, redirect, request, jsonify

app = Flask(__name__)
port = int(os.environ.get('PORT', 5000))

#
# Simulate an exposed CAMARA API (Device Location)
# with a hardcoded response.
#
@app.route('/device-location-verification/v1/verify', methods=['POST'])
def devicelocation():
    dummmy_response_data = {
        "verification_result": "match"
    }
    return jsonify(dummmy_response_data)


@app.route('/healthz')
def healthz():
    return 'OK'


if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=port)
