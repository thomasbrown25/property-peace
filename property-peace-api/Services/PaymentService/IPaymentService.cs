
using brownstone_hub_api.Dtos.Payment;

namespace brownstone_hub_api.Services.PaymentService
{
    public interface IPaymentService
    {
        Task<ServiceResponse<List<LoadPaymentDto>>> AddPayment(AddPaymentDto newPayment);
        Task<ServiceResponse<List<LoadPaymentDto>>> AddManualPayment(AddPaymentDto newPayment, long organizationId);
        Task<ServiceResponse<LoadPaymentDto>> UpdatePayment(long paymentId, UpdatePaymentDto updatePayment, long organizationId);
        Task<ServiceResponse<bool>> DeletePayment(long paymentId, long? userId);
        Task<ServiceResponse<List<LoadPaymentDto>>> GetPaymentsByLeaseId(long leaseId);
        Task<ServiceResponse<List<LoadPaymentDto>>> GetPaymentsByLeaseId(long leaseId, long organizationId);
        Task<ServiceResponse<List<LoadPaymentDto>>> GetAllPayments(long organizationId, long? propertyId = null, long? unitId = null);
        Task<ServiceResponse<List<TenantPaymentHistoryItemDto>>> GetPaymentHistoryByTenantId(long tenantId, long organizationId);
        Task<ServiceResponse<List<TenantLeasePaymentHistoryItemDto>>> GetTenantLeasePaymentHistory(long leaseId, long tenantUserId);
    }
}