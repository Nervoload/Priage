FROM node:20-alpine AS build
ARG APP_DIR
ARG VITE_API_URL=http://localhost:8080
WORKDIR /app
COPY ${APP_DIR}/package.json ${APP_DIR}/package-lock.json ./
RUN npm ci
COPY ${APP_DIR}/ ./
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY infra/dev/frontend-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
