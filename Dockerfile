ARG NODE_IMAGE=mirror.gcr.io/library/node:20-alpine
FROM ${NODE_IMAGE}
WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm install --no-audit --prefer-offline --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
