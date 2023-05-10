FROM mongo:5.0

ADD ./app.js /app.js
ADD ./docker-entrypoint.sh /docker-entrypoint.sh
ADD ./wait-for-it.sh /wait-for-it.sh

ENTRYPOINT [ "./wait-for-it.sh", "-t", "60", "mongodb:27017", "--", "./docker-entrypoint.sh"]
