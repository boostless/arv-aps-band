FROM node:22-alpine AS builder
RUN apk add --no-cache libc6-compat

WORKDIR /arv-aps

COPY package.json package-lock.json ./

# More reliable npm in CI/build containers
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm config set fund false \
 && npm config set audit false \
 && npm ci --prefer-offline --no-progress

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

RUN apk add --no-cache curl

WORKDIR /arv-aps

COPY --from=builder /arv-aps/.output /arv-aps/.output
COPY --from=builder /arv-aps/package.json /arv-aps/package.json

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]