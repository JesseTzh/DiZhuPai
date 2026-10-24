FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY .prettierrc.json ./
COPY scripts ./scripts
COPY src ./src
RUN npm run build

FROM nginx:stable-alpine

COPY --from=build /app/dist/ /usr/share/nginx/html/

EXPOSE 80
