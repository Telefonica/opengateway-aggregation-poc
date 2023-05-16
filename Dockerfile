FROM node:18.16.0-buster

WORKDIR /apps
ADD ./camara-node-sdk ./camara-node-sdk

WORKDIR /apps/camara-node-sdk
RUN npm install
RUN npm run build
WORKDIR /apps/camara-node-sdk/demo-app
RUN npm install
# needed because ejs is not installed at the first time.
RUN npm install
CMD ["npm", "start"]
