# Attendance Backend Dockerfile (multi-stage)
# Build stage: compiles TypeScript with dev deps
FROM node:20-alpine AS build

# Install build tools for native modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL deps (prod + dev) for building
RUN npm install

# Copy source (exclude tests via .dockerignore)
COPY . .

# Compile TypeScript
RUN npm run build

# Production stage: lean runtime
FROM node:20-alpine

ENV NODE_ENV=production
ENV TZ=Asia/Kolkata
RUN apk add --no-cache tzdata && cp /usr/share/zoneinfo/Asia/Kolkata /etc/localtime && echo "Asia/Kolkata" > /etc/timezone
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production deps
RUN npm install --omit=dev && \
    npm cache clean --force

# Copy compiled output + assets
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
# OpenAPI spec for the Swagger UI (/docs)
COPY --from=build /app/openapi.json ./openapi.json

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start
CMD ["node", "dist/index.js"]