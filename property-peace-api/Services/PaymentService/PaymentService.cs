
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Services.AccountMappingService;
using brownstone_hub_api.Services.GeneralLedgerService;
using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.PaymentService
{
    public class PaymentService(
        IPaymentRepository paymentRepository,
        IAccountMappingService accountMappingService,
        IGeneralLedgerService generalLedgerService,
        DataContext dataContext,
        ILogger<PaymentService> logger) : IPaymentService
    {
        private readonly IPaymentRepository _paymentRepository = paymentRepository;
        private readonly IAccountMappingService _accountMappingService = accountMappingService;
        private readonly IGeneralLedgerService _generalLedgerService = generalLedgerService;
        private readonly DataContext _dataContext = dataContext;
        private readonly ILogger<PaymentService> _logger = logger;

        public async Task<ServiceResponse<List<LoadPaymentDto>>> AddPayment(AddPaymentDto newPayment)
        {
            var response = new ServiceResponse<List<LoadPaymentDto>>();
            try
            {
                var payments = await _paymentRepository.AddPayment(newPayment);
                response.Data = payments;

                // Create ledger entry only for completed payments (Stripe tenant payments remain Processing until webhook approval).
                if (payments != null && payments.Count > 0 && string.Equals(payments[0].Status, "Completed", StringComparison.OrdinalIgnoreCase))
                {
                    var payment = payments[0]; // Get the newly created payment
                    
                    try
                    {
                        // Get organization ID from the payment
                        var paymentEntity = await _dataContext.Payments
                            .Include(p => p.Lease)
                                .ThenInclude(l => l.Unit)
                                    .ThenInclude(u => u.Property)
                            .FirstOrDefaultAsync(p => p.Id == payment.Id);

                        if (paymentEntity?.OrganizationId.HasValue == true)
                        {
                            var organizationId = paymentEntity.OrganizationId.Value;
                            var rentIncomeAccount = await _accountMappingService.GetRentIncomeAccountAsync(organizationId);
                            
                            if (rentIncomeAccount != null)
                            {
                                // Payments are positive (increase equity/income)
                                var ledgerResponse = await _generalLedgerService.CreateLedgerEntryAsync(
                                    organizationId,
                                    rentIncomeAccount.Id,
                                    payment.Id,
                                    "Payment",
                                    Math.Abs(payment.Amount), // Positive amount for income
                                    payment.PaymentDate,
                                    "Rent Payment",
                                    payment.Reference ?? payment.LeaseId.ToString()
                                );

                                if (!ledgerResponse.Success)
                                {
                                    _logger.LogWarning("Failed to create ledger entry for payment {PaymentId}: {Message}", payment.Id, ledgerResponse.Message);
                                }
                            }
                            else
                            {
                                _logger.LogWarning("Could not find or create Rent Income account for organization {OrganizationId}", organizationId);
                            }
                        }
                    }
                    catch (Exception ledgerEx)
                    {
                        // Log but don't fail the payment creation if ledger entry fails
                        _logger.LogError(ledgerEx, "Error creating ledger entry for payment {PaymentId}", payment.Id);
                    }
                }
            }
            catch (Exception ex)
            {
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<List<LoadPaymentDto>>> AddManualPayment(AddPaymentDto newPayment, long organizationId)
        {
            var authorized = await _dataContext.Leases.AsNoTracking().AnyAsync(l =>
                l.Id == newPayment.LeaseId && !l.IsDeleted && l.Unit.Property.OrganizationId == organizationId);
            if (!authorized)
                return new ServiceResponse<List<LoadPaymentDto>>
                {
                    Success = false, StatusCode = 403, Message = "Access denied to this lease"
                };

            return await AddPayment(newPayment);
        }

        public async Task<ServiceResponse<LoadPaymentDto>> UpdatePayment(long paymentId, UpdatePaymentDto updatePayment, long organizationId)
        {
            var response = new ServiceResponse<LoadPaymentDto>();
            try
            {
                // Get the payment before update to check status change
                var paymentBeforeUpdate = await _dataContext.Payments
                    .Include(p => p.Lease)
                        .ThenInclude(l => l.Unit)
                            .ThenInclude(u => u.Property)
                    .FirstOrDefaultAsync(p => p.Id == paymentId &&
                        (p.OrganizationId == organizationId || p.Lease.Unit.Property.OrganizationId == organizationId));

                if (paymentBeforeUpdate == null)
                {
                    response.Success = false;
                    response.Message = "Payment not found";
                    response.StatusCode = 404;
                    return response;
                }

                if (!string.IsNullOrWhiteSpace(paymentBeforeUpdate.StripePaymentIntentId)
                    || !string.IsNullOrWhiteSpace(paymentBeforeUpdate.StripeChargeId))
                {
                    response.Success = false;
                    response.Message = "Provider-recorded online payments cannot be manually edited. Refund, dispute, return, and reconciliation state must come from the payment provider workflow.";
                    response.StatusCode = 409;
                    return response;
                }

                // Update the payment
                var payment = await _paymentRepository.UpdatePayment(paymentId, updatePayment, organizationId);
                response.Data = payment;

                try
                {
                    var paymentEntity = await _dataContext.Payments
                        .Include(p => p.Lease)
                            .ThenInclude(l => l.Unit)
                                .ThenInclude(u => u.Property)
                        .FirstOrDefaultAsync(p => p.Id == paymentId &&
                            (p.OrganizationId == organizationId || p.Lease.Unit.Property.OrganizationId == organizationId));

                    if (paymentEntity?.OrganizationId.HasValue == true)
                    {
                        var existingEntry = await _dataContext.GeneralLedgerEntries
                            .FirstOrDefaultAsync(e =>
                                e.OrganizationId == organizationId &&
                                e.TransactionId == paymentId &&
                                e.TransactionType == "Payment");

                        if (paymentEntity.Status == "Completed")
                        {
                            if (existingEntry == null)
                            {
                                var rentIncomeAccount = await _accountMappingService.GetRentIncomeAccountAsync(organizationId);

                                if (rentIncomeAccount != null)
                                {
                                    var ledgerResponse = await _generalLedgerService.CreateLedgerEntryAsync(
                                        organizationId,
                                        rentIncomeAccount.Id,
                                        paymentEntity.Id,
                                        "Payment",
                                        Math.Abs(paymentEntity.Amount),
                                        paymentEntity.PaymentDate,
                                        "Rent Payment",
                                        paymentEntity.Reference ?? paymentEntity.LeaseId.ToString()
                                    );

                                    if (!ledgerResponse.Success)
                                    {
                                        _logger.LogWarning("Failed to create ledger entry for payment {PaymentId}: {Message}", paymentEntity.Id, ledgerResponse.Message);
                                    }
                                }
                                else
                                {
                                    _logger.LogWarning("Could not find or create Rent Income account for organization {OrganizationId}", organizationId);
                                }
                            }
                            else if (existingEntry != null)
                            {
                                existingEntry.Amount = Math.Abs(paymentEntity.Amount);
                                existingEntry.TransactionDate = paymentEntity.PaymentDate;
                                existingEntry.Reference = paymentEntity.Reference ?? paymentEntity.LeaseId.ToString();
                                existingEntry.UpdatedAt = DateTime.UtcNow;
                                await _dataContext.SaveChangesAsync();
                            }
                        }
                    }
                }
                catch (Exception ledgerEx)
                {
                    // Log but don't fail the payment update if ledger synchronization fails
                    _logger.LogError(ledgerEx, "Error synchronizing ledger entry for payment {PaymentId}", paymentId);
                }
            }
            catch (Exception ex)
            {
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<bool>> DeletePayment(long paymentId, long? userId)
        {
            var response = new ServiceResponse<bool>();
            try
            {
                var providerRecorded = await _dataContext.Payments
                    .AsNoTracking()
                    .Where(p => p.Id == paymentId)
                    .Select(p => !string.IsNullOrWhiteSpace(p.StripePaymentIntentId)
                        || !string.IsNullOrWhiteSpace(p.StripeChargeId))
                    .SingleOrDefaultAsync();
                if (providerRecorded)
                {
                    response.Success = false;
                    response.Message = "Provider-recorded online payments cannot be manually deleted. Refund, dispute, return, and reconciliation state must come from the payment provider workflow.";
                    response.StatusCode = 409;
                    return response;
                }

                var result = await _paymentRepository.DeletePayment(paymentId, userId);
                response.Data = result;
            }
            catch (UnauthorizedAccessException ex)
            {
                response.Success = false;
                response.Message = ex.Message;
                response.StatusCode = 403;
            }
            catch (Exception ex)
            {
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<List<LoadPaymentDto>>> GetPaymentsByLeaseId(long leaseId)
        {
            var response = new ServiceResponse<List<LoadPaymentDto>>();
            try
            {
                var payments = await _paymentRepository.GetPaymentsByLeaseId(leaseId);
                response.Data = payments;
            }
            catch (Exception ex)
            {
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<List<LoadPaymentDto>>> GetPaymentsByLeaseId(long leaseId, long organizationId)
        {
            var authorized = await _dataContext.Leases.AsNoTracking().AnyAsync(l =>
                l.Id == leaseId && !l.IsDeleted && l.Unit.Property.OrganizationId == organizationId);
            if (!authorized)
                return new ServiceResponse<List<LoadPaymentDto>>
                {
                    Success = false, StatusCode = 403, Message = "Access denied to this lease"
                };

            return await GetPaymentsByLeaseId(leaseId);
        }

        public async Task<ServiceResponse<List<TenantLeasePaymentHistoryItemDto>>> GetTenantLeasePaymentHistory(long leaseId, long tenantUserId)
        {
            var response = new ServiceResponse<List<TenantLeasePaymentHistoryItemDto>>();
            try
            {
                var organizationId = await _dataContext.TenantLeases
                    .AsNoTracking()
                    .Where(tl => tl.LeaseId == leaseId
                        && tl.Tenant.UserId == tenantUserId
                        && !tl.Tenant.IsDeleted
                        && !tl.Lease.IsDeleted
                        && tl.Tenant.OrganizationId.HasValue
                        && tl.Tenant.OrganizationId == tl.Lease.Unit.Property.OrganizationId)
                    .Select(tl => tl.Tenant.OrganizationId)
                    .SingleOrDefaultAsync();

                if (!organizationId.HasValue)
                {
                    response.Success = false;
                    response.Message = "Access denied to this lease payment history";
                    response.StatusCode = 403;
                    return response;
                }

                response.Data = await _paymentRepository.GetTenantLeasePaymentHistory(
                    leaseId, tenantUserId, organizationId.Value);
            }
            catch (Exception ex)
            {
                response.Success = false;
                response.Message = ex.Message;
            }

            return response;
        }

        public async Task<ServiceResponse<List<LoadPaymentDto>>> GetAllPayments(long organizationId, long? propertyId = null, long? unitId = null)
        {
            var response = new ServiceResponse<List<LoadPaymentDto>>();
            try
            {
                var payments = await _paymentRepository.GetAllPaymentsByOrganizationId(organizationId, propertyId, unitId);
                response.Data = payments;
            }
            catch (Exception ex)
            {
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }

        public async Task<ServiceResponse<List<TenantPaymentHistoryItemDto>>> GetPaymentHistoryByTenantId(long tenantId, long organizationId)
        {
            var response = new ServiceResponse<List<TenantPaymentHistoryItemDto>>();
            try
            {
                var tenant = await _dataContext.Tenants
                    .AsNoTracking()
                    .FirstOrDefaultAsync(t => t.Id == tenantId && !t.IsDeleted);

                if (tenant == null)
                {
                    response.Success = false;
                    response.Message = "Tenant not found";
                    response.StatusCode = 404;
                    return response;
                }

                if (tenant.OrganizationId != organizationId)
                {
                    response.Success = false;
                    response.Message = "Access denied to this tenant";
                    response.StatusCode = 403;
                    return response;
                }

                var history = await _paymentRepository.GetPaymentHistoryByTenantId(tenantId);
                response.Data = history;
            }
            catch (Exception ex)
            {
                response.Success = false;
                response.Message = ex.Message;
            }
            return response;
        }
    }
}