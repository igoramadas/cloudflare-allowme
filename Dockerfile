# CLOUDFLARE-ALLOWME

FROM oven/bun:alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json bun.lock* ./
RUN bun install --production --frozen-lockfile
COPY src ./src
EXPOSE 8080
CMD ["bun", "src/index.ts"]
