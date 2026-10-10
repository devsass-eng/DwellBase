import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = 'success' | 'info' | 'warning' | 'error';
export type RecipientType = 'landlord' | 'tenant';

export interface AppNotification {
  id: string;
  recipientType: RecipientType;
  recipientId?: string; // tenant id if tenant-specific
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface Toast {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  notifications: AppNotification[];
  toasts: Toast[];
  unreadCount: (recipientType: RecipientType, recipientId?: string) => number;
  addNotification: (n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => void;
  markRead: (id: string) => void;
  markAllRead: (recipientType: RecipientType, recipientId?: string) => void;
  dismissToast: (id: string) => void;
  // Convenience: add notification + show toast
  notify: (n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>, showToast?: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => {
    const newNotif: AppNotification = {
      ...n,
      id: crypto.randomUUID(),
      read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications(prev => [newNotif, ...prev]);
  }, []);

  const showToast = useCallback((title: string, message: string, type: NotificationType) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, title, message, type }]);
    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const notify = useCallback((
    n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>,
    showToastFlag = true
  ) => {
    addNotification(n);
    if (showToastFlag) showToast(n.title, n.message, n.type);
  }, [addNotification, showToast]);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback((recipientType: RecipientType, recipientId?: string) => {
    setNotifications(prev => prev.map(n => {
      if (n.recipientType !== recipientType) return n;
      if (recipientId && n.recipientId !== recipientId) return n;
      return { ...n, read: true };
    }));
  }, []);

  const unreadCount = useCallback((recipientType: RecipientType, recipientId?: string) => {
    return notifications.filter(n => {
      if (n.read) return false;
      if (n.recipientType !== recipientType) return false;
      if (recipientId && n.recipientId && n.recipientId !== recipientId) return false;
      return true;
    }).length;
  }, [notifications]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications, toasts, unreadCount,
      addNotification, markRead, markAllRead,
      dismissToast, notify,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};
