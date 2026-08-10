using brownstone_hub_api.Dtos.Vendor;

namespace brownstone_hub_api.Services.VendorService
{
    public interface IVendorService
    {
        Task<ServiceResponse<LoadVendorDto>> AddVendor(AddVendorDto vendor);
        Task<ServiceResponse<LoadVendorDto>> AddVendor(AddVendorDto vendor, long organizationId, long actorUserId);
        Task<ServiceResponse<LoadVendorDto>> GetVendorById(long vendorId);
        Task<ServiceResponse<LoadVendorDto>> GetVendorByOrganizationId(long vendorId, long organizationId);
        Task<ServiceResponse<List<LoadVendorDto>>> GetVendorsByLandlordId(long landlordId, bool includeInactive = false);
        Task<ServiceResponse<List<LoadVendorDto>>> GetVendorsByOrganizationId(long organizationId, bool includeInactive = false);
        Task<ServiceResponse<LoadVendorDto>> UpdateVendor(UpdateVendorDto vendor);
        Task<ServiceResponse<LoadVendorDto>> UpdateVendor(UpdateVendorDto vendor, long organizationId);
        Task<ServiceResponse<bool>> DeleteVendor(long vendorId);
        Task<ServiceResponse<bool>> DeleteVendor(long vendorId, long organizationId);
        Task<ServiceResponse<bool>> SoftDeleteVendor(long vendorId);
        Task<ServiceResponse<bool>> SoftDeleteVendor(long vendorId, long organizationId);
        Task<ServiceResponse<List<LoadVendorDto>>> SearchVendors(long landlordId, string searchTerm, string? category = null);
        Task<ServiceResponse<List<LoadVendorDto>>> SearchVendorsByOrganizationId(long organizationId, string searchTerm, string? category = null);
    }
}

