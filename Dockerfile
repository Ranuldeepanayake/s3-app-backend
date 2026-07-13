FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY server.js ./
COPY config ./config
COPY models ./models
COPY routes ./routes

EXPOSE 3100

CMD ["npm", "start"]
