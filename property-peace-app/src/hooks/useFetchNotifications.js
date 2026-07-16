import useSWR from 'swr';
import { useMemo, useEffect } from 'react';
import { fetcher } from 'utils/axios';
import useAuth from 'hooks/useAuth';
import useSignalRNotifications from 'hooks/useSignalRNotifications';

const endpoints = {
  key: 'api/notifications',
  list: () => `/list`,
  unreadCount: () => `/unread-count`,
  markAsRead: (notificationId) => `/mark-read/${notificationId}`,
  markAllAsRead: () => `/mark-all-read`
};

/**
 * Fetch notifications for the current user
 * Expects server response: { success: true, data: { notifications: [], unreadCount: number } }
 */
export default function useFetchNotifications() {
  const { user } = useAuth();
  const userId = user?.id;
  const { onNotification, isConnected } = useSignalRNotifications();

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    userId ? `${endpoints.key}${endpoints.list()}` : null,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: isConnected ? false : 30000 // Don't poll if SignalR is connected, otherwise poll every 30 seconds
    }
  );

  const notifications = data?.data?.notifications || data?.notifications || [];
  const unreadCount = data?.data?.unreadCount || data?.unreadCount || 0;

  // Listen for real-time notifications via SignalR
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = onNotification((notification) => {
      // Optimistically update the cache with the new notification
      
      mutate(
        (currentData) => {
          if (!currentData) {
            // If no data yet, fetch from server
            mutate();
            return currentData;
          }

          // Check if notification already exists (avoid duplicates)
          const existingNotifications = currentData?.data?.notifications || currentData?.notifications || [];
          const notificationExists = existingNotifications.some(n => n.id === notification.id);
          
          if (notificationExists) {
            return currentData; // Already have it, no update needed
          }

          // Add new notification to the beginning of the list
          const updatedNotifications = [notification, ...existingNotifications];
          const updatedUnreadCount = (currentData?.data?.unreadCount || currentData?.unreadCount || 0) + 1;

          // Return updated data structure
          if (currentData?.data) {
            return {
              ...currentData,
              data: {
                ...currentData.data,
                notifications: updatedNotifications,
                unreadCount: updatedUnreadCount
              }
            };
          } else {
            return {
              ...currentData,
              notifications: updatedNotifications,
              unreadCount: updatedUnreadCount
            };
          }
        },
        { revalidate: false } // Don't refetch immediately, we already have the data
      );

      // Optionally revalidate in the background to ensure consistency
      setTimeout(() => {
        mutate();
      }, 1000);
    });

    return unsubscribe;
  }, [isConnected, onNotification, mutate]);

  return useMemo(
    () => ({
      notifications,
      unreadCount,
      notificationsLoading: isLoading || isValidating,
      notificationsError: error,
      refetch: mutate
    }),
    [notifications, unreadCount, isLoading, isValidating, error, mutate]
  );
}

/**
 * Fetch unread notification count
 */
export function useFetchUnreadCount() {
  const { user } = useAuth();
  const userId = user?.id;
  const { onNotification, isConnected } = useSignalRNotifications();

  const { data, error, mutate } = useSWR(
    userId ? `${endpoints.key}${endpoints.unreadCount()}` : null,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: isConnected ? false : 30000 // Don't poll if SignalR is connected
    }
  );

  const unreadCount = data?.data?.unreadCount || data?.unreadCount || 0;

  // Listen for real-time notifications via SignalR to update count
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = onNotification((notification) => {
      // Optimistically update the unread count
      mutate(
        (currentData) => {
          if (!currentData) {
            mutate();
            return currentData;
          }

          const currentCount = currentData?.data?.unreadCount || currentData?.unreadCount || 0;
          const updatedCount = currentCount + 1;

          if (currentData?.data) {
            return {
              ...currentData,
              data: {
                ...currentData.data,
                unreadCount: updatedCount
              }
            };
          } else {
            return {
              ...currentData,
              unreadCount: updatedCount
            };
          }
        },
        { revalidate: false }
      );

      // Revalidate in background
      setTimeout(() => {
        mutate();
      }, 1000);
    });

    return unsubscribe;
  }, [isConnected, onNotification, mutate]);

  return useMemo(
    () => ({
      unreadCount,
      unreadCountError: error
    }),
    [unreadCount, error]
  );
}

export { endpoints };

