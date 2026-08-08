using Azure.Storage.Blobs;
using brownstone_hub_api.Dtos.Image;
using brownstone_hub_api.Dtos.Listing;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Listings;
using brownstone_hub_api.Repositories.Organizations;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Units;
using brownstone_hub_api.Services.AzureBlobService;
using brownstone_hub_api.Services.ImageService;
using brownstone_hub_api.Services.UserContextService;
using Microsoft.AspNetCore.Http;

namespace brownstone_hub_api.Services.ListingService
{
    public class ListingService(
        IListingRepository listingRepository,
        IOrganizationMemberRepository organizationMemberRepository,
        IPropertyRepository propertyRepository,
        IUnitRepository unitRepository,
        IImageService<ListingImage, LoadImageDto, AddImageDto> imageService,
        IAzureBlobService azureBlobService,
        BlobServiceClient blobServiceClient,
        IUserContextService userContextService,
        IHttpContextAccessor httpContextAccessor,
        ILogger<ListingService> logger) : IListingService
    {
        private const string ListingImagesContainer = "listing-images";

        private readonly IListingRepository _listingRepository = listingRepository;
        private readonly IOrganizationMemberRepository _organizationMemberRepository = organizationMemberRepository;
        private readonly IPropertyRepository _propertyRepository = propertyRepository;
        private readonly IUnitRepository _unitRepository = unitRepository;
        private readonly IImageService<ListingImage, LoadImageDto, AddImageDto> _imageService = imageService;
        private readonly IAzureBlobService _azureBlobService = azureBlobService;
        private readonly BlobServiceClient _blobServiceClient = blobServiceClient;
        private readonly IUserContextService _userContextService = userContextService;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<ListingService> _logger = logger;

        private long? GetCurrentOrganizationId()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        private async Task<bool> CurrentUserCanManageListings(long organizationId)
        {
            var userId = await _userContextService.GetCurrentUserIdAsync();
            if (!userId.HasValue)
            {
                return false;
            }

            var member = await _organizationMemberRepository.GetMemberAsync(organizationId, userId.Value);
            return member != null
                && member.IsActive
                && (string.Equals(member.Role, "Owner", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(member.Role, "Landlord", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(member.Role, "Manager", StringComparison.OrdinalIgnoreCase));
        }

        private async Task<ServiceResponse<T>?> ValidateListingMutationAccess<T>(long listingId)
        {
            var organizationId = GetCurrentOrganizationId();
            if (!organizationId.HasValue)
            {
                return ServiceResponse<T>.CreateError(
                    "Organization context required",
                    "Organization context is required to manage listings.",
                    "",
                    403
                );
            }

            var listing = await _listingRepository.GetListingById(listingId);
            if (listing == null)
            {
                return ServiceResponse<T>.CreateError(
                    "Listing not found",
                    "Listing not found.",
                    "",
                    404
                );
            }

            if (listing.OrganizationId != organizationId.Value)
            {
                return ServiceResponse<T>.CreateError(
                    "Access denied",
                    "You do not have access to this listing.",
                    "",
                    403
                );
            }

            if (!await CurrentUserCanManageListings(organizationId.Value))
            {
                return ServiceResponse<T>.CreateError(
                    "Access denied",
                    "Only organization owners, landlords, and managers can manage listings.",
                    "",
                    403
                );
            }

            return null;
        }

        /// <summary>
        /// Replaces each image's BlobUrl with a time-limited SAS URI so clients can load from private blob storage.
        /// </summary>
        private void AttachSasUrlsToListingImages(List<LoadImageDto>? images)
        {
            if (images == null || images.Count == 0) return;
            var containerClient = _blobServiceClient.GetBlobContainerClient(ListingImagesContainer);
            foreach (var img in images)
            {
                if (string.IsNullOrWhiteSpace(img.BlobName)) continue;
                try
                {
                    var blobClient = containerClient.GetBlobClient(img.BlobName);
                    img.BlobUrl = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromHours(1));
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Could not generate SAS for listing image BlobName={BlobName}", img.BlobName);
                }
            }
        }

        public async Task<ServiceResponse<LoadListingDto>> CreateListing(CreateListingDto listingDto, List<IFormFile>? imageFiles)
        {
            try
            {
                var organizationId = GetCurrentOrganizationId();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadListingDto>.CreateError(
                        "Organization context required",
                        "Organization context is required to create listings."
                    );
                }

                var userId = await _userContextService.GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    return ServiceResponse<LoadListingDto>.CreateError(
                        "User context required",
                        "User context is required to create listings."
                    );
                }

                // Validate property exists and belongs to the current organization
                var property = await _propertyRepository.GetPropertyById(listingDto.PropertyId);
                if (property == null)
                {
                    return ServiceResponse<LoadListingDto>.CreateError(
                        "Property not found",
                        $"Property with ID {listingDto.PropertyId} not found."
                    );
                }

                if (property.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<LoadListingDto>.CreateError(
                        "Access denied",
                        "You do not have access to this property.",
                        "",
                        403
                    );
                }

                if (!await CurrentUserCanManageListings(organizationId.Value))
                {
                    return ServiceResponse<LoadListingDto>.CreateError(
                        "Access denied",
                        "Only organization owners, landlords, and managers can create listings.",
                        "",
                        403
                    );
                }

                // Validate unit if provided
                if (listingDto.UnitId.HasValue)
                {
                    var unit = await _unitRepository.GetUnitById(listingDto.UnitId.Value);
                    if (unit == null || unit.PropertyId != listingDto.PropertyId)
                    {
                        return ServiceResponse<LoadListingDto>.CreateError(
                            "Unit not found",
                            $"Unit with ID {listingDto.UnitId} not found or does not belong to the property."
                        );
                    }
                }

                // Create listing
                var listing = await _listingRepository.CreateListing(listingDto, organizationId.Value, userId.Value);

                // Upload images if provided
                if (imageFiles != null && imageFiles.Any())
                {
                    var imageResponse = await _imageService.AddImages(listing.Id, imageFiles);
                    if (!imageResponse.Success)
                    {
                        _logger.LogWarning("Failed to upload images for listing {ListingId}: {Message}", listing.Id, imageResponse.Message);
                    }
                }

                // Reload listing with images
                var result = await _listingRepository.GetListingById(listing.Id);
                return ServiceResponse<LoadListingDto>.CreateSuccess(result ?? listing);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating listing");
                return ServiceResponse<LoadListingDto>.CreateError(
                    "Error creating listing",
                    ex.Message
                );
            }
        }

        public async Task<ServiceResponse<LoadListingDto>> UpdateListing(UpdateListingDto listingDto)
        {
            try
            {
                var accessError = await ValidateListingMutationAccess<LoadListingDto>(listingDto.Id);
                if (accessError != null)
                {
                    return accessError;
                }

                _logger.LogInformation(
                    "[UpdateListing] ListingId={ListingId} BasicAmenityIds={BasicAmenityIds} DefaultAmenityIds={DefaultAmenityIds} CustomAmenityIds={CustomAmenityIds} DefaultFeatureIds={DefaultFeatureIds} CustomFeatureIds={CustomFeatureIds}",
                    listingDto.Id,
                    listingDto.BasicAmenityIds != null ? string.Join(",", listingDto.BasicAmenityIds) : "null",
                    listingDto.DefaultAmenityIds != null ? string.Join(",", listingDto.DefaultAmenityIds) : "null",
                    listingDto.CustomAmenityIds != null ? string.Join(",", listingDto.CustomAmenityIds) : "null",
                    listingDto.DefaultFeatureIds != null ? string.Join(",", listingDto.DefaultFeatureIds) : "null",
                    listingDto.CustomFeatureIds != null ? string.Join(",", listingDto.CustomFeatureIds) : "null");
                var listing = await _listingRepository.UpdateListing(listingDto);
                return ServiceResponse<LoadListingDto>.CreateSuccess(listing);
            }
            catch (KeyNotFoundException ex)
            {
                return ServiceResponse<LoadListingDto>.CreateError(
                    "Listing not found",
                    ex.Message
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating listing {ListingId}", listingDto.Id);
                return ServiceResponse<LoadListingDto>.CreateError(
                    "Error updating listing",
                    ex.Message
                );
            }
        }

        public async Task<ServiceResponse<LoadListingDto>> GetListingById(long listingId)
        {
            try
            {
                var organizationId = GetCurrentOrganizationId();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadListingDto>.CreateError(
                        "Organization context required",
                        "Organization context is required to retrieve an internal listing.",
                        "",
                        403
                    );
                }

                var userId = await _userContextService.GetCurrentUserIdAsync();
                if (!userId.HasValue)
                {
                    return ServiceResponse<LoadListingDto>.CreateError(
                        "Access denied",
                        "An authenticated organization member is required to retrieve an internal listing.",
                        "",
                        403
                    );
                }

                var member = await _organizationMemberRepository.GetMemberAsync(organizationId.Value, userId.Value);
                if (member == null || !member.IsActive)
                {
                    return ServiceResponse<LoadListingDto>.CreateError(
                        "Access denied",
                        "You do not have access to listings for the current organization.",
                        "",
                        403
                    );
                }

                var listing = await _listingRepository.GetListingById(listingId);
                if (listing == null)
                {
                    return ServiceResponse<LoadListingDto>.CreateError(
                        "Listing not found",
                        $"Listing with ID {listingId} not found."
                    );
                }

                if (listing.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<LoadListingDto>.CreateError(
                        "Access denied",
                        "You do not have access to this listing.",
                        "",
                        403
                    );
                }

                // Replace image URLs with time-limited SAS URLs so the frontend can load from private blob storage
                var imagesResponse = await _imageService.GetImagesByRefId(listingId);
                if (imagesResponse.Success && imagesResponse.Data != null && imagesResponse.Data.Count > 0)
                {
                    listing.Images = imagesResponse.Data;
                }
                else if (listing.Images != null && listing.Images.Count > 0)
                {
                    var containerClient = _blobServiceClient.GetBlobContainerClient(ListingImagesContainer);
                    foreach (var img in listing.Images)
                    {
                        if (string.IsNullOrWhiteSpace(img.BlobName)) continue;
                        try
                        {
                            var blobClient = containerClient.GetBlobClient(img.BlobName);
                            img.BlobUrl = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromHours(1));
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Could not generate SAS for listing {ListingId} image {BlobName}", listingId, img.BlobName);
                        }
                    }
                }

                return ServiceResponse<LoadListingDto>.CreateSuccess(listing);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving listing {ListingId}", listingId);
                return ServiceResponse<LoadListingDto>.CreateError(
                    "Error retrieving listing",
                    ex.Message
                );
            }
        }

        public async Task<ServiceResponse<LoadListingDto>> GetListingByNumber(string listingNumber)
        {
            try
            {
                var listing = await _listingRepository.GetListingByNumber(listingNumber);
                if (listing == null)
                {
                    return ServiceResponse<LoadListingDto>.CreateError(
                        "Listing not found",
                        $"Listing with number {listingNumber} not found."
                    );
                }

                return ServiceResponse<LoadListingDto>.CreateSuccess(listing);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving listing {ListingNumber}", listingNumber);
                return ServiceResponse<LoadListingDto>.CreateError(
                    "Error retrieving listing",
                    ex.Message
                );
            }
        }

        public async Task<ServiceResponse<List<LoadListingDto>>> GetListingsByOrganization()
        {
            try
            {
                var organizationId = GetCurrentOrganizationId();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadListingDto>>.CreateError(
                        "Organization context required",
                        "Organization context is required to retrieve listings."
                    );
                }

                var listings = await _listingRepository.GetListingsByOrganizationId(organizationId.Value);

                // Attach time-limited SAS URLs for images so listing cards can load from private blob storage
                var containerClient = _blobServiceClient.GetBlobContainerClient(ListingImagesContainer);
                foreach (var listing in listings)
                {
                    var imagesResponse = await _imageService.GetImagesByRefId(listing.Id);
                    if (imagesResponse.Success && imagesResponse.Data != null && imagesResponse.Data.Count > 0)
                    {
                        listing.Images = imagesResponse.Data;
                        var cover = listing.Images.FirstOrDefault(i => i.IsCoverPhoto) ?? listing.Images.FirstOrDefault();
                        listing.CoverImageUrl = cover?.BlobUrl;
                    }
                    else if (listing.Images != null && listing.Images.Count > 0)
                    {
                        // Fallback: generate SAS from repo images (BlobName) so we never send raw URLs (404 on private blob)
                        foreach (var img in listing.Images)
                        {
                            if (string.IsNullOrWhiteSpace(img.BlobName)) continue;
                            try
                            {
                                var blobClient = containerClient.GetBlobClient(img.BlobName);
                                img.BlobUrl = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromHours(1));
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Could not generate SAS for listing {ListingId} image {BlobName}", listing.Id, img.BlobName);
                            }
                        }
                        var coverImg = listing.Images.FirstOrDefault(i => i.IsCoverPhoto) ?? listing.Images.FirstOrDefault();
                        listing.CoverImageUrl = coverImg?.BlobUrl;
                    }
                }

                return ServiceResponse<List<LoadListingDto>>.CreateSuccess(listings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving listings");
                return ServiceResponse<List<LoadListingDto>>.CreateError(
                    "Error retrieving listings",
                    ex.Message
                );
            }
        }

        public async Task<ServiceResponse<bool>> IsUnitListed(long unitId)
        {
            try
            {
                var isListed = await _listingRepository.IsUnitListed(unitId);
                return ServiceResponse<bool>.CreateSuccess(isListed);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if unit {UnitId} is listed", unitId);
                return ServiceResponse<bool>.CreateError(
                    "Error checking listing status",
                    ex.Message
                );
            }
        }

        public async Task<ServiceResponse<bool>> DeleteListing(long listingId)
        {
            try
            {
                var accessError = await ValidateListingMutationAccess<bool>(listingId);
                if (accessError != null)
                {
                    return accessError;
                }

                var deleted = await _listingRepository.DeleteListing(listingId);
                if (!deleted)
                {
                    return ServiceResponse<bool>.CreateError(
                        "Listing not found",
                        $"Listing with ID {listingId} not found."
                    );
                }

                return ServiceResponse<bool>.CreateSuccess(true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting listing {ListingId}", listingId);
                return ServiceResponse<bool>.CreateError(
                    "Error deleting listing",
                    ex.Message
                );
            }
        }

        public async Task<ServiceResponse<LoadListingDto>> PublishListing(long listingId)
        {
            try
            {
                var accessError = await ValidateListingMutationAccess<LoadListingDto>(listingId);
                if (accessError != null)
                {
                    return accessError;
                }

                var existing = await _listingRepository.GetListingById(listingId);
                if (existing == null)
                {
                    return ServiceResponse<LoadListingDto>.CreateError(
                        "Listing not found",
                        "Listing not found."
                    );
                }

                var slug = ListingSlugHelper.ToSlug(existing.PropertyAddress, existing.UnitName);
                if (string.IsNullOrWhiteSpace(slug))
                {
                    return ServiceResponse<LoadListingDto>.CreateError(
                        "Address required",
                        "Property address is required to publish and generate the listing URL."
                    );
                }

                var updateDto = new UpdateListingDto
                {
                    Id = listingId,
                    Status = EListingStatus.Active,
                    CustomListingUrl = slug
                };

                var listing = await _listingRepository.UpdateListing(updateDto);
                return ServiceResponse<LoadListingDto>.CreateSuccess(listing);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error publishing listing {ListingId}", listingId);
                return ServiceResponse<LoadListingDto>.CreateError(
                    "Error publishing listing",
                    ex.Message
                );
            }
        }

        public async Task<ServiceResponse<List<PublicListingSummaryDto>>> GetPublicListingsAsync()
        {
            try
            {
                var listings = await _listingRepository.GetActiveListingsForPublicAsync();
                return ServiceResponse<List<PublicListingSummaryDto>>.CreateSuccess(listings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving public listings");
                return ServiceResponse<List<PublicListingSummaryDto>>.CreateError(
                    "Error retrieving listings",
                    ex.Message
                );
            }
        }

        public async Task<ServiceResponse<List<LoadListingDto>>> GetListingsByPropertyIdAsync(long propertyId)
        {
            try
            {
                var organizationId = GetCurrentOrganizationId();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadListingDto>>.CreateError(
                        "Organization context required",
                        "Organization context is required to retrieve listings."
                    );
                }

                var property = await _propertyRepository.GetPropertyById(propertyId);
                if (property == null)
                {
                    return ServiceResponse<List<LoadListingDto>>.CreateError(
                        "Property not found",
                        $"Property with ID {propertyId} not found."
                    );
                }

                if (property.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<List<LoadListingDto>>.CreateError(
                        "Access denied",
                        "You do not have access to this property.",
                        "",
                        403
                    );
                }

                var listings = await _listingRepository.GetListingsByPropertyId(propertyId);
                return ServiceResponse<List<LoadListingDto>>.CreateSuccess(listings);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving listings for property {PropertyId}", propertyId);
                return ServiceResponse<List<LoadListingDto>>.CreateError(
                    "Error retrieving listings",
                    ex.Message
                );
            }
        }

        public async Task<ServiceResponse<PublicListingDto>> GetPublicListing(string listingNumber)
        {
            try
            {
                var listing = await _listingRepository.GetListingByNumber(listingNumber);
                if (listing == null ||
                    listing.Status != EListingStatus.Active ||
                    !listing.SyndicateToListingWebsite)
                {
                    return ServiceResponse<PublicListingDto>.CreateError(
                        "Listing not found",
                        "Listing not found or not active."
                    );
                }

                // Replace image URLs with time-limited SAS URLs so the public page can load from private blob storage
                AttachSasUrlsToListingImages(listing.Images);

                // Get property and unit details
                var property = await _propertyRepository.GetPropertyById(listing.PropertyId);
                var unit = listing.UnitId.HasValue ? await _unitRepository.GetUnitById(listing.UnitId.Value) : null;

                var organizationId = GetCurrentOrganizationId();
                var showOwnerDashboard = organizationId.HasValue && listing.OrganizationId == organizationId.Value;

                var publicDto = new PublicListingDto
                {
                    ListingId = listing.Id,
                    ShowOwnerDashboard = showOwnerDashboard,
                    ListingNumber = listing.ListingNumber,
                    Slug = (listing.CustomListingUrl ?? "").Trim().TrimStart('/'),
                    PropertyName = property?.Name ?? "",
                    PropertyAddress = listing.PropertyAddress,
                    UnitName = unit?.Name,
                    SquareFeet = listing.SquareFeet ?? unit?.SquareFeet,
                    MonthlyRent = listing.MonthlyRent,
                    SecurityDeposit = listing.SecurityDeposit,
                    YearBuilt = listing.YearBuilt ?? property?.YearBuilt,
                    Bedrooms = unit?.Bedrooms,
                    Baths = unit?.Baths,
                    DateAvailable = listing.DateAvailable,
                    MinLeaseDuration = listing.MinLeaseDuration,
                    MaxLeaseDuration = listing.MaxLeaseDuration,
                    PetsAllowed = listing.PetsAllowed,
                    MarketingDescription = listing.MarketingDescription,
                    VideoTourUrl = listing.VideoTourUrl,
                    AcceptOnlineApplications = listing.AcceptOnlineApplications,
                    ApplicationFeeRequired = listing.ApplicationFeeRequired,
                    ApplicationFee = listing.ApplicationFee,
                    ListingContactName = listing.ListingContactName,
                    ListingContactPhone = listing.ListingContactPhone,
                    ListingContactEmail = listing.ListingContactEmail,
                    Images = listing.Images,
                    CoverPhoto = listing.Images.FirstOrDefault(i => i.IsCoverPhoto) ?? listing.Images.FirstOrDefault(),
                    BasicAmenities = listing.BasicAmenities,
                    PropertyAmenities = listing.PropertyAmenities,
                    PropertyFeatures = listing.PropertyFeatures
                };

                return ServiceResponse<PublicListingDto>.CreateSuccess(publicDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving public listing {ListingNumber}", listingNumber);
                return ServiceResponse<PublicListingDto>.CreateError(
                    "Error retrieving listing",
                    ex.Message
                );
            }
        }

        public async Task<ServiceResponse<PublicListingDto>> GetPublicListingBySlug(string slug)
        {
            try
            {
                var listing = await _listingRepository.GetListingByPublishedSlug(slug);
                if (listing == null)
                {
                    return ServiceResponse<PublicListingDto>.CreateError(
                        "Listing not found",
                        "Listing not found or not active."
                    );
                }

                // Replace image URLs with time-limited SAS URLs so the public page can load from private blob storage
                AttachSasUrlsToListingImages(listing.Images);

                var property = await _propertyRepository.GetPropertyById(listing.PropertyId);
                var unit = listing.UnitId.HasValue ? await _unitRepository.GetUnitById(listing.UnitId.Value) : null;

                var organizationId = GetCurrentOrganizationId();
                var showOwnerDashboard = organizationId.HasValue && listing.OrganizationId == organizationId.Value;

                var publicDto = new PublicListingDto
                {
                    ListingId = listing.Id,
                    ShowOwnerDashboard = showOwnerDashboard,
                    ListingNumber = listing.ListingNumber,
                    Slug = (listing.CustomListingUrl ?? "").Trim().TrimStart('/'),
                    PropertyName = property?.Name ?? "",
                    PropertyAddress = listing.PropertyAddress,
                    UnitName = unit?.Name,
                    SquareFeet = listing.SquareFeet ?? unit?.SquareFeet,
                    MonthlyRent = listing.MonthlyRent,
                    SecurityDeposit = listing.SecurityDeposit,
                    YearBuilt = listing.YearBuilt ?? property?.YearBuilt,
                    Bedrooms = unit?.Bedrooms,
                    Baths = unit?.Baths,
                    DateAvailable = listing.DateAvailable,
                    MinLeaseDuration = listing.MinLeaseDuration,
                    MaxLeaseDuration = listing.MaxLeaseDuration,
                    PetsAllowed = listing.PetsAllowed,
                    MarketingDescription = listing.MarketingDescription,
                    VideoTourUrl = listing.VideoTourUrl,
                    AcceptOnlineApplications = listing.AcceptOnlineApplications,
                    ApplicationFeeRequired = listing.ApplicationFeeRequired,
                    ApplicationFee = listing.ApplicationFee,
                    ListingContactName = listing.ListingContactName,
                    ListingContactPhone = listing.ListingContactPhone,
                    ListingContactEmail = listing.ListingContactEmail,
                    Images = listing.Images,
                    CoverPhoto = listing.Images.FirstOrDefault(i => i.IsCoverPhoto) ?? listing.Images.FirstOrDefault(),
                    BasicAmenities = listing.BasicAmenities,
                    PropertyAmenities = listing.PropertyAmenities,
                    PropertyFeatures = listing.PropertyFeatures
                };

                return ServiceResponse<PublicListingDto>.CreateSuccess(publicDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving public listing by slug {Slug}", slug);
                return ServiceResponse<PublicListingDto>.CreateError(
                    "Error retrieving public listing",
                    ex.Message
                );
            }
        }
    }
}
