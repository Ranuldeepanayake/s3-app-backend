FROM node:24-alpine

RUN apk update

RUN apk add --no-cache curl bash busybox-extras

# WORKDIR /tmp

# RUN curl -LO mongosh https://downloads.mongodb.com/compass/mongosh-2.2.12-linux-x64.tgz

# RUN tar -xzf mongosh-2.2.12-linux-x64.tgz

# RUN cd mongosh*

# RUN mv ./bin/mongosh /usr/local/bin/

# RUN chmod +x /usr/local/bin/mongosh

# RUN mongosh --version

WORKDIR /app

COPY package*.json ./

#To read envs from the config file.
#COPY .env .

COPY . .

RUN npm install

EXPOSE 3100

CMD ["npm", "start"]
