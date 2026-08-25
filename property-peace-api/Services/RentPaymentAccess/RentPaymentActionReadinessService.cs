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
    private const string NotRequested = "NotRequested";

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
            var access = await db.RentPaymentAccessRequests.AsNoTracking()
                .SingleOrDefaultAsync(x => x.OrganizationId == organizationId, cancellationToken);
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
                            && (review.ApprovedOrganizationId == organizationId ||
                                (review.Status != StripePayeeReviewStatus.PayoutApproved &&
                                 review.ApprovedOrganizationId == null))
                        orderby review.Status == StripePayeeReviewStatus.PayoutApproved descending,
                            review.UpdatedAt descending,
                            review.Id
                        select review)
                    .FirstOrDefaultAsync(cancellationToken);
            }

            var providerEnabled =
                configuration.GetValue<bool?>("Stripe:RentPaymentsEnabled") == true &&
                HasValue(configuration["Stripe:SecretKey"]);
            var transfersEnabled =
                configuration.GetValue<bool?>("Stripe:TransfersEnabled") == true;
            var organizationApproved = access?.Status == RentPaymentAccessStatus.Approved;
            var connectedPayeeApproved =
                action is RentPaymentAction.Pay or RentPaymentAction.Transfer &&
                IsApproved(payee, organizationId) &&
                await connectedPayeeService.IsApprovedDestinationAsync(
                    payee!.UserId!.Value,
                    organizationId,
                    payee.StripeAccountId,
                    cancellationToken);
            var connectedPayeeReady = connectedPayeeApproved && IsReady(payee!, clock.GetUtcNow());
            var blockers = BuildBlockers(
                action,
                member,
                access?.Status,
                providerEnabled,
                connectedPayeeApproved,
                connectedPayeeReady,
                payee is not null,
                transfersEnabled);

            return new RentPaymentActionReadiness(
                action,
                blockers.Count == 0,
                access?.Status.ToString() ?? NotRequested,
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
        RentPaymentAccessStatus? accessStatus,
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

        if (action == RentPaymentAction.RequestAccess)
        {
            switch (accessStatus)
            {
                case null:
                case RentPaymentAccessStatus.Rejected:
                    break;
                case RentPaymentAccessStatus.Pending:
                    blockers.Add("access_pending");
                    break;
                case RentPaymentAccessStatus.Suspended:
                    blockers.Add("access_suspended");
                    break;
                case RentPaymentAccessStatus.Approved:
                    blockers.Add("access_not_approved");
                    break;
            }

            return blockers;
        }

        if (!providerEnabled) blockers.Add("provider_disabled");
        if (accessStatus != RentPaymentAccessStatus.Approved)
        {
            blockers.Add(accessStatus switch
            {
                null => "access_not_requested",
                RentPaymentAccessStatus.Pending => "access_pending",
                RentPaymentAccessStatus.Rejected => "access_rejected",
                RentPaymentAccessStatus.Suspended => "access_suspended",
                _ => "access_not_approved"
            });
            blockers.Add("access_not_approved");
        }

        if (action is RentPaymentAction.Pay or RentPaymentAction.Transfer)
        {
            if (!connectedPayeeExists) blockers.Add("connected_payee_missing");
            else if (!connectedPayeeApproved) blockers.Add("connected_payee_under_review");
            else if (!connectedPayeeReady) blockers.Add("connected_payee_not_ready");
        }

        if (action == RentPaymentAction.Transfer && !transfersEnabled)
            blockers.Add("transfers_disabled");

        return blockers;
    }

    private static bool IsApproved(StripeConnectedPayeeReview? payee, int organizationId) =>
        payee is
        {
            Status: StripePayeeReviewStatus.PayoutApproved,
            UserId: not null,
            PropertyAuthorityAttested: true,
            ApprovedAt: not null
        } &&
        payee.ApprovedOrganizationId == organizationId;

    private static bool IsReady(StripeConnectedPayeeReview payee, DateTimeOffset now) =>
        payee.LastStripeSnapshotAt is { } capturedAt &&
        capturedAt >= now.AddMinutes(-5) &&
        capturedAt <= now.AddMinutes(1) &&
        payee.StripeDetailsSubmitted &&
        payee.StripePayoutsEnabled &&
        payee.StripeTransfersActive &&
        string.Equals(payee.StripeTransferCapabilityStatus, "active", StringComparison.OrdinalIgnoreCase) &&
        payee.CurrentlyDueRequirementCount == 0 &&
        payee.PastDueRequirementCount == 0 &&
        string.IsNullOrWhiteSpace(payee.StripeDisabledReason) &&
        !string.IsNullOrWhiteSpace(payee.ExternalAccountFingerprint) &&
        string.Equals(payee.PayoutSchedulePolicy, "manual", StringComparison.OrdinalIgnoreCase) &&
        !payee.InstantPayoutsAllowed;

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
        Blockers: ["provider_disabled", "access_not_approved", "actor_not_authorized"],
        ConnectedPayeeExists: false);
}
