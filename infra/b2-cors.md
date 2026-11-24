# Backblaze B2 — CORS configuration

The bucket must **not** allow `AllowedOrigins: ["*"]`. A wildcard lets a presigned
PUT URL (if ever leaked in network logs) be replayed from any origin, and lets any
site read objects a victim's browser is authorized for.

## Files

- `b2-cors.json` — **production**. Replace `REPLACE_WITH_PROD_ORIGIN` with the real
  domain (e.g. `pgpass.in`) before applying. Keep both apex and `www` if both serve.
- `b2-cors.dev.json` — local development against MinIO / localhost only.

## Apply (S3-compatible API)

```bash
# Production bucket
aws s3api put-bucket-cors \
  --endpoint-url "$B2_ENDPOINT" \
  --bucket "$B2_BUCKET" \
  --cors-configuration "file://infra/b2-cors.json"

# Verify
aws s3api get-bucket-cors --endpoint-url "$B2_ENDPOINT" --bucket "$B2_BUCKET"
```

Also confirm the bucket itself is **private** (not public-read): objects must only be
reachable through short-TTL presigned URLs minted by the server, never by public URL.
