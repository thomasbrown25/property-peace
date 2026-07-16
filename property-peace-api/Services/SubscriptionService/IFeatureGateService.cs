namespace brownstone_hub_api.Services.SubscriptionService
{
    public interface IFeatureGateService
    {
        Task<bool> CanAddPropertyAsync(long userId);
        Task<bool> CanAddUnitToPropertyAsync(long userId, long propertyId);
        Task<bool> CanAddTenantAsync(long userId);
        Task<bool> HasFeatureAccessAsync(long userId, string featureName);
        Task<bool> HasLeaseShieldAccessAsync(long userId);
        Task<int?> GetRemainingPropertySlotsAsync(long userId);
        Task<int?> GetRemainingUnitSlotsAsync(long userId);
        Task<int> GetCurrentPropertyCountAsync(long userId);
        Task<int> GetCurrentTotalUnitsAsync(long userId);
    }
}

