# Attendance Portal Dockerfile (multi-stage)
FROM node:20-alpine AS build

WORKDIR /app

# Cache bust argument - changes on every build to force fresh source copy
ARG CACHE_BUST=1

# Copy package files
COPY package*.json ./

# Install ALL deps (prod + dev) for building
RUN npm install

# Copy source
COPY . .

# Compile TypeScript - this layer will re-run when CACHE_BUST changes
RUN npm run build

# Production stage: nginx to serve static files
# The official nginx image auto-substitutes /etc/nginx/templates/*.template
# with env vars at container start -> /etc/nginx/conf.d/default.conf.
# This is the ONLY deployment-specific knob (BACKEND_UPSTREAM), so the same
# image runs on any infrastructure with `docker run -e BACKEND_UPSTREAM=...`.
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]