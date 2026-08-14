FROM node:20-slim

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY index.js .

ENV NODE_ENV=production

CMD ["node", "index.js"]