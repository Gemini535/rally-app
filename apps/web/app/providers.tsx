'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Toast = { id: number; message: string };
const ToastContext = createContext<(message: string) => void>(() => undefined);

export function useRallyToast() { return useContext(ToastContext); }
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 2, retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000) } } }));
  const [online, setOnline] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = (message: string) => {
    const id = Date.now();
    setToasts((current) => [...current, { id, message }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4_000);
  };
  useEffect(() => { const update = () => setOnline(navigator.onLine); update(); window.addEventListener('online', update); window.addEventListener('offline', update); return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); }; }, []);
  useEffect(() => { const report = (event: Event) => toast((event as CustomEvent<string>).detail); window.addEventListener('rally-api-error', report); return () => window.removeEventListener('rally-api-error', report); }, []);
  return <QueryClientProvider client={client}><ToastContext.Provider value={toast}>{!online && <div role="status" className="fixed inset-x-0 top-0 z-[100] bg-amber-400 px-4 py-2 text-center text-sm font-medium text-black">You’re offline — Rally will catch up when you’re back.</div>}{children}<div aria-live="polite" className="fixed inset-x-4 bottom-20 z-[110] mx-auto flex max-w-sm flex-col gap-2 lg:bottom-6">{toasts.map((item) => <p key={item.id} role="status" className="rounded-control border border-rose-400/50 bg-rally-surface px-4 py-3 text-sm text-rally-primary">{item.message}</p>)}</div></ToastContext.Provider></QueryClientProvider>;
}
