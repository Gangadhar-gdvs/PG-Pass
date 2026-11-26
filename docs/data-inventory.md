# PG-Pass — Personal Data Inventory

*Maintained under India's Digital Personal Data Protection (DPDP) Act, 2023.*

| Data Field | Collection / Storage | Purpose | Viewer Roles | Retention Policy |
| :--- | :--- | :--- | :--- | :--- |
| **Tenant Name** | Firestore (`tenants`) | Resident identification & receipt generation | Owner, Warden, Admin, Tenant | Kept until checkout + 365 days for tax/accounting records |
| **Tenant Phone** | Firestore (`tenants`) | Communication, WhatsApp reminders | Owner, Warden, Admin | Kept until checkout + 365 days; never logged in server logs |
| **Phone Last 4 Digits** | Firestore (`tenants`) | Portal authentication PIN verification | System (constant time comparison) | Kept with tenant profile |
| **ID Proof Type** | Firestore (`tenants`) | Record that offline ID was sighted | Owner, Warden, Admin | No ID scans or Aadhaar/PAN numbers ever stored |
| **Move-in/out Photos** | Backblaze B2 (`movein/`, `moveout/`) | Room dispute evidence & deposit deductions | Owner, Warden, Admin | Deleted 90 days following checkout |
| **Deposit Records** | Firestore (`deposits`) | Refundable deposit accounting | Owner, Warden, Admin, Tenant | Retained with financial records |
| **Rent Records** | Firestore (`rent_records`) | Rent billing, UTR claims & receipts | Owner, Warden, Admin, Tenant | Retained for tax records |
| **Owner Name & Phone** | Firestore (`owners`) | Account identity & support | Owner, Admin | Active account lifetime |
| **Owner UPI ID & QR** | Firestore (`owners`) | Direct 0% rent collection | Owner, Residents, Admin | Active account lifetime |
| **Owner Profile Photo** (optional) | Backblaze B2 (`avatar/`, private) + key in `owners.avatarKey` | Shown on the owner's own account | Owner only (short-lived presigned URL) | Until the owner removes/replaces it (old file deleted on replace) or the account is closed |
| **Staff/Warden Details**| Firestore (`staff`) | Scoped property management delegation | Owner, Warden, Admin | Active until owner revokes access |
| **Database Backups** | Backblaze B2 (`backups/`) | Disaster recovery | System / Admin only | AES-256-GCM encrypted, auto-purged after 30 days |
