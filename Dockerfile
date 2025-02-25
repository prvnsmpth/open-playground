FROM node:23-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json .
RUN npm install

FROM node:23-alpine AS builder
ARG BUILD_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY . .
RUN npm run build -- --mode ${BUILD_ENV}

FROM node:23-alpine
RUN apk add --update --no-cache python3 && ln -sf python3 /usr/bin/python
WORKDIR /app
COPY package.json package-lock.json .
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
ENTRYPOINT [ "node", "build" ]

