using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Security;
using brownstone_hub_api.Services.StripeRentPayments;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.RentPaymentAccess;

public sealed class RentPaymentActionReadinessService(
    DataContext db,
    IOrganizationAuthorityResolver authorityResolver,
    IStripeConnectedPayeeService connectedPayeeService,
    IConfiguration configuration,
    TimeProvider clock,
    ILogger<RentPaymentActionReadinessService> logger) : IRentPaymentActionReadinessService
{
    // Legacy response field names are retained for client compatibility; review records
    // are historical only and are never consulted to authorize payment actions.

    public async Task<RentPaymentActionReadiness> EvaluateAsync(
        int userId,
        int organizationId,
        RentPaymentAction action,
        CancellationToken cancellationToken)
    {
        if (userId <= 0 || organizationId <= 0 || !Enum.IsDefined(action))
            return Unavailable(action);

        try
        {
            var member = await authorityResolver.ResolveActiveMemberAsync(
                userId, organizationId, cancellationToken);

            StripeConnectedPayeeReview? payee = null;
            if (action is RentPaymentAction.Pay or RentPaymentAction.Transfer)
            {
                payee = await (
                        from review in db.StripeConnectedPayeeReviews.AsNoTracking()
                        join payeeMember in db.OrganizationMembers.AsNoTracking()
                            on review.UserId equals payeeMember.UserId
                        where payeeMember.OrganizationId == organizationId
                            && payeeMember.IsActive
                            && (payeeMember.Role == "Owner" || payeeMember.Role == "Manager")
                            && (review.ApprovedOrganizationId == organizationId || review.ApprovedOrganizationId == null)
                        orderby review.UpdatedAt descending,
                            review.Id
                        select review)
                    .FirstOrDefaultAsync(cancellationToken);
            }

            var providerEnabled =
                configuration.GetValue<bool?>("Stripe:RentPaymentsEnabled") == true &&
                HasValue(configuration["Stripe:SecretKey"]);
            var transfersEnabled =
                configuration.GetValue<bool?>("Stripe:TransfersEnabled") == true;
            var organizationApproved = true;
            var connectedPayeeApproved =
                action is RentPaymentAction.Pay or RentPaymentAction.Transfer &&
                payee?.UserId is not null &&
                await connectedPayeeService.IsApprovedDestinationAsync(
                    payee!.UserId!.Value,
                    organizationId,
                    payee.StripeAccountId,
                    cancellationToken);
            var connectedPayeeReady = connectedPayeeApproved && IsReady(
                payee!, clock.GetUtcNow(), action == RentPaymentAction.Transfer);
            var blockers = BuildBlockers(
                action,
                member,
                providerEnabled,
                connectedPayeeApproved,
                connectedPayeeReady,
                payee is not null,
                transfersEnabled);

            return new RentPaymentActionReadiness(
                action,
                blockers.Count == 0,
                "Available",
                providerEnabled,
                organizationApproved,
                connectedPayeeApproved,
                connectedPayeeReady,
                transfersEnabled,
                blockers,
                payee is not null);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Failed to evaluate rent-payment action {Action} for user {UserId} and organization {OrganizationId}",
                action, userId, organizationId);
            return Unavailable(action);
        }
    }

    private static IReadOnlyList<string> BuildBlockers(
        RentPaymentAction action,
        OrganizationMember? member,
        bool providerEnabled,
        bool connectedPayeeApproved,
        bool connectedPayeeReady,
        bool connectedPayeeExists,
        bool transfersEnabled)
    {
        var blockers = new List<string>();
        var actorAuthorized = action switch
        {
            RentPaymentAction.RequestAccess or RentPaymentAction.Configure =>
                IsOwnerOrManager(member?.Role),
            // The outer Pay gate admits any authenticated actor. Lease and tenant authorization
            // remains an inner-service defense with the payment's lease context available.
            RentPaymentAction.Pay => true,
            RentPaymentAction.Transfer => IsKnownActiveRole(member?.Role),
            _ => false
        };
        if (!actorAuthorized) blockers.Add("actor_not_authorized");

        if (action == RentPaymentAction.RequestAccess) return blockers;

        if (!providerEnabled) blockers.Add("provider_disabled");
        if (action is RentPaymentAction.Pay or RentPaymentAction.Transfer)
        {
            if (!connectedPayeeExists) blockers.Add("connected_payee_missing");
            else if (!connectedPayeeApproved || !connectedPayeeReady) blockers.Add("connected_payee_not_ready");
        }

        if (action == RentPaymentAction.Transfer && !transfersEnabled)
            blockers.Add("transfers_disabled");

        return blockers;
    }


    // Pay is a cached preflight only: the inner risk gate validates live charges,
    // card-payments capability and controller policy via RestrictionReason(snapshot, true).
    // Legacy transfers must retain their separate transfer/manual-payout requirements.
    private static bool IsReady(StripeConnectedPayeeReview payee, DateTimeOffset now, bool transfer) =>
        payee.LastStripeSnapshotAt is { } capturedAt &&
        capturedAt >= now.AddMinutes(-5) &&
        capturedAt <= now.AddMinutes(1) &&
        payee.StripeDetailsSubmitted &&
        payee.StripePayoutsEnabled &&
        payee.CurrentlyDueRequirementCount == 0 &&
        payee.PastDueRequirementCount == 0 &&
        string.IsNullOrWhiteSpace(payee.StripeDisabledReason) &&
        !string.IsNullOrWhiteSpace(payee.ExternalAccountFingerprint) &&
        (transfer
            ? payee.StripeTransfersActive &&
              string.Equals(payee.StripeTransferCapabilityStatus, "active", StringComparison.OrdinalIgnoreCase) &&
              string.Equals(payee.PayoutSchedulePolicy, "manual", StringComparison.OrdinalIgnoreCase) &&
              !payee.InstantPayoutsAllowed
            : payee.PayoutSchedulePolicy?.ToLowerInvariant() is "manual" or "daily" or "weekly" or "monthly");

    private static bool IsOwnerOrManager(string? role) =>
        string.Equals(role, "Owner", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(role, "Manager", StringComparison.OrdinalIgnoreCase);

    private static bool IsKnownActiveRole(string? role) =>
        IsOwnerOrManager(role) || string.Equals(role, "Viewer", StringComparison.OrdinalIgnoreCase);

    private static bool HasValue(string? value) =>
        !string.IsNullOrWhiteSpace(value) &&
        !value.Equals("[REDACTED]", StringComparison.OrdinalIgnoreCase) &&
        !value.Equals("changeme", StringComparison.OrdinalIgnoreCase);

    private static RentPaymentActionReadiness Unavailable(RentPaymentAction action) => new(
        action,
        Allowed: false,
        AccessStatus: "Unavailable",
        ProviderEnabled: false,
        OrganizationApproved: false,
        ConnectedPayeeApproved: false,
        ConnectedPayeeReady: false,
        TransfersEnabled: false,
        Blockers: ["provider_disabled", "actor_not_authorized"],
        ConnectedPayeeExists: false);
}
