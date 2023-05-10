import os
import requests
from flask import Flask

app = Flask(__name__)
port = int(os.environ.get('PORT', 5000))


#
# Telco Router acts as a proxy to the target operator CAMARA APIs.
# It could be deployed as an API Gateway (e.g., kong + plugins)
#
@app.route('/', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])
def proxy_all_requests():
    # TODO evaluate if a Kong might be simpler
    return 'TODO'


@app.route('/healthz')
def healthz():
    return 'OK'


if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=port)
