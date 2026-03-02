# File Service API – Integration Guide for AI

This document is for **AI agents and code generators** that need to implement a client for the File Service API or integrate it into another system. Use it as the single source of truth for endpoints, schemas, auth, and flows.

---

## Base URLs

| Role | URL | Use |
|------|-----|-----|
| API (all requests except file bytes) | `https://files.nbericmmsu.com` | Health, upload-url, delete. |
| Public file reads | `https://cdn.nbericmmsu.com` | GET URL for an uploaded file. Build as `{CDN_BASE}/{bucket}/{objectKey}`. |
| Local dev API | `http://localhost:3000` | Same paths as production. |

---

## Authentication

- **Required for**: `POST /api/files/upload-url`, `DELETE /api/files/{objectKey}`.
- **Not required for**: `GET /health`, and for the presigned PUT (upload) URL — the presigned URL is used without the Bearer token.

**Header (exact):**
```http
Authorization: Bearer <opaque-token>
```

- Token is validated server-side via Redis key `access:<token>`.
- Stored value must be JSON with: `userId` (string), `appId` (number), `expiresAt` (number, Unix milliseconds). Optional: `role` (string).
- If missing/invalid/expired: HTTP 401, body `{ "error": true, "message": "<reason>", "code": 401 }`.

---

## Endpoints Reference

### GET /health

- **Auth:** None.
- **Response:** 200, `{ "status": "ok" }`.

### POST /api/files/upload-url

- **Auth:** Bearer required.
- **Request:** `Content-Type: application/json`, body:

```json
{
  "fileName": "string (required)",
  "contentType": "string (required, see allowed list below)",
  "folder": "string (optional, single path segment)"
}
```

- **Success:** 200, body:

```json
{
  "uploadUrl": "string (presigned PUT URL)",
  "objectKey": "string (use for delete and public URL)",
  "expiresIn": 120
}
```

- **Errors:** 400 (missing/invalid body, content type not allowed), 401 (auth), 429 (rate limit), 503 (Redis/storage).

### PUT &lt;uploadUrl&gt; (upload file)

- **Auth:** None (URL is presigned). Call this from your app after receiving `uploadUrl` from POST /api/files/upload-url.
- **Request:** Body = raw file bytes. Header: `Content-Type` must match the `contentType` sent in the upload-url request.
- **Success:** 200 from storage. After success, persist `objectKey` and use it for public URL and delete.

### DELETE /api/files/{objectKey}

- **Auth:** Bearer required.
- **Path:** `objectKey` must be **URI-encoded** (e.g. `/` → `%2F`). Use the exact key returned from upload-url.
- **Success:** 204, no body.
- **Errors:** 400 (invalid key), 401 (auth), 403 (key not owned by user), 404 (not found), 503 (storage).

### Public file URL (GET)

- **Auth:** None. Served from CDN.
- **Formula:** `https://cdn.nbericmmsu.com/{bucket}/{objectKey}` where `bucket` = `files-app-{appId}` (e.g. `files-app-1`). Use the same `appId` from the token payload when building the URL.

---

## Allowed contentType (upload-url)

Only these MIME types are accepted for `contentType` (case-insensitive; parameters like `; charset=utf-8` are stripped before check):

- `image/jpeg`
- `image/png`
- `image/gif`
- `image/webp`
- `application/pdf`
- `text/plain`
- `application/json`

Any other type → 400 "Content type not allowed".

---

## Error response schema

All error responses are JSON:

```json
{
  "error": true,
  "message": "string",
  "code": number
}
```

| HTTP status | When |
|-------------|------|
| 400 | Missing/invalid body, content type not allowed, invalid object key. |
| 401 | Missing or invalid Bearer token, token expired. |
| 403 | Delete: object key does not belong to authenticated user. |
| 404 | Delete: object not found. |
| 429 | Too many upload-url requests (rate limit). |
| 503 | Redis or storage unavailable. |

---

## objectKey format and encoding

- **Format:** `[folder/]userId/timestamp_fileName` (folder optional). Example: `avatars/user123/1739123456789_profile.png`.
- **Sanitization (server-side):** File names and folder segments are sanitized; path traversal (`..`), null bytes, and unsafe characters are removed.
- **In DELETE:** Send the key **URI-encoded** in the path (e.g. `avatars%2Fuser123%2F1739123456789_profile.png`). Do not send raw slashes in the path segment.

---

## Implementation steps (for AI to generate code)

### Upload flow

1. Call `POST https://files.nbericmmsu.com/api/files/upload-url` with `Authorization: Bearer <token>` and JSON body `{ "fileName", "contentType" [, "folder"] }`. Use an allowed `contentType`.
2. From the response, take `uploadUrl` and `objectKey`. If status is not 200, treat as error (use `message` and `code`).
3. Send `PUT` to `uploadUrl` with body = file bytes and header `Content-Type: <same contentType>`.
4. Persist `objectKey` (and optionally `appId` for public URL). Public URL = `https://cdn.nbericmmsu.com/files-app-{appId}/{objectKey}`.

### Delete flow

1. Take the stored `objectKey` and URI-encode it for use in a path (encode `/` as `%2F`, etc.).
2. Call `DELETE https://files.nbericmmsu.com/api/files/{encodedObjectKey}` with `Authorization: Bearer <token>`.
3. 204 = success; 403/404 = handle as permission or not-found error.

### Health check

- `GET https://files.nbericmmsu.com/health` → 200 and `{ "status": "ok" }` means the service is up.

---

## Summary table

| Action | Method | URL | Auth | Request body | Response |
|--------|--------|-----|------|--------------|----------|
| Health | GET | /health | No | — | 200 `{ status: "ok" }` |
| Get upload URL | POST | /api/files/upload-url | Bearer | JSON `fileName`, `contentType`, optional `folder` | 200 `{ uploadUrl, objectKey, expiresIn }` |
| Upload file | PUT | *(uploadUrl from above)* | No | Raw file bytes, Content-Type header | 200 |
| Public file | GET | cdn.nbericmmsu.com/{bucket}/{objectKey} | No | — | File bytes |
| Delete file | DELETE | /api/files/{encodedObjectKey} | Bearer | — | 204 |

---

## OpenAPI spec

For codegen or tooling, the canonical OpenAPI 3 spec is at `https://files.nbericmmsu.com/docs/openapi.yaml` or in-repo `docs/openapi.yaml`. This markdown is the human/AI-oriented summary; the OpenAPI spec is authoritative for schema details.
