FROM node:24-alpine

#Change the working directory.
WORKDIR /usr/src/app

#Build argument (default false).
ARG RUN_TESTS=false

#Copy package manifests first for cached installs.
COPY package.json ./
COPY package-lock.json* ./

#Install dependencies (include devDependencies if tests are enabled).
RUN if [ "$RUN_TESTS" = "true" ]; then \
      echo "Installing all dependencies (including dev)"; \
      npm_config_production=false npm ci; \
    else \
      echo "Installing production dependencies only"; \
      npm ci --omit=dev; \
    fi

#Should be placed here to prevent dev dependencies from being ignored.
ENV NODE_ENV=production

#Copy required source files.
COPY src ./src
COPY test ./test

#Run tests only if enabled.
RUN if [ "$RUN_TESTS" = "true" ]; then \
      echo "Running tests..."; \
      npm run test:coverage; \
    fi

#Listening port metadata.
EXPOSE 3100

#Run process.
CMD ["npm", "start"]
