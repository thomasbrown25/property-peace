import { useEffect, useRef, useState, useCallback } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import useAuth from 'hooks/useAuth';

/**
 * Custom hook for managing SignalR connection for real-time conversation updates
 * Automatically connects when user is logged in and disconnects on logout
 */
export default function useSignalRConversations() {
  const { isLoggedIn, user } = useAuth();
  const [connectionState, setConnectionState] = useState('Disconnected'); // Disconnected, Connecting, Connected, Reconnecting
  const connectionRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const conversationHandlersRef = useRef([]);
  const messageHandlersRef = useRef([]);
  const handlerRegisteredRef = useRef(false);

  // Get API base URL - use the same as axios (from env var or default to HTTPS)
  const apiBaseUrl = import.meta.env.VITE_APP_API_URL || 'https://localhost:5001';
  const hubUrl = `${apiBaseUrl.replace(/\/$/, '')}/conversationHub`;

  /**
   * Register a callback to handle incoming conversation updates
   * @param {Function} handler - Callback function that receives the conversation update object
   * @returns {Function} - Unregister function
   */
  const onConversationUpdate = useCallback((handler) => {
    conversationHandlersRef.current.push(handler);
    
    // Return unregister function
    return () => {
      const index = conversationHandlersRef.current.indexOf(handler);
      if (index > -1) {
        conversationHandlersRef.current.splice(index, 1);
      }
    };
  }, []);

  /**
   * Register a callback to handle incoming message updates
   * @param {Function} handler - Callback function that receives the message update object
   * @returns {Function} - Unregister function
   */
  const onMessageUpdate = useCallback((handler) => {
    messageHandlersRef.current.push(handler);
    
    // Return unregister function
    return () => {
      const index = messageHandlersRef.current.indexOf(handler);
      if (index > -1) {
        messageHandlersRef.current.splice(index, 1);
      }
    };
  }, []);

  /**
   * Join a conversation group to receive real-time updates for that conversation
   */
  const joinConversation = useCallback(async (conversationId) => {
    if (connectionRef.current?.state === 'Connected' && conversationId) {
      try {
        await connectionRef.current.invoke('JoinConversation', conversationId);
      } catch (error) {
        // Error joining conversation - silently fail
      }
    }
  }, []);

  /**
   * Leave a conversation group
   */
  const leaveConversation = useCallback(async (conversationId) => {
    if (connectionRef.current?.state === 'Connected' && conversationId) {
      try {
        await connectionRef.current.invoke('LeaveConversation', conversationId);
      } catch (error) {
        // Error leaving conversation - silently fail
      }
    }
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
      const connection = new HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => {
            const currentToken = localStorage.getItem('serviceToken') || localStorage.getItem('token');
            return currentToken || '';
          },
          skipNegotiation: false,
          withCredentials: true
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
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
        handlerRegisteredRef.current = false;
        registerHandlers(connection);
      });

      // Register handlers for conversation and message updates
      const registerHandlers = (conn) => {
        if (handlerRegisteredRef.current) {
          return;
        }
        
        handlerRegisteredRef.current = true;
        
        // Handle conversation updates
        conn.on('ConversationUpdated', (conversation) => {
          conversationHandlersRef.current.forEach(handler => {
            try {
              handler(conversation);
            } catch (error) {
              // Error in conversation handler - silently fail
            }
          });
        });

        // Handle new messages
        conn.on('MessageReceived', (message) => {
          messageHandlersRef.current.forEach((handler) => {
            try {
              handler(message);
            } catch (error) {
              // Error in message handler - silently fail
            }
          });
        });

        // Handle conversation list updates
        conn.on('ConversationListUpdated', () => {
          conversationHandlersRef.current.forEach(handler => {
            try {
              handler(null); // Pass null to indicate list refresh needed
            } catch (error) {
              // Error in conversation handler - silently fail
            }
          });
        });
      };

      // Register the handlers before starting connection
      registerHandlers(connection);

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
        console.error('[SignalR Conversations] Error stopping connection:', error);
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
      conversationHandlersRef.current = [];
      messageHandlersRef.current = [];
    };
  }, [stopConnection]);

  return {
    connectionState,
    isConnected: connectionState === 'Connected',
    onConversationUpdate,
    onMessageUpdate,
    joinConversation,
    leaveConversation,
    reconnect: startConnection,
    disconnect: stopConnection
  };
}

