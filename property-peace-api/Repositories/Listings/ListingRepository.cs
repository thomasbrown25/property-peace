using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Listing;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Amenities;
using brownstone_hub_api.Repositories.Features;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Listings
{
    public class ListingRepository(DataContext context, ILogger<ListingRepository> logger, IMapper mapper, IAmenityRepository amenityRepository, IFeatureRepository featureRepository) : IListingRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<ListingRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;
        private readonly IAmenityRepository _amenityRepository = amenityRepository;
        private readonly IFeatureRepository _featureRepository = featureRepository;

        public async Task<LoadListingDto> CreateListing(CreateListingDto listingDto, long organizationId, long createdBy)
        {
            try
            {
                var listing = _mapper.Map<Listing>(listingDto);
                listing.OrganizationId = organizationId;
                listing.CreatedBy = createdBy;
                listing.ListingNumber = await GenerateListingNumber();
                listing.Status = EListingStatus.Draft;
                listing.ExpiresAt = DateTime.Now.AddDays(30);
                // Use path-based URL (no subdomain required)
                // Format: https://brownstonehub.com/listing/{listingNumber}
                listing.CustomListingUrl = $"/listing/{listing.ListingNumber}";

                // Add basic amenities (Parking, Laundry, Air Conditioning selections)
                if (listingDto.BasicAmenityIds != null && listingDto.BasicAmenityIds.Any())
                {
                    foreach (var amenityId in listingDto.BasicAmenityIds)
                    {
                        listing.ListingBasicAmenities.Add(new ListingBasicAmenity
                        {
                            Listing = listing,
                            BasicAmenityId = amenityId
                        });
                    }
                }

                // Add default amenities (property amenities)
                if (listingDto.DefaultAmenityIds != null && listingDto.DefaultAmenityIds.Any())
                {
                    foreach (var amenityId in listingDto.DefaultAmenityIds)
                    {
                        listing.ListingAmenities.Add(new ListingAmenity
                        {
                            Listing = listing,
                            DefaultAmenityId = amenityId,
                            IsAcquired = true
                        });
                    }
                }

                // Add custom amenities (property amenities)
                if (listingDto.CustomAmenityIds != null && listingDto.CustomAmenityIds.Any())
                {
                    foreach (var amenityId in listingDto.CustomAmenityIds)
                    {
                        listing.ListingAmenities.Add(new ListingAmenity
                        {
                            Listing = listing,
                            CustomAmenityId = amenityId,
                            IsAcquired = true
                        });
                    }
                }

                // Add default features
                if (listingDto.DefaultFeatureIds != null && listingDto.DefaultFeatureIds.Any())
                {
                    foreach (var featureId in listingDto.DefaultFeatureIds)
                    {
                        listing.ListingFeatures.Add(new ListingFeature
                        {
                            Listing = listing,
                            DefaultFeatureId = featureId,
                            IsAcquired = true
                        });
                    }
                }

                // Add custom features
                if (listingDto.CustomFeatureIds != null && listingDto.CustomFeatureIds.Any())
                {
                    foreach (var featureId in listingDto.CustomFeatureIds)
                    {
                        listing.ListingFeatures.Add(new ListingFeature
                        {
                            Listing = listing,
                            CustomFeatureId = featureId,
                            IsAcquired = true
                        });
                    }
                }

                var entry = await _context.Listings.AddAsync(listing);
                await _context.SaveChangesAsync();

                return await GetListingById(entry.Entity.Id) ?? throw new Exception("Failed to retrieve created listing");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating listing");
                throw new Exception("Error creating listing", ex);
            }
        }

        public async Task<LoadListingDto> UpdateListing(UpdateListingDto listingDto)
        {
            try
            {
                var existingListing = await _context.Listings
                    .Include(l => l.ListingBasicAmenities)
                    .Include(l => l.ListingAmenities)
                    .Include(l => l.ListingFeatures)
                    .FirstOrDefaultAsync(l => l.Id == listingDto.Id) ?? throw new KeyNotFoundException("Listing not found");

                // Preserve the first authoritative publication time across later updates and replay.
                var wasActive = existingListing.Status == EListingStatus.Active;

                // Update basic properties
                if (listingDto.Status.HasValue)
                    existingListing.Status = listingDto.Status.Value;
                if (!wasActive && existingListing.Status == EListingStatus.Active)
                    existingListing.PublishedAt ??= DateTime.UtcNow;
                if (listingDto.SquareFeet.HasValue)
                    existingListing.SquareFeet = listingDto.SquareFeet;
                if (listingDto.MonthlyRent.HasValue)
                    existingListing.MonthlyRent = listingDto.MonthlyRent.Value;
                if (listingDto.SecurityDeposit.HasValue)
                    existingListing.SecurityDeposit = listingDto.SecurityDeposit;
                if (listingDto.YearBuilt.HasValue)
                    existingListing.YearBuilt = listingDto.YearBuilt;
                if (listingDto.DateAvailable.HasValue)
                    existingListing.DateAvailable = listingDto.DateAvailable;
                if (listingDto.MinLeaseDuration != null)
                    existingListing.MinLeaseDuration = listingDto.MinLeaseDuration;
                if (listingDto.MaxLeaseDuration != null)
                    existingListing.MaxLeaseDuration = listingDto.MaxLeaseDuration;
                if (listingDto.AdditionalLeaseTermsNotes != null)
                    existingListing.AdditionalLeaseTermsNotes = listingDto.AdditionalLeaseTermsNotes;
                if (listingDto.PetsAllowed.HasValue)
                    existingListing.PetsAllowed = listingDto.PetsAllowed.Value;
                if (listingDto.MarketingDescription != null)
                    existingListing.MarketingDescription = listingDto.MarketingDescription;
                if (listingDto.VideoTourUrl != null)
                    existingListing.VideoTourUrl = listingDto.VideoTourUrl;
                if (listingDto.AcceptOnlineApplications.HasValue)
                    existingListing.AcceptOnlineApplications = listingDto.AcceptOnlineApplications.Value;
                if (listingDto.ApplicationFeeRequired.HasValue)
                    existingListing.ApplicationFeeRequired = listingDto.ApplicationFeeRequired.Value;
                if (listingDto.ApplicationFee.HasValue)
                    existingListing.ApplicationFee = listingDto.ApplicationFee.Value;
                if (listingDto.RequireScreening.HasValue)
                    existingListing.RequireScreening = listingDto.RequireScreening.Value;
                if (listingDto.ScreeningType.HasValue)
                    existingListing.ScreeningType = listingDto.ScreeningType.Value;
                if (listingDto.RequireIncomeVerification.HasValue)
                    existingListing.RequireIncomeVerification = listingDto.RequireIncomeVerification.Value;
                if (listingDto.IncomeVerificationCost.HasValue)
                    existingListing.IncomeVerificationCost = listingDto.IncomeVerificationCost.Value;
                if (listingDto.ListingContactId.HasValue)
                    existingListing.ListingContactId = listingDto.ListingContactId;
                if (listingDto.ListingContactName != null)
                    existingListing.ListingContactName = listingDto.ListingContactName;
                if (listingDto.ListingContactPhone != null)
                    existingListing.ListingContactPhone = listingDto.ListingContactPhone;
                if (listingDto.ListingContactEmail != null)
                    existingListing.ListingContactEmail = listingDto.ListingContactEmail;
                if (listingDto.SyndicateToListingWebsite.HasValue)
                    existingListing.SyndicateToListingWebsite = listingDto.SyndicateToListingWebsite.Value;
                if (listingDto.SyndicateToFreeSites.HasValue)
                    existingListing.SyndicateToFreeSites = listingDto.SyndicateToFreeSites.Value;
                if (listingDto.SyndicateToPremiumSites.HasValue)
                    existingListing.SyndicateToPremiumSites = listingDto.SyndicateToPremiumSites.Value;
                if (listingDto.CustomListingUrl != null)
                    existingListing.CustomListingUrl = listingDto.CustomListingUrl;

                existingListing.UpdatedAt = DateTime.Now;

                // Resolve fallback (name+category) selections to real ids when API returned empty and UI used negative ids
                var basicIds = (listingDto.BasicAmenityIds ?? []).Where(id => id > 0).ToList();
                if (listingDto.BasicAmenitySelections != null && listingDto.BasicAmenitySelections.Count > 0)
                {
                    foreach (var sel in listingDto.BasicAmenitySelections)
                    {
                        if (string.IsNullOrWhiteSpace(sel.Name)) continue;
                        var id = await _amenityRepository.GetOrCreateBasicAmenity(sel.Name.Trim(), sel.Category ?? "");
                        basicIds.Add(id);
                    }
                }
                var defaultAmenityIds = (listingDto.DefaultAmenityIds ?? []).Where(id => id > 0).ToList();
                if (listingDto.DefaultAmenitySelections != null && listingDto.DefaultAmenitySelections.Count > 0)
                {
                    foreach (var sel in listingDto.DefaultAmenitySelections.Where(s => s.Category == nameof(EAmenityCategory.PropertyAmenity)))
                    {
                        if (string.IsNullOrWhiteSpace(sel.Name)) continue;
                        var id = await _amenityRepository.GetOrCreateDefaultAmenity(sel.Name.Trim(), EAmenityCategory.PropertyAmenity);
                        defaultAmenityIds.Add(id);
                    }
                }
                var defaultFeatureIds = (listingDto.DefaultFeatureIds ?? []).Where(id => id > 0).ToList();
                if (listingDto.DefaultFeatureSelections != null && listingDto.DefaultFeatureSelections.Count > 0)
                {
                    foreach (var sel in listingDto.DefaultFeatureSelections)
                    {
                        if (string.IsNullOrWhiteSpace(sel.Name)) continue;
                        var id = await _featureRepository.GetDefaultFeatureIdByName(sel.Name.Trim());
                        if (id.HasValue && !defaultFeatureIds.Contains(id.Value)) defaultFeatureIds.Add(id.Value);
                    }
                }

                // Update amenities if provided
                _logger.LogInformation(
                    "[UpdateListing] Amenity payload: BasicAmenityIds={Basic}, DefaultAmenityIds={DefaultA}, CustomAmenityIds={CustomA}, DefaultFeatureIds={DefaultF}, CustomFeatureIds={CustomF}",
                    basicIds.Count,
                    defaultAmenityIds.Count,
                    listingDto.CustomAmenityIds != null ? listingDto.CustomAmenityIds.Count.ToString() : "null",
                    defaultFeatureIds.Count,
                    listingDto.CustomFeatureIds != null ? listingDto.CustomFeatureIds.Count.ToString() : "null");
                // Replace listing's basic amenities with the new set (no duplicate rows: remove all then add current selection by BasicAmenityId)
                if (listingDto.BasicAmenityIds != null || (listingDto.BasicAmenitySelections?.Count ?? 0) > 0)
                {
                    _context.ListingBasicAmenities.RemoveRange(existingListing.ListingBasicAmenities);
                    foreach (var amenityId in basicIds)
                    {
                        existingListing.ListingBasicAmenities.Add(new ListingBasicAmenity
                        {
                            ListingId = existingListing.Id,
                            BasicAmenityId = amenityId
                        });
                    }
                }

                if (listingDto.DefaultAmenityIds != null || (listingDto.DefaultAmenitySelections?.Count ?? 0) > 0)
                {
                    _context.ListingAmenities.RemoveRange(existingListing.ListingAmenities.Where(la => la.DefaultAmenityId != null && la.CustomAmenityId == null));
                    foreach (var amenityId in defaultAmenityIds)
                    {
                        existingListing.ListingAmenities.Add(new ListingAmenity
                        {
                            ListingId = existingListing.Id,
                            DefaultAmenityId = amenityId,
                            IsAcquired = true
                        });
                    }
                }

                if (listingDto.CustomAmenityIds != null)
                {
                    _context.ListingAmenities.RemoveRange(existingListing.ListingAmenities.Where(la => la.CustomAmenityId != null));
                    foreach (var amenityId in listingDto.CustomAmenityIds)
                    {
                        existingListing.ListingAmenities.Add(new ListingAmenity
                        {
                            ListingId = existingListing.Id,
                            CustomAmenityId = amenityId,
                            IsAcquired = true
                        });
                    }
                }

                if (listingDto.DefaultFeatureIds != null || (listingDto.DefaultFeatureSelections?.Count ?? 0) > 0)
                {
                    _context.ListingFeatures.RemoveRange(existingListing.ListingFeatures.Where(lf => lf.DefaultFeatureId != null && lf.CustomFeatureId == null));
                    foreach (var featureId in defaultFeatureIds)
                    {
                        existingListing.ListingFeatures.Add(new ListingFeature
                        {
                            ListingId = existingListing.Id,
                            DefaultFeatureId = featureId,
                            IsAcquired = true
                        });
                    }
                }

                if (listingDto.CustomFeatureIds != null)
                {
                    _context.ListingFeatures.RemoveRange(existingListing.ListingFeatures.Where(lf => lf.CustomFeatureId != null));
                    foreach (var featureId in listingDto.CustomFeatureIds)
                    {
                        existingListing.ListingFeatures.Add(new ListingFeature
                        {
                            ListingId = existingListing.Id,
                            CustomFeatureId = featureId,
                            IsAcquired = true
                        });
                    }
                }

                _context.Listings.Update(existingListing);
                await _context.SaveChangesAsync();

                return await GetListingById(existingListing.Id) ?? throw new Exception("Failed to retrieve updated listing");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating listing with ID {ListingId}", listingDto.Id);
                throw new Exception($"Error updating listing with ID {listingDto.Id}", ex);
            }
        }

        public async Task<LoadListingDto?> GetListingById(long listingId)
        {
            try
            {
                var listing = await _context.Listings
                    .Include(l => l.Property)
                    .Include(l => l.Unit)
                    .Include(l => l.Images)
                    .Include(l => l.ListingBasicAmenities)
                        .ThenInclude(lba => lba.BasicAmenity)
                    .Include(l => l.ListingAmenities)
                        .ThenInclude(la => la.DefaultAmenity)
                    .Include(l => l.ListingAmenities)
                        .ThenInclude(la => la.CustomAmenity)
                    .Include(l => l.ListingFeatures)
                        .ThenInclude(lf => lf.DefaultFeature)
                    .Include(l => l.ListingFeatures)
                        .ThenInclude(lf => lf.CustomFeature)
                    .FirstOrDefaultAsync(l => l.Id == listingId);

                if (listing == null)
                    return null;

                return MapToLoadListingDto(listing);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving listing with ID {ListingId}", listingId);
                throw new Exception($"Error retrieving listing with ID {listingId}", ex);
            }
        }

        public async Task<LoadListingDto?> GetListingByNumber(string listingNumber)
        {
            try
            {
                var listing = await _context.Listings
                    .Include(l => l.Property)
                    .Include(l => l.Unit)
                    .Include(l => l.Images)
                    .Include(l => l.ListingBasicAmenities)
                        .ThenInclude(lba => lba.BasicAmenity)
                    .Include(l => l.ListingAmenities)
                        .ThenInclude(la => la.DefaultAmenity)
                    .Include(l => l.ListingAmenities)
                        .ThenInclude(la => la.CustomAmenity)
                    .Include(l => l.ListingFeatures)
                        .ThenInclude(lf => lf.DefaultFeature)
                    .Include(l => l.ListingFeatures)
                        .ThenInclude(lf => lf.CustomFeature)
                    .FirstOrDefaultAsync(l => l.ListingNumber == listingNumber);

                if (listing == null)
                    return null;

                return MapToLoadListingDto(listing);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving listing with number {ListingNumber}", listingNumber);
                throw new Exception($"Error retrieving listing with number {listingNumber}", ex);
            }
        }

        public async Task<LoadListingDto?> GetListingByPublishedSlug(string slug)
        {
            if (string.IsNullOrWhiteSpace(slug)) return null;
            var normalized = slug.Trim().TrimStart('/');
            try
            {
                var listing = await _context.Listings
                    .Where(l => l.Status == EListingStatus.Active &&
                        l.SyndicateToListingWebsite != false &&
                        (l.CustomListingUrl == normalized || l.CustomListingUrl == "/" + normalized))
                    .Include(l => l.Property)
                    .Include(l => l.Unit)
                    .Include(l => l.Images)
                    .Include(l => l.ListingBasicAmenities)
                        .ThenInclude(lba => lba.BasicAmenity)
                    .Include(l => l.ListingAmenities)
                        .ThenInclude(la => la.DefaultAmenity)
                    .Include(l => l.ListingAmenities)
                        .ThenInclude(la => la.CustomAmenity)
                    .Include(l => l.ListingFeatures)
                        .ThenInclude(lf => lf.DefaultFeature)
                    .Include(l => l.ListingFeatures)
                        .ThenInclude(lf => lf.CustomFeature)
                    .FirstOrDefaultAsync();

                return listing == null ? null : MapToLoadListingDto(listing);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving listing by slug {Slug}", slug);
                throw new Exception($"Error retrieving listing by slug {slug}", ex);
            }
        }

        public async Task<List<LoadListingDto>> GetListingsByOrganizationId(long organizationId)
        {
            try
            {
                var listings = await _context.Listings
                    .Where(l => l.OrganizationId == organizationId)
                    .Include(l => l.Property)
                    .Include(l => l.Unit)
                    .Include(l => l.Images)
                    .OrderByDescending(l => l.CreatedAt)
                    .ToListAsync();

                return listings.Select(MapToLoadListingDto).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving listings for organization {OrganizationId}", organizationId);
                throw new Exception($"Error retrieving listings for organization {organizationId}", ex);
            }
        }

        public async Task<List<LoadListingDto>> GetListingsByPropertyId(long propertyId)
        {
            try
            {
                var listings = await _context.Listings
                    .Where(l => l.PropertyId == propertyId)
                    .Include(l => l.Property)
                    .Include(l => l.Unit)
                    .Include(l => l.Images)
                    .OrderByDescending(l => l.CreatedAt)
                    .ToListAsync();

                return listings.Select(MapToLoadListingDto).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving listings for property {PropertyId}", propertyId);
                throw new Exception($"Error retrieving listings for property {propertyId}", ex);
            }
        }

        public async Task<List<LoadListingDto>> GetListingsByUnitId(long unitId)
        {
            try
            {
                var listings = await _context.Listings
                    .Where(l => l.UnitId == unitId)
                    .Include(l => l.Property)
                    .Include(l => l.Unit)
                    .Include(l => l.Images)
                    .OrderByDescending(l => l.CreatedAt)
                    .ToListAsync();

                return listings.Select(MapToLoadListingDto).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving listings for unit {UnitId}", unitId);
                throw new Exception($"Error retrieving listings for unit {unitId}", ex);
            }
        }

        public async Task<List<PublicListingSummaryDto>> GetActiveListingsForPublicAsync()
        {
            try
            {
                var listings = await _context.Listings
                    .Where(l => l.Status == EListingStatus.Active && l.SyndicateToListingWebsite != false)
                    .Include(l => l.Property)
                    .Include(l => l.Unit)
                    .Include(l => l.Images)
                    .OrderByDescending(l => l.CreatedAt)
                    .ToListAsync();

                return listings.Select(MapToPublicListingSummaryDto).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving active listings for public");
                throw new Exception("Error retrieving active listings for public", ex);
            }
        }

        public async Task<bool> IsUnitListed(long unitId)
        {
            try
            {
                return await _context.Listings
                    .AnyAsync(l => l.UnitId == unitId && l.Status == EListingStatus.Active);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if unit {UnitId} is listed", unitId);
                throw new Exception($"Error checking if unit {unitId} is listed", ex);
            }
        }

        /// <summary>
        /// Deletes the listing and all data associated with it (basic amenities, amenities, features, images).
        /// CustomAmenity and CustomFeature records are not deleted so they remain as options for other listings.
        /// </summary>
        public async Task<bool> DeleteListing(long listingId)
        {
            try
            {
                var listing = await _context.Listings
                    .Include(l => l.ListingBasicAmenities)
                    .Include(l => l.ListingAmenities)
                    .Include(l => l.ListingFeatures)
                    .Include(l => l.Images)
                    .FirstOrDefaultAsync(l => l.Id == listingId);
                if (listing == null)
                    return false;

                _context.ListingBasicAmenities.RemoveRange(listing.ListingBasicAmenities);
                _context.ListingAmenities.RemoveRange(listing.ListingAmenities);
                _context.ListingFeatures.RemoveRange(listing.ListingFeatures);
                _context.ListingImages.RemoveRange(listing.Images);
                _context.Listings.Remove(listing);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting listing {ListingId}", listingId);
                throw new Exception($"Error deleting listing {listingId}", ex);
            }
        }

        public async Task<int> DeleteListingsByPropertyId(long propertyId)
        {
            try
            {
                var listings = await _context.Listings
                    .Include(l => l.ListingBasicAmenities)
                    .Include(l => l.ListingAmenities)
                    .Include(l => l.ListingFeatures)
                    .Include(l => l.Images)
                    .Where(l => l.PropertyId == propertyId)
                    .ToListAsync();

                if (listings.Count == 0)
                    return 0;

                foreach (var listing in listings)
                {
                    _context.ListingBasicAmenities.RemoveRange(listing.ListingBasicAmenities);
                    _context.ListingAmenities.RemoveRange(listing.ListingAmenities);
                    _context.ListingFeatures.RemoveRange(listing.ListingFeatures);
                    _context.ListingImages.RemoveRange(listing.Images);
                }

                _context.Listings.RemoveRange(listings);
                await _context.SaveChangesAsync();
                return listings.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting listings for property {PropertyId}", propertyId);
                throw new Exception($"Error deleting listings for property {propertyId}", ex);
            }
        }

        public async Task<string> GenerateListingNumber()
        {
            try
            {
                var lastListing = await _context.Listings
                    .OrderByDescending(l => l.Id)
                    .FirstOrDefaultAsync();

                var nextNumber = lastListing == null ? 1 : lastListing.Id + 1;
                return $"LST{nextNumber:D6}";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating listing number");
                throw new Exception("Error generating listing number", ex);
            }
        }

        private LoadListingDto MapToLoadListingDto(Listing listing)
        {
            var dto = _mapper.Map<LoadListingDto>(listing);

            // Coerce nullable entity fields to defaults for DTO
            dto.ListingNumber = listing.ListingNumber ?? "";
            dto.MonthlyRent = listing.MonthlyRent ?? 0;
            dto.MarketingDescription = listing.MarketingDescription ?? "";
            dto.PetsAllowed = listing.PetsAllowed ?? false;
            dto.AcceptOnlineApplications = listing.AcceptOnlineApplications ?? true;
            dto.ApplicationFeeRequired = listing.ApplicationFeeRequired ?? false;
            dto.ApplicationFee = listing.ApplicationFee ?? 0;
            dto.RequireScreening = listing.RequireScreening ?? true;
            dto.ScreeningType = listing.ScreeningType ?? EScreeningType.Essential;
            dto.RequireIncomeVerification = listing.RequireIncomeVerification ?? false;
            dto.IncomeVerificationCost = listing.IncomeVerificationCost ?? 12.00m;
            dto.SyndicateToListingWebsite = listing.SyndicateToListingWebsite ?? true;
            dto.SyndicateToFreeSites = listing.SyndicateToFreeSites ?? false;
            dto.SyndicateToPremiumSites = listing.SyndicateToPremiumSites ?? false;
            dto.CustomListingUrl = listing.CustomListingUrl ?? "";
            dto.ExpiresAt = listing.ExpiresAt ?? DateTime.Now.AddDays(30);
            dto.OrganizationId = listing.OrganizationId ?? 0;
            dto.PublishedAt = listing.PublishedAt;
            dto.UpdatedAt = listing.UpdatedAt ?? listing.CreatedAt;

            // Map property info
            dto.PropertyName = listing.Property?.Name ?? "";
            dto.PropertyAddress = $"{listing.Property?.StreetAddress}, {listing.Property?.City}, {listing.Property?.State} {listing.Property?.ZipCode}";
            dto.UnitName = listing.Unit?.Name;

            // Map images (include IsCoverPhoto so listing cards can show cover)
            dto.Images = listing.Images.Select(i => new Dtos.Image.LoadImageDto
            {
                Id = i.Id,
                BlobName = i.BlobName,
                BlobUrl = i.BlobUrl,
                RefId = i.RefId,
                CreatedAt = i.CreatedAt,
                IsCoverPhoto = i.IsCoverPhoto
            }).ToList();
            var coverImage = listing.Images.FirstOrDefault(i => i.IsCoverPhoto) ?? listing.Images.FirstOrDefault();
            dto.CoverImageUrl = coverImage?.BlobUrl;

            // Map basic amenities from listing.ListingBasicAmenities (FK BasicAmenityId → BasicAmenity)
            dto.BasicAmenities = (listing.ListingBasicAmenities ?? Enumerable.Empty<ListingBasicAmenity>())
                .Where(lba => lba.BasicAmenity != null)
                .Select(lba => new Dtos.Listing.AmenityDto
                {
                    Id = lba.BasicAmenity!.Id,
                    Name = lba.BasicAmenity.Name,
                    Category = lba.BasicAmenity.Category,
                    IsCustom = false
                }).ToList();

            // Map property amenities (only selected/acquired)
            dto.PropertyAmenities = listing.ListingAmenities
                .Where(la => la.DefaultAmenityId != null && la.DefaultAmenity!.Category == EAmenityCategory.PropertyAmenity && la.IsAcquired)
                .Select(la => new Dtos.Listing.AmenityDto
                {
                    Id = la.DefaultAmenity!.Id,
                    Name = la.DefaultAmenity.Name,
                    Category = la.DefaultAmenity.Category,
                    IsCustom = false
                })
                .Concat(listing.ListingAmenities
                    .Where(la => la.CustomAmenityId != null && la.CustomAmenity!.Category == EAmenityCategory.PropertyAmenity && la.IsAcquired)
                    .Select(la => new Dtos.Listing.AmenityDto
                    {
                        Id = la.CustomAmenity!.Id,
                        Name = la.CustomAmenity.Name,
                        Category = la.CustomAmenity.Category,
                        IsCustom = true
                    }))
                .ToList();

            // Map property features (only selected/acquired)
            dto.PropertyFeatures = listing.ListingFeatures
                .Where(lf => lf.DefaultFeatureId != null && lf.IsAcquired)
                .Select(lf => new Dtos.Listing.AmenityDto
                {
                    Id = lf.DefaultFeature!.Id,
                    Name = lf.DefaultFeature.Name,
                    Category = EAmenityCategory.PropertyFeature,
                    IsCustom = false
                })
                .Concat(listing.ListingFeatures
                    .Where(lf => lf.CustomFeatureId != null && lf.IsAcquired)
                    .Select(lf => new Dtos.Listing.AmenityDto
                    {
                        Id = lf.CustomFeature!.Id,
                        Name = lf.CustomFeature.Name,
                        Category = EAmenityCategory.PropertyFeature,
                        IsCustom = true
                    }))
                .ToList();

            return dto;
        }

        private static PublicListingSummaryDto MapToPublicListingSummaryDto(Listing listing)
        {
            var parts = listing.Property != null
                ? new[] { listing.Property.StreetAddress, listing.Property.City, listing.Property.State, listing.Property.ZipCode }
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                : Array.Empty<string>();
            var propertyAddress = string.Join(", ", parts);
            var coverUrl = listing.Images
                .OrderBy(i => i.BlobUrl.Contains("cover", StringComparison.OrdinalIgnoreCase) ? 0 : 1)
                .ThenBy(i => i.Id)
                .FirstOrDefault()?.BlobUrl;

            var slug = (listing.CustomListingUrl ?? "").Trim().TrimStart('/');
            return new PublicListingSummaryDto
            {
                ListingNumber = listing.ListingNumber ?? "",
                Slug = slug,
                PropertyName = listing.Property?.Name ?? "",
                PropertyAddress = propertyAddress,
                UnitName = listing.Unit?.Name,
                MonthlyRent = listing.MonthlyRent ?? 0,
                SquareFeet = listing.SquareFeet ?? listing.Unit?.SquareFeet,
                Bedrooms = listing.Unit?.Bedrooms,
                Baths = listing.Unit?.Baths,
                DateAvailable = listing.DateAvailable,
                CoverPhotoUrl = coverUrl
            };
        }
    }
}
