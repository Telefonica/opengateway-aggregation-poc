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
);

db.apps.replaceOne(
    {
        _id : "4d019263-3ff0-4d0e-a48a-5b3d877038dc"
    },
    {
        _id : "4d019263-3ff0-4d0e-a48a-5b3d877038dc",
        consumer_secret : "4222fddd-64b6-4452-b24e-23caae9ccc08",
        name : "Aggregator",
        description : "Aggregator for testing",
        developer : {
            email : "jeandupont@demoapp.com",
            name : "Jean Dupont Developer"
        },
        status : "active",
        grants : [
            {
                grant_type : "basic",
                scopes : [
                    "admin:apps:create"
                ]
            }
        ]
    },
    {
        upsert: true
    }
);
