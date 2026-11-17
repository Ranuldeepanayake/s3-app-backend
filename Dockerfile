FROM node:24-alpine

# Keep application files in one predictable container directory.
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

# The upload handler writes temporary files under src/tmp; prepare that path for
# the unprivileged runtime user before dropping root privileges.
RUN mkdir -p /usr/src/app/src/tmp \
    && chown -R node:node /usr/src/app/src/tmp

#Run tests only if enabled.
RUN if [ "$RUN_TESTS" = "true" ]; then \
      echo "Running tests..."; \
      npm run test:coverage; \
    fi

#Listening port metadata.
EXPOSE 3100

# Probe the cheap root endpoint so external dependency outages do not cause the
# container runtime to restart an API that intentionally supports degraded mode.
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3100/', response => process.exit(response.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Run the API without container root privileges.
USER node
CMD ["npm", "start"]
