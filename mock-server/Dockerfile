# --- Build stage ---
FROM node:20-alpine AS build

WORKDIR /app/mock-server

# Install dependencies first (better layer caching)
COPY mock-server/package.json mock-server/package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY mock-server/tsconfig.json ./
COPY mock-server/src/ ./src/
RUN npm run build

# --- Production stage ---
FROM node:20-alpine

LABEL org.opencontainers.image.source="https://github.com/christopherhouse/Api-Specs"
LABEL org.opencontainers.image.description="Mock API server for Api-Specs — serves realistic mock data for OpenAPI, GraphQL, RAML, WADL, and SOAP specs"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Copy built mock-server
COPY --from=build /app/mock-server/dist ./mock-server/dist/
COPY mock-server/package.json mock-server/package-lock.json ./mock-server/

# Install production dependencies only
WORKDIR /app/mock-server
RUN npm ci --omit=dev --ignore-scripts

# Copy scenarios (the API specs)
WORKDIR /app
COPY scenarios/ ./scenarios/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

WORKDIR /app/mock-server
CMD ["node", "dist/server.js"]
