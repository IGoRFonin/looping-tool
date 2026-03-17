# Stage 1: install + build
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/
RUN npm ci
COPY . .
RUN npm run build --workspace=@looping-tool/frontend

# Stage 2: production
FROM node:24-alpine
WORKDIR /app
COPY --from=build /app .
RUN npm ci --omit=dev
EXPOSE 3001
CMD ["npm", "run", "start", "--workspace=@looping-tool/backend"]
