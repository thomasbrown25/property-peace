import { useEffect } from 'react';
import useSignalRNotifications from 'hooks/useSignalRNotifications';
import useAuth from 'hooks/useAuth';

/**
 * Component to initialize SignalR connection globally
 * This ensures the connection is established when user is logged in
 */
export default function SignalRConnection() {
  const { isLoggedIn, user } = useAuth();
  const { connectionState, isConnected } = useSignalRNotifications();

  // This component doesn't render anything, it just initializes the connection
  // Connection status is logged in useSignalRNotifications hook

  // Return null - this component doesn't render anything
  return null;
}

