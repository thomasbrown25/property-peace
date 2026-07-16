namespace brownstone_hub_api.Services.ListingAIService
{
    public interface IListingAIService
    {
        Task<ServiceResponse<string>> GenerateMarketingDescription(
            string propertyName,
            string propertyAddress,
            string? unitName,
            int? squareFeet,
            int? yearBuilt,
            string? bedrooms,
            string? baths,
            decimal monthlyRent,
            List<string> basicAmenities,
            List<string> propertyAmenities,
            List<string> propertyFeatures
        );
    }
}
