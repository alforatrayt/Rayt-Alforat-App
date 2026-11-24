# Security Specification — Rayat Al-Furat Travel & Tourism

## 1. Data Invariants
1. **PII Isolation**: Customer PII (`bookings` and `bookings/{bookingId}/attachments`) can NEVER be read or listed by unauthenticated users or non-staff accounts. Public tracking operates exclusively via single-document `get` on `bookingTrackers/{REF_PHONE}` with zero PII and `allow list: if false`.
2. **Referential & Atomic Integrity**: A `booking` cannot be created for a non-existent `packageId`. A `bookingTracker` cannot be created without an atomic matching `bookings/{bookingId}` write (`existsAfter`), and an `attachment` cannot be created without an atomic matching `bookings/{bookingId}` write.
3. **Initial State Enforcement**: Guest bookings MUST enter with `status == 'pending_review'` and empty `internalNotes == ''` and `publicStatusNote == ''`.
4. **Hybrid Owner-Google + Staff-2FA Security**: Google OAuth login is strictly whitelisted to verified `alforat.rayt@gmail.com` (`sign_in_provider == 'google.com' && email_verified == true`). Staff accounts use Owner-provisioned Email/Password (`sign_in_provider == 'password'`) with forced initial password change, mandatory TOTP 2FA enrollment, and real-time `active == true` revocation. Staff can never elevate roles, disable their own verified 2FA, or read/delete `auditLogs`.
5. **Temporal Integrity**: `createdAt == request.time` on creation and `updatedAt == request.time` on updates. `createdAt` is immutable after creation.
6. **Terminal State Locking**: Once a booking reaches `status == 'cancelled'`, non-super-admin staff cannot mutate it.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Guest Status Forgery**: Creating a `bookings/{id}` with `status: "confirmed"` instead of `"pending_review"`.
2. **Orphaned Booking**: Creating a `bookings/{id}` referencing a non-existent `packageId: "fake-pkg-999"`.
3. **Shadow Field Injection**: Creating a `bookings/{id}` containing an unlisted ghost field `isPaid: true`.
4. **PII Blanket List Attack**: Unauthenticated or non-staff user attempting `list` or `get` on `/bookings`.
5. **Tracker Enumeration Attack**: Unauthenticated user attempting `list` on `/bookingTrackers`.
6. **Orphaned Tracker Attack**: Creating a `bookingTrackers/{id}` without an atomic `bookings/{bookingId}` creation.
7. **Passport Leak Attack**: Non-staff user attempting `get` or `list` on `/bookings/{id}/attachments`.
8. **ID Poisoning Attack**: Creating a document with an oversized or invalid character ID (`../../admin`).
9. **Email Spoofing Attack**: Authenticating with admin email while `email_verified: false`.
10. **Self-Role Escalation**: A `sales` employee attempting to update their own `/staff/{email}` document to `role: "super_admin"`.
11. **Timestamp Forgery**: Creating a booking or package with client-forged `createdAt` not equal to `request.time`.
12. **Terminal State Violation**: A `sales` employee attempting to change a booking whose existing status is `cancelled` back to `confirmed`.
