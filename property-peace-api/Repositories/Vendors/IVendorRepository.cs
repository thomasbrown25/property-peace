using brownstone_hub_api.Dtos.Vendor;

namespace brownstone_hub_api.Repositories.Vendors
{
    public interface IVendorRepository
    {
        Task<LoadVendorDto> AddVendor(AddVendorDto vendor, long? organizationId = null);
        Task<LoadVendorDto?> GetVendorById(long vendorId);
        Task<List<LoadVendorDto>> GetVendorsByLandlordId(long landlordId, bool includeInactive = false);
        Task<LoadVendorDto?> UpdateVendor(UpdateVendorDto vendor);
        Task<bool> DeleteVendor(long vendorId);
        Task<bool> SoftDeleteVendor(long vendorId);
        Task<List<LoadVendorDto>> SearchVendors(long landlordId, string searchTerm, string? category = null);
        Task<List<LoadVendorDto>> GetVendorsByOrganizationId(long organizationId, bool includeInactive = false);
        Task<List<LoadVendorDto>> SearchVendorsByOrganizationId(long organizationId, string searchTerm, string? category = null);
    }
}

