# Demo app

Provision in authservers

```txt
{
    "_id" : "73902489-c201-4819-bdf9-3708a484fe21",
    "consumer_secret" : "3184428a-1ea4-4e1c-9969-b623f36fbc2f",
    "name" : "My App",
    "description" : "App for testing",
    "redirect_uri" : [
        "http://localhost:3000/login/camara/callback"
    ],
    "developer" : {
        "email" : "johndoe@myapp.com",
        "name" : "John Doe"
    },
    "status" : "active",
    "grants" : [
        {
            "grant_type" : "authorization_code",
            "scopes" : [
                "device-location-verification-verify-read"
            ]
        },
        {
            "grant_type" : "client_credentials",
            "scopes" : [
                "discovery:read"
            ]
        }
    ],
    "sector_identifier_uri" : "http://localhost:3000",
    "jwks_uri" : "http://demo-app:3000/api/jwks"
}
```