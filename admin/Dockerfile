# Attendance Admin Dashboard (multi-stage)
FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL=https://api.atmyhome.tech/api/v1
ENV VITE_API_URL=$VITE_API_URL
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage: nginx to serve static files.
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]