# ---- 前端构建(剧场版 v1 + 导演剪辑版 v2) ----
FROM node:22-alpine AS web
WORKDIR /build
COPY web/package.json web/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY web/ ./
RUN npm run build
COPY web-v2/package.json web-v2/package-lock.json* /v2/
WORKDIR /v2
RUN npm install --no-audit --no-fund
COPY web-v2/ /v2/
RUN npm run build

# ---- 运行时(纯 JS 依赖,免编译) ----
FROM node:22-alpine
ENV NODE_ENV=production DATA_DIR=/data PORT=8080 NODE_OPTIONS=--no-warnings
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server/src ./src
COPY --from=web /v2/dist ./web-v2/dist
COPY --from=web /build/dist ./web/dist
VOLUME /data
EXPOSE 8080
CMD ["node", "src/index.js"]
