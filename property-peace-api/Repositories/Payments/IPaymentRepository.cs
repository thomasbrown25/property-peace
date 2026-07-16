using brownstone_hub_api.Dtos.Payment;

namespace brownstone_hub_api.Repositories.Payments
{
    public interface IPaymentRepository
    {
        Task<List<LoadPaymentDto>> AddPayment(AddPaymentDto newPayment);
        Task<LoadPaymentDto> UpdatePayment(long paymentId, UpdatePaymentDto updatePayment, long organizationId);
        Task<bool> DeletePayment(long paymentId, long? userId);
        Task<List<LoadPaymentDto>> GetPaymentsByPropertyId(long propertyId, DateTime start, DateTime end);
        Task<Dictionary<long, List<LoadPaymentDto>>> GetPaymentsByPropertyIds(List<long> propertyIds, DateTime start, DateTime end);
        Task<List<LoadPaymentDto>> GetLifetimePaymentsByPropertyId(long propertyId);
        Task<List<LoadPaymentDto>> GetLifetimePaymentsByLandlordId(long landlordId);
        Task<List<LoadPaymentDto>> GetLifetimePaymentsByOrganizationId(long organizationId);
        Task<List<LoadPaymentDto>> GetPaymentsByLeaseId(long leaseId);
        Task<Dictionary<long, List<LoadPaymentDto>>> GetPaymentsByLeaseIds(List<long> leaseIds);
        Task<List<LoadPaymentDto>> GetRentPaymentsByLeaseId(long leaseId);
        Task<Dictionary<long, List<LoadPaymentDto>>> GetRentPaymentsByLeaseIds(List<long> leaseIds);
        Task<List<LoadPaymentDto>> GetLifetimeRentPaymentsByPropertyId(long propertyId);
        Task<List<LoadPaymentDto>> GetLifetimeRentPaymentsByOrganizationId(long organizationId);
        Task<List<LoadPaymentDto>> GetLifetimeRentPaymentsByLandlordId(long landlordId);
        Task<List<LoadPaymentDto>> GetAllPaymentsByOrganizationId(long organizationId, long? propertyId = null, long? unitId = null);
        Task<int> DeletePaymentsByLeaseIds(List<long> leaseIds);
        Task<List<TenantPaymentHistoryItemDto>> GetPaymentHistoryByTenantId(long tenantId);
    }
}