# s3-app-backend

A Node.js + Express API for uploading, listing, updating, and deleting images stored in AWS S3, with MongoDB metadata and signed URL support.

## Features
- Upload images to an S3 bucket
- Store image metadata in MongoDB
- Generate signed URLs for image access
- Replace existing images in S3 during updates
- Delete image metadata and S3 objects
- Use a temporary directory for upload handling instead of in-memory buffering
- Log request, database, S3, and route activity with timestamps

## Prerequisites
- Node.js 18+
- Docker (optional)
- MongoDB instance
- AWS credentials with access to an S3 bucket

## Environment Variables
Copy the sample file and update it:

```bash
cp .env.example .env
```

Required values in `.env`:

```env
PORT=3100
MONGODB_URI=mongodb://mongo:27017/s3-app
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_BUCKET_NAME=your-bucket-name
AWS_URL_EXPIRATION=3600
```

## Local Development
Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm run dev
```

The app will:
- connect to MongoDB
- test S3 access for the configured bucket
- start the API on port 3000

## Frontend Setup
A simple React frontend is available in the sibling directory [s3-app-frontend](../s3-app-frontend). To run it locally:

```bash
cd ../s3-app-frontend
npm install
npm run dev
```

The frontend expects the backend at `http://localhost:3300` and uses the existing image API endpoints for listing, viewing, uploading, updating, and deleting images.

## Docker Setup
Build the image:

```bash
docker build -t s3-app-backend .
```

Run the container with your environment file:

```bash
docker run -p 3100:3100 --env-file .env s3-app-backend
```

You can also use Docker Compose:

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

## API Endpoints
- `POST /api/images` — upload an image (`multipart/form-data`, field name: `image`)
- `GET /api/images` — list all images with signed URLs
- `GET /api/images/:id` — get one image record and its signed URL
- `PUT /api/images/:id` — replace the image in S3 and update metadata
- `DELETE /api/images/:id` — delete the image from S3 and MongoDB

## Notes
- Uploaded files are stored temporarily on disk in the `tmp` directory before being sent to S3.
- The app uses a 5 MB upload size limit for image files.
- Signed URLs are generated with the configured expiration time.
