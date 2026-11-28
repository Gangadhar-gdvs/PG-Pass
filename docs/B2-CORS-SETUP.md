# Fix: photo uploads fail with "Upload to secure storage was blocked"

## What's wrong
The browser uploads photos **directly** to your Backblaze B2 bucket using a
presigned PUT URL (`https://s3.eu-central-003.backblazeb2.com/<bucket>/...`).
B2 blocks that cross-origin request because the **bucket has no CORS rule**
allowing `PUT` from your app's domain. The app itself is fine — only the
browser→B2 upload is blocked.

## The fix: add a CORS rule to the bucket
Apply a CORS rule to the bucket named in your `B2_BUCKET` env var (the one the
app uploads to). You can do it with the B2 CLI or the Backblaze web console.

### Values you need — READ YOUR REAL DEPLOYMENT ENV
The `.env.*.example` files now all use region `eu-central-003` (matching the live
staging CSP). Still confirm the ACTUAL values in **Vercel → the deployment's
project → Settings → Environment Variables**, since the real bucket name/region
is what matters:
- **`B2_BUCKET`** — the exact bucket to add CORS to. Examples suggest
  `pgpass-media-staging` (staging) / `pgpass-media-prod` (prod), but confirm.
- **`B2_REGION`** — the region in the endpoint. If it's `eu-central-003`, the
  endpoint is `https://s3.eu-central-003.backblazeb2.com`.
- **Allowed origins** = every domain the app is served from. Based on your config:
  - **Staging:** `https://staging.pgpass.in` (+ your staging `*.vercel.app` URL if you upload there)
  - **Production:** `https://pgpass.in`, `https://www.pgpass.in`
  - Admins don't upload today, so `admin-pgpass.vercel.app` is NOT needed.
  - `http://localhost:3000` only if you test uploads locally against real B2.

---

## Option A — B2 CLI (recommended, exact & scriptable)

1. Install + authorize (once):
   ```bash
   # macOS
   brew install b2-tools        # or: pip install b2
   b2 account authorize          # paste your B2 keyID + applicationKey
   ```

2. Create the CORS rules file `b2-cors.json`:
   ```json
   [
     {
       "corsRuleName": "pgpass-browser-uploads",
       "allowedOrigins": [
         "https://YOUR-APP-DOMAIN"
       ],
       "allowedOperations": [
         "s3_put",
         "s3_get",
         "s3_head"
       ],
       "allowedHeaders": ["*"],
       "exposeHeaders": ["etag"],
       "maxAgeSeconds": 3600
     }
   ]
   ```
   Replace `https://YOUR-APP-DOMAIN` with your real origin(s). Add more strings
   to `allowedOrigins` for each domain. **Do not use `"*"` for origins** on a
   bucket that serves private photos — list your exact domains.

3. Apply it to the bucket:
   ```bash
   # Newer CLI (b2 v3+):
   b2 bucket update --cors-rules "$(cat b2-cors.json)" <YOUR_BUCKET_NAME> allPrivate

   # Older CLI (b2 v2):
   b2 update-bucket --corsRules "$(cat b2-cors.json)" <YOUR_BUCKET_NAME> allPrivate
   ```
   (Use `allPublic` instead of `allPrivate` only if your bucket is public; the PG
   gallery is public-read but move-in/ID photos are private — keep the bucket
   `allPrivate` and rely on presigned URLs, which is how the app already works.)

4. Verify:
   ```bash
   b2 bucket get <YOUR_BUCKET_NAME>     # (or: b2 get-bucket <name>) — shows corsRules
   ```

---

### Worked example (STAGING) — fill in your real bucket name
Assuming staging bucket `pgpass-media-staging` and origin `https://staging.pgpass.in`:

```bash
cat > b2-cors.json <<'JSON'
[
  {
    "corsRuleName": "pgpass-browser-uploads",
    "allowedOrigins": ["https://staging.pgpass.in"],
    "allowedOperations": ["s3_put", "s3_get", "s3_head"],
    "allowedHeaders": ["*"],
    "exposeHeaders": ["etag"],
    "maxAgeSeconds": 3600
  }
]
JSON

b2 account authorize   # paste staging B2 keyID + appKey
b2 bucket update --cors-rules "$(cat b2-cors.json)" pgpass-media-staging allPrivate
```

For **production**, repeat with bucket `pgpass-media-prod` and
`"allowedOrigins": ["https://pgpass.in", "https://www.pgpass.in"]`.

## Option B — Backblaze web console
B2 does **not** expose CORS in the normal bucket UI; you need the CLI for full
CORS control. If you must use the console, Backblaze only offers preset CORS
("Share everything in this bucket with all HTTPS origins"), which is too broad
for private photos. Prefer Option A.

---

## Confirm it worked
After applying CORS, a browser preflight should succeed:
```bash
# Replace with a real presigned PUT URL (or just the bucket endpoint) + your origin
curl -s -D - -o /dev/null -X OPTIONS \
  -H "Origin: https://YOUR-APP-DOMAIN" \
  -H "Access-Control-Request-Method: PUT" \
  "https://s3.eu-central-003.backblazeb2.com/<YOUR_BUCKET_NAME>/" | grep -i "access-control-allow"
```
You should see `access-control-allow-origin` + `access-control-allow-methods`
echoed back. Then try a profile-photo upload in the app — it should succeed, and
the error toast is gone.

## Notes
- CORS changes are near-instant on B2 (no long propagation).
- `s3_get`/`s3_head` are included so presigned-GET views and uploads both work.
- If you later add a custom domain, append it to `allowedOrigins` and re-apply.
</content>
</parameter>
