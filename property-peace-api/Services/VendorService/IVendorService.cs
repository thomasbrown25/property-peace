using brownstone_hub_api.Dtos.Vendor;

namespace brownstone_hub_api.Services.VendorService
{
    public interface IVendorService
    {
        Task<ServiceResponse<LoadVendorDto>> AddVendor(AddVendorDto vendor);
        Task<ServiceResponse<LoadVendorDto>> GetVendorById(long vendorId);
        Task<ServiceResponse<List<LoadVendorDto>>> GetVendorsByLandlordId(long landlordId, bool includeInactive = false);
        Task<ServiceResponse<LoadVendorDto>> UpdateVendor(UpdateVendorDto vendor);
        Task<ServiceResponse<bool>> DeleteVendor(long vendorId);
        Task<ServiceResponse<bool>> SoftDeleteVendor(long vendorId);
        Task<ServiceResponse<List<LoadVendorDto>>> SearchVendors(long landlordId, string searchTerm, string? category = null);
    }
}

