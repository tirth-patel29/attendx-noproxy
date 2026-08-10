# Attendance Admin Dashboard (multi-stage)
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage: nginx to serve static files.
# /etc/nginx/templates/*.template is envsubst-rendered by the official nginx
# entrypoint, so BACKEND_UPSTREAM is the only deployment knob.
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]