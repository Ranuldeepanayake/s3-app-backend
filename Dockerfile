FROM node:24-alpine

#Change the working directory.
WORKDIR /usr/src/app

ENV NODE_ENV=production

#Build argument (default false).
ARG RUN_TESTS=false

#Copy package manifests first for cached installs.
COPY package.json ./
COPY package-lock.json* ./

#RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

#Install dependencies (include devDependencies if tests are enabled).
RUN if [ "$RUN_TESTS" = "true" ]; then \
      echo "Installing all dependencies (including dev)"; \
      npm ci; \
    else \
      echo "Installing production dependencies only"; \
      npm ci --omit=dev; \
    fi

COPY src ./
COPY test ./

#Run tests only if enabled.
RUN if [ "$RUN_TESTS" = "true" ]; then \
      echo "Running tests..."; \
      npm test; \
    fi

#Listening port metadata.
EXPOSE 3100

#Run process.
CMD ["npm", "start"]
