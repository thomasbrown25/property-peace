import * as SignalR from '@microsoft/signalr';
import config from '../config';
import storageService from './storageService';
import { ConversationSubscriptionRegistry, normalizeSubscriptionId, SubscriptionOrganizationId, SubscriptionConversationId } from './conversationSubscriptionRegistry';

class SignalRService {
  private connection: SignalR.HubConnection | null = null;
  private connectionOrganizationId: string | null = null;
  private connectPromise: Promise<SignalR.HubConnection> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private conversationSubscriptions = new ConversationSubscriptionRegistry();
  private joinedConversationIds = new Set<number>();

  async connect(organizationId: string | number | null | undefined): Promise<SignalR.HubConnection> {
    const normalizedOrganizationId = normalizeSubscriptionId(String(organizationId ?? ''), 'active organization');

    // Serialize starts so a rapid organization switch cannot leave the older
    // connection alive after the newer scope has been selected.
    if (this.connectPromise) {
      try { await this.connectPromise; } catch { /* The new scope can retry below. */ }
    }

    if (this.connection && this.connectionOrganizationId !== normalizedOrganizationId) {
      await this.disconnect();
    }
    if (this.connection?.state === SignalR.HubConnectionState.Connected) {
      return this.connection;
    }

    const startPromise = this.startConnection(normalizedOrganizationId);
    this.connectPromise = startPromise;
    try {
      return await startPromise;
    } finally {
      if (this.connectPromise === startPromise) this.connectPromise = null;
    }
  }

  private async startConnection(normalizedOrganizationId: string): Promise<SignalR.HubConnection> {
    const token = await storageService.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const connection = new SignalR.HubConnectionBuilder()
      .withUrl(config.SIGNALR_URL, {
        accessTokenFactory: async () => {
          const currentToken = await storageService.getToken();
          return currentToken || '';
        },
        headers: { 'X-Organization-Id': normalizedOrganizationId },
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

    this.connection = connection;
    this.connectionOrganizationId = normalizedOrganizationId;

    connection.onclose((error) => {
      console.log('SignalR connection closed', error);
      this.reconnectAttempts = 0;
      if (this.connection === connection) this.joinedConversationIds.clear();
    });

    connection.onreconnecting((error) => {
      console.log('SignalR reconnecting...', error);
      this.reconnectAttempts++;
      if (this.connection === connection) this.joinedConversationIds.clear();
    });

    connection.onreconnected((connectionId) => {
      console.log('SignalR reconnected', connectionId);
      this.reconnectAttempts = 0;
      void this.restoreConversationSubscriptions(connection, normalizedOrganizationId);
    });

    try {
      await connection.start();
      console.log('SignalR connected');
      await this.restoreConversationSubscriptions(connection, normalizedOrganizationId);
      return connection;
    } catch (error) {
      console.error('SignalR connection error:', error);
      if (this.connection === connection) {
        this.connection = null;
        this.connectionOrganizationId = null;
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    const connection = this.connection;
    this.connection = null;
    this.connectionOrganizationId = null;
    this.reconnectAttempts = 0;
    this.joinedConversationIds.clear();
    if (connection) await connection.stop();
  }

  async subscribeToConversation(organizationId: SubscriptionOrganizationId, conversationId: SubscriptionConversationId): Promise<void> {
    const normalizedOrganizationId = normalizeSubscriptionId(organizationId, 'active organization');
    const normalizedConversationId = Number(normalizeSubscriptionId(conversationId, 'conversation'));
    const isFirstSubscriber = this.conversationSubscriptions.subscribe(normalizedOrganizationId, normalizedConversationId);
    if (isFirstSubscriber && this.connection && this.connectionOrganizationId === normalizedOrganizationId && this.isConnected()) {
      await this.joinConversationIfActive(this.connection, normalizedOrganizationId, normalizedConversationId);
    }
  }

  async unsubscribeFromConversation(organizationId: SubscriptionOrganizationId, conversationId: SubscriptionConversationId): Promise<void> {
    const normalizedOrganizationId = normalizeSubscriptionId(organizationId, 'active organization');
    const normalizedConversationId = Number(normalizeSubscriptionId(conversationId, 'conversation'));
    const isLastSubscriber = this.conversationSubscriptions.unsubscribe(normalizedOrganizationId, normalizedConversationId);
    if (!isLastSubscriber || this.connectionOrganizationId !== normalizedOrganizationId) return;

    const wasJoined = this.joinedConversationIds.delete(normalizedConversationId);
    if (wasJoined && this.connection && this.isConnected()) {
      await this.connection.invoke('LeaveConversation', normalizedConversationId);
    }
  }

  private async restoreConversationSubscriptions(connection: SignalR.HubConnection, organizationId: string): Promise<void> {
    if (this.connection !== connection || this.connectionOrganizationId !== organizationId) return;
    this.joinedConversationIds.clear();
    await this.conversationSubscriptions.restore(organizationId, async (conversationId) => {
      try {
        await this.joinConversationIfActive(connection, organizationId, conversationId);
      } catch (error) {
        console.warn(`Could not restore SignalR conversation ${conversationId}`, error);
      }
    });
  }

  private async joinConversationIfActive(connection: SignalR.HubConnection, organizationId: string, conversationId: number): Promise<void> {
    if (this.connection !== connection || this.connectionOrganizationId !== organizationId ||
        !this.conversationSubscriptions.isActive(organizationId, conversationId)) return;
    await connection.invoke('JoinConversation', conversationId);
    if (this.connection === connection && this.connectionOrganizationId === organizationId &&
        this.conversationSubscriptions.isActive(organizationId, conversationId)) {
      this.joinedConversationIds.add(conversationId);
    } else if (connection.state === SignalR.HubConnectionState.Connected) {
      await connection.invoke('LeaveConversation', conversationId).catch(() => undefined);
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
