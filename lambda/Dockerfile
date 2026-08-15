FROM node:20-slim

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY global-bundle.pem .

COPY index.js .

ENV NODE_ENV=production

CMD ["node", "index.js"]