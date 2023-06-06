FROM node:18.16.0-buster

WORKDIR /apps
ADD ./camara-node-sdk ./camara-node-sdk

# camara-node-sdk
WORKDIR /apps/camara-node-sdk
RUN npm install
RUN npm run build

# demo-app
WORKDIR /apps/camara-node-sdk/demo-app
RUN npm install

CMD ["npm", "start"]
