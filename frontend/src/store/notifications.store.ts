import { create } from 'zustand';

export type NotificationType = 'solicitud_nueva';

export interface Notification {
  id:        string;
  type:      NotificationType;
  title:     string;
  body:      string;
  entityId?: string;
  createdAt: string;
  read:      boolean;
}

interface NotificationsState {
  notifications: Notification[];
  addNotification: (payload: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markRead:        (id: string) => void;
  markAllRead:     () => void;
}

const MAX_NOTIFICATIONS = 50;

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],

  addNotification: (payload) => set((state) => {
    const nueva: Notification = {
      ...payload,
      id:        crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      read:      false,
    };
    const updated = [nueva, ...state.notifications];
    return { notifications: updated.slice(0, MAX_NOTIFICATIONS) };
  }),

  markRead: (id) => set((state) => ({
    notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n),
  })),

  markAllRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, read: true })),
  })),
}));

export const selectUnreadCount = (state: NotificationsState) =>
  state.notifications.filter(n => !n.read).length;
