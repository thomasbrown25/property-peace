using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.UpcomingFeature;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.UpcomingFeatures
{
    public class UpcomingFeatureRepository(DataContext context, ILogger<UpcomingFeatureRepository> logger, IMapper mapper) : IUpcomingFeatureRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<UpcomingFeatureRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public async Task<UpcomingFeatureDto> AddUpcomingFeature(AddUpcomingFeatureDto feature)
        {
            var featureEntity = new Models.UpcomingFeature
            {
                Title = feature.Title,
                Description = feature.Description,
                Icon = feature.Icon,
                DisplayOrder = feature.DisplayOrder,
                IsActive = feature.IsActive,
                ExpectedDate = feature.ExpectedDate,
                CreatedAt = DateTime.Now
            };

            _context.UpcomingFeatures.Add(featureEntity);
            await _context.SaveChangesAsync();

            return _mapper.Map<UpcomingFeatureDto>(featureEntity);
        }

        public async Task<UpcomingFeatureDto> UpdateUpcomingFeature(UpdateUpcomingFeatureDto feature)
        {
            var featureEntity = await _context.UpcomingFeatures.FindAsync(feature.Id);
            if (featureEntity == null)
                throw new KeyNotFoundException($"Upcoming feature with ID {feature.Id} not found");

            featureEntity.Title = feature.Title;
            featureEntity.Description = feature.Description;
            featureEntity.Icon = feature.Icon;
            featureEntity.DisplayOrder = feature.DisplayOrder;
            featureEntity.IsActive = feature.IsActive;
            featureEntity.ExpectedDate = feature.ExpectedDate;
            featureEntity.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            return _mapper.Map<UpcomingFeatureDto>(featureEntity);
        }

        public async Task<bool> DeleteUpcomingFeature(long featureId)
        {
            var featureEntity = await _context.UpcomingFeatures.FindAsync(featureId);
            if (featureEntity == null)
                return false;

            _context.UpcomingFeatures.Remove(featureEntity);
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<UpcomingFeatureDto?> GetUpcomingFeatureById(long featureId)
        {
            var featureEntity = await _context.UpcomingFeatures.FindAsync(featureId);
            return featureEntity == null ? null : _mapper.Map<UpcomingFeatureDto>(featureEntity);
        }

        public async Task<List<UpcomingFeatureDto>> GetAllUpcomingFeatures()
        {
            var features = await _context.UpcomingFeatures
                .OrderBy(f => f.DisplayOrder)
                .ThenBy(f => f.CreatedAt)
                .ToListAsync();

            return _mapper.Map<List<UpcomingFeatureDto>>(features);
        }

        public async Task<List<UpcomingFeatureDto>> GetActiveUpcomingFeatures()
        {
            var features = await _context.UpcomingFeatures
                .Where(f => f.IsActive)
                .OrderBy(f => f.DisplayOrder)
                .ThenBy(f => f.CreatedAt)
                .ToListAsync();

            return _mapper.Map<List<UpcomingFeatureDto>>(features);
        }
    }
}

