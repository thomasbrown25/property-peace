import * as SignalR from '@microsoft/signalr';
import config from '../config';
import storageService from './storageService';

class SignalRService {
  private connection: SignalR.HubConnection | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async connect(): Promise<SignalR.HubConnection> {
    if (this.connection?.state === SignalR.HubConnectionState.Connected) {
      return this.connection;
    }

    const token = await storageService.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    this.connection = new SignalR.HubConnectionBuilder()
      .withUrl(config.SIGNALR_URL, {
        accessTokenFactory: async () => {
          const currentToken = await storageService.getToken();
          return currentToken || '';
        },
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          if (retryContext.previousRetryCount < this.maxReconnectAttempts) {
            return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
          }
          return null;
        },
      })
      .build();

    // Set up event handlers
    this.connection.onclose((error) => {
      console.log('SignalR connection closed', error);
      this.reconnectAttempts = 0;
    });

    this.connection.onreconnecting((error) => {
      console.log('SignalR reconnecting...', error);
      this.reconnectAttempts++;
    });

    this.connection.onreconnected((connectionId) => {
      console.log('SignalR reconnected', connectionId);
      this.reconnectAttempts = 0;
    });

    try {
      await this.connection.start();
      console.log('SignalR connected');
      return this.connection;
    } catch (error) {
      console.error('SignalR connection error:', error);
      this.connection = null;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
      this.reconnectAttempts = 0;
    }
  }

  getConnection(): SignalR.HubConnection | null {
    return this.connection;
  }

  isConnected(): boolean {
    return this.connection?.state === SignalR.HubConnectionState.Connected;
  }

  // Subscribe to notifications
  onNotification(callback: (notification: any) => void): void {
    if (this.connection) {
      this.connection.on('ReceiveNotification', callback);
    }
  }

  // Subscribe to new messages
  onNewMessage(callback: (message: any) => void): void {
    if (this.connection) {
      this.connection.on('ReceiveMessage', callback);
    }
  }

  // Unsubscribe from events
  off(eventName: string): void {
    if (this.connection) {
      this.connection.off(eventName);
    }
  }
}

export default new SignalRService();
