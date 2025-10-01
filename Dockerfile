FROM node:18-alpine as builder
WORKDIR /app
COPY indexer yarn.lock ./
# Install build dependencies for native modules like heapdump
RUN apk add --no-cache python3 make g++
RUN rm -rf node_modules && yarn install --frozen-lockfile
RUN npx graphql-codegen
RUN yarn build

FROM node:18-alpine
WORKDIR /app
COPY indexer/package.json indexer/tsconfig.json yarn.lock ./
# Install build dependencies for native modules like heapdump
RUN apk add --no-cache python3 make g++
RUN yarn install --frozen-lockfile
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/config/global-bundle.pem ./dist/config/global-bundle.pem
COPY --from=builder /app/src/kadena-server/config/schema.graphql ./dist/kadena-server/config/schema.graphql
COPY --from=builder /app/src/circulating-coins/ ./dist/circulating-coins/
# Create snapshots directory for heap dumps
RUN mkdir -p /snapshots
EXPOSE 3001

ARG INDEXER_MODE_PARAM
ENV INDEXER_MODE=${INDEXER_MODE_PARAM}
CMD ["sh", "-c", "node -r module-alias/register dist/index.js $INDEXER_MODE"]