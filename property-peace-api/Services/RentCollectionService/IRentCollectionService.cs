
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Dtos.RentCollection;

namespace brownstone_hub_api.Services.RentCollectionService
{
    public interface IRentCollectionService
    {
        Task<ServiceResponse<RentCollectionResponseDto>> GetRentCollection(long organizationId, long? propertyId = null, long? leaseId = null, bool includeLifetime = false);
        Task<ServiceResponse<RentRecordDto>> AddPayment(AddPaymentDto newPayment);
        Task<ServiceResponse<bool>> SendRentReminder(long leaseId);
    }
}