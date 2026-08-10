using brownstone_hub_api.Dtos.RentEstimate;

namespace brownstone_hub_api.Services.RentEstimateService
{
    public enum RentEstimateOutcome
    {
        Success,
        InvalidInput,
        NotFound,
        ProviderUnavailable
    }

    public sealed record RentEstimateResult(RentEstimateOutcome Outcome, RentEstimateDto? Data = null)
    {
        public static RentEstimateResult Success(RentEstimateDto data) => new(RentEstimateOutcome.Success, data);
        public static RentEstimateResult InvalidInput() => new(RentEstimateOutcome.InvalidInput);
        public static RentEstimateResult NotFound() => new(RentEstimateOutcome.NotFound);
        public static RentEstimateResult ProviderUnavailable() => new(RentEstimateOutcome.ProviderUnavailable);
    }

    public interface IRentEstimateService
    {
        Task<RentEstimateResult> GetRentEstimateAsync(
            long propertyId,
            long? unitId,
            long organizationId,
            bool forceRefresh = false,
            CancellationToken cancellationToken = default);
    }
}
