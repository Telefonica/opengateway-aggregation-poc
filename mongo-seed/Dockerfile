FROM mongo:5.0

ADD ./app-provision.js /app-provision.js
ADD ./aggregator-app-provision.js /aggregator-app-provision.js
ADD ./docker-entrypoint.sh /docker-entrypoint.sh
ADD ./wait-for-it.sh /wait-for-it.sh

ENTRYPOINT [ "./wait-for-it.sh", "-t", "60", "mongodb:27017", "--", "./docker-entrypoint.sh"]
