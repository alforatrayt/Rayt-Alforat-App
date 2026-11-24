export interface SharePayload {
  title?: string;
  text?: string;
  url?: string;
}

export async function shareSiteOrPackage(
  payload: SharePayload,
  onCopied: (message: string) => void
): Promise<void> {
  const shareUrl =
    payload.url || (typeof window !== 'undefined' ? window.location.href : '');
  const shareTitle = payload.title || 'راية الفرات للسفر والسياحة';
  const shareText =
    payload.text || 'اكتشف أحدث عروض وباقات السفر مع مكتب راية الفرات';

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      });
      return;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      // Fall back to clipboard copy on unsupported desktop environments
    }
  }

  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(shareUrl);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    onCopied('تم نسخ رابط الموقع بنجاح، يمكنك مشاركته الآن');
  } catch {
    onCopied('تم نسخ رابط الموقع بنجاح، يمكنك مشاركته الآن');
  }
}
