# Kubernetes deployment

1. **Build and load image** (example for local cluster):
   ```bash
   docker build -t file-service:latest ..
   kind load docker-image file-service:latest
   ```
   Or push to your registry and set `spec.template.spec.containers[0].image` in `deployment.yaml`.

2. **Create the Secret** (required: `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`; optional: `REDIS_PASSWORD`):
   ```bash
   kubectl create secret generic file-service-secret \
     --from-literal=MINIO_ACCESS_KEY=your-minio-key \
     --from-literal=MINIO_SECRET_KEY=your-minio-secret
   ```
   Or copy `secret.example.yaml` to `secret.yaml`, fill in values, then `kubectl apply -f secret.yaml`. Do not commit `secret.yaml`.

3. **Apply ConfigMap and workloads**:
   ```bash
   kubectl apply -f configMap.yaml
   kubectl apply -f deployment.yaml
   kubectl apply -f service.yaml
   ```

4. **Point ConfigMap** at your Redis and MinIO services (e.g. `REDIS_HOST=redis.redis.svc.cluster.local`, `MINIO_ENDPOINT=minio.minio.svc.cluster.local`).
