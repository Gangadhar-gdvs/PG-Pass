# Backblaze B2 Lifecycle Rules Configuration

Configure the following lifecycle rules in the Backblaze B2 console or via B2 CLI:

## 1. Photos Bucket (`B2_BUCKET`)
- **Prefix:** `pending/`
- **Action:** Delete unconfirmed uploads after 1 day.
  - `daysFromUploadingToHiding: 1`
  - `daysFromHidingToDeleting: 1`
- **File Versions:** Keep only the most recent version (`daysFromHidingToDeleting: 1`) to ensure deleted photos stop consuming storage quota.

## 2. Backup Bucket (`B2_BACKUP_BUCKET`)
- **Prefix:** `backups/`
- **Action:** Automatically expire backup files after 30 days (`BACKUP_RETENTION_DAYS`).
  - `daysFromUploadingToHiding: 30`
  - `daysFromHidingToDeleting: 1`
