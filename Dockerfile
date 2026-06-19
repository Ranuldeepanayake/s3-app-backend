FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

COPY . .

RUN npm install

ENV PORT=3100

EXPOSE 3100

CMD ["npm", "start"]
