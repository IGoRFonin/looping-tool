# Stage 1: install + build
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn workspace @looping-tool/frontend run build

# Stage 2: production
FROM node:24-alpine
WORKDIR /app
COPY --from=build /app .
RUN yarn install --frozen-lockfile --production
EXPOSE 3001
CMD ["yarn", "workspace", "@looping-tool/backend", "run", "start"]
