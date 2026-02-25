# File Service API – Developer Guide

How your app uses the file service: **upload**, **public URLs**, and **delete**.

**Interactive API docs (Swagger UI)** are served by the API at **[https://files.nbericmmsu.com/docs](https://files.nbericmmsu.com/docs)** (or `http://localhost:3000/docs` locally). The OpenAPI spec is at `/docs/openapi.yaml`.

---

## Deployment URLs

| Purpose | URL | Use |
|--------|-----|-----|
| **API (main)** | `https://files.nbericmmsu.com` | All API calls: get upload URL, delete file, health. |
| **Public files (CDN)** | `https://cdn.nbericmmsu.com` | Base URL for **reading** uploaded files (e.g. in `<img>`, download links). |

Your app talks to **files.nbericmmsu.com** for auth and operations; users and browsers load actual file bytes from **cdn.nbericmmsu.com**.

---

## Authentication

File operations (upload URL, delete) require a Bearer token:

```http
Authorization: Bearer <your-opaque-token>
```

- The token is validated against Redis (`access:<token>`).
- Stored payload must include: `userId` (string), `appId` (number), `expiresAt` (Unix ms). Optional: `role`.
- If the token is missing, invalid, or expired, the API returns `401` with `{ "error": true, "message": "...", "code": 401 }`.

You obtain tokens from your own auth system; the file service only validates them.

---

## Upload flow (3 steps)

### 1. Request a presigned URL

**POST** `https://files.nbericmmsu.com/api/files/upload-url`

**Headers**

- `Content-Type: application/json`
- `Authorization: Bearer <token>`

**Body**

```json
{
  "fileName": "profile.png",
  "contentType": "image/png",
  "folder": "avatars"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `fileName` | Yes | Original file name (path stripped, sanitized). |
| `contentType` | Yes | MIME type; must be in the [allowed list](#allowed-file-types). |
| `folder` | No | Optional segment (e.g. `avatars`, `documents`). Sanitized. |

**Success (200)**

```json
{
  "uploadUrl": "https://...",
  "objectKey": "avatars/user123/1739123456789_profile.png",
  "expiresIn": 120
}
```

- `uploadUrl` – use in step 2 (PUT the file here).
- `objectKey` – save this for delete and for building the public URL (step 3).
- `expiresIn` – seconds until `uploadUrl` expires (e.g. 120).

### 2. Upload the file to the presigned URL

From your **frontend or backend**, send a **PUT** request to `uploadUrl` with:

- **Body**: raw file bytes.
- **Header**: `Content-Type: <same as contentType in step 1>`.

Example (browser):

```javascript
const file = document.querySelector('input[type="file"]').files[0];
const { uploadUrl, objectKey, expiresIn } = await (await fetch('https://files.nbericmmsu.com/api/files/upload-url', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    fileName: file.name,
    contentType: file.type,
    folder: 'avatars',
  }),
})).json();

await fetch(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': file.type },
  body: file,
});
// Store objectKey in your DB for this user/record
```

The file never goes through your app server; it goes straight to storage.

### 3. Public URL for the file

To show or download the file, use the **CDN** base and the stored `objectKey` (and bucket if your CDN uses it). Bucket names are `files-app-<appId>`.

**Public file URL pattern:**

```
https://cdn.nbericmmsu.com/<bucket>/<objectKey>
```

Example:

- `objectKey`: `avatars/user123/1739123456789_profile.png`
- `appId`: `1` → bucket: `files-app-1`
- Public URL: `https://cdn.nbericmmsu.com/files-app-1/avatars/user123/1739123456789_profile.png`

*(If your CDN is configured with a different path, use that; the important part is using **cdn.nbericmmsu.com** for public reads and **objectKey** from the API.)*

---

## Delete flow

**DELETE** `https://files.nbericmmsu.com/api/files/{objectKey}`

- **Header**: `Authorization: Bearer <token>`
- `objectKey` must be **URI-encoded** (e.g. slashes as `%2F`). Use the same key you saved from the upload response.

Example:

```http
DELETE https://files.nbericmmsu.com/api/files/avatars%2Fuser123%2F1739123456789_profile.png
Authorization: Bearer <token>
```

- **204** – deleted.
- **403** – key does not belong to the authenticated user.
- **404** – object not found.

---

## Allowed file types

Default allowed `contentType` values:

- `image/jpeg`
- `image/png`
- `image/gif`
- `image/webp`
- `application/pdf`
- `text/plain`
- `application/json`

If you send a type not in the allowlist, the upload-url request returns **400** “Content type not allowed”.

---

## Error format

All error responses are JSON:

```json
{
  "error": true,
  "message": "Human-readable message",
  "code": 401
}
```

| HTTP status | Typical cause |
|-------------|----------------|
| 400 | Missing/invalid body, content type not allowed, invalid object key. |
| 401 | Missing or invalid Bearer token, token expired. |
| 403 | Object key does not belong to the user (delete). |
| 404 | Object not found (delete). |
| 429 | Too many upload-url requests (rate limit). |
| 503 | Redis or storage temporarily unavailable. |

---

## Quick reference

| Action | Method | URL | Auth |
|--------|--------|-----|------|
| Health | GET | `https://files.nbericmmsu.com/health` | No |
| Get upload URL | POST | `https://files.nbericmmsu.com/api/files/upload-url` | Bearer |
| Upload file | PUT | *(from uploadUrl in response)* | No (presigned) |
| Public file | GET | `https://cdn.nbericmmsu.com/...` | No (public) |
| Delete file | DELETE | `https://files.nbericmmsu.com/api/files/{objectKey}` | Bearer |

---

## OpenAPI (Swagger) spec

- **Served by the API**: [https://files.nbericmmsu.com/docs](https://files.nbericmmsu.com/docs) — Swagger UI (interactive). Spec at `/docs/openapi.yaml`.
- **Repo files**: `docs/openapi.yaml`, `docs/swagger.html`. For Postman/codegen you can use the spec URL or the file.
