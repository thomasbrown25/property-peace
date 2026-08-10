using System.Globalization;
using brownstone_hub_api.Data;
using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Policy;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.SmsService;

public sealed record OutboundSmsSecurityDecision(bool IsAllowed, string? From = null, string? ReasonCode = null)
{
    public static OutboundSmsSecurityDecision Denied(string reason) => new(false, null, reason);
    public static OutboundSmsSecurityDecision Allowed(string? from = null) => new(true, from);
}

/// <summary>
/// The single fail-closed policy boundary for organization SMS. It always evaluates the persisted
/// resource organization and never reads a user's ambient/current organization.
/// </summary>
public interface IOutboundSmsSecurityService
{
    Task<OutboundSmsSecurityDecision> AuthorizeConversationEnqueueAsync(
        long userId, long selectedOrganizationId, long conversationId, CancellationToken cancellationToken = default);
    Task<OutboundSmsSecurityDecision> AuthorizeOrganizationSendAsync(
        long userId, long organizationId, CancellationToken cancellationToken = default);
    Task<OutboundSmsSecurityDecision> AuthorizeDeliveryAsync(
        long deliveryId, CancellationToken cancellationToken = default);
}

public sealed class OutboundSmsSecurityService(
    DataContext context,
    IEntitlementDecisionService entitlementDecisionService,
    IConfiguration configuration) : IOutboundSmsSecurityService
{
    public async Task<OutboundSmsSecurityDecision> AuthorizeConversationEnqueueAsync(
        long userId, long selectedOrganizationId, long conversationId, CancellationToken cancellationToken = default)
    {
        var facts = await context.Conversations.AsNoTracking()
            .Where(conversation => conversation.Id == conversationId)
            .Select(conversation => new
            {
                OrganizationId = conversation.OrganizationId,
                conversation.LandlordId,
                HasTenantPhone = conversation.TenantId.HasValue && context.Tenants.Any(tenant =>
                    tenant.Id == conversation.TenantId.Value && !string.IsNullOrWhiteSpace(tenant.PhoneNumber)),
                IsParticipant = context.ConversationParticipants.Any(participant =>
                    participant.ConversationId == conversation.Id && participant.UserId == userId && !participant.IsDeleted)
                    || context.OrganizationMembers.Any(member => member.OrganizationId == conversation.OrganizationId
                        && member.UserId == userId && member.IsActive)
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (facts?.OrganizationId is not > 0 || !facts.IsParticipant)
            return OutboundSmsSecurityDecision.Denied("conversation_unavailable");
        if (facts.OrganizationId.Value != selectedOrganizationId)
            return OutboundSmsSecurityDecision.Denied("organization_mismatch");

        // This message cannot create an SMS outbox row. Preserve ordinary in-app tenant messaging.
        if (facts.LandlordId != userId || !facts.HasTenantPhone)
            return OutboundSmsSecurityDecision.Allowed();

        return await AuthorizeCoreAsync(userId, facts.OrganizationId.Value, requireProvider: false, cancellationToken);
    }

    public Task<OutboundSmsSecurityDecision> AuthorizeOrganizationSendAsync(
        long userId, long organizationId, CancellationToken cancellationToken = default) =>
        AuthorizeCoreAsync(userId, organizationId, requireProvider: true, cancellationToken);

    public async Task<OutboundSmsSecurityDecision> AuthorizeDeliveryAsync(
        long deliveryId, CancellationToken cancellationToken = default)
    {
        var facts = await context.MessageDeliveries.AsNoTracking()
            .Where(delivery => delivery.Id == deliveryId && delivery.Channel == MessageDeliveryChannel.Sms)
            .Select(delivery => new
            {
                DeliveryOrganizationId = delivery.OrganizationId,
                TimelineOrganizationId = delivery.ConversationTimelineEntry.OrganizationId,
                ConversationOrganizationId = delivery.ConversationTimelineEntry.Conversation.OrganizationId,
                MessageOrganizationId = delivery.Message == null ? null : delivery.Message.OrganizationId,
                SenderId = delivery.Message == null ? (long?)null : delivery.Message.SenderId,
                LandlordId = delivery.ConversationTimelineEntry.Conversation.LandlordId
            })
            .SingleOrDefaultAsync(cancellationToken);

        if (facts is null || facts.DeliveryOrganizationId <= 0 ||
            facts.TimelineOrganizationId != facts.DeliveryOrganizationId ||
            facts.ConversationOrganizationId != facts.DeliveryOrganizationId ||
            facts.MessageOrganizationId != facts.DeliveryOrganizationId ||
            facts.SenderId is not > 0 || facts.SenderId != facts.LandlordId)
            return OutboundSmsSecurityDecision.Denied("delivery_organization_mismatch");

        return await AuthorizeCoreAsync(
            facts.SenderId.Value, facts.DeliveryOrganizationId, requireProvider: true, cancellationToken);
    }

    private async Task<OutboundSmsSecurityDecision> AuthorizeCoreAsync(
        long userId, long organizationId, bool requireProvider, CancellationToken cancellationToken)
    {
        if (userId <= 0 || organizationId <= 0)
            return OutboundSmsSecurityDecision.Denied("invalid_scope");

        var entitlement = await entitlementDecisionService.DecideAsync(
            new EntitlementDecisionRequest(
                userId.ToString(CultureInfo.InvariantCulture),
                organizationId,
                FeatureKeys.SmsMessaging,
                ResourceOrganizationId: organizationId),
            cancellationToken);
        if (!entitlement.IsAllowed)
            return OutboundSmsSecurityDecision.Denied(entitlement.Reason.Value);

        if (requireProvider && !IsMessagingProviderConfigured())
            return OutboundSmsSecurityDecision.Denied("sms_provider_unavailable");

        var from = await context.OrganizationSmsNumbers.AsNoTracking()
            .Where(number => number.OrganizationId == organizationId && number.IsActive && number.IsPrimary
                && !string.IsNullOrWhiteSpace(number.PhoneNumber))
            .Select(number => number.PhoneNumber)
            .SingleOrDefaultAsync(cancellationToken);
        return string.IsNullOrWhiteSpace(from)
            ? OutboundSmsSecurityDecision.Denied("sms_sender_unavailable")
            : OutboundSmsSecurityDecision.Allowed(from);
    }

    private bool IsMessagingProviderConfigured()
    {
        var provider = configuration["SmsProvider"] ?? "Azure";
        return provider.Equals("Twilio", StringComparison.OrdinalIgnoreCase)
            ? HasValue("Twilio:AccountSid") && HasValue("Twilio:AuthToken")
            : HasValue("AzureCommunication:ConnectionString");
    }

    private bool HasValue(string key)
    {
        var value = configuration[key];
        return !string.IsNullOrWhiteSpace(value)
            && !value.Equals("[REDACTED]", StringComparison.OrdinalIgnoreCase)
            && !value.Equals("changeme", StringComparison.OrdinalIgnoreCase);
    }
}
