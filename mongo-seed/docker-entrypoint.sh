#!/bin/bash

mongo mongodb:27017/authserver-telefonica --quiet app.js

mongo mongodb:27017/authserver-vodafone --quiet app.js
