import React, { createContext, useContext, useEffect, useState } from 'react';

type Toast = { id: string; message: string; type?: 'info' | 'success' | 'error' };

const ToastContext = createContext<{
  push: (t: { message: string; type?: Toast['type']; duration?: number }) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = (t: { message: string; type?: Toast['type']; duration?: number }) => {
    const id = Math.random().toString(36).slice(2, 9);
    const toast: Toast = { id, message: t.message, type: t.type ?? 'info' };
    setToasts((s) => [toast, ...s]);

    const dur = t.duration ?? 4000;
    setTimeout(() => {
      setToasts((s) => s.filter((x) => x.id !== id));
    }, dur);
  };

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 60, display: 'grid', gap: 8 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ minWidth: 220, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--line)', padding: '10px 12px', borderRadius: 8, boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{t.type === 'success' ? 'Success' : t.type === 'error' ? 'Error' : 'Info'}</div>
            <div style={{ fontSize: 13 }}>{t.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

export default ToastProvider;
