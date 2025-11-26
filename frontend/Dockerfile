# frontend/Dockerfile

# 1. Сборка Vite + React
FROM node:22-alpine AS build

WORKDIR /app

# сначала зависимости
COPY package.json package-lock.json* ./
RUN npm install

# потом код
COPY . .
RUN npm run build

# 2. Лёгкий nginx для раздачи статических файлов
FROM nginx:1.27-alpine

# копируем собранный фронт
COPY --from=build /app/dist /usr/share/nginx/html

# (по умолчанию nginx.conf и так отдаёт index.html на /)

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
