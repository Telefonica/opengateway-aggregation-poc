db.apps.replaceOne(
    {
        _id : "73902489-c201-4819-bdf9-3708a484fe21"
    },
    {
        _id : "73902489-c201-4819-bdf9-3708a484fe21",
        consumer_secret : "3184428a-1ea4-4e1c-9969-b623f36fbc2f",
        name : "Demo App",
        description : "App for testing",
        developer : {
            email : "johndoe@demoapp.com",
            name : "John Doe Developer"
        },
        status : "active",
        grants : [
            {
                grant_type : "urn:ietf:params:oauth:grant-type:jwt-bearer",
                scopes : [
                    "device-location-verification-verify-read"
                ]
            }
        ],
        sector_identifier_uri : "http://localhost:3000",
        jwks_uri : "http://demo-app:3000/api/jwks"
    },
    {
        upsert: true
    }
)