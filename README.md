# s3-app-backend

Express API for uploading, listing, updating, and deleting images in AWS S3, with MongoDB metadata, JWT-protected admin actions, CloudFront render URLs, and health checks for container deployments.

## What It Does

- Accepts image uploads through `multipart/form-data`
- Stores image files in an S3 bucket
- Stores image metadata in MongoDB
- Returns CloudFront URLs when images are listed or fetched
- Replaces existing S3 objects during image updates
- Deletes individual images or, with authentication, all images
- Uses disk-based temporary upload handling instead of in-memory buffers
- Reports MongoDB and S3 health through live and ready endpoints
- Logs request, database, S3, route, and startup activity with timestamps

## Project Structure

```text
server.js              Express app, middleware, health routes, startup flow
config/db.js           MongoDB connection and health helper
config/s3.js           AWS S3 client and bucket health helper
config/logger.js       Timestamped console logger
models/Image.js        Mongoose schema for image metadata
routes/authRoutes.js   Login route and JWT middleware
routes/imageRoutes.js  Image CRUD routes and S3 operations
test/                  Node test runner checks
legacy/                Older implementation kept for reference
```

## Requirements

- Node.js 18+ for local development
- MongoDB
- AWS credentials with access to the target S3 bucket
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
AUTH_USERNAME=admin
AUTH_PASSWORD=admin123
JWT_SECRET=change-me
JWT_EXPIRATION=12h
```

Change `AUTH_USERNAME`, `AUTH_PASSWORD`, and `JWT_SECRET` before using the API outside local development.

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

On startup the app connects to MongoDB, checks access to the configured S3 bucket, and starts the HTTP server. If S3 is unavailable, startup continues and the health endpoints report a degraded state.

## Docker

Build the image:

```bash
docker build -t s3-app-backend .
```

Run with your environment file:

```bash
docker run -p 3100:3100 --env-file .env s3-app-backend
```

Or use Docker Compose:

```bash
docker compose up --build
```

## Logging

The application logs timestamped messages with component labels such as:

- `HTTP` for incoming requests and errors
- `STARTUP` for app initialization
- `MONGO` for database connectivity
- `S3` for bucket connectivity checks
- `ROUTES` for image upload, update, delete, and temp-file operations
- `HEALTH` for healthcheck failures
- `API` for request guards such as database availability

## Authentication

Log in with the configured username and password:

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
| `POST` | `/api/auth/login` | No | Create a JWT from configured credentials |
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

- `200` with `status: "ok"` when MongoDB and S3 are reachable
- `503` with `status: "degraded"` when either dependency is down

`GET /api/health/ready` requires a JWT and adds container hostname, container IP address, AWS region, and bucket name.

## Tests

The project uses Node.js' built-in test runner, so no separate test framework is required. Run the test suite with:

```bash
npm test
```

That command runs:

```bash
node --test
```

The current tests live in `test/healthcheck.test.js` and verify dependency health behavior:

- MongoDB health returns `false` when Mongoose is not connected
- S3 health returns `false` when `AWS_BUCKET_NAME` is not configured

Install dependencies with `npm install` before running tests in a fresh checkout.

## Frontend

A React frontend is expected in the sibling directory `../s3-app-frontend`. Start it separately and configure it to call this backend, usually `http://localhost:3100` unless you override `PORT`.

## Notes

- Image routes are short-circuited when MongoDB is unavailable to avoid S3 objects without matching metadata.
- `delete-all` continues database cleanup even if individual S3 objects are already missing.
- The `legacy/` directory contains an older implementation and is not used by the current Dockerfile or `server.js`.
