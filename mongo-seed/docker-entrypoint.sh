#!/bin/bash

mongo mongodb:27017/authserver-telefonica --quiet app-provision.js

mongo mongodb:27017/authserver-vodafone --quiet app-provision.js

mongo mongodb:27017/aggregator-telco-router-1 --quiet aggregator-app-provision.js

mongo mongodb:27017/aggregator-telco-router-2 --quiet aggregator-app-provision.js
