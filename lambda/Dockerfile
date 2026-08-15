FROM node:20-slim

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY index.js .
COPY global-bundle.pem .

ENV NODE_ENV=production

CMD ["node", "index.js"]