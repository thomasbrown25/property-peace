export type SubscriptionOrganizationId = string | number;
export type SubscriptionConversationId = string | number;

export function normalizeSubscriptionId(value: string | number, label: string): string {
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw) || !/[1-9]/.test(raw)) {
    throw new Error(`A valid ${label} is required for messaging`);
  }
  return raw.replace(/^0+(?=\d)/, '');
}

/**
 * Tracks UI subscription owners independently from a SignalR connection.
 * SignalR group membership is connection-specific, while these subscriptions
 * remain active across automatic reconnects.
 */
export class ConversationSubscriptionRegistry {
  private readonly counts = new Map<string, Map<number, number>>();

  subscribe(organizationId: SubscriptionOrganizationId, conversationId: SubscriptionConversationId): boolean {
    const organizationKey = normalizeSubscriptionId(organizationId, 'active organization');
    const conversationKey = Number(normalizeSubscriptionId(conversationId, 'conversation'));
    let organizationCounts = this.counts.get(organizationKey);
    if (!organizationCounts) {
      organizationCounts = new Map<number, number>();
      this.counts.set(organizationKey, organizationCounts);
    }
    const previousCount = organizationCounts.get(conversationKey) ?? 0;
    organizationCounts.set(conversationKey, previousCount + 1);
    return previousCount === 0;
  }

  unsubscribe(organizationId: SubscriptionOrganizationId, conversationId: SubscriptionConversationId): boolean {
    const organizationKey = normalizeSubscriptionId(organizationId, 'active organization');
    const conversationKey = Number(normalizeSubscriptionId(conversationId, 'conversation'));
    const organizationCounts = this.counts.get(organizationKey);
    const previousCount = organizationCounts?.get(conversationKey) ?? 0;
    if (!organizationCounts || previousCount === 0) return false;
    if (previousCount > 1) {
      organizationCounts.set(conversationKey, previousCount - 1);
      return false;
    }
    organizationCounts.delete(conversationKey);
    if (organizationCounts.size === 0) this.counts.delete(organizationKey);
    return true;
  }

  isActive(organizationId: SubscriptionOrganizationId, conversationId: SubscriptionConversationId): boolean {
    const organizationKey = normalizeSubscriptionId(organizationId, 'active organization');
    const conversationKey = Number(normalizeSubscriptionId(conversationId, 'conversation'));
    return (this.counts.get(organizationKey)?.get(conversationKey) ?? 0) > 0;
  }

  activeConversationIds(organizationId: SubscriptionOrganizationId): number[] {
    const organizationKey = normalizeSubscriptionId(organizationId, 'active organization');
    return [...(this.counts.get(organizationKey)?.keys() ?? [])].sort((left, right) => left - right);
  }

  async restore(organizationId: SubscriptionOrganizationId, join: (conversationId: number) => Promise<void>): Promise<void> {
    await Promise.all(this.activeConversationIds(organizationId).map(join));
  }
}
