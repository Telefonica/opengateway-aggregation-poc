#!/bin/bash

mongo mongodb:27017/authserver-telefonica --quiet app.js

mongo mongodb:27017/authserver-vodafone --quiet app.js

mongo mongodb:27017/aggregator-telco-router-1 --quiet routerApp.js

mongo mongodb:27017/aggregator-telco-router-2 --quiet routerApp.js
