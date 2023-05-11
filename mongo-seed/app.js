db.apps.replaceOne(
    {
        _id : "73902489-c201-4819-bdf9-3708a484fe21"
    },
    {
        _id : "73902489-c201-4819-bdf9-3708a484fe21",
        consumer_secret : "3184428a-1ea4-4e1c-9969-b623f36fbc2f",
        name : "Demo App",
        description : "App for testing",
        redirect_uri : [
            "http://localhost:3000/api/auth/callback/telco",
            "http://localhost:3001/api/auth/callback/camara",
            "http://127.0.0.1:3000/api/auth/callback/camara" ,
            "http://localhost:3000/login/camara/callback"
        ],
        developer : {
            email : "johndoe@demo-app.com",
            name : "John Doe Developer"
        },
        status : "active",
        grants : [
            {
                grant_type : "authorization_code",
                scopes : [
                    "openid",
                    "device-location-verification-verify-read"
                ]
            }, {
                grant_type : "urn:openid:params:grant-type:ciba",
                scopes : [
                    "openid",
                    "device-location-verification-verify-read"
                ]
            }, {
                grant_type : "urn:ietf:params:oauth:grant-type:jwt-bearer",
                scopes : [
                    "device-location-verification-verify-read"
                ]
            },{
                grant_type : "client_credentials",
                scopes : [
                    "discovery:read"
                ]
            }
        ],
        sector_identifier_uri : "http://localhost:3000",
        jwks_uri : "http://demo-sdk-example:3000/api/jwks"
    },
    {
        upsert: true
    }
)
