using brownstone_hub_api.Dtos.RentPaymentAccess;

namespace brownstone_hub_api.Services.RentPaymentAccess;

public sealed record RentPaymentAccessNotificationResult(int Attempted, int Accepted, int Failed);

public interface IRentPaymentAccessNotificationService
{
    Task<RentPaymentAccessNotificationResult> NotifyReviewersAsync(
        RentPaymentAccessAdminDetailDto request,
        CancellationToken cancellationToken);
}
