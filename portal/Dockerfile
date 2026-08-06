# Attendance Portal Dockerfile (multi-stage)
FROM node:20-alpine AS build

WORKDIR /app

# Cache bust argument - changes on every build to force fresh source copy
ARG CACHE_BUST=1

# Copy package files
COPY package*.json ./

# Install ALL deps (prod + dev) for building
RUN npm install

# Copy source (exclude tests via .dockerignore)
COPY . .

# Compile TypeScript - this layer will re-run when CACHE_BUST changes
RUN npm run build

# Production stage: nginx to serve static files
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]