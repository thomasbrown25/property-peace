using brownstone_hub_api.Dtos.Listing;

namespace brownstone_hub_api.Repositories.Listings
{
    public interface IListingRepository
    {
        Task<LoadListingDto> CreateListing(CreateListingDto listingDto, long organizationId, long createdBy);
        Task<LoadListingDto> UpdateListing(UpdateListingDto listingDto);
        Task<LoadListingDto?> GetListingById(long listingId);
        Task<LoadListingDto?> GetListingByNumber(string listingNumber);
        Task<LoadListingDto?> GetListingByPublishedSlug(string slug);
        Task<List<LoadListingDto>> GetListingsByOrganizationId(long organizationId);
        Task<List<LoadListingDto>> GetListingsByPropertyId(long propertyId);
        Task<List<LoadListingDto>> GetListingsByUnitId(long unitId);
        Task<List<PublicListingSummaryDto>> GetActiveListingsForPublicAsync();
        Task<bool> IsUnitListed(long unitId);
        Task<bool> DeleteListing(long listingId);
        Task<int> DeleteListingsByPropertyId(long propertyId);
        Task<string> GenerateListingNumber();
    }
}
