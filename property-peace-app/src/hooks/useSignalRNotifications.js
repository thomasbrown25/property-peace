import { useEffect, useRef, useState, useCallback } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import useAuth from 'hooks/useAuth';
import { openSnackbar } from 'api/snackbar';

/**
 * Custom hook for managing SignalR connection and real-time notifications
 * Automatically connects when user is logged in and disconnects on logout
 */
export default function useSignalRNotifications() {
  const { isLoggedIn, user } = useAuth();
  const [connectionState, setConnectionState] = useState('Disconnected'); // Disconnected, Connecting, Connected, Reconnecting
  const connectionRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const notificationHandlersRef = useRef([]);
  const leaseSignatureUpdatedHandlersRef = useRef([]);
  const handlerRegisteredRef = useRef(false);

  // Get API base URL - use the same as axios (from env var or default to HTTPS)
  // This ensures SignalR uses the same URL as all other API calls
  const apiBaseUrl = import.meta.env.VITE_APP_API_URL || 'https://localhost:5001';
  const hubUrl = `${apiBaseUrl.replace(/\/$/, '')}/notificationHub`;

  /**
   * Register a callback to handle incoming notifications
   * @param {Function} handler - Callback function that receives the notification object
   * @returns {Function} - Unregister function
   */
  const onNotification = useCallback((handler) => {
    notificationHandlersRef.current.push(handler);

    return () => {
      const index = notificationHandlersRef.current.indexOf(handler);
      if (index > -1) {
        notificationHandlersRef.current.splice(index, 1);
      }
    };
  }, []);

  /**
   * Register a callback for LeaseSignatureUpdated (DocuSign Connect real-time update).
   * @param {Function} handler - Callback that receives { leaseId }
   * @returns {Function} - Unregister function
   */
  const onLeaseSignatureUpdated = useCallback((handler) => {
    leaseSignatureUpdatedHandlersRef.current.push(handler);

    return () => {
      const index = leaseSignatureUpdatedHandlersRef.current.indexOf(handler);
      if (index > -1) {
        leaseSignatureUpdatedHandlersRef.current.splice(index, 1);
      }
    };
  }, []);

  /**
   * Start SignalR connection
   */
  const startConnection = useCallback(async () => {
    if (!isLoggedIn || !user?.id) {
      return;
    }

    // Get token for authentication
    const token = localStorage.getItem('serviceToken') || localStorage.getItem('token');
    if (!token) {
      return;
    }

    // If already connected or connecting, don't start again
    if (connectionRef.current?.state === 'Connected' || connectionRef.current?.state === 'Connecting') {
      return;
    }

    try {
      setConnectionState('Connecting');
      
        // Build connection with JWT token
        // hubUrl uses HTTPS (same as other API calls)
        const connection = new HubConnectionBuilder()
          .withUrl(hubUrl, {
            accessTokenFactory: () => {
              const currentToken = localStorage.getItem('serviceToken') || localStorage.getItem('token');
              return currentToken || '';
            },
            skipNegotiation: false,
            // Let SignalR choose the best transport automatically (WebSockets, Server-Sent Events, Long Polling)
            // Don't force WebSockets in case it's not available
            withCredentials: true // Always include credentials for authenticated requests
          })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            // Exponential backoff: 0s, 2s, 10s, 30s, then 30s intervals
            if (retryContext.previousRetryCount === 0) return 2000;
            if (retryContext.previousRetryCount === 1) return 10000;
            if (retryContext.previousRetryCount === 2) return 30000;
            return 30000;
          }
        })
        .configureLogging(LogLevel.Warning)
        .build();

      // Handle connection state changes
      connection.onclose((error) => {
        setConnectionState('Disconnected');
        
        // Attempt to reconnect if user is still logged in
        if (isLoggedIn && !error) {
          // Only reconnect if it wasn't a manual close
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isLoggedIn) {
              startConnection();
            }
          }, 3000);
        }
      });

      connection.onreconnecting((error) => {
        setConnectionState('Reconnecting');
      });

      connection.onreconnected((connectionId) => {
        setConnectionState('Connected');
        // Reset handler flag since we're using the same connection object
        handlerRegisteredRef.current = false;
        // Re-register handlers after reconnection (they should persist, but just to be safe)
        registerNotificationHandler(connection);
      });

      // Register notification handler
      const registerNotificationHandler = (conn) => {
        // Only register once per connection instance (check if already registered for this connection)
        if (handlerRegisteredRef.current) {
          return;
        }
        
        handlerRegisteredRef.current = true;

        conn.on('LeaseSignatureUpdated', (payload) => {
          leaseSignatureUpdatedHandlersRef.current.forEach(handler => {
            try {
              handler(payload);
            } catch (err) {
              // Silently fail
            }
          });
        });

        conn.on('ReceiveNotification', (notification) => {
          notificationHandlersRef.current.forEach(handler => {
            try {
              handler(notification);
            } catch (error) {
              // Error in notification handler - silently fail
            }
          });

          // Determine notification color based on type
          const getNotificationColor = (type) => {
            // Handle both string and numeric enum values
            let typeString = type;
            if (typeof type === 'number') {
              // Map numeric enum values (C# enum order: Rent=0, Maintenance=1, Payment=2, Lease=3, Message=4, Expense=5, System=6, Application=7, RentPaymentSetupReminder=8)
              const enumMap = { 0: 'rent', 1: 'maintenance', 2: 'payment', 3: 'lease', 4: 'message', 5: 'expense', 6: 'system', 7: 'application', 8: 'rentpaymentsetupreminder' };
              typeString = enumMap[type] || '';
            } else if (typeof type === 'string') {
              typeString = type.toLowerCase();
            } else {
              typeString = '';
            }
            
            const typeMap = {
              rent: 'warning',
              payment: 'success',
              maintenance: 'info',
              lease: 'info',
              message: 'info',
              rentpaymentsetupreminder: 'primary',
              default: 'info'
            };
            return typeMap[typeString] || typeMap.default;
          };

          // Determine notification icon/variant
          const notificationColor = getNotificationColor(notification?.type);
          const notificationMessage = notification?.title || notification?.message || 'New notification';

          // Show toast notification with appropriate styling
          try {
            openSnackbar({
              open: true,
              message: notificationMessage,
              variant: 'alert',
              alert: { 
                color: notificationColor,
                variant: 'filled'
              },
              close: true, // Show close button
              actionButton: false, // Don't show UNDO button
              anchorOrigin: {
                vertical: 'bottom',
                horizontal: 'right'
              },
              transition: 'SlideUp',
              autoHideDuration: 5000 // Show for 5 seconds instead of default 1.5
            });
          } catch (error) {
            // Error opening snackbar - silently fail
          }
        });
      };

      // Register the handler before starting connection
      registerNotificationHandler(connection);

      // Start connection
      await connection.start();
      setConnectionState('Connected');
      
      connectionRef.current = connection;
    } catch (error) {
      setConnectionState('Disconnected');
      
      // Retry connection after a delay (only if it's not an auth error)
      if (!error.message?.includes('401') && !error.message?.includes('Unauthorized')) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isLoggedIn) {
            startConnection();
          }
        }, 5000);
      }
    }
  }, [isLoggedIn, user?.id, hubUrl]);

  /**
   * Stop SignalR connection
   */
  const stopConnection = useCallback(async () => {
    clearTimeout(reconnectTimeoutRef.current);
    
    if (connectionRef.current) {
      try {
        await connectionRef.current.stop();
      } catch (error) {
        // Error stopping connection - silently fail
      }
      connectionRef.current = null;
    }
    
    handlerRegisteredRef.current = false;
    setConnectionState('Disconnected');
  }, []);

      // Connect when user logs in, disconnect when user logs out
  useEffect(() => {
    if (isLoggedIn && user?.id) {
      startConnection();
    } else {
      stopConnection();
    }

    // Cleanup on unmount
    return () => {
      stopConnection();
    };
  }, [isLoggedIn, user?.id, startConnection, stopConnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopConnection();
      notificationHandlersRef.current = [];
      leaseSignatureUpdatedHandlersRef.current = [];
    };
  }, [stopConnection]);

  return {
    connectionState,
    isConnected: connectionState === 'Connected',
    onNotification,
    onLeaseSignatureUpdated,
    reconnect: startConnection,
    disconnect: stopConnection
  };
}

