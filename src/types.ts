import type { Timestamp } from 'firebase/firestore';

export type TripType = 'umrah' | 'family' | 'honeymoon' | 'tourism' | 'vip';

export type BookingStatus = 'pending_review' | 'awaiting_payment' | 'confirmed' | 'cancelled';

export type FieldType = 'text' | 'number' | 'select' | 'radio' | 'multiselect' | 'date' | 'file';

export type StaffRole = 'super_admin' | 'manager' | 'sales' | 'content_editor';

export interface ItineraryDay {
  day: number;
  title: string;
  description: string;
}

export type PaymentMethod = 'cash' | 'bank_transfer' | 'pos_card';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface PackageCategory {
  id: string;
  name: string;
  description: string;
  order: number;
  active: boolean;
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
}

export interface PackageBus {
  id: string;
  name: string;
  capacity: number;
  notes?: string;
}

export interface TravelPackage {
  id: string;
  title: string;
  subtitle: string;
  destination: string;
  tripType: TripType;
  categoryId?: string;
  durationDays: number;
  durationNights: number;
  durationLabel: string;
  departureDate: string;
  price: number;
  childPrice: number;
  infantPrice: number;
  currency: string;
  availableSeats: number;
  buses?: PackageBus[];
  coverImage: string;
  highlights: string[];
  itinerary: ItineraryDay[];
  inclusions: string[];
  exclusions: string[];
  hotelInfo: string;
  transportInfo: string;
  cancellationPolicy: string;
  formTemplateId: string;
  featured: boolean;
  visible: boolean;
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
}

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  fields: FormField[];
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
}

export interface TravelerRecord {
  index: number;
  category: 'adult' | 'child' | 'infant';
  label: string;
  answers: Record<string, string | string[]>;
}

export interface BookingPayment {
  id: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  note?: string;
  recordedBy?: string;
  createdAt?: string;
}

export interface Booking {
  id: string;
  bookingRef: string;
  trackerId: string;
  packageId: string;
  packageTitle: string;
  departureDate: string;
  formTemplateId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  adultsCount: number;
  childrenCount: number;
  infantsCount: number;
  totalPrice: number;
  currency: string;
  busId?: string;
  busName?: string;
  paidAmount?: number;
  remainingAmount?: number;
  paymentStatus?: PaymentStatus;
  payments?: BookingPayment[];
  travelers: TravelerRecord[];
  customerNotes: string;
  internalNotes: string;
  publicStatusNote: string;
  status: BookingStatus;
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
}

export interface BookingAttachment {
  id: string;
  bookingId: string;
  travelerIndex: number;
  fieldId: string;
  fieldLabel: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  createdAt?: Timestamp | Date | string;
}

export interface BookingTracker {
  id: string;
  bookingId: string;
  bookingRef: string;
  packageTitle: string;
  departureDate: string;
  travelersCount: number;
  totalPrice: number;
  currency: string;
  busName?: string;
  paidAmount?: number;
  remainingAmount?: number;
  paymentStatus?: PaymentStatus;
  status: BookingStatus;
  publicStatusNote: string;
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
}

export interface ContactEntry {
  label: string;
  phone: string;
}

export interface SiteSettings {
  agencyName: string;
  agencySubtitle: string;
  tagline: string;
  licenseNumber?: string;
  logoUrl: string;
  logoVersion?: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
  heroTitle: string;
  heroSubtitle: string;
  welcomePhrase: string;
  contacts: ContactEntry[];
  email: string;
  address: string;
  whatsappNumber: string;
  instagramUrl: string;
  twitterUrl: string;
  snapchatUrl: string;
  termsAndConditions: string;
  defaultCancellationPolicy: string;
  updatedAt?: Timestamp | Date | string;
}

export interface StaffPermissions {
  managePackages: boolean;
  manageForms: boolean;
  manageBookings: boolean;
  manageSettings: boolean;
  manageStaff: boolean;
}

export interface StaffMember {
  id: string;
  uid?: string;
  email: string;
  name: string;
  role: StaffRole;
  active: boolean;
  permissions: StaffPermissions;
  mustChangePassword?: boolean;
  totpEnabled?: boolean;
  totpVerified?: boolean;
  totpSecret?: string;
  failedAttempts?: number;
  lockedUntil?: number;
  lastLoginAt?: Timestamp | Date | string;
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
}

export type AuditLogAction =
  | 'login_success'
  | 'login_locked'
  | 'password_changed'
  | '2fa_enrolled'
  | '2fa_owner_toggled'
  | '2fa_reset'
  | 'staff_created'
  | 'staff_updated'
  | 'staff_frozen'
  | 'staff_activated'
  | 'staff_deleted'
  | 'payment_added'
  | 'payment_removed'
  | 'bus_assigned'
  | 'booking_status_updated'
  | 'booking_deleted'
  | 'manifest_exported'
  | 'financial_report_exported';

export interface AuditActor {
  email: string;
  name: string;
  role: string;
}

export interface AuditLog {
  id: string;
  action: AuditLogAction;
  actorEmail: string;
  actorName: string;
  actorRole: string;
  targetType: string;
  targetId: string;
  summary: string;
  details: string;
  createdAt?: Timestamp | Date | string;
}

export const AUDIT_ACTION_LABELS: Record<AuditLogAction, string> = {
  login_success: 'تسجيل دخول ناجح',
  login_locked: 'قفل مؤقت بعد محاولات فاشلة',
  password_changed: 'تغيير كلمة المرور الإجباري',
  '2fa_enrolled': 'تفعيل وربط المصادقة الثنائية (2FA)',
  '2fa_owner_toggled': 'تحديث إعداد 2FA للمالك',
  '2fa_reset': 'إعادة تعيين 2FA لموظف',
  staff_created: 'إنشاء حساب موظف جديد',
  staff_updated: 'تعديل صلاحيات موظف',
  staff_frozen: 'إيقاف / تجميد حساب موظف',
  staff_activated: 'إعادة تفعيل حساب موظف',
  staff_deleted: 'حذف حساب موظف',
  payment_added: 'إضافة دفعة مالية',
  payment_removed: 'حذف دفعة مالية',
  bus_assigned: 'تسكين حجز في حافلة',
  booking_status_updated: 'تحديث حالة حجز وملاحظات',
  booking_deleted: 'حذف حجز نهائياً',
  manifest_exported: 'تصدير كشف مسافرين',
  financial_report_exported: 'تصدير تقرير مالي',
};

export interface SeasonPoster {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  active: boolean;
  order: number;
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
}

export const TRIP_TYPE_LABELS: Record<TripType, string> = {
  umrah: 'عمرة وزيارة',
  family: 'عائلية',
  honeymoon: 'شهر عسل',
  tourism: 'سياحة دولية',
  vip: 'كبار الشخصيات',
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending_review: 'قيد المراجعة',
  awaiting_payment: 'بانتظار الدفع',
  confirmed: 'مؤكد',
  cancelled: 'ملغي',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'كاش (نقدي)',
  bank_transfer: 'تحويل بنكي',
  pos_card: 'شبكة (مدى / بطاقة)',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'غير مدفوع',
  partial: 'مدفوع جزئياً',
  paid: 'مدفوع بالكامل',
};

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'نص قصير',
  number: 'رقم',
  select: 'قائمة منسدلة',
  radio: 'اختيار واحد',
  multiselect: 'اختيار متعدد',
  date: 'تاريخ',
  file: 'رفع ملف / صورة جواز',
};

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: 'مدير عام',
  manager: 'مدير عمليات',
  sales: 'موظف مبيعات وحجوزات',
  content_editor: 'محرر باقات ومحتوى',
};

export const ROLE_PRESET_PERMISSIONS: Record<StaffRole, StaffPermissions> = {
  super_admin: {
    managePackages: true,
    manageForms: true,
    manageBookings: true,
    manageSettings: true,
    manageStaff: true,
  },
  manager: {
    managePackages: true,
    manageForms: true,
    manageBookings: true,
    manageSettings: true,
    manageStaff: false,
  },
  sales: {
    managePackages: false,
    manageForms: false,
    manageBookings: true,
    manageSettings: false,
    manageStaff: false,
  },
  content_editor: {
    managePackages: true,
    manageForms: true,
    manageBookings: false,
    manageSettings: false,
    manageStaff: false,
  },
};
