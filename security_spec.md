# Security Specification — Kas Warga RT & Siaga Darurat

## 1. Data Invariants
1. **Verified Identity**: All authenticated writes require `request.auth.token.email_verified == true`.
2. **PII Isolation**: Private contact details (phone, NIK) and encrypted health profiles live strictly under `/users/{userId}/private/{docId}` (`AES-GCM-256` encrypted payload) and are never readable by other residents.
3. **Role Protection**: Residents cannot assign themselves admin/bendahara roles (`admins/{uid}` is strictly controlled by bootstrapped admin or existing admins).
4. **Transaction Integrity**: Residents may only create `income` dues submissions with `residentUid == request.auth.uid`, `status == 'pending'`, `verifiedBy == ''`, and `amount > 0`. Only RT Admins may approve/reject transactions or record `expense` entries.
5. **Server Timestamps & Immutability**: `createdAt` must equal `request.time` on create and remains immutable on update. `updatedAt` must equal `request.time` on update.
6. **Banner Slide Integrity**: Only RT Admins may create, update, or delete `/slides/{slideId}` documents. Public reads are strictly scoped to `communityId == 'rt_warga'` and contain zero PII.

## 2. Adversarial Test Payloads ("Dirty Dozen")
1. **Unverified Email Spoof**: Write to `/transactions/tx1` with `email_verified: false` -> `PERMISSION_DENIED`.
2. **Self-Admin Escalation**: Resident creates `/admins/{selfUid}` with `role: 'admin'` -> `PERMISSION_DENIED`.
3. **Shadow Ghost Field Injection**: Resident creates transaction with extra field `isAdminApproved: true` -> `PERMISSION_DENIED`.
4. **Auto-Approve Fraud**: Resident submits dues `/transactions/tx2` with `status: 'approved'` -> `PERMISSION_DENIED`.
5. **Resident Expense Forgery**: Resident submits `/transactions/tx3` with `type: 'expense'` -> `PERMISSION_DENIED`.
6. **Negative/Zero Amount Poisoning**: Resident submits transaction with `amount: -50000` -> `PERMISSION_DENIED`.
7. **Other Resident Impersonation**: Resident creates transaction with `residentUid: 'other_uid'` -> `PERMISSION_DENIED`.
8. **1MB ID Poisoning**: Create document with 1500-char ID -> `PERMISSION_DENIED`.
9. **PII Snooping**: Resident reads `/users/otherUid/private/health` -> `PERMISSION_DENIED`.
10. **Terminal State Tampering**: Resident edits an already `approved` transaction -> `PERMISSION_DENIED`.
11. **Backdated Timestamp Attack**: Create transaction with client-forged `createdAt` -> `PERMISSION_DENIED`.
12. **Notification Harvesting**: Resident lists `/notifications` without `targetUid == request.auth.uid` filter -> `PERMISSION_DENIED`.
13. **Non-Admin Slide Injection**: Regular resident creates or deletes `/slides/slide1` -> `PERMISSION_DENIED`.
