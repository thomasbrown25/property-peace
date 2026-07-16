using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Amenity;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Amenities
{
    public class AmenityRepository(DataContext context, ILogger<AmenityRepository> logger, IMapper mapper) : IAmenityRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<AmenityRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public async Task<List<LoadBasicAmenityDto>> GetBasicAmenities()
        {
            try
            {
                var amenities = await _context.BasicAmenities
                    .OrderBy(a => a.Category)
                    .ThenBy(a => a.Name)
                    .ToListAsync();

                return _mapper.Map<List<LoadBasicAmenityDto>>(amenities);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving basic amenities");
                throw new Exception("Error retrieving basic amenities", ex);
            }
        }

        public async Task<List<LoadDefaultAmenityDto>> GetDefaultAmenities()
        {
            try
            {
                var amenities = await _context.DefaultAmenities
                    .Where(a => a.Category == EAmenityCategory.PropertyAmenity)
                    .OrderBy(a => a.Name)
                    .ToListAsync();

                return _mapper.Map<List<LoadDefaultAmenityDto>>(amenities);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving default amenities");
                throw new Exception("Error retrieving default amenities", ex);
            }
        }

        public async Task<List<LoadDefaultAmenityDto>> GetDefaultAmenitiesByCategory(string category)
        {
            try
            {
                if (!Enum.TryParse<EAmenityCategory>(category, true, out var categoryEnum) ||
                    categoryEnum != EAmenityCategory.PropertyAmenity)
                {
                    return new List<LoadDefaultAmenityDto>();
                }

                var amenities = await _context.DefaultAmenities
                    .Where(a => a.Category == categoryEnum)
                    .OrderBy(a => a.Name)
                    .ToListAsync();

                return _mapper.Map<List<LoadDefaultAmenityDto>>(amenities);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving default amenities by category {Category}", category);
                throw new Exception($"Error retrieving default amenities by category {category}", ex);
            }
        }

        public async Task<List<LoadCustomAmenityDto>> GetCustomAmenitiesByOrganizationId(long organizationId)
        {
            try
            {
                var amenities = await _context.CustomAmenities
                    .Where(a => a.OrganizationId == organizationId && a.Category == EAmenityCategory.PropertyAmenity)
                    .OrderBy(a => a.Name)
                    .ToListAsync();

                return _mapper.Map<List<LoadCustomAmenityDto>>(amenities);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving custom amenities for organization {OrganizationId}", organizationId);
                throw new Exception($"Error retrieving custom amenities for organization {organizationId}", ex);
            }
        }

        public async Task<LoadCustomAmenityDto> CreateCustomAmenity(CreateCustomAmenityDto amenityDto, long organizationId, long createdBy)
        {
            try
            {
                var amenity = _mapper.Map<CustomAmenity>(amenityDto);
                amenity.OrganizationId = organizationId;
                amenity.CreatedBy = createdBy;
                amenity.CreatedAt = DateTime.Now;

                var entry = await _context.CustomAmenities.AddAsync(amenity);
                await _context.SaveChangesAsync();

                return _mapper.Map<LoadCustomAmenityDto>(entry.Entity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating custom amenity");
                throw new Exception("Error creating custom amenity", ex);
            }
        }

        public async Task<bool> DeleteCustomAmenity(long amenityId, long organizationId)
        {
            try
            {
                var amenity = await _context.CustomAmenities
                    .FirstOrDefaultAsync(a => a.Id == amenityId && a.OrganizationId == organizationId);

                if (amenity == null)
                    return false;

                // Remove any listing links that reference this custom amenity so the FK constraint does not block delete
                var listingLinks = await _context.ListingAmenities
                    .Where(la => la.CustomAmenityId == amenityId)
                    .ToListAsync();
                _context.ListingAmenities.RemoveRange(listingLinks);

                _context.CustomAmenities.Remove(amenity);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting custom amenity {AmenityId}", amenityId);
                throw new Exception($"Error deleting custom amenity {amenityId}", ex);
            }
        }

        public async Task<long> GetOrCreateBasicAmenity(string name, string category)
        {
            if (!Enum.TryParse<EAmenityCategory>(category, true, out var categoryEnum))
                throw new ArgumentException($"Invalid basic amenity category: {category}");
            var existing = await _context.BasicAmenities
                .FirstOrDefaultAsync(a => a.Name == name && a.Category == categoryEnum);
            if (existing != null)
                return existing.Id;
            var entity = new BasicAmenity { Name = name, Category = categoryEnum };
            var entry = await _context.BasicAmenities.AddAsync(entity);
            await _context.SaveChangesAsync();
            return entry.Entity.Id;
        }

        public async Task<long> GetOrCreateDefaultAmenity(string name, EAmenityCategory category)
        {
            var existing = await _context.DefaultAmenities
                .FirstOrDefaultAsync(a => a.Name == name && a.Category == category);
            if (existing != null)
                return existing.Id;
            var entity = new DefaultAmenity { Name = name, Category = category };
            var entry = await _context.DefaultAmenities.AddAsync(entity);
            await _context.SaveChangesAsync();
            return entry.Entity.Id;
        }
    }
}
