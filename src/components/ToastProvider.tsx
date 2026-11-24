import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed bottom-5 left-5 z-[100] flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2.5rem)] pointer-events-none no-print"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-xl border shadow-lg transition-all duration-200 ${
              t.kind === 'success'
                ? 'bg-[#0F332B] text-white border-[#B88E3E]/40'
                : t.kind === 'error'
                ? 'bg-[#7F1D1D] text-white border-red-400/40'
                : 'bg-white text-[#142621] border-[#E6DCCA]'
            }`}
          >
            {t.kind === 'success' && <CheckCircle2 className="w-5 h-5 text-[#D8B464] shrink-0 mt-0.5" />}
            {t.kind === 'error' && <AlertCircle className="w-5 h-5 text-red-200 shrink-0 mt-0.5" />}
            {t.kind === 'info' && <Info className="w-5 h-5 text-[#0E6E73] shrink-0 mt-0.5" />}
            <p className="text-sm font-medium leading-relaxed flex-1">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="opacity-70 hover:opacity-100 p-0.5 transition-opacity"
              aria-label="إغلاق الإشعار"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
