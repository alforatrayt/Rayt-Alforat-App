import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';

export const LOCKOUT_MAX_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_STORAGE_KEY = 'rf_auth_lockouts_v1';

interface LocalLockRecord {
  failedAttempts: number;
  lockedUntil: number;
}

function readLockStore(): Record<string, LocalLockRecord> {
  try {
    const raw = localStorage.getItem(LOCKOUT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLockStore(store: Record<string, LocalLockRecord>): void {
  try {
    localStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage quota/privacy mode errors
  }
}

export function getLocalLockState(email: string): {
  isLocked: boolean;
  failedAttempts: number;
  remainingMs: number;
  lockedUntil: number;
} {
  const key = email.trim().toLowerCase();
  if (!key) {
    return { isLocked: false, failedAttempts: 0, remainingMs: 0, lockedUntil: 0 };
  }
  const store = readLockStore();
  const rec = store[key];
  if (!rec) {
    return { isLocked: false, failedAttempts: 0, remainingMs: 0, lockedUntil: 0 };
  }
  const now = Date.now();
  if (rec.lockedUntil > now) {
    return {
      isLocked: true,
      failedAttempts: rec.failedAttempts,
      remainingMs: rec.lockedUntil - now,
      lockedUntil: rec.lockedUntil,
    };
  }
  if (rec.lockedUntil > 0 && rec.lockedUntil <= now) {
    delete store[key];
    writeLockStore(store);
    return { isLocked: false, failedAttempts: 0, remainingMs: 0, lockedUntil: 0 };
  }
  return {
    isLocked: false,
    failedAttempts: rec.failedAttempts || 0,
    remainingMs: 0,
    lockedUntil: 0,
  };
}

export function recordLocalFailedAttempt(email: string): {
  failedAttempts: number;
  isLocked: boolean;
  lockedUntil: number;
  remainingMs: number;
  attemptsLeft: number;
} {
  const key = email.trim().toLowerCase();
  const store = readLockStore();
  const prev = store[key] || { failedAttempts: 0, lockedUntil: 0 };
  const now = Date.now();
  const baseCount = prev.lockedUntil > 0 && prev.lockedUntil <= now ? 0 : prev.failedAttempts || 0;
  const failedAttempts = baseCount + 1;
  const isLocked = failedAttempts >= LOCKOUT_MAX_ATTEMPTS;
  const lockedUntil = isLocked ? now + LOCKOUT_DURATION_MS : 0;

  store[key] = { failedAttempts, lockedUntil };
  writeLockStore(store);

  return {
    failedAttempts,
    isLocked,
    lockedUntil,
    remainingMs: isLocked ? LOCKOUT_DURATION_MS : 0,
    attemptsLeft: Math.max(0, LOCKOUT_MAX_ATTEMPTS - failedAttempts),
  };
}

export function clearLocalFailedAttempts(email: string): void {
  const key = email.trim().toLowerCase();
  if (!key) return;
  const store = readLockStore();
  if (store[key]) {
    delete store[key];
    writeLockStore(store);
  }
}

export function formatRemainingLockout(ms: number): string {
  const totalSeconds = Math.max(1, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins <= 0) {
    return `${secs} ثانية`;
  }
  return `${mins} دقيقة و ${secs} ثانية`;
}

// ==================== STRONG PASSWORD VALIDATION ====================

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateStrongPassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  if (password.length < 8) {
    errors.push('يجب أن تتكون كلمة المرور من 8 خانات على الأقل');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('يجب أن تحتوي على حرف إنجليزي كبير واحد على الأقل (A-Z)');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('يجب أن تحتوي على حرف إنجليزي صغير واحد على الأقل (a-z)');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('يجب أن تحتوي على رقم واحد على الأقل (0-9)');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('يجب أن تحتوي على رمز خاص واحد على الأقل (مثل !@#$%)');
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function generateTemporaryPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const all = upper + lower + digits + symbols;

  const pick = (pool: string) => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return pool[arr[0] % pool.length];
  };

  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  for (let i = chars.length; i < length; i++) {
    chars.push(pick(all));
  }
  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const j = arr[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// ==================== TOTP 2FA (GOOGLE / MICROSOFT AUTHENTICATOR) ====================

export function createTotpSetup(
  email: string,
  issuerName = 'راية الفرات للسفر والسياحة'
): { secret: string; otpauthUri: string } {
  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({
    issuer: issuerName,
    label: email.trim().toLowerCase(),
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  });
  return {
    secret: secret.base32,
    otpauthUri: totp.toString(),
  };
}

export function buildTotpUriFromSecret(
  email: string,
  base32Secret: string,
  issuerName = 'راية الفرات للسفر والسياحة'
): string {
  const totp = new OTPAuth.TOTP({
    issuer: issuerName,
    label: email.trim().toLowerCase(),
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(base32Secret),
  });
  return totp.toString();
}

export async function generateQrCodeDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, {
    width: 240,
    margin: 2,
    color: {
      dark: '#0F332B',
      light: '#FFFFFF',
    },
  });
}

export function verifyTotpCode(base32Secret: string, code: string): boolean {
  const normalized = code.replace(/\s+/g, '').trim();
  if (!/^\d{6}$/.test(normalized) || !base32Secret) {
    return false;
  }
  try {
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(base32Secret.trim()),
    });
    const delta = totp.validate({ token: normalized, window: 1 });
    return delta !== null;
  } catch {
    return false;
  }
}
