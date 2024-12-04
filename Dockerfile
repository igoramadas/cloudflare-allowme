# CLOUDFLARE-ALLOWME

# BUILDER
FROM node:alpine AS allowme-builder
WORKDIR /app
COPY . .
RUN npm install --prefer-online && npm run build

# FINAL
FROM node:alpine AS allowme-final
WORKDIR /app
ENV NODE_ENV=production
COPY . .
COPY --from=strautomator-web-builder ./app/lib ./lib
RUN npm install --production
EXPOSE 8080
CMD ["npm", "start"]
