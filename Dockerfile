# CLOUDFLARE-ALLOWME

FROM node:alpine

WORKDIR /app
ENV NODE_ENV=production
ADD . /
RUN npm install --production

EXPOSE 8080
CMD ["npm", "start"]
