using System.Globalization;
using brownstone_hub_api.Data;
using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Policy;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Entitlements.Enforcement;

/// <summary>Resolves a supplied resource's organization without using caller-provided ownership facts.</summary>
public interface IEntitlementResourceOrganizationResolver
{
    Task<long?> GetPropertyOrganizationIdAsync(long propertyId, CancellationToken cancellationToken = default);
    Task<long?> GetLeaseShieldConversationOrganizationIdAsync(
        long conversationId,
        long userId,
        CancellationToken cancellationToken = default);
}

public sealed class EfEntitlementResourceOrganizationResolver(DataContext context)
    : IEntitlementResourceOrganizationResolver
{
    public Task<long?> GetPropertyOrganizationIdAsync(long propertyId, CancellationToken cancellationToken = default) =>
        context.Properties
            .AsNoTracking()
            .Where(property => property.Id == propertyId)
            .Select(property => (long?)property.OrganizationId)
            .SingleOrDefaultAsync(cancellationToken);

    public Task<long?> GetLeaseShieldConversationOrganizationIdAsync(
        long conversationId,
        long userId,
        CancellationToken cancellationToken = default) =>
        context.LeaseShieldConversations
            .AsNoTracking()
            .Where(conversation => conversation.Id == conversationId && conversation.UserId == userId)
            .Select(conversation => conversation.OrganizationId)
            .SingleOrDefaultAsync(cancellationToken);
}

public static class EntitlementEnforcement
{
    public static bool TryGetTrustedScope(HttpContext httpContext, out long userId, out long organizationId)
    {
        userId = PositiveId(httpContext.Items["UserId"]);
        organizationId = PositiveId(httpContext.Items["OrganizationId"]);
        return userId > 0 && organizationId > 0;
    }

    public static ObjectResult MissingUser(FeatureKey feature) => Denied(
        feature,
        EntitlementReasonCodes.InvalidInput,
        EntitlementDecisionCategory.Unauthorized,
        StatusCodes.Status401Unauthorized);

    public static ObjectResult MissingOrganization(FeatureKey feature) => Denied(
        feature,
        EntitlementReasonCodes.OrganizationRequired,
        EntitlementDecisionCategory.Unauthorized,
        StatusCodes.Status403Forbidden);

    public static ObjectResult Denied(FeatureKey feature, UnifiedEntitlementDecision decision)
    {
        var malformed = decision.Feature != feature ||
                        decision.IsAllowed ||
                        decision.Category == EntitlementDecisionCategory.Allowed;
        if (malformed)
        {
            return Denied(
                feature,
                EntitlementReasonCodes.PolicyError,
                EntitlementDecisionCategory.Unavailable,
                StatusCodes.Status503ServiceUnavailable);
        }

        return Denied(
            feature,
            decision.Reason,
            decision.Category,
            IsInfrastructureFailure(decision.Reason)
                ? StatusCodes.Status503ServiceUnavailable
                : StatusCodes.Status403Forbidden);
    }

    public static bool IsAllowed(FeatureKey feature, UnifiedEntitlementDecision decision) =>
        decision.IsAllowed &&
        decision.Category == EntitlementDecisionCategory.Allowed &&
        decision.Feature == feature &&
        decision.Reason == EntitlementReasonCodes.Allowed;

    public static EntitlementDecisionRequest Request(
        long userId,
        long organizationId,
        FeatureKey feature,
        long? resourceOrganizationId = null) =>
        new(
            userId.ToString(CultureInfo.InvariantCulture),
            organizationId,
            feature,
            ResourceOrganizationId: resourceOrganizationId);

    private static ObjectResult Denied(
        FeatureKey feature,
        EntitlementReasonCode reason,
        EntitlementDecisionCategory category,
        int statusCode) =>
        new(new EntitlementDeniedResponse(
            false,
            EntitlementCatalog.Version,
            feature.Value,
            reason.Value,
            CategoryWireValue(category),
            Message(category)))
        {
            StatusCode = statusCode
        };

    private static string Message(EntitlementDecisionCategory category) => category switch
    {
        EntitlementDecisionCategory.Upgrade => "Upgrade your plan to use this feature.",
        EntitlementDecisionCategory.Setup => "Complete feature setup and try again.",
        EntitlementDecisionCategory.Unauthorized => "Verify your organization access and try again.",
        _ => "This feature is currently unavailable. Try again later."
    };

    private static string CategoryWireValue(EntitlementDecisionCategory category) => category switch
    {
        EntitlementDecisionCategory.Upgrade => "upgrade",
        EntitlementDecisionCategory.Setup => "setup",
        EntitlementDecisionCategory.Unauthorized => "unauthorized",
        EntitlementDecisionCategory.Allowed => "allowed",
        _ => "unavailable"
    };

    private static bool IsInfrastructureFailure(EntitlementReasonCode reason) =>
        reason == EntitlementReasonCodes.PolicyError ||
        reason == EntitlementReasonCodes.FactsUnavailable;

    private static long PositiveId(object? value) => value switch
    {
        long longValue when longValue > 0 => longValue,
        int intValue when intValue > 0 => intValue,
        _ => 0
    };
}
