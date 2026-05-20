"use client";

import * as React from "react";

export type ToastInput = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: "default" | "destructive";
};

type ToastState = ToastInput & {
  id: string;
  open: boolean;
};

type ToastContextValue = {
  toasts: ToastState[];
  toast: (toast: ToastInput) => void;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastStateProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastState[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) =>
      current.map((toast) =>
        toast.id === id ? { ...toast, open: false } : toast
      )
    );
  }, []);

  const toast = React.useCallback((input: ToastInput) => {
    const id = crypto.randomUUID();
    setToasts((current) => [
      ...current.slice(-2),
      {
        ...input,
        id,
        open: true,
      },
    ]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastStateProvider");
  }

  return context;
}
