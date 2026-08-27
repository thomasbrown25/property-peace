namespace brownstone_hub_api.Services.RentPaymentAccess;

public sealed record RentPaymentActionReadiness(
    RentPaymentAction Action,
    bool Allowed,
    string AccessStatus,
    bool ProviderEnabled,
    bool OrganizationApproved,
    bool ConnectedPayeeApproved,
    bool ConnectedPayeeReady,
    bool TransfersEnabled,
    IReadOnlyList<string> Blockers,
    bool ConnectedPayeeExists = false);

public interface IRentPaymentActionReadinessService
{
    Task<RentPaymentActionReadiness> EvaluateAsync(
        int userId,
        int organizationId,
        RentPaymentAction action,
        CancellationToken cancellationToken);
}
