export function normalizePhone(phone: string): string {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const normalized = phone
    .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)))
    .replace(/[^0-9]/g, '');
  return normalized;
}

export function buildTrackerId(bookingRef: string, phone: string): string {
  const cleanRef = bookingRef.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const cleanPhone = normalizePhone(phone);
  return `${cleanRef}_${cleanPhone}`;
}

export function generateBookingRef(): string {
  const randomPart = Math.floor(100000 + Math.random() * 900000);
  return `RF-${randomPart}`;
}

export function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export async function compressFileToDataUrl(
  file: File,
  maxWidth = 960,
  maxBytes = 190000,
  preserveTransparency = false
): Promise<{ dataUrl: string; mimeType: string; fileName: string }> {
  if (file.type === 'application/pdf') {
    const dataUrl = await readAsDataUrl(file);
    if (dataUrl.length > 240000) {
      throw new Error('حجم ملف PDF كبير جداً. يُرجى اختيار ملف أصغر من 170 كيلوبايت أو رفع صورة واضحة للمستند.');
    }
    return { dataUrl, mimeType: file.type, fileName: file.name };
  }

  if (!file.type.startsWith('image/')) {
    throw new Error('يُرجى رفع صورة (JPG / PNG / WebP) أو ملف PDF صالح.');
  }

  const rawDataUrl = await readAsDataUrl(file);
  const img = await loadImage(rawDataUrl);

  const canvas = document.createElement('canvas');
  let targetWidth = img.width || maxWidth;
  let targetHeight = img.height || maxWidth;

  if (targetWidth > maxWidth) {
    targetHeight = Math.round((targetHeight * maxWidth) / targetWidth);
    targetWidth = maxWidth;
  }
  if (targetHeight > maxWidth && preserveTransparency) {
    targetWidth = Math.round((targetWidth * maxWidth) / targetHeight);
    targetHeight = maxWidth;
  }

  canvas.width = Math.max(1, targetWidth);
  canvas.height = Math.max(1, targetHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('تعذر معالجة الصورة في المتصفح.');
  }

  const supportsAlpha =
    preserveTransparency &&
    (file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/svg+xml');

  if (supportsAlpha) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let pngOutput = canvas.toDataURL('image/png');
    if (pngOutput.length <= maxBytes) {
      return {
        dataUrl: pngOutput,
        mimeType: 'image/png',
        fileName: file.name,
      };
    }

    // Try slightly smaller PNG before falling back to WebP/JPEG to keep alpha edges crisp
    for (const scale of [0.76, 0.56]) {
      const scaled = document.createElement('canvas');
      scaled.width = Math.max(64, Math.round(canvas.width * scale));
      scaled.height = Math.max(64, Math.round(canvas.height * scale));
      const sCtx = scaled.getContext('2d');
      if (sCtx) {
        sCtx.clearRect(0, 0, scaled.width, scaled.height);
        sCtx.drawImage(img, 0, 0, scaled.width, scaled.height);
        pngOutput = scaled.toDataURL('image/png');
        if (pngOutput.length <= maxBytes) {
          return {
            dataUrl: pngOutput,
            mimeType: 'image/png',
            fileName: file.name,
          };
        }
      }
    }

    const webpOutput = canvas.toDataURL('image/webp', 0.86);
    if (webpOutput.startsWith('data:image/webp') && webpOutput.length <= maxBytes) {
      return {
        dataUrl: webpOutput,
        mimeType: 'image/webp',
        fileName: file.name,
      };
    }
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let quality = 0.78;
  let output = canvas.toDataURL('image/jpeg', quality);
  while (output.length > maxBytes && quality > 0.35) {
    quality -= 0.1;
    output = canvas.toDataURL('image/jpeg', quality);
  }

  if (output.length > 245000) {
    const smallerCanvas = document.createElement('canvas');
    smallerCanvas.width = Math.round(canvas.width * 0.65);
    smallerCanvas.height = Math.round(canvas.height * 0.65);
    const sCtx = smallerCanvas.getContext('2d');
    if (sCtx) {
      sCtx.fillStyle = '#FFFFFF';
      sCtx.fillRect(0, 0, smallerCanvas.width, smallerCanvas.height);
      sCtx.drawImage(img, 0, 0, smallerCanvas.width, smallerCanvas.height);
      output = smallerCanvas.toDataURL('image/jpeg', 0.6);
    }
  }

  return {
    dataUrl: output,
    mimeType: 'image/jpeg',
    fileName: file.name,
  };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('تعذر قراءة الملف المختار.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('تعذر تحميل الصورة للمعالجة.'));
    img.src = src;
  });
}
