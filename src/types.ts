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
  email: string;
  name: string;
  role: StaffRole;
  active: boolean;
  permissions: StaffPermissions;
  createdAt?: Timestamp | Date | string;
  updatedAt?: Timestamp | Date | string;
}

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
