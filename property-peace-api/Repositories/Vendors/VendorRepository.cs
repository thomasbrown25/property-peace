using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Vendor;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Vendors
{
    public class VendorRepository(DataContext context, ILogger<VendorRepository> logger, IMapper mapper) : IVendorRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<VendorRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public async Task<LoadVendorDto> AddVendor(AddVendorDto vendorDto, long? organizationId = null)
        {
            try
            {
                var vendor = _mapper.Map<Models.Vendor>(vendorDto);
                vendor.CreatedAt = DateTime.UtcNow;
                vendor.UpdatedAt = DateTime.UtcNow;
                
                // Set organizationId if provided
                if (organizationId.HasValue)
                {
                    vendor.OrganizationId = organizationId.Value;
                }
                else
                {
                    // Try to get organizationId from landlord's current organization
                    var landlord = await _context.Users
                        .FirstOrDefaultAsync(u => u.Id == vendorDto.LandlordId);
                    
                    if (landlord?.CurrentOrganizationId != null)
                    {
                        vendor.OrganizationId = landlord.CurrentOrganizationId.Value;
                    }
                }

                var entry = await _context.Vendors.AddAsync(vendor);
                await _context.SaveChangesAsync();

                var saved = entry.Entity;
                var result = await GetVendorWithStats(saved.Id);

                return result!;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding vendor");
                throw new Exception("Error adding vendor", ex);
            }
        }

        public async Task<LoadVendorDto?> GetVendorById(long vendorId)
        {
            try
            {
                return await GetVendorWithStats(vendorId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving vendor with ID {VendorId}", vendorId);
                throw new Exception($"Error retrieving vendor with ID {vendorId}", ex);
            }
        }

        public async Task<List<LoadVendorDto>> GetVendorsByLandlordId(long landlordId, bool includeInactive = false)
        {
            try
            {
                var query = _context.Vendors
                    .Where(v => v.LandlordId == landlordId && !v.IsDeleted);

                if (!includeInactive)
                {
                    query = query.Where(v => v.IsActive);
                }

                var vendors = await query
                    .OrderBy(v => v.Name)
                    .ToListAsync();

                var result = new List<LoadVendorDto>();

                foreach (var vendor in vendors)
                {
                    var dto = await GetVendorWithStats(vendor.Id);
                    result.Add(dto!);
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving vendors for landlord ID {LandlordId}", landlordId);
                throw new Exception($"Error retrieving vendors for landlord ID {landlordId}", ex);
            }
        }

        public async Task<LoadVendorDto?> UpdateVendor(UpdateVendorDto vendorDto)
        {
            try
            {
                var existingVendor = await _context.Vendors
                    .FirstOrDefaultAsync(v => v.Id == vendorDto.Id && !v.IsDeleted);

                if (existingVendor == null)
                {
                    return null;
                }

                _mapper.Map(vendorDto, existingVendor);
                existingVendor.UpdatedAt = DateTime.UtcNow;

                _context.Vendors.Update(existingVendor);
                await _context.SaveChangesAsync();

                return await GetVendorWithStats(existingVendor.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating vendor with ID {VendorId}", vendorDto.Id);
                throw new Exception($"Error updating vendor with ID {vendorDto.Id}", ex);
            }
        }

        public async Task<bool> DeleteVendor(long vendorId)
        {
            try
            {
                var vendor = await _context.Vendors.FindAsync(vendorId);
                if (vendor == null)
                {
                    return false;
                }

                _context.Vendors.Remove(vendor);
                await _context.SaveChangesAsync();

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting vendor with ID {VendorId}", vendorId);
                throw new Exception($"Error deleting vendor with ID {vendorId}", ex);
            }
        }

        public async Task<bool> SoftDeleteVendor(long vendorId)
        {
            try
            {
                var vendor = await _context.Vendors.FindAsync(vendorId);
                if (vendor == null)
                {
                    return false;
                }

                vendor.IsDeleted = true;
                vendor.IsActive = false;
                vendor.UpdatedAt = DateTime.UtcNow;

                _context.Vendors.Update(vendor);
                await _context.SaveChangesAsync();

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error soft deleting vendor with ID {VendorId}", vendorId);
                throw new Exception($"Error soft deleting vendor with ID {vendorId}", ex);
            }
        }

        public async Task<List<LoadVendorDto>> SearchVendors(long landlordId, string searchTerm, string? category = null)
        {
            try
            {
                var query = _context.Vendors
                    .Where(v => v.LandlordId == landlordId && !v.IsDeleted && v.IsActive);

                if (!string.IsNullOrWhiteSpace(searchTerm))
                {
                    var searchLower = searchTerm.ToLower();
                    query = query.Where(v =>
                        v.Name.ToLower().Contains(searchLower) ||
                        (v.BusinessName != null && v.BusinessName.ToLower().Contains(searchLower)) ||
                        (v.Email != null && v.Email.ToLower().Contains(searchLower)) ||
                        (v.Phone != null && v.Phone.Contains(searchTerm)) ||
                        (v.Category != null && v.Category.ToLower().Contains(searchLower)));
                }

                if (!string.IsNullOrWhiteSpace(category))
                {
                    query = query.Where(v => v.Category != null && v.Category.ToLower() == category.ToLower());
                }

                var vendors = await query
                    .OrderBy(v => v.Name)
                    .ToListAsync();

                var result = new List<LoadVendorDto>();

                foreach (var vendor in vendors)
                {
                    var dto = await GetVendorWithStats(vendor.Id);
                    result.Add(dto!);
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching vendors for landlord ID {LandlordId}", landlordId);
                throw new Exception($"Error searching vendors for landlord ID {landlordId}", ex);
            }
        }

        public async Task<List<LoadVendorDto>> GetVendorsByOrganizationId(long organizationId, bool includeInactive = false)
        {
            try
            {
                var query = _context.Vendors
                    .Where(v => v.OrganizationId == organizationId && !v.IsDeleted);

                if (!includeInactive)
                {
                    query = query.Where(v => v.IsActive);
                }

                var vendors = await query
                    .OrderBy(v => v.Name)
                    .ToListAsync();

                var result = new List<LoadVendorDto>();

                foreach (var vendor in vendors)
                {
                    var dto = await GetVendorWithStats(vendor.Id);
                    result.Add(dto!);
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving vendors for organization ID {OrganizationId}", organizationId);
                throw new Exception($"Error retrieving vendors for organization ID {organizationId}", ex);
            }
        }

        public async Task<List<LoadVendorDto>> SearchVendorsByOrganizationId(long organizationId, string searchTerm, string? category = null)
        {
            try
            {
                var query = _context.Vendors
                    .Where(v => v.OrganizationId == organizationId && !v.IsDeleted && v.IsActive);

                if (!string.IsNullOrWhiteSpace(searchTerm))
                {
                    var searchLower = searchTerm.ToLower();
                    query = query.Where(v =>
                        v.Name.ToLower().Contains(searchLower) ||
                        (v.BusinessName != null && v.BusinessName.ToLower().Contains(searchLower)) ||
                        (v.Email != null && v.Email.ToLower().Contains(searchLower)) ||
                        (v.Phone != null && v.Phone.Contains(searchTerm)) ||
                        (v.Category != null && v.Category.ToLower().Contains(searchLower)));
                }

                if (!string.IsNullOrWhiteSpace(category))
                {
                    query = query.Where(v => v.Category != null && v.Category.ToLower() == category.ToLower());
                }

                var vendors = await query
                    .OrderBy(v => v.Name)
                    .ToListAsync();

                var result = new List<LoadVendorDto>();

                foreach (var vendor in vendors)
                {
                    var dto = await GetVendorWithStats(vendor.Id);
                    result.Add(dto!);
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching vendors for organization ID {OrganizationId}", organizationId);
                throw new Exception($"Error searching vendors for organization ID {organizationId}", ex);
            }
        }

        private async Task<LoadVendorDto?> GetVendorWithStats(long vendorId)
        {
            var vendor = await _context.Vendors
                .FirstOrDefaultAsync(v => v.Id == vendorId && !v.IsDeleted);

            if (vendor == null)
            {
                return null;
            }

            var dto = _mapper.Map<LoadVendorDto>(vendor);

            // Calculate statistics
            var expenses = await _context.Expenses
                .Where(e => e.VendorId == vendorId)
                .ToListAsync();

            var maintenanceRequests = await _context.MaintenanceRequests
                .Where(m => m.VendorId == vendorId)
                .ToListAsync();

            dto.ExpenseCount = expenses.Count;
            dto.MaintenanceRequestCount = maintenanceRequests.Count;
            dto.TotalExpenseAmount = expenses.Sum(e => e.Amount);

            return dto;
        }
    }
}

