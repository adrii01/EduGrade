import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/src/context/AuthContext';
import { db } from '@/src/firebase';
import { collection, query, where, getDocs, Timestamp, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { Notification as AppNotification } from '@/src/types';
import { toast } from 'sonner';
import { format, isSameDay, subDays, startOfDay } from 'date-fns';

export default function NotificationManager() {
  const { user } = useAuth();
  const checkedRef = useRef<Record<string, boolean>>({});

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error('Error marking as read', err);
    }
  };

  useEffect(() => {
    if (!user?.uid) return;
    
    let unsubscribe: () => void;
    
    const checkNotifications = async () => {
      try {
        const q = query(
          collection(db, 'notifications'), 
          where('teacherId', '==', user.uid),
          where('read', '==', false),
          where('notify', '==', true)
        );
        unsubscribe = onSnapshot(q, (snap) => {
          const now = startOfDay(new Date());

          snap.docs.forEach(docSnap => {
            const data = { id: docSnap.id, ...docSnap.data() } as AppNotification;
            if (checkedRef.current[data.id]) return;

            let targetDate: Date;
            if (data.date instanceof Timestamp) {
              targetDate = startOfDay(data.date.toDate());
            } else {
              targetDate = startOfDay(new Date(data.date));
            }

            const dayBefore = subDays(targetDate, 1);

            const toastConfig = {
              description: data.content,
              duration: 10000, // 10 seconds seems reasonable for a reminder
              action: {
                label: 'Cerrar',
                onClick: () => {} // Just close the toast without archiving
              }
            };

            if (isSameDay(now, targetDate)) {
              toast.info(`Recordatorio hoy: ${data.title}`, toastConfig);
              checkedRef.current[data.id] = true;
              triggerBrowserNotification(`Recordatorio Hoy: ${data.title}`, data.content);
            } else if (isSameDay(now, dayBefore)) {
              toast.info(`Recordatorio mañana: ${data.title}`, toastConfig);
              checkedRef.current[data.id] = true;
              triggerBrowserNotification(`Recordatorio Mañana: ${data.title}`, data.content);
            }
          });
        });
      } catch (err) {
        console.error('Error checking notifications', err);
      }
    };

    checkNotifications();

    // Request permission on mount if signed in
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid]);

  const triggerBrowserNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' });
    }
  };

  return null;
}
