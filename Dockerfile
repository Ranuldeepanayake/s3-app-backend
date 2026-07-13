FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

<<<<<<< HEAD
COPY server.js ./
COPY config ./config
COPY models ./models
COPY routes ./routes
=======
COPY . .

RUN npm install
>>>>>>> parent of 85dc14c (Mongodb connection works)

ENV PORT=3100

EXPOSE 3100

CMD ["npm", "start"]
