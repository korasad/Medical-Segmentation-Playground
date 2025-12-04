# frontend/Dockerfile

# 1. Сборка Vite + React
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# 2. nginx для раздачи фронта + прокси на бэкенд
FROM nginx:1.27-alpine

# статика
COPY --from=build /app/dist /usr/share/nginx/html

# наш конфиг
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
