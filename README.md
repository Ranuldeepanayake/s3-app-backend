# s3-app-backend

A simple Node.js + Express CRUD API for uploading, viewing, updating, and deleting images in AWS S3.

## Features
- Upload image files to S3
- Store image metadata in MongoDB (ID, file name, size, timestamp)
- Generate signed URLs for image access
- Update or replace existing image records
- Delete image records and objects from S3

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the sample environment file:
   ```bash
   cp .env.example .env
   ```
3. Fill in your MongoDB and AWS credentials in `.env`.
4. Start the server:
   ```bash
   npm run dev
   ```

## Docker Setup
Build the image:
```bash
docker build -t s3-app-backend .
```

Run the container:
```bash
docker run -p 3000:3000 \
  --env-file .env \
  s3-app-backend
```

## Logging
The server logs:
- every incoming request method and path
- database connection status
- upload/update/delete errors
- startup failures

## API Endpoints
- `POST /api/images` — upload an image (`multipart/form-data` with field `image`)
- `GET /api/images` — list all images
- `GET /api/images/:id` — get one image record and signed URL
- `PUT /api/images/:id` — update metadata or replace the image
- `DELETE /api/images/:id` — delete the image from S3 and MongoDB
