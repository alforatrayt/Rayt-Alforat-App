import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, handleFirestoreError, OperationType, staffProvisionAuth } from '../firebase';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  DEFAULT_FORM_TEMPLATES,
  DEFAULT_SEASON_POSTERS,
  DEFAULT_SITE_SETTINGS,
} from '../data/defaults';
import {
  ROLE_PRESET_PERMISSIONS,
  type AuditActor,
  type AuditLog,
  type AuditLogAction,
  type Booking,
  type BookingAttachment,
  type BookingPayment,
  type BookingStatus,
  type BookingTracker,
  type FormTemplate,
  type PackageBus,
  type PackageCategory,
  type PaymentStatus,
  type SeasonPoster,
  type SiteSettings,
  type StaffMember,
  type StaffPermissions,
  type StaffRole,
  type TravelPackage,
} from '../types';
import { buildTrackerId, generateSafeId } from '../utils/imageCompress';

// ==================== SITE SETTINGS ====================

export async function fetchSiteSettings(): Promise<SiteSettings | null> {
  const path = 'siteSettings/main';
  try {
    const snap = await getDoc(doc(db, 'siteSettings', 'main'));
    if (!snap.exists()) return null;
    return snap.data() as SiteSettings;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveSiteSettings(settings: SiteSettings): Promise<void> {
  const path = 'siteSettings/main';
  try {
    const payload = {
      agencyName: settings.agencyName.trim().slice(0, 120),
      agencySubtitle: settings.agencySubtitle.trim().slice(0, 120),
      tagline: settings.tagline.trim().slice(0, 180),
      licenseNumber: (settings.licenseNumber || '').trim().slice(0, 80),
      logoUrl: (settings.logoUrl || '').slice(0, 260000),
      primaryColor: settings.primaryColor.slice(0, 20),
      secondaryColor: settings.secondaryColor.slice(0, 20),
      accentColor: settings.accentColor.slice(0, 20),
      bgColor: settings.bgColor.slice(0, 20),
      heroTitle: settings.heroTitle.trim().slice(0, 180),
      heroSubtitle: settings.heroSubtitle.trim().slice(0, 400),
      welcomePhrase: settings.welcomePhrase.trim().slice(0, 120),
      contacts: (settings.contacts || []).slice(0, 10),
      email: settings.email.trim().slice(0, 120),
      address: settings.address.trim().slice(0, 240),
      whatsappNumber: settings.whatsappNumber.trim().slice(0, 30),
      instagramUrl: settings.instagramUrl.trim().slice(0, 240),
      twitterUrl: settings.twitterUrl.trim().slice(0, 240),
      snapchatUrl: settings.snapchatUrl.trim().slice(0, 240),
      termsAndConditions: settings.termsAndConditions.slice(0, 5000),
      defaultCancellationPolicy: settings.defaultCancellationPolicy.slice(0, 3000),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'siteSettings', 'main'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ==================== CATEGORIES ====================

export async function fetchPublicCategories(): Promise<PackageCategory[]> {
  const path = 'categories';
  try {
    const q = query(collection(db, 'categories'), where('active', '==', true));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<PackageCategory, 'id'>) }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchAllCategoriesAdmin(): Promise<PackageCategory[]> {
  const path = 'categories';
  try {
    const snap = await getDocs(collection(db, 'categories'));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<PackageCategory, 'id'>) }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveCategory(
  category: Omit<PackageCategory, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<string> {
  const id = isNew ? generateSafeId('cat') : category.id;
  const path = `categories/${id}`;
  try {
    const baseData = {
      name: category.name.trim().slice(0, 120),
      description: (category.description || '').trim().slice(0, 400),
      order: Math.max(0, Math.min(1000, Number(category.order) || 1)),
      active: Boolean(category.active),
      updatedAt: serverTimestamp(),
    };
    if (isNew) {
      await setDoc(doc(db, 'categories', id), {
        ...baseData,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'categories', id), baseData);
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteCategoryById(categoryId: string): Promise<void> {
  const path = `categories/${categoryId}`;
  try {
    await deleteDoc(doc(db, 'categories', categoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ==================== PACKAGES ====================

export async function fetchPublicPackages(): Promise<TravelPackage[]> {
  const path = 'packages';
  try {
    const q = query(collection(db, 'packages'), where('visible', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TravelPackage, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchAllPackagesAdmin(): Promise<TravelPackage[]> {
  const path = 'packages';
  try {
    const snap = await getDocs(collection(db, 'packages'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TravelPackage, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

function sanitizePackageBuses(buses: PackageBus[] | undefined): PackageBus[] {
  if (!Array.isArray(buses)) return [];
  return buses
    .filter((b) => b && typeof b.name === 'string' && b.name.trim().length > 0)
    .slice(0, 30)
    .map((b) => {
      const clean: PackageBus = {
        id: String(b.id || generateSafeId('bus')).slice(0, 60),
        name: b.name.trim().slice(0, 120),
        capacity: Math.max(1, Math.min(200, Number(b.capacity) || 45)),
      };
      if (typeof b.notes === 'string' && b.notes.trim()) {
        clean.notes = b.notes.trim().slice(0, 240);
      }
      return clean;
    });
}

export async function savePackage(pkg: TravelPackage, isNew: boolean): Promise<string> {
  const id = isNew ? generateSafeId('pkg') : pkg.id;
  const path = `packages/${id}`;
  try {
    const cleanBuses = sanitizePackageBuses(pkg.buses);
    const baseData = {
      title: pkg.title.trim().slice(0, 160),
      subtitle: (pkg.subtitle || '').trim().slice(0, 240),
      destination: pkg.destination.trim().slice(0, 100),
      tripType: pkg.tripType,
      categoryId: (pkg.categoryId || '').trim().slice(0, 80),
      durationDays: Math.max(1, Math.min(90, Number(pkg.durationDays) || 1)),
      durationNights: Math.max(0, Math.min(90, Number(pkg.durationNights) || 0)),
      durationLabel: pkg.durationLabel.trim().slice(0, 60),
      departureDate: pkg.departureDate.trim().slice(0, 60),
      price: Math.max(0, Math.min(500000, Number(pkg.price) || 0)),
      childPrice: Math.max(0, Math.min(500000, Number(pkg.childPrice) || 0)),
      infantPrice: Math.max(0, Math.min(500000, Number(pkg.infantPrice) || 0)),
      currency: (pkg.currency || 'ريال').trim().slice(0, 20),
      availableSeats: Math.max(0, Math.min(2000, Number(pkg.availableSeats) || 0)),
      buses: cleanBuses,
      coverImage: (pkg.coverImage || '').slice(0, 260000),
      highlights: (pkg.highlights || []).filter(Boolean).slice(0, 20),
      itinerary: (pkg.itinerary || []).slice(0, 35),
      inclusions: (pkg.inclusions || []).filter(Boolean).slice(0, 30),
      exclusions: (pkg.exclusions || []).filter(Boolean).slice(0, 30),
      hotelInfo: (pkg.hotelInfo || '').slice(0, 1500),
      transportInfo: (pkg.transportInfo || '').slice(0, 1500),
      cancellationPolicy: (pkg.cancellationPolicy || '').slice(0, 2000),
      formTemplateId: pkg.formTemplateId || 'form_umrah_domestic',
      featured: Boolean(pkg.featured),
      visible: Boolean(pkg.visible),
      updatedAt: serverTimestamp(),
    };

    if (isNew) {
      await setDoc(doc(db, 'packages', id), {
        ...baseData,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'packages', id), baseData);
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deletePackageById(packageId: string): Promise<void> {
  const path = `packages/${packageId}`;
  try {
    await deleteDoc(doc(db, 'packages', packageId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ==================== FORM TEMPLATES ====================

export async function fetchFormTemplateById(formId: string): Promise<FormTemplate | null> {
  const path = `formTemplates/${formId}`;
  try {
    const snap = await getDoc(doc(db, 'formTemplates', formId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<FormTemplate, 'id'>) };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchAllFormTemplatesAdmin(): Promise<FormTemplate[]> {
  const path = 'formTemplates';
  try {
    const snap = await getDocs(collection(db, 'formTemplates'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FormTemplate, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveFormTemplate(form: FormTemplate, isNew: boolean): Promise<string> {
  const id = isNew ? generateSafeId('form') : form.id;
  const path = `formTemplates/${id}`;
  try {
    const cleanFields = (form.fields || []).slice(0, 40).map((fld) => {
      const needsOptions =
        fld.type === 'select' || fld.type === 'radio' || fld.type === 'multiselect';
      const sanitized: Record<string, unknown> = {
        id: String(fld.id || generateSafeId('fld')).slice(0, 80),
        label: String(fld.label || 'حقل').trim().slice(0, 120),
        type: fld.type,
        required: Boolean(fld.required),
      };
      if (typeof fld.placeholder === 'string' && fld.placeholder.trim() !== '') {
        sanitized.placeholder = fld.placeholder.trim().slice(0, 180);
      }
      if (typeof fld.helpText === 'string' && fld.helpText.trim() !== '') {
        sanitized.helpText = fld.helpText.trim().slice(0, 240);
      }
      if (needsOptions) {
        const opts = (fld.options || []).map((o) => String(o).trim()).filter(Boolean);
        sanitized.options = opts.length > 0 ? opts.slice(0, 30) : ['خيار 1', 'خيار 2'];
      }
      return sanitized;
    });

    const baseData = {
      name: form.name.trim().slice(0, 120),
      description: (form.description || '').trim().slice(0, 400),
      isDefault: Boolean(form.isDefault),
      fields: cleanFields,
      updatedAt: serverTimestamp(),
    };
    if (isNew) {
      await setDoc(doc(db, 'formTemplates', id), {
        ...baseData,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'formTemplates', id), baseData);
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteFormTemplateById(formId: string): Promise<void> {
  const path = `formTemplates/${formId}`;
  try {
    await deleteDoc(doc(db, 'formTemplates', formId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ==================== BOOKINGS & TRACKING ====================

export interface PendingAttachmentUpload {
  travelerIndex: number;
  fieldId: string;
  fieldLabel: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
}

export async function submitCustomerBooking(
  bookingData: Omit<
    Booking,
    | 'id'
    | 'trackerId'
    | 'status'
    | 'internalNotes'
    | 'publicStatusNote'
    | 'paidAmount'
    | 'remainingAmount'
    | 'paymentStatus'
    | 'payments'
    | 'createdAt'
    | 'updatedAt'
  >,
  attachments: PendingAttachmentUpload[]
): Promise<{ bookingId: string; trackerId: string; bookingRef: string }> {
  const bookingId = generateSafeId('bk');
  const trackerId = buildTrackerId(bookingData.bookingRef, bookingData.customerPhone);
  const path = `bookings/${bookingId}`;

  try {
    const batch = writeBatch(db);
    const now = serverTimestamp();
    const totalTravelers =
      bookingData.adultsCount + bookingData.childrenCount + bookingData.infantsCount;
    const cleanBusId = (bookingData.busId || '').trim().slice(0, 80);
    const cleanBusName = (bookingData.busName || '').trim().slice(0, 120);

    batch.set(doc(db, 'bookings', bookingId), {
      bookingRef: bookingData.bookingRef.trim().toUpperCase().slice(0, 32),
      trackerId,
      packageId: bookingData.packageId,
      packageTitle: bookingData.packageTitle.trim().slice(0, 160),
      departureDate: bookingData.departureDate.trim().slice(0, 60),
      formTemplateId: bookingData.formTemplateId,
      customerName: bookingData.customerName.trim().slice(0, 120),
      customerPhone: bookingData.customerPhone.trim().slice(0, 30),
      customerEmail: (bookingData.customerEmail || '').trim().slice(0, 120),
      adultsCount: bookingData.adultsCount,
      childrenCount: bookingData.childrenCount,
      infantsCount: bookingData.infantsCount,
      totalPrice: bookingData.totalPrice,
      currency: bookingData.currency.slice(0, 20),
      busId: cleanBusId,
      busName: cleanBusName,
      paidAmount: 0,
      remainingAmount: bookingData.totalPrice,
      paymentStatus: 'unpaid',
      payments: [],
      travelers: bookingData.travelers.slice(0, 50),
      customerNotes: (bookingData.customerNotes || '').trim().slice(0, 1000),
      internalNotes: '',
      publicStatusNote: '',
      status: 'pending_review',
      createdAt: now,
      updatedAt: now,
    });

    batch.set(doc(db, 'bookingTrackers', trackerId), {
      bookingId,
      bookingRef: bookingData.bookingRef.trim().toUpperCase().slice(0, 32),
      packageTitle: bookingData.packageTitle.trim().slice(0, 160),
      departureDate: bookingData.departureDate.trim().slice(0, 60),
      travelersCount: Math.max(1, totalTravelers),
      totalPrice: bookingData.totalPrice,
      currency: bookingData.currency.slice(0, 20),
      busName: cleanBusName,
      paidAmount: 0,
      remainingAmount: bookingData.totalPrice,
      paymentStatus: 'unpaid',
      status: 'pending_review',
      publicStatusNote: '',
      createdAt: now,
      updatedAt: now,
    });

    attachments.forEach((att, idx) => {
      const attId = generateSafeId(`att${idx}`);
      batch.set(doc(db, 'bookings', bookingId, 'attachments', attId), {
        bookingId,
        travelerIndex: att.travelerIndex,
        fieldId: att.fieldId.slice(0, 80),
        fieldLabel: att.fieldLabel.slice(0, 120),
        fileName: att.fileName.slice(0, 180),
        mimeType: att.mimeType.slice(0, 80),
        dataUrl: att.dataUrl.slice(0, 260000),
        createdAt: now,
      });
    });

    await batch.commit();
    return { bookingId, trackerId, bookingRef: bookingData.bookingRef };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function lookupBookingTracker(
  bookingRef: string,
  phone: string
): Promise<BookingTracker | null> {
  const trackerId = buildTrackerId(bookingRef, phone);
  if (trackerId.length < 8) return null;
  const path = `bookingTrackers/${trackerId}`;
  try {
    const snap = await getDoc(doc(db, 'bookingTrackers', trackerId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<BookingTracker, 'id'>) };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchAllBookingsAdmin(): Promise<Booking[]> {
  const path = 'bookings';
  try {
    const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchBookingAttachmentsAdmin(bookingId: string): Promise<BookingAttachment[]> {
  const path = `bookings/${bookingId}/attachments`;
  try {
    const q = query(
      collection(db, 'bookings', bookingId, 'attachments'),
      where('bookingId', '==', bookingId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BookingAttachment, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function updateBookingStatusAndNotes(
  booking: Booking,
  status: BookingStatus,
  internalNotes: string,
  publicStatusNote: string
): Promise<void> {
  const path = `bookings/${booking.id}`;
  try {
    const batch = writeBatch(db);
    const now = serverTimestamp();

    batch.update(doc(db, 'bookings', booking.id), {
      status,
      internalNotes: internalNotes.slice(0, 2000),
      publicStatusNote: publicStatusNote.slice(0, 500),
      updatedAt: now,
    });

    batch.update(doc(db, 'bookingTrackers', booking.trackerId), {
      status,
      publicStatusNote: publicStatusNote.slice(0, 500),
      updatedAt: now,
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function computeBookingFinancialTotals(
  totalPrice: number,
  payments: BookingPayment[]
): {
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: PaymentStatus;
} {
  const safeTotal = Math.max(0, Number(totalPrice) || 0);
  const paidAmount = payments.reduce((sum, p) => sum + Math.max(0, Number(p.amount) || 0), 0);
  const roundedPaid = Math.round(paidAmount * 100) / 100;
  const remainingAmount = Math.max(0, Math.round((safeTotal - roundedPaid) * 100) / 100);
  const paymentStatus: PaymentStatus =
    roundedPaid >= safeTotal && safeTotal > 0
      ? 'paid'
      : roundedPaid > 0
      ? 'partial'
      : 'unpaid';
  return { paidAmount: roundedPaid, remainingAmount, paymentStatus };
}

export async function updateBookingBusAssignment(
  booking: Booking,
  busId: string,
  busName: string
): Promise<{ busId: string; busName: string }> {
  const path = `bookings/${booking.id}`;
  const cleanBusId = busId.trim().slice(0, 80);
  const cleanBusName = busName.trim().slice(0, 120);
  try {
    const batch = writeBatch(db);
    const now = serverTimestamp();

    batch.update(doc(db, 'bookings', booking.id), {
      busId: cleanBusId,
      busName: cleanBusName,
      updatedAt: now,
    });

    batch.update(doc(db, 'bookingTrackers', booking.trackerId), {
      busName: cleanBusName,
      updatedAt: now,
    });

    await batch.commit();
    return { busId: cleanBusId, busName: cleanBusName };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveBookingFinancials(
  booking: Booking,
  rawPayments: BookingPayment[],
  recordedByEmail?: string
): Promise<{
  payments: BookingPayment[];
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: PaymentStatus;
}> {
  const path = `bookings/${booking.id}`;
  try {
    const cleanPayments: BookingPayment[] = rawPayments
      .filter((p) => p && Number(p.amount) > 0)
      .slice(0, 30)
      .map((p) => {
        const entry: BookingPayment = {
          id: String(p.id || generateSafeId('pay')).slice(0, 60),
          amount: Math.round(Math.max(0, Number(p.amount)) * 100) / 100,
          method: p.method,
          date: String(p.date || new Date().toISOString().slice(0, 10)).slice(0, 30),
        };
        if (typeof p.note === 'string' && p.note.trim()) {
          entry.note = p.note.trim().slice(0, 240);
        }
        const recorder = p.recordedBy || recordedByEmail;
        if (typeof recorder === 'string' && recorder.trim()) {
          entry.recordedBy = recorder.trim().slice(0, 120);
        }
        if (typeof p.createdAt === 'string' && p.createdAt.trim()) {
          entry.createdAt = p.createdAt.trim().slice(0, 40);
        }
        return entry;
      });

    const summary = computeBookingFinancialTotals(booking.totalPrice, cleanPayments);
    const batch = writeBatch(db);
    const now = serverTimestamp();

    batch.update(doc(db, 'bookings', booking.id), {
      payments: cleanPayments,
      paidAmount: summary.paidAmount,
      remainingAmount: summary.remainingAmount,
      paymentStatus: summary.paymentStatus,
      updatedAt: now,
    });

    batch.update(doc(db, 'bookingTrackers', booking.trackerId), {
      paidAmount: summary.paidAmount,
      remainingAmount: summary.remainingAmount,
      paymentStatus: summary.paymentStatus,
      updatedAt: now,
    });

    await batch.commit();
    return {
      payments: cleanPayments,
      ...summary,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteBookingAdmin(booking: Booking): Promise<void> {
  const path = `bookings/${booking.id}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'bookings', booking.id));
    batch.delete(doc(db, 'bookingTrackers', booking.trackerId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ==================== STAFF & RBAC ====================

export async function fetchStaffProfileByEmail(email: string): Promise<StaffMember | null> {
  const key = email.trim().toLowerCase();
  const path = `staff/${key}`;
  try {
    const snap = await getDoc(doc(db, 'staff', key));
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<StaffMember, 'id'>) };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeStaffProfile(
  email: string,
  onUpdate: (profile: StaffMember | null) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const key = email.trim().toLowerCase();
  return onSnapshot(
    doc(db, 'staff', key),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate({ id: snap.id, ...(snap.data() as Omit<StaffMember, 'id'>) });
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function fetchAllStaffAdmin(): Promise<StaffMember[]> {
  const path = 'staff';
  try {
    const snap = await getDocs(collection(db, 'staff'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StaffMember, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createStaffAccountWithAuth(params: {
  name: string;
  email: string;
  tempPassword: string;
  role: StaffRole;
  permissions: StaffPermissions;
}): Promise<void> {
  const key = params.email.trim().toLowerCase();
  if (!key || key === BOOTSTRAPPED_ADMIN_EMAIL) {
    throw new Error('لا يمكن إنشاء حساب موظف بهذا البريد الإلكتروني.');
  }
  const existingSnap = await getDoc(doc(db, 'staff', key));
  if (existingSnap.exists()) {
    const err = new Error('يوجد ملف موظف مسجل مسبقاً بهذا البريد الإلكتروني.');
    (err as { code?: string }).code = 'staff/already-exists';
    throw err;
  }

  let createdUid = '';
  try {
    const cred = await createUserWithEmailAndPassword(
      staffProvisionAuth,
      key,
      params.tempPassword
    );
    createdUid = cred.user.uid;
  } finally {
    try {
      await signOut(staffProvisionAuth);
    } catch {
      // ignore provisioning sign-out cleanup errors
    }
  }

  const path = `staff/${key}`;
  try {
    await setDoc(doc(db, 'staff', key), {
      email: key,
      uid: createdUid.slice(0, 128),
      name: params.name.trim().slice(0, 100),
      role: params.role,
      active: true,
      permissions: {
        managePackages: Boolean(params.permissions.managePackages),
        manageForms: Boolean(params.permissions.manageForms),
        manageBookings: Boolean(params.permissions.manageBookings),
        manageSettings: Boolean(params.permissions.manageSettings),
        manageStaff: false, // Only Main Owner manages staff & audit logs
      },
      mustChangePassword: true,
      totpEnabled: true,
      totpVerified: false,
      totpSecret: '',
      failedAttempts: 0,
      lockedUntil: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateStaffSecurityProfile(
  email: string,
  updates: {
    uid?: string;
    name?: string;
    role?: StaffRole;
    active?: boolean;
    permissions?: StaffPermissions;
    mustChangePassword?: boolean;
    totpEnabled?: boolean;
    totpVerified?: boolean;
    totpSecret?: string;
    failedAttempts?: number;
    lockedUntil?: number;
    touchLastLogin?: boolean;
  }
): Promise<void> {
  const key = email.trim().toLowerCase();
  const path = `staff/${key}`;
  try {
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.uid !== undefined) payload.uid = updates.uid.slice(0, 128);
    if (updates.name !== undefined) payload.name = updates.name.trim().slice(0, 100);
    if (updates.role !== undefined) payload.role = updates.role;
    if (updates.active !== undefined) payload.active = Boolean(updates.active);
    if (updates.permissions !== undefined) {
      payload.permissions = {
        managePackages: Boolean(updates.permissions.managePackages),
        manageForms: Boolean(updates.permissions.manageForms),
        manageBookings: Boolean(updates.permissions.manageBookings),
        manageSettings: Boolean(updates.permissions.manageSettings),
        manageStaff:
          key === BOOTSTRAPPED_ADMIN_EMAIL
            ? Boolean(updates.permissions.manageStaff)
            : false,
      };
    }
    if (updates.mustChangePassword !== undefined) {
      payload.mustChangePassword = Boolean(updates.mustChangePassword);
    }
    if (updates.totpEnabled !== undefined) {
      payload.totpEnabled = Boolean(updates.totpEnabled);
    }
    if (updates.totpVerified !== undefined) {
      payload.totpVerified = Boolean(updates.totpVerified);
    }
    if (updates.totpSecret !== undefined) {
      payload.totpSecret = updates.totpSecret.trim().slice(0, 128);
    }
    if (updates.failedAttempts !== undefined) {
      payload.failedAttempts = Math.max(0, Math.min(100, Number(updates.failedAttempts) || 0));
    }
    if (updates.lockedUntil !== undefined) {
      payload.lockedUntil = Math.max(0, Number(updates.lockedUntil) || 0);
    }
    if (updates.touchLastLogin) {
      payload.lastLoginAt = serverTimestamp();
    }

    await updateDoc(doc(db, 'staff', key), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveStaffMember(
  member: Omit<StaffMember, 'id' | 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<void> {
  const key = member.email.trim().toLowerCase();
  const path = `staff/${key}`;
  try {
    const baseData = {
      email: key,
      name: member.name.trim().slice(0, 100),
      role: member.role,
      active: Boolean(member.active),
      permissions: {
        managePackages: Boolean(member.permissions.managePackages),
        manageForms: Boolean(member.permissions.manageForms),
        manageBookings: Boolean(member.permissions.manageBookings),
        manageSettings: Boolean(member.permissions.manageSettings),
        manageStaff: key === BOOTSTRAPPED_ADMIN_EMAIL ? Boolean(member.permissions.manageStaff) : false,
      },
      updatedAt: serverTimestamp(),
    };
    if (isNew) {
      await setDoc(doc(db, 'staff', key), {
        ...baseData,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'staff', key), {
        name: baseData.name,
        role: baseData.role,
        active: baseData.active,
        permissions: baseData.permissions,
        updatedAt: baseData.updatedAt,
      });
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteStaffMember(email: string): Promise<void> {
  const key = email.trim().toLowerCase();
  const path = `staff/${key}`;
  try {
    await deleteDoc(doc(db, 'staff', key));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ==================== AUDIT LOGS ====================

export async function logAuditEvent(params: {
  action: AuditLogAction;
  actor: AuditActor;
  targetType?: string;
  targetId?: string;
  summary: string;
  details?: string;
}): Promise<void> {
  const actorEmail = (params.actor.email || '').trim().toLowerCase();
  if (!actorEmail) return;
  const logId = generateSafeId('audit');
  try {
    await setDoc(doc(db, 'auditLogs', logId), {
      action: params.action.slice(0, 60),
      actorEmail: actorEmail.slice(0, 128),
      actorName: (params.actor.name || actorEmail).trim().slice(0, 120) || 'مستخدم',
      actorRole: (params.actor.role || 'staff').trim().slice(0, 40) || 'staff',
      targetType: (params.targetType || '').trim().slice(0, 60),
      targetId: (params.targetId || '').trim().slice(0, 128),
      summary: params.summary.trim().slice(0, 400) || params.action,
      details: (params.details || '').trim().slice(0, 1000),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Best-effort logging: never crash primary operation if audit write fails
    console.warn('Audit log write skipped:', error);
  }
}

export async function fetchAuditLogsOwnerOnly(maxItems = 250): Promise<AuditLog[]> {
  const path = 'auditLogs';
  try {
    const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(maxItems));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// ==================== SEASON POSTERS / ADS ====================

export async function fetchPublicSeasonPosters(): Promise<SeasonPoster[]> {
  const path = 'seasonPosters';
  try {
    const q = query(collection(db, 'seasonPosters'), where('active', '==', true));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<SeasonPoster, 'id'>) }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchAllSeasonPostersAdmin(): Promise<SeasonPoster[]> {
  const path = 'seasonPosters';
  try {
    const snap = await getDocs(collection(db, 'seasonPosters'));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<SeasonPoster, 'id'>) }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveSeasonPoster(
  poster: Omit<SeasonPoster, 'createdAt' | 'updatedAt'>,
  isNew: boolean
): Promise<string> {
  const id = isNew ? generateSafeId('poster') : poster.id;
  const path = `seasonPosters/${id}`;
  try {
    const baseData = {
      title: poster.title.trim().slice(0, 140),
      subtitle: (poster.subtitle || '').trim().slice(0, 260),
      imageUrl: poster.imageUrl.trim().slice(0, 350000),
      active: Boolean(poster.active),
      order: Math.max(0, Math.min(1000, Number(poster.order) || 1)),
      updatedAt: serverTimestamp(),
    };
    if (isNew) {
      await setDoc(doc(db, 'seasonPosters', id), {
        ...baseData,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'seasonPosters', id), baseData);
    }
    try {
      localStorage.setItem('rf_posters_seeded', '1');
    } catch {
      // ignore storage errors
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteSeasonPosterById(posterId: string): Promise<void> {
  const path = `seasonPosters/${posterId}`;
  try {
    await deleteDoc(doc(db, 'seasonPosters', posterId));
    try {
      localStorage.setItem('rf_posters_seeded', '1');
    } catch {
      // ignore storage errors
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ==================== INITIAL DATABASE SEEDING (ADMIN ONLY) ====================

export async function seedInitialAgencyDataIfEmpty(currentEmail?: string): Promise<boolean> {
  try {
    const [existingSettings, existingForms, existingPosters] = await Promise.all([
      getDoc(doc(db, 'siteSettings', 'main')),
      getDocs(collection(db, 'formTemplates')),
      getDocs(collection(db, 'seasonPosters')),
    ]);

    const batch = writeBatch(db);
    let wroteSomething = false;
    const now = serverTimestamp();

    if (!existingSettings.exists()) {
      batch.set(doc(db, 'siteSettings', 'main'), {
        ...DEFAULT_SITE_SETTINGS,
        updatedAt: now,
      });
      wroteSomething = true;
    } else {
      const currentSettingEmail = String(existingSettings.data()?.email || '').trim().toLowerCase();
      if (
        !currentSettingEmail ||
        currentSettingEmail === 'info@rayatalfurat.sa' ||
        currentSettingEmail === 'alahsaey@gmail.com'
      ) {
        batch.update(doc(db, 'siteSettings', 'main'), {
          email: BOOTSTRAPPED_ADMIN_EMAIL,
          updatedAt: now,
        });
        wroteSomething = true;
      }
    }

    if (existingForms.empty) {
      DEFAULT_FORM_TEMPLATES.forEach((tmpl) => {
        batch.set(doc(db, 'formTemplates', tmpl.id), {
          name: tmpl.name,
          description: tmpl.description,
          isDefault: tmpl.isDefault,
          fields: tmpl.fields,
          createdAt: now,
          updatedAt: now,
        });
      });
      wroteSomething = true;
    }

    let postersAlreadySeeded = false;
    try {
      postersAlreadySeeded = localStorage.getItem('rf_posters_seeded') === '1';
    } catch {
      postersAlreadySeeded = false;
    }

    if (existingPosters.empty && !postersAlreadySeeded) {
      DEFAULT_SEASON_POSTERS.forEach((p) => {
        const { id, ...rest } = p;
        batch.set(doc(db, 'seasonPosters', id), {
          ...rest,
          createdAt: now,
          updatedAt: now,
        });
      });
      wroteSomething = true;
      try {
        localStorage.setItem('rf_posters_seeded', '1');
      } catch {
        // ignore storage errors
      }
    }

    // Ensure bootstrapped owner staff record exists for alforat.rayt@gmail.com
    const ownerRef = doc(db, 'staff', BOOTSTRAPPED_ADMIN_EMAIL);
    const ownerSnap = await getDoc(ownerRef);
    if (!ownerSnap.exists()) {
      batch.set(ownerRef, {
        email: BOOTSTRAPPED_ADMIN_EMAIL,
        name: 'المدير العام — راية الفُرات',
        role: 'super_admin',
        active: true,
        permissions: ROLE_PRESET_PERMISSIONS.super_admin,
        createdAt: now,
        updatedAt: now,
      });
      wroteSomething = true;
    }

    // Remove legacy personal email staff record ONLY when signed in as the new owner
    if (currentEmail && currentEmail.trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL) {
      const legacyRef = doc(db, 'staff', 'alahsaey@gmail.com');
      try {
        const legacySnap = await getDoc(legacyRef);
        if (legacySnap.exists()) {
          batch.delete(legacyRef);
          wroteSomething = true;
        }
      } catch {
        // Ignore if cannot read legacy record
      }
    }

    if (wroteSomething) {
      await batch.commit();
    }
    return wroteSomething;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seedInitialAgencyData');
  }
}
