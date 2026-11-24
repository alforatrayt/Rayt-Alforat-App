import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Share,
  PlusSquare,
  Smartphone,
  X,
  WifiOff,
  CheckCircle2,
  MonitorDown,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface PWAInstallButtonProps {
  compact?: boolean;
  fullWidth?: boolean;
  onActionDone?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  fullWidth = false,
  onActionDone,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  // Auto-hide completely when running as an installed standalone PWA
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      onActionDone?.();
      return;
    }
    setGuideOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="تثبيت تطبيق راية الفرات على جهازك"
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#B88E3E]/60 bg-[#FAF7F0] text-[#0F332B] hover:bg-[#EFE7D8] transition-colors font-semibold whitespace-nowrap shrink-0 min-h-[38px] ${
          fullWidth
            ? 'w-full px-4 py-2.5 text-sm'
            : compact
            ? 'px-2.5 py-1.5 text-xs'
            : 'px-3 py-1.5 text-xs sm:text-sm'
        }`}
      >
        <Smartphone className="w-4 h-4 text-[#0E6E73] shrink-0" />
        <span>تثبيت التطبيق</span>
      </button>

      {guideOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
            dir="rtl"
            onClick={() => setGuideOpen(false)}
          >
            <div
              className="w-full max-w-md bg-white rounded-3xl border border-[#E6DCCA] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-[#0F332B] text-white flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src="/pwa-192x192.png"
                    alt="شعار راية الفرات"
                    className="w-10 h-10 object-contain shrink-0"
                  />
                  <div>
                    <h3 className="font-display font-extrabold text-base leading-snug">
                      تثبيت تطبيق راية الفرات
                    </h3>
                    <p className="text-[11px] text-[#E8C97E]">
                      وصول سريع بملء الشاشة على جوالك وجهازك
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGuideOpen(false)}
                  className="p-1.5 rounded-lg text-white/75 hover:bg-white/10"
                  aria-label="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Guided Steps */}
              <div className="p-6 space-y-4">
                {isIOS ? (
                  <div className="space-y-3.5">
                    <p className="text-sm text-[#374B45] leading-relaxed font-medium">
                      لتثبيت التطبيق على جهاز <strong className="text-[#0F332B]">iPhone / iPad</strong> عبر متصفح Safari، اتبع الخطوات البسيطة التالية:
                    </p>

                    {/* Step 1 */}
                    <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#FAF7F0] border border-[#E6DCCA]">
                      <div className="w-9 h-9 rounded-xl bg-[#0F332B] text-[#E8C97E] flex items-center justify-center shrink-0">
                        <Share className="w-4 h-4" />
                      </div>
                      <div className="text-xs sm:text-sm text-[#142621] leading-relaxed">
                        <p className="font-bold text-[#0F332B]">1. اضغط على أيقونة المشاركة [⍐]</p>
                        <p className="text-[#556660]">
                          تجدها في شريط المتصفح أسفل الشاشة (أو في الأعلى على أجهزة iPad).
                        </p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#FAF7F0] border border-[#E6DCCA]">
                      <div className="w-9 h-9 rounded-xl bg-[#0E6E73] text-white flex items-center justify-center shrink-0">
                        <PlusSquare className="w-4 h-4" />
                      </div>
                      <div className="text-xs sm:text-sm text-[#142621] leading-relaxed">
                        <p className="font-bold text-[#0F332B]">
                          2. اختر &quot;إضافة إلى الصفحة الرئيسية&quot;
                        </p>
                        <p className="text-[#556660]">
                          مرّر القائمة للأسفل واختر <strong>Add to Home Screen</strong>.
                        </p>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#FAF7F0] border border-[#E6DCCA]">
                      <div className="w-9 h-9 rounded-xl bg-[#B88E3E] text-white flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="text-xs sm:text-sm text-[#142621] leading-relaxed">
                        <p className="font-bold text-[#0F332B]">3. اضغط &quot;إضافة / Add&quot;</p>
                        <p className="text-[#556660]">
                          سيظهر التطبيق بشعار راية الفرات على شاشتك الرئيسية مباشرة.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    <p className="text-sm text-[#374B45] leading-relaxed font-medium">
                      يمكنك تثبيت تطبيق <strong className="text-[#0F332B]">راية الفرات للسفر والسياحة</strong> للوصول الفوري بملء الشاشة دون شريط المتصفح:
                    </p>

                    <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#FAF7F0] border border-[#E6DCCA]">
                      <div className="w-9 h-9 rounded-xl bg-[#0F332B] text-[#E8C97E] flex items-center justify-center shrink-0">
                        <MonitorDown className="w-4 h-4" />
                      </div>
                      <div className="text-xs sm:text-sm text-[#142621] leading-relaxed">
                        <p className="font-bold text-[#0F332B]">أجهزة أندرويد والكمبيوتر (Chrome / Edge)</p>
                        <p className="text-[#556660]">
                          اضغط على أيقونة التثبيت <Download className="w-3.5 h-3.5 inline text-[#0E6E73]" /> في شريط العنوان، أو افتح قائمة المتصفح (⋮) واختر <strong>&quot;تثبيت التطبيق&quot;</strong> / <strong>&quot;إضافة إلى الشاشة الرئيسية&quot;</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#FAF7F0] border border-[#E6DCCA]">
                      <div className="w-9 h-9 rounded-xl bg-[#0E6E73] text-white flex items-center justify-center shrink-0">
                        <Share className="w-4 h-4" />
                      </div>
                      <div className="text-xs sm:text-sm text-[#142621] leading-relaxed">
                        <p className="font-bold text-[#0F332B]">أجهزة الآيفون والآيباد (Safari)</p>
                        <p className="text-[#556660]">
                          اضغط على أيقونة المشاركة [⍐] بالأسفل ثم اختر <strong>&quot;إضافة إلى الصفحة الرئيسية / Add to Home Screen&quot;</strong>.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setGuideOpen(false);
                    onActionDone?.();
                  }}
                  className="w-full py-2.5 rounded-xl font-display font-bold text-sm text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  حسناً، فهمت
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-[#B88E3E] px-3.5 py-2 text-xs font-bold text-white shadow-lg no-print"
      dir="rtl"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>وضع عدم الاتصال — يتم استخدام البيانات المحفوظة</span>
    </div>
  );
};
