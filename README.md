# File Service API

Production-grade file upload API with **Redis** token validation and **MinIO** (S3-compatible) storage. Issues presigned upload URLs and supports authenticated delete by object key.

**Documentation for app developers:** [docs/api.md](docs/api.md) – how to use the API (upload flow, public CDN URLs, delete). **For AI / codegen:** [docs/ai-integration.md](docs/ai-integration.md) – canonical integration guide (endpoints, schemas, auth, steps). The API serves interactive docs (Swagger UI) at **`/docs`** and the OpenAPI spec at **`/docs/openapi.yaml`**.

---

## Features

- **Presigned upload URLs** – Clients get a time-limited PUT URL to upload directly to MinIO (no file through the API).
- **Token-based auth** – `Authorization: Bearer <token>` validated against Redis; token payload must include `userId`, `appId`, and `expiresAt`.
- **Per-app buckets** – Buckets derived from `MINIO_BUCKET_PREFIX` and `appId`; optional auto-creation.
- **Rate limiting** – Configurable limit on `POST /api/files/upload-url` requests per window.
- **Path safety** – Sanitized file names and folder segments; object keys scoped to user for delete.

---

## Requirements

- **Node.js** ≥ 20.6.0
- **Redis** (token store)
- **MinIO** or any S3-compatible storage

---

## Quick start

### 1. Install and env

```bash
npm install
cp .env.example .env
# Edit .env: REDIS_HOST, REDIS_PORT, MINIO_* and optionally limits/MIME types
```

### 2. Run Redis + MinIO locally (optional)

```bash
docker compose up -d
```

Uses defaults in `.env.example` (e.g. `REDIS_HOST=localhost`, `MINIO_ENDPOINT=localhost`).

### 3. Start the server

```bash
npm run dev
```

Server listens on `PORT` (default `3000`). Health: `GET http://localhost:3000/health`.

---

## How to use the API

### Context

- **API base**: `https://files.nbericmmsu.com` (production) or `http://localhost:3000` (local).
- **Public files**: Uploaded files are served from `https://cdn.nbericmmsu.com` (CDN). Use the `objectKey` from the API to build the public URL.
- **Auth**: Your app must obtain a Bearer token from your auth system. The file service validates it via Redis; the token payload must include `userId`, `appId`, and `expiresAt`.

### Steps to upload a file

1. **Request a presigned URL** – `POST /api/files/upload-url` with `Authorization: Bearer <token>` and body `{ "fileName": "photo.png", "contentType": "image/png", "folder": "avatars" }`.
2. **Upload the file** – Send a **PUT** request to the returned `uploadUrl` with the file as body and `Content-Type` set to the same `contentType`. The file goes directly to storage, not through the API.
3. **Store the objectKey** – Save the returned `objectKey` in your DB. Use it to build the public URL (`https://cdn.nbericmmsu.com/<bucket>/<objectKey>`) or to delete the file later.

### Steps to delete a file

1. **Call delete** – `DELETE /api/files/{objectKey}` with `Authorization: Bearer <token>`. The `objectKey` must be **URI-encoded** (e.g. slashes as `%2F`).
2. **Ownership** – The object must belong to the authenticated user (key format: `[folder/]userId/timestamp_fileName`). Otherwise you get `403 Access denied`.

### Interactive docs

- **Swagger UI**: `https://files.nbericmmsu.com/docs` (or `/docs` on your deployment).
- **Full guide**: [docs/api.md](docs/api.md).

---

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | HTTP port (default `3000`) |
| `REDIS_HOST` | **Yes** | Redis host |
| `REDIS_PORT` | No | Redis port (default `6379`) |
| `REDIS_PASSWORD` | No | Redis password if needed |
| `MINIO_ENDPOINT` | **Yes** | MinIO/S3 host |
| `MINIO_PORT` | No | MinIO API port (default `9000`) |
| `MINIO_ACCESS_KEY` | **Yes** | MinIO access key |
| `MINIO_SECRET_KEY` | **Yes** | MinIO secret key |
| `MINIO_USE_SSL` | No | `true` for HTTPS |
| `MINIO_BUCKET_PREFIX` | No | Bucket name prefix (default `files`) |
| `MAX_UPLOAD_SIZE` | No | Max size in bytes for validation (default `10485760` = 10MB) |
| `ALLOWED_MIME_TYPES` | No | Comma-separated MIME types (see `.env.example`) |
| `AUTO_CREATE_BUCKETS` | No | Create bucket on first use if missing (`true`/`false`) |
| `RATE_LIMIT_UPLOAD_URL_MAX` | No | Max requests per window for upload-url (e.g. `30`) |

---

## API

Base URL: `http://localhost:3000` (or your `PORT`).

### Health

- **GET** `/health`  
  - No auth.  
  - Response: `{ "status": "ok" }`.

### Files (auth required)

All file routes require:

```http
Authorization: Bearer <opaque-token>
```

Token is looked up in Redis under `access:<token>`. Stored value must be JSON with at least:

- `userId` (string)
- `appId` (number)
- `expiresAt` (number, Unix ms)

Optional: `role` (string).

---

#### Create upload URL

- **POST** `/api/files/upload-url`  
  - Rate limited (see `RATE_LIMIT_UPLOAD_URL_MAX`).  
  - Body (JSON):

  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | `fileName` | string | Yes | Original file name (sanitized; path stripped) |
  | `contentType` | string | Yes | MIME type (must be in `ALLOWED_MIME_TYPES`) |
  | `folder` | string | No | Optional single path segment (sanitized) |

  - Response: `{ "uploadUrl": "<presigned PUT URL>", "objectKey": "<key>", "expiresIn": 120 }`.
  - Client uploads the file with **PUT** to `uploadUrl` (e.g. with `Content-Type` set to the same `contentType`). Store `objectKey` for later delete or reference.

---

#### Delete object

- **DELETE** `/api/files/:objectKey`  
  - `objectKey` must be **URI-encoded** (e.g. slashes as `%2F`).  
  - Object must belong to the authenticated user (key pattern: `[folder/]userId/timestamp_fileName`).  
  - Response: `204 No Content` on success.

---

## Project structure

```
├── src/
│   ├── app.js              # Express app, middleware, routes
│   ├── server.js           # HTTP server, graceful shutdown
│   ├── config/
│   │   ├── index.js        # Env-based config (fail fast on missing required)
│   │   ├── redis.js        # Redis client
│   │   └── minio.js        # S3 client + presigner, bucket helper
│   ├── middleware/
│   │   ├── auth.js         # Bearer token validation via Redis
│   │   ├── requestId.js    # Request ID header
│   │   ├── rateLimiter.js  # Upload-URL rate limit
│   │   └── errorHandler.js # Central error and createError()
│   ├── routes/
│   │   └── fileRoutes.js   # POST /upload-url, DELETE /:objectKey
│   ├── services/
│   │   └── fileService.js  # createUploadUrl, deleteObject
│   └── utils/
│       └── sanitize.js     # File name, folder, object key sanitization
├── k8s/                    # Kubernetes manifests (see below)
├── Dockerfile              # Multi-stage Node 20 Alpine
├── docker-compose.yml      # Local MinIO + Redis
├── .env.example
└── package.json
```

---

## Docker

### Run API in Docker

Build and run (ensure Redis and MinIO are reachable, e.g. via host or `docker compose`):

```bash
docker build -t file-service:latest .
docker run --env-file .env -p 3000:3000 file-service:latest
```

### Local MinIO + Redis

```bash
docker compose up -d
```

See `docker-compose.yml` for ports (MinIO API `9000`, console `9001`, Redis `6379`).

---

## Kubernetes

Manifests live in `k8s/`. See **k8s/README.md** for:

- Building/loading image (e.g. `kind`) or pushing to a registry
- Creating the Secret (`MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, optional `REDIS_PASSWORD`)
- Applying ConfigMap, Deployment, Service
- Setting Redis/MinIO endpoints for your cluster (e.g. `REDIS_HOST=redis.redis.svc.cluster.local`)

Quick apply (after Secret and ConfigMap are set):

```bash
kubectl apply -f k8s/configMap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Run production server (`node src/server.js`) |
| `npm run dev` | Run with `--watch` and `--env-file=.env` |

---

## License

See repository license file.
