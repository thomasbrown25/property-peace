using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Vendor;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Repositories.Vendors;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.VendorService
{
    public class VendorService(
        IVendorRepository vendorRepository,
        IUserRepository userRepository,
        IHttpContextAccessor httpContextAccessor,
        DataContext db,
        ILogger<VendorService> logger) : IVendorService
    {
        private readonly IVendorRepository _vendorRepository = vendorRepository;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly DataContext _db = db;
        private readonly ILogger<VendorService> _logger = logger;

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        public async Task<ServiceResponse<LoadVendorDto>> AddVendor(AddVendorDto vendorDto)
        {
            try
            {
                // Validate landlord exists
                var landlord = await _userRepository.GetUser(vendorDto.LandlordId);
                if (landlord == null)
                {
                    return ServiceResponse<LoadVendorDto>.CreateError(
                        "Invalid Landlord ID",
                        "The specified landlord does not exist."
                    );
                }

                var organizationId = GetOrganizationIdFromContext();
                var result = await _vendorRepository.AddVendor(vendorDto, organizationId);
                return ServiceResponse<LoadVendorDto>.CreateSuccess(result, "Vendor created successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding vendor");
                return ServiceResponse<LoadVendorDto>.CreateError("Error creating vendor", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadVendorDto>> AddVendor(AddVendorDto vendorDto, long organizationId, long actorUserId)
        {
            if (organizationId <= 0 || actorUserId <= 0)
                return ServiceResponse<LoadVendorDto>.CreateError("Organization and actor are required", "Invalid ownership context", statusCode: 403);
            var actor = await _userRepository.GetUser(actorUserId);
            if (actor is null)
                return ServiceResponse<LoadVendorDto>.CreateError("Actor not found", "Authenticated actor does not exist", statusCode: 401);

            vendorDto.LandlordId = actorUserId;
            var result = await _vendorRepository.AddVendor(vendorDto, organizationId);
            return ServiceResponse<LoadVendorDto>.CreateSuccess(result, "Vendor created successfully");
        }

        public async Task<ServiceResponse<LoadVendorDto>> GetVendorById(long vendorId)
        {
            try
            {
                var vendor = await _vendorRepository.GetVendorById(vendorId);
                if (vendor == null)
                {
                    return ServiceResponse<LoadVendorDto>.CreateError(
                        "Vendor not found",
                        $"No vendor found with ID {vendorId}",
                        statusCode: 404
                    );
                }

                return ServiceResponse<LoadVendorDto>.CreateSuccess(vendor, "Vendor retrieved successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving vendor with ID {VendorId}", vendorId);
                return ServiceResponse<LoadVendorDto>.CreateError("Error retrieving vendor", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadVendorDto>>> GetVendorsByLandlordId(long landlordId, bool includeInactive = false)
        {
            try
            {
                // Validate landlord exists
                var landlord = await _userRepository.GetUser(landlordId);
                if (landlord == null)
                {
                    return ServiceResponse<List<LoadVendorDto>>.CreateError(
                        "Invalid Landlord ID",
                        "The specified landlord does not exist."
                    );
                }

                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadVendorDto>>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var vendors = await _vendorRepository.GetVendorsByOrganizationId(organizationId.Value, includeInactive);
                return ServiceResponse<List<LoadVendorDto>>.CreateSuccess(vendors, "Vendors retrieved successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving vendors for landlord ID {LandlordId}", landlordId);
                return ServiceResponse<List<LoadVendorDto>>.CreateError("Error retrieving vendors", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadVendorDto>>> GetVendorsByOrganizationId(long organizationId, bool includeInactive = false)
        {
            var vendors = await _vendorRepository.GetVendorsByOrganizationId(organizationId, includeInactive);
            await ApplyReadiness(vendors, organizationId);
            return ServiceResponse<List<LoadVendorDto>>.CreateSuccess(vendors, "Vendors retrieved successfully");
        }

        public async Task<ServiceResponse<LoadVendorDto>> GetVendorByOrganizationId(long vendorId, long organizationId)
        {
            var vendors = await _vendorRepository.GetVendorsByOrganizationId(organizationId, true);
            var vendor = vendors.SingleOrDefault(x => x.Id == vendorId);
            if (vendor is null)
                return ServiceResponse<LoadVendorDto>.CreateError("Vendor not found", "Vendor not found", statusCode: 404);
            await ApplyReadiness([vendor], organizationId);
            return ServiceResponse<LoadVendorDto>.CreateSuccess(vendor, "Vendor retrieved successfully");
        }

        public async Task<ServiceResponse<List<LoadVendorDto>>> SearchVendorsByOrganizationId(long organizationId, string searchTerm, string? category = null)
        {
            var vendors = await _vendorRepository.SearchVendorsByOrganizationId(organizationId, searchTerm, category);
            await ApplyReadiness(vendors, organizationId);
            return ServiceResponse<List<LoadVendorDto>>.CreateSuccess(vendors, "Vendors retrieved successfully");
        }

        private async Task ApplyReadiness(IEnumerable<LoadVendorDto> vendors, long organizationId)
        {
            var readyIds = await _db.Vendors.AsNoTracking()
                .Where(x => x.OrganizationId == organizationId && x.IsActive && !x.IsDeleted && x.PortalUserId != null)
                .Select(x => x.Id).ToHashSetAsync();
            foreach (var vendor in vendors) vendor.IsReadyForAssignment = readyIds.Contains(vendor.Id);
        }

        public async Task<ServiceResponse<LoadVendorDto>> UpdateVendor(UpdateVendorDto vendorDto)
        {
            try
            {
                // Verify vendor exists and belongs to the correct landlord
                var existingVendor = await _vendorRepository.GetVendorById(vendorDto.Id);
                if (existingVendor == null)
                {
                    return ServiceResponse<LoadVendorDto>.CreateError(
                        "Vendor not found",
                        $"No vendor found with ID {vendorDto.Id}",
                        statusCode: 404
                    );
                }

                var result = await _vendorRepository.UpdateVendor(vendorDto);
                if (result == null)
                {
                    return ServiceResponse<LoadVendorDto>.CreateError(
                        "Update failed",
                        "Failed to update vendor"
                    );
                }

                return ServiceResponse<LoadVendorDto>.CreateSuccess(result, "Vendor updated successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating vendor with ID {VendorId}", vendorDto.Id);
                return ServiceResponse<LoadVendorDto>.CreateError("Error updating vendor", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadVendorDto>> UpdateVendor(UpdateVendorDto vendorDto, long organizationId)
        {
            if (!await OwnsVendorAsync(vendorDto.Id, organizationId)) return VendorNotFound<LoadVendorDto>();
            return await UpdateVendor(vendorDto);
        }

        public async Task<ServiceResponse<bool>> DeleteVendor(long vendorId)
        {
            try
            {
                var vendor = await _vendorRepository.GetVendorById(vendorId);
                if (vendor == null)
                {
                    return ServiceResponse<bool>.CreateError(
                        "Vendor not found",
                        $"No vendor found with ID {vendorId}",
                        statusCode: 404
                    );
                }

                var result = await _vendorRepository.DeleteVendor(vendorId);
                return ServiceResponse<bool>.CreateSuccess(result, "Vendor deleted successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting vendor with ID {VendorId}", vendorId);
                return ServiceResponse<bool>.CreateError("Error deleting vendor", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteVendor(long vendorId, long organizationId)
        {
            if (!await OwnsVendorAsync(vendorId, organizationId)) return VendorNotFound<bool>();
            return await DeleteVendor(vendorId);
        }

        public async Task<ServiceResponse<bool>> SoftDeleteVendor(long vendorId)
        {
            try
            {
                var vendor = await _vendorRepository.GetVendorById(vendorId);
                if (vendor == null)
                {
                    return ServiceResponse<bool>.CreateError(
                        "Vendor not found",
                        $"No vendor found with ID {vendorId}",
                        statusCode: 404
                    );
                }

                var result = await _vendorRepository.SoftDeleteVendor(vendorId);
                return ServiceResponse<bool>.CreateSuccess(result, "Vendor deactivated successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error soft deleting vendor with ID {VendorId}", vendorId);
                return ServiceResponse<bool>.CreateError("Error deactivating vendor", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<bool>> SoftDeleteVendor(long vendorId, long organizationId)
        {
            if (!await OwnsVendorAsync(vendorId, organizationId)) return VendorNotFound<bool>();
            return await SoftDeleteVendor(vendorId);
        }

        private Task<bool> OwnsVendorAsync(long vendorId, long organizationId) =>
            _db.Vendors.AsNoTracking().AnyAsync(x => x.Id == vendorId && x.OrganizationId == organizationId);

        private static ServiceResponse<T> VendorNotFound<T>() =>
            ServiceResponse<T>.CreateError("Vendor not found", "Vendor not found in the current organization", statusCode: 404);

        public async Task<ServiceResponse<List<LoadVendorDto>>> SearchVendors(long landlordId, string searchTerm, string? category = null)
        {
            try
            {
                // Validate landlord exists
                var landlord = await _userRepository.GetUser(landlordId);
                if (landlord == null)
                {
                    return ServiceResponse<List<LoadVendorDto>>.CreateError(
                        "Invalid Landlord ID",
                        "The specified landlord does not exist."
                    );
                }

                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadVendorDto>>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                if (string.IsNullOrWhiteSpace(searchTerm) && string.IsNullOrWhiteSpace(category))
                {
                    // If no search term or category, return all vendors
                    return await GetVendorsByLandlordId(landlordId, false);
                }

                var vendors = await _vendorRepository.SearchVendorsByOrganizationId(organizationId.Value, searchTerm ?? string.Empty, category);
                return ServiceResponse<List<LoadVendorDto>>.CreateSuccess(vendors, "Vendors retrieved successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching vendors for landlord ID {LandlordId}", landlordId);
                return ServiceResponse<List<LoadVendorDto>>.CreateError("Error searching vendors", ex.Message, ex.InnerException?.Message);
            }
        }
    }
}

