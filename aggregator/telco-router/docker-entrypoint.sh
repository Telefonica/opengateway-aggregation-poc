#!/bin/bash

APPNAME=baikal-aggregator
USER=baikal
APPMODULE=aggregator.wsgi:application
DAEMON=gunicorn
BIND=0.0.0.0:${PORT}
[ -z "${WORKERS}" ] && WORKERS=2 || true
BASE_DIR="/opt/baikal/baikal-aggregator"

pushd ${BASE_DIR} && ${DAEMON} --bind=${BIND} --workers=${WORKERS} ${APPMODULE}
