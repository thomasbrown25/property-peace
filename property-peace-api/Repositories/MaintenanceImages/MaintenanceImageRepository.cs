

using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.MaintenanceImage;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.MaintenanceImages
{
    public class MaintenanceImageRepository(DataContext context, IMapper mapper) : IMaintenanceImageRepository
    {
        private readonly DataContext _context = context;
        private readonly IMapper _mapper = mapper;

        public async Task<LoadMaintenanceImageDto> AddMaintenanceImage(AddMaintenanceImageDto maintenanceImage)
        {
            var newMaintenanceImage = _mapper.Map<MaintenanceImage>(maintenanceImage);
            await _context.MaintenanceImages.AddAsync(newMaintenanceImage);
            await _context.SaveChangesAsync();

            return _mapper.Map<LoadMaintenanceImageDto>(newMaintenanceImage);
        }

        public async Task<List<LoadMaintenanceImageDto>> GetMaintenanceImagesByRequestId(long maintenanceRequestId)
        {
            var images = await _context.MaintenanceImages
                .Where(x => x.RefId == maintenanceRequestId)
                .ToListAsync();

            return _mapper.Map<List<LoadMaintenanceImageDto>>(images);
        }

        public async Task<LoadMaintenanceImageDto> DeleteMaintenanceImage(long id)
        {
            var image = await _context.MaintenanceImages.FindAsync(id) ?? throw new KeyNotFoundException($"Maintenance image with ID {id} not found.");

            _context.MaintenanceImages.Remove(image);
            await _context.SaveChangesAsync();

            return _mapper.Map<LoadMaintenanceImageDto>(image);
        }
    }
}