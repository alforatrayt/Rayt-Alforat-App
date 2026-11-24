/**
 * Phase 0 Security TDD Specification — Dirty Dozen Verification Matrix
 * Documents the 12 adversarial payloads that must receive PERMISSION_DENIED
 * under firestore.rules.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  operation: 'create' | 'update' | 'delete' | 'get' | 'list';
  path: string;
  auth: { uid?: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
  enforcedBy: string;
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Guest Status Forgery on Booking Create',
    operation: 'create',
    path: '/bookings/bk_forged_01',
    auth: null,
    payload: { status: 'confirmed', packageId: 'pkg_makkah_madinah' },
    expected: 'PERMISSION_DENIED',
    enforcedBy: "incoming().status == 'pending_review'",
  },
  {
    id: 2,
    name: 'Orphaned Booking Referencing Missing Package',
    operation: 'create',
    path: '/bookings/bk_orphan_02',
    auth: null,
    payload: { status: 'pending_review', packageId: 'non_existent_pkg' },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'exists(/databases/$(database)/documents/packages/$(incoming().packageId))',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Booking Create',
    operation: 'create',
    path: '/bookings/bk_shadow_03',
    auth: null,
    payload: { status: 'pending_review', isPaid: true },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'data.keys().hasOnly([...])',
  },
  {
    id: 4,
    name: 'Unauthenticated PII Read/List on Bookings',
    operation: 'list',
    path: '/bookings',
    auth: null,
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'allow get, list: if isActiveStaff()',
  },
  {
    id: 5,
    name: 'Tracker Collection Enumeration',
    operation: 'list',
    path: '/bookingTrackers',
    auth: null,
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'allow list: if false',
  },
  {
    id: 6,
    name: 'Orphaned Tracker Creation Without Booking',
    operation: 'create',
    path: '/bookingTrackers/RF9999_0500000000',
    auth: null,
    payload: { bookingId: 'missing_bk', status: 'pending_review' },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'existsAfter(/databases/$(database)/documents/bookings/$(incoming().bookingId))',
  },
  {
    id: 7,
    name: 'Unauthorized Passport Attachment Access',
    operation: 'get',
    path: '/bookings/bk_01/attachments/att_01',
    auth: { uid: 'guest_1', email: 'stranger@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'allow get, list: if isActiveStaff()',
  },
  {
    id: 8,
    name: 'Document ID Poisoning',
    operation: 'create',
    path: '/bookings/bad..id$$$poison',
    auth: null,
    payload: {},
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'isValidId(bookingId)',
  },
  {
    id: 9,
    name: 'Unverified Email Admin Spoofing',
    operation: 'list',
    path: '/bookings',
    auth: { uid: 'spoof_1', email: 'alforat.rayt@gmail.com', email_verified: false },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'request.auth.token.email_verified == true',
  },
  {
    id: 10,
    name: 'Staff Self-Role Escalation',
    operation: 'update',
    path: '/staff/sales@agency.com',
    auth: { uid: 'sales_1', email: 'sales@agency.com', email_verified: true },
    payload: { role: 'super_admin' },
    expected: 'PERMISSION_DENIED',
    enforcedBy: "hasPermission('manageStaff')",
  },
  {
    id: 11,
    name: 'Client Timestamp Forgery',
    operation: 'create',
    path: '/packages/pkg_fake_time',
    auth: { uid: 'admin_1', email: 'alforat.rayt@gmail.com', email_verified: true },
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'incoming().createdAt == request.time',
  },
  {
    id: 12,
    name: 'Non-SuperAdmin Mutating Terminal Cancelled Booking',
    operation: 'update',
    path: '/bookings/bk_cancelled_01',
    auth: { uid: 'sales_1', email: 'sales@agency.com', email_verified: true },
    payload: { status: 'confirmed' },
    expected: 'PERMISSION_DENIED',
    enforcedBy: "(existing().status != 'cancelled' || isSuperAdmin())",
  },
];
