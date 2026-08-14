FROM node:20-slim
WORKDIR /usr/src/app
COPY package.json .
RUN npm ci --only=production
COPY index.js .
ENV NODE_ENV=production
CMD ["node", "index.js"]
