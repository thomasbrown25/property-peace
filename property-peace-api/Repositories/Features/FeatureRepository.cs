using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Feature;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Features
{
    public class FeatureRepository(DataContext context, ILogger<FeatureRepository> logger, IMapper mapper) : IFeatureRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<FeatureRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public async Task<List<LoadDefaultFeatureDto>> GetDefaultFeatures()
        {
            var list = await _context.DefaultFeatures
                .OrderBy(f => f.Name)
                .ToListAsync();
            return _mapper.Map<List<LoadDefaultFeatureDto>>(list);
        }

        public async Task<List<LoadCustomFeatureDto>> GetCustomFeaturesByOrganizationId(long organizationId)
        {
            var list = await _context.CustomFeatures
                .Where(f => f.OrganizationId == organizationId)
                .OrderBy(f => f.Name)
                .ToListAsync();
            return _mapper.Map<List<LoadCustomFeatureDto>>(list);
        }

        public async Task<LoadCustomFeatureDto> CreateCustomFeature(CreateCustomFeatureDto dto, long organizationId, long createdBy)
        {
            var entity = new CustomFeature
            {
                Name = dto.Name.Trim(),
                OrganizationId = organizationId,
                CreatedBy = createdBy,
                CreatedAt = DateTime.Now
            };
            var entry = await _context.CustomFeatures.AddAsync(entity);
            await _context.SaveChangesAsync();
            return _mapper.Map<LoadCustomFeatureDto>(entry.Entity);
        }

        public async Task<bool> DeleteCustomFeature(long featureId, long organizationId)
        {
            var entity = await _context.CustomFeatures
                .FirstOrDefaultAsync(f => f.Id == featureId && f.OrganizationId == organizationId);
            if (entity == null)
                return false;

            // Remove any listing links that reference this custom feature so the FK constraint does not block delete
            var listingLinks = await _context.ListingFeatures
                .Where(lf => lf.CustomFeatureId == featureId)
                .ToListAsync();
            _context.ListingFeatures.RemoveRange(listingLinks);

            _context.CustomFeatures.Remove(entity);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<long?> GetDefaultFeatureIdByName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return null;
            var entity = await _context.DefaultFeatures
                .FirstOrDefaultAsync(f => f.Name == name.Trim());
            return entity?.Id;
        }
    }
}
