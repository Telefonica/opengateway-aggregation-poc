import logging
from urllib.parse import urlparse

from django.conf import settings
from django.core.cache import cache

from aggregator.utils.database import AggregatorCollection
from aggregator.utils.schemas import FIELD_APP_ID

logger = logging.getLogger(settings.LOGGING_PREFIX)


class ApplicationCollection(AggregatorCollection):

    collection_name = 'apps'

    FIELD_ID = '_id'
    FIELD_NAME = 'name'
    FIELD_REDIRECT_URI = 'redirect_uri'
    FIELD_SECTOR_IDENTIFIER_URI = 'sector_identifier_uri'
    FIELD_JWKS_URI = 'jwks_uri'
    FIELD_SECTOR_IDENTIFIER = 'sector_identifier'
    FIELD_STATUS = 'status'
    FIELD_GRANTS = 'grants'
    FIELD_CONSUMER_SECRET = 'consumer_secret'

    FIELD_STATUS_VALUE_ACTIVE = 'active'

    @classmethod
    def find_one_by_id(cls, client_id, cached=True):
        key = cls.get_cache_key(client_id)

        if cached:
            app = cache.get(key)
            if app is not None:
                logger.debug("Getting app from cache: %s", client_id)
                return app

        app = cls.objects.find_one({cls.FIELD_ID: client_id})

        if app is not None:
            app[cls.FIELD_STATUS] = app.get(cls.FIELD_STATUS, cls.FIELD_STATUS_VALUE_ACTIVE)
            app[cls.FIELD_SECTOR_IDENTIFIER] = cls.get_sector_identifier(app)
            app[cls.FIELD_NAME] = app[cls.FIELD_NAME] if isinstance(app[cls.FIELD_NAME], list) else [app[cls.FIELD_NAME]]

            logger.debug("Saving app in cache: %s", client_id)
            cache.set(key, app)

        return app

    @classmethod
    def get_sector_identifier(cls, app):
        url = app.get(cls.FIELD_SECTOR_IDENTIFIER_URI, app.get(cls.FIELD_REDIRECT_URI, None))
        if url:
            url = url[0] if isinstance(url, list) else url
            p = urlparse(url)
            return p.netloc
        return None

    @classmethod
    def insert(cls, application):
        if cls.FIELD_ID not in application:
            application[cls.FIELD_ID] = application[FIELD_APP_ID]
        return cls.objects.insert_one(application)

    @classmethod
    def find_one_by_id(cls, client_id, cached=True):
        key = cls.get_cache_key(client_id)

        if cached:
            app = cache.get(key)
            if app is not None:
                logger.debug("Getting app from cache: %s", client_id)
                return app

        app = cls.objects.find_one({cls.FIELD_ID: client_id})

        if app is not None:
            app[cls.FIELD_STATUS] = app.get(cls.FIELD_STATUS, cls.FIELD_STATUS_VALUE_ACTIVE)
            app[cls.FIELD_SECTOR_IDENTIFIER] = cls.get_sector_identifier(app)
            app[cls.FIELD_NAME] = app[cls.FIELD_NAME] if isinstance(app[cls.FIELD_NAME], list) else [app[cls.FIELD_NAME]]

            logger.debug("Saving app in cache: %s", client_id)
            cache.set(key, app)

        return app

    @classmethod
    def update(cls, application):
        return cls.objects.update_one({cls.FIELD_ID: application[cls.FIELD_ID]}, {'$set': application}, upsert=False)

    @classmethod
    def remove(cls, client_id):
        return cls.objects.delete_one({cls.FIELD_ID: client_id})

    @classmethod
    def get_cache_key(cls, client_id):
        return f"app_{client_id}"


class Grant:

    FIELD_GRANT_TYPE = 'grant_type'
    FIELD_SCOPES = 'scopes'
    FIELD_CLAIMS = 'claims'
    FIELD_ACCESS_TOKEN_TTL = 'access_token_ttl'
    FIELD_REFRESH_TOKEN_TTL = 'refresh_token_ttl'
