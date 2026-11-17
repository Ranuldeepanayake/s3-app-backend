# s3-app-backend

Express API for uploading, listing, updating, and deleting images in AWS S3, with MongoDB metadata, PostgreSQL-backed login, JWT-protected admin actions, CloudFront render URLs, and health checks for container deployments.

## What It Does

- Accepts image uploads through `multipart/form-data`
- Stores image files in an S3 bucket
- Stores image metadata in MongoDB
- Returns CloudFront URLs when images are listed or fetched
- Replaces existing S3 objects during image updates
- Deletes individual images or, with authentication, all images
- Uses disk-based temporary upload handling instead of in-memory buffers
- Validates login credentials from PostgreSQL
- Reports MongoDB, PostgreSQL, and S3 health through live and ready endpoints
- Logs request, database, S3, route, and startup activity with timestamps

## Project Structure

```text
src/server.js                 Express app, middleware, routes, startup flow
src/config/                   Database, AWS, logging, proxy, rate limit, and CORS configuration
src/models/                   Mongoose models
src/routes/                   Authentication and image API routes
src/services/                 Background PostgreSQL traffic utility
test/                         Jest unit and route tests
database/                     PostgreSQL bootstrap SQL
legacy/                       Older implementation kept for reference
.agent/session-summary.md     Agent handoff checkpoint
```

## Architecture and data flow

Express applies request IDs, CORS origin enforcement, and API rate limits before
dispatching routes. Login verifies credentials with a parameterized PostgreSQL
query and returns a JWT. Image routes validate uploads, stage files under
`src/tmp`, store image bytes in S3, and persist metadata in MongoDB; responses
derive display URLs from the configured CloudFront domain. Health endpoints
report MongoDB, PostgreSQL, and S3 availability. PostgreSQL IAM tokens are
generated for each new pooled connection.

## Requirements

- Node.js 22+ for local development (the Docker image uses Node.js 24)
- npm (ships with Node.js)
- MongoDB
- AWS access keys with access to the target S3 bucket
- An EKS Pod Identity Association whose IAM role can connect to RDS
- An RDS PostgreSQL instance with IAM database authentication enabled
- Docker, optional

The Docker image uses `node:24-alpine`.

## Environment

Copy the sample file, then replace the placeholder values:

```bash
cp .env.example .env
```

Required and commonly used values:

```env
HOST=0.0.0.0
PORT=3100
MONGODB_URI=mongodb://127.0.0.1:27017/s3-app
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_BUCKET_NAME=your-bucket-name
AWS_CLOUDFRONT_DOMAIN_NAME=your-distribution.cloudfront.net
MAX_IMAGE_SIZE_BYTES=5242880
DB_HOST=your-rds-endpoint.region.rds.amazonaws.com
DB_PORT=5432
DB_USERNAME=s3_app_user
DB_NAME=s3-app
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT_MS=30000
DB_CONNECTION_TIMEOUT_MS=5000
JWT_SECRET=change-me
JWT_EXPIRATION=12h
TRUST_PROXY=1
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3300
```

S3 uses `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. For RDS only, configure an EKS Pod Identity Association for the service account; its IAM role needs `rds-db:connect` for the RDS database user.

`DB_HOST`, `DB_PORT`, `DB_USERNAME`, and `DB_NAME` identify the authentication database. The application requests a new RDS IAM token every time the PostgreSQL pool opens a new connection, so tokens are never reused for newly created clients. TLS certificate verification is required.

Run [database/postgres-bootstrap.sql](/C:/Users/ranul/Documents/GitHub/s3-app-backend/database/postgres-bootstrap.sql) with an RDS PostgreSQL administrator using `psql`; it creates the `s3_app_user` IAM database user, the `s3-app` database, its public-schema privileges, and the minimalist `app_users` login table. The script intentionally does not insert a default account. Add the first account through an approved administrative process. The requested `password` column is plaintext; this is unsafe for a production service and should be changed to a password hash when that database contract can be revised.

Set `TRUST_PROXY=1` when running behind a Kubernetes ingress, reverse proxy, or load balancer so Express and `express-rate-limit` can use forwarded client IP headers correctly. Leave it unset or `false` only for direct local development without a proxy.

`CORS_ALLOWED_ORIGINS` is a comma-separated allowlist of exact browser origins, including scheme and port when present (for example, `https://app.example.com,https://admin.example.com`). The defaults include `http://localhost:3000` and `http://localhost:3300` for local frontend development and Docker Compose. Set this value explicitly for production; do not use `*`. Requests with a disallowed `Origin` receive `403`, and preflight requests are limited to the API's supported methods and headers. Requests without an `Origin` header continue through the normal API controls. CORS does not replace authentication or authorize non-browser clients.

## Local Development

Install dependencies:

```bash
npm install
```

Start the API with reloads:

```bash
npm run dev
```

Or start it normally:

```bash
npm start
```

By default the API listens on `http://localhost:3100`. If your `.env` overrides `PORT`, use that port instead.

On startup the app connects to MongoDB, probes S3, and probes RDS PostgreSQL with three bounded retries. The HTTP server still starts when S3 or PostgreSQL is unavailable so the health endpoints can report a degraded state. PostgreSQL queries use a connection pool and each health probe executes `SELECT 1`.

## Docker
Build and run the backend image. The container runs as the unprivileged `node`
user and reports health through its `/` endpoint.

```bash
docker build -t s3-app-backend .
docker run -p 3100:3100 --env-file .env s3-app-backend
```

View application logs and container health:

```bash
docker logs -f s3-app-backend
docker inspect --format='{{.State.Health.Status}}' s3-app-backend
```

Use Docker Compose (builds and deploys both the backend and frontend):

```bash
docker compose up -d --build
```

Stop local services with `docker compose down`. Uploaded temporary files are
ephemeral; durable image bytes live in S3 and metadata lives in MongoDB.

### Deployment and rollback

Build and publish a version-tagged image through the deployment pipeline, then
update the deployment to that tag. Keep the prior known-good image tag so a
rollback can restore it. For local Compose deployments, retain the previous
image or source revision, then rebuild and restart it with
`docker compose up -d --build`. Verify the root endpoint, API health endpoints,
logs, and frontend-to-API CORS origin configuration after deployment. Rollback
does not reverse database changes; review database compatibility separately.

## Kubernetes
If deploying on kubernetes, the below secrets must be created with the appropriate values.

# The below secret includes general environment variables required by the service.
kubectl create secret generic app-credentials \
  --namespace= \
  --from-literal=AWS_ACCESS_KEY_ID= \
  --from-literal=AWS_BUCKET_NAME= \
  --from-literal=AWS_REGION= \
  --from-literal=AWS_SECRET_ACCESS_KEY= \
  --from-literal=JWT_SECRET= \
  --from-literal=MONGODB_URI=	\
  --from-literal=DB_HOST= \
  --from-literal=DB_PORT= \
  --from-literal=DB_USERNAME= \
  --from-literal=DB_NAME=

# The below secret is required if the RDS connection uses TLS which needs the AWS RDS CA bundle.  
kubectl create secret generic rds-ca-bundle --from-file=rds-ca-bundle.pem=./aws-rds-ca.pem -n s3-app-dev

# The below secret is only required if the Kubernetes cluster does not have access to the relevant ECR repositories and the ECR token generation
# Kubernetes cron job is enabled.
kubectl create secret generic aws-ecr-credentials \
  --namespace= \
  --from-literal=AWS_ACCESS_KEY_ID= \
  --from-literal=AWS_SECRET_ACCESS_KEY= \
  --from-literal=AWS_REGION= \
  --from-literal=AWS_ACCOUNT_ID= \
  --from-literal=AWS_ECR_SECRET_NAME= \
  --from-literal=SECRET_NAMESPACE=

## Logging and troubleshooting

`src/config/logger.js` writes one JSON record per line to stdout or stderr. Each
record includes an ISO-8601 UTC `timestamp`, `level`, `service`, `component`,
`event`, `message`, and optional structured `metadata`. HTTP completion records
include a generated request ID, method, route path without query parameters,
status, and duration. The response carries the same ID in `X-Request-Id`.
Sensitive metadata keys and common inline bearer or connection-string
credentials are redacted centrally. Never add credentials, authorization
headers, passwords, or raw request bodies to log metadata.

Levels are `info` for routine lifecycle activity, `warn` for rejected or
degraded operations, and `error` for unexpected failures. Components identify
subsystems such as `HTTP`, `STARTUP`, `MONGO`, `POSTGRES`, `S3`, `ROUTES`,
`HEALTH`, `AUTH`, and `CORS`. Startup records include non-secret configuration
and dependency outcomes; readiness is logged once the listener is active.

Read local logs directly in the terminal, or use `docker logs -f
s3-app-backend` for a container. In Kubernetes, use `kubectl logs -f` for the
backend pod and filter JSON fields with the cluster log collector. When
troubleshooting a request, search by the response's `X-Request-Id`; inspect
`component`, `event`, `status`, `durationMs`, and dependency metadata. CORS
rejections include the rejected origin and method, but no request path or payload.

The service handles `SIGINT` and `SIGTERM` by stopping background PostgreSQL
traffic, closing the HTTP listener, MongoDB, and the PostgreSQL pool, then
logging cleanup results. The protected restart endpoint uses the same cleanup
path.

There is no dedicated lint or format script configured in `package.json`.
Run `npm test` for the Jest suite. Common failures include an unlisted browser
origin (set `CORS_ALLOWED_ORIGINS`), missing database or AWS configuration,
unavailable external dependencies, and an unreadable RDS CA bundle.

## Authentication

Log in with a username and plaintext password stored in `public.app_users`:

```bash
curl -X POST http://localhost:3100/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
```

Use the returned token for protected routes:

```bash
Authorization: Bearer <token>
```

Protected routes include `GET /api/health/ready`, `GET /api/auth/test-protected`, and `DELETE /api/images/delete-all`.

## API Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/` | No | Basic API information |
| `POST` | `/api/auth/login` | No | Create a JWT from PostgreSQL credentials |
| `GET` | `/api/auth/test-protected` | Yes | Confirm JWT authentication works |
| `GET` | `/api/health/live` | No | Check MongoDB and S3 dependency health |
| `GET` | `/api/health/ready` | Yes | Check dependency health plus container/AWS details |
| `POST` | `/api/images` | No | Upload an image with form field `image` |
| `GET` | `/api/images` | No | List images with CloudFront URLs |
| `GET` | `/api/images/:id` | No | Fetch one image by Mongo `_id` or public `imageId` |
| `PUT` | `/api/images/:id` | No | Rename metadata and optionally replace the uploaded image |
| `DELETE` | `/api/images/:id` | No | Delete one S3 object and its MongoDB record |
| `DELETE` | `/api/images/delete-all` | Yes | Delete all image records and S3 objects |

## Image Uploads

Uploads use `multer` disk storage. Files are written to a local `tmp` directory, uploaded to S3, then removed from disk after a successful upload. The default upload limit is 5 MB, controlled by `MAX_IMAGE_SIZE_BYTES`.

Only files whose MIME type starts with `image/` are accepted.

The uploaded file's original filename is used as the S3 object key and stored as `fileName`. Uploading or replacing an image with a filename that already exists returns `409` to avoid multiple records pointing at the same CloudFront object.

## CloudFront URLs

The API no longer generates S3 signed URLs. The database stores S3 bucket, key, and `fileName` metadata, and each list or fetch response renders `url` from `AWS_CLOUDFRONT_DOMAIN_NAME` plus the stored filename.

Example:

```json
{
  "fileName": "photo.jpg",
  "url": "https://your-distribution.cloudfront.net/photo.jpg"
}
```

Configure CloudFront so the distribution can read from the S3 bucket and serve objects by filename.

## Health Checks

`GET /api/health/live` returns:

- `200` with `status: "ok"` when MongoDB, PostgreSQL, and S3 are reachable
- `503` with `status: "degraded"` when any dependency is down

`GET /api/health/ready` requires a JWT and adds container hostname, container IP address, AWS region, and bucket name.

## Tests

The project uses Jest. Run the test suite with:

```bash
npm test
```

The current tests verify dependency health behavior, PostgreSQL pool probes,
login handling, CORS origin and preflight enforcement, and logger record shape
and redaction:

- MongoDB health returns `false` when Mongoose is not connected
- S3 health returns `false` when `AWS_BUCKET_NAME` is not configured
- PostgreSQL health returns `false` when required RDS configuration is missing
- Login uses a parameterized PostgreSQL query and returns `503` when RDS is unavailable
- CORS permits allowlisted origins and rejects disallowed origins and preflight capabilities
- Logger records contain structured context and redact common credentials

Install dependencies with `npm install` before running tests in a fresh checkout.

## Frontend

A React frontend is expected in the sibling directory `../s3-app-frontend`. Start it separately and configure it to call this backend, usually `http://localhost:3100` unless you override `PORT`.

## Notes

- Image routes are short-circuited when MongoDB is unavailable to avoid S3 objects without matching metadata.
- `delete-all` continues database cleanup even if individual S3 objects are already missing.
- The `legacy/` directory is an unsupported reference implementation. It is not used by the current Dockerfile or `src/server.js` and must not be deployed as the supported service.
- Store `.env` values in an approved secret manager in deployed environments; `.env` is ignored by Git and excluded from Docker build context.
- `JWT_SECRET` must be a unique high-entropy secret in deployed environments. The example value is only a placeholder.
- Login currently compares plaintext passwords because that is the established PostgreSQL schema; migrate to password hashes before production use.
- CORS is a browser-origin policy and does not replace authentication, network access controls, or authorization.
