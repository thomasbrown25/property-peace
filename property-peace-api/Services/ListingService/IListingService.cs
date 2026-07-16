using brownstone_hub_api.Dtos.Listing;
using brownstone_hub_api.Dtos.Image;

namespace brownstone_hub_api.Services.ListingService
{
    public interface IListingService
    {
        Task<ServiceResponse<LoadListingDto>> CreateListing(CreateListingDto listingDto, List<IFormFile>? imageFiles);
        Task<ServiceResponse<LoadListingDto>> UpdateListing(UpdateListingDto listingDto);
        Task<ServiceResponse<LoadListingDto>> GetListingById(long listingId);
        Task<ServiceResponse<LoadListingDto>> GetListingByNumber(string listingNumber);
        Task<ServiceResponse<List<LoadListingDto>>> GetListingsByOrganization();
        Task<ServiceResponse<bool>> IsUnitListed(long unitId);
        Task<ServiceResponse<bool>> DeleteListing(long listingId);
        Task<ServiceResponse<LoadListingDto>> PublishListing(long listingId);
        Task<ServiceResponse<List<PublicListingSummaryDto>>> GetPublicListingsAsync();
        Task<ServiceResponse<PublicListingDto>> GetPublicListing(string listingNumber);
        Task<ServiceResponse<PublicListingDto>> GetPublicListingBySlug(string slug);
        Task<ServiceResponse<List<LoadListingDto>>> GetListingsByPropertyIdAsync(long propertyId);
    }
}
