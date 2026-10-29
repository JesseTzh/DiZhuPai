FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY .prettierrc.json ./
COPY scripts ./scripts
COPY src ./src
ARG BUILD_SHA=0000000
ARG BUILD_CHANNEL=prod
RUN BUILD_SHA="$BUILD_SHA" BUILD_CHANNEL="$BUILD_CHANNEL" npm run build

FROM nginx:stable-alpine

COPY --from=build /app/dist/ /usr/share/nginx/html/

EXPOSE 80
