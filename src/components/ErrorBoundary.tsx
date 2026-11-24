import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let readable = error.message || 'حدث خطأ غير متوقع في التطبيق.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.error) {
        if (String(parsed.error).includes('permission') || String(parsed.error).includes('PERMISSION_DENIED')) {
          readable = 'عذراً، لا تملك صلاحية كافية لتنفيذ هذه العملية في قاعدة البيانات.';
        } else if (String(parsed.error).includes('Quota exceeded')) {
          readable = 'تم تجاوز الحصة اليومية لقاعدة البيانات، يُرجى المحاولة لاحقاً.';
        } else {
          readable = String(parsed.error);
        }
      }
    } catch {
      // keep raw message
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F4EC] p-6" dir="rtl">
          <div className="max-w-md w-full bg-white border border-[#E6DCCA] rounded-2xl p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-700" />
            </div>
            <h2 className="font-display text-xl font-bold text-[#0F332B] mb-2">
              تعذر إتمام الطلب
            </h2>
            <p className="text-sm text-[#556660] leading-relaxed mb-6">{this.state.message}</p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F332B] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <RotateCcw className="w-4 h-4" />
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
