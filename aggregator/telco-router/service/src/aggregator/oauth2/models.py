import calendar
import logging
from datetime import datetime

import pymongo
from django.conf import settings

from aggregator.utils.database import AggregatorCollection

logger = logging.getLogger(settings.LOGGING_PREFIX)


class JtiCollection(AggregatorCollection):

    collection_name = 'jtis'

    INDEX_EXPIRATION = 'expiration'
    INDEX_JTI = 'jti'

    FIELD_CLIENT_ID = 'client_id'
    FIELD_JTI = 'jti'
    FIELD_EXPIRATION = 'exp'

    @classmethod
    def ensure_all_indexes(cls):
        try:
            logger.info('Creating JTIs indexes...')
            super().ensure_indexes([
                {'name': cls.INDEX_EXPIRATION, 'keys': [(cls.FIELD_EXPIRATION, pymongo.ASCENDING)], 'expireAfterSeconds': 0},
                {'name': cls.INDEX_JTI, 'keys': [(cls.FIELD_CLIENT_ID, pymongo.ASCENDING), (cls.FIELD_JTI, pymongo.ASCENDING)], 'unique': True}
            ])
            logger.info('JTIs indexes created')
        except Exception as e:
            logger.error('Unable to create JTIs indexes: %s', str(e.args[0]))

    @classmethod
    def find_jti(cls, client_id, jti):
        jti = cls.objects.find_one({cls.FIELD_CLIENT_ID: client_id, cls.FIELD_JTI: jti})
        if jti is not None:
            if calendar.timegm(datetime.timetuple(datetime.utcnow())) > calendar.timegm(datetime.timetuple(jti[cls.FIELD_EXPIRATION])):
                return None
        return jti

    @classmethod
    def insert_jti(cls, client_id, jti, expiration):
        return cls.objects.insert_one({cls.FIELD_CLIENT_ID: client_id, cls.FIELD_JTI: jti, cls.FIELD_EXPIRATION: expiration})

