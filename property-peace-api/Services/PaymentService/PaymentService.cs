
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Services.AccountMappingService;
using brownstone_hub_api.Services.GeneralLedgerService;
using brownstone_hub_api.Data;
using brownstone_hub_api.Services.ActivationFunnel;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.PaymentService
{
    public class PaymentService(
        IPaymentRepository paymentRepository,
        IAccountMappingService accountMappingService,
        IGeneralLedgerService generalLedgerService,
        DataContext dataContext,
        ILogger<PaymentService> logger,
        IActivationOccurrenceRecorder? activationRecorder = null,
        TimeProvider? timeProvider = null) : IPaymentService
    {
        private readonly IPaymentRepository _paymentRepository = paymentRepository;
        private readonly IAccountMappingService _accountMappingService = accountMappingService;
        private readonly IGeneralLedgerService _generalLedgerService = generalLedgerService;
        private readonly DataContext _dataContext = dataContext;
        private readonly ILogger<PaymentService> _logger = logger;

        public async Task<ServiceResponse<List<LoadPaymentDto>>> AddPayment(AddPaymentDto newPayment) =>
            (await AddPaymentCore(newPayment)).Response;

        private async Task<(ServiceResponse<List<LoadPaymentDto>> Response, LoadPaymentDto? Inserted)> AddPaymentCore(AddPaymentDto newPayment)
        {
            var response = new ServiceResponse<List<LoadPaymentDto>>();
            LoadPaymentDto? insertedPayment = null;
            try
            {
                var completed = string.IsNullOrWhiteSpace(newPayment.Status) ||
                    string.Equals(newPayment.Status, "Completed", StringComparison.OrdinalIgnoreCase);
                long organizationId = 0;
                Account? account = null;
                if (completed)
                {
                    var leaseOrg = await _dataContext.Leases.AsNoTracking()
                        .Where(l => l.Id == newPayment.LeaseId && !l.IsDeleted)
                        .Select(l => (long?)l.Unit.Property.OrganizationId).SingleOrDefaultAsync();
                    if (!leaseOrg.HasValue || leaseOrg.Value <= 0 || (newPayment.FeeId.HasValue && newPayment.DepositId.HasValue))
                        return (ServiceResponse<List<LoadPaymentDto>>.CreateError("Payment accounting unavailable", statusCode: 409), null);
                    organizationId = leaseOrg.Value;
                    account = await ResolvePaymentAccount(organizationId, newPayment.FeeId, newPayment.DepositId);
                    if (account == null)
                        return (ServiceResponse<List<LoadPaymentDto>>.CreateError("Payment accounting account unavailable", statusCode: 409), null);
                }
                await using var transaction = completed && _dataContext.Database.IsRelational() && _dataContext.Database.CurrentTransaction == null
                    ? await _dataContext.Database.BeginTransactionAsync() : null;
                var (inserted, payments) = await _paymentRepository.AddPaymentWithIdentity(newPayment);
                insertedPayment = inserted;
                response.Data = payments;

                if (completed)
                {
                    var payment = inserted;
                    if (payment.Id <= 0 || payment.LeaseId != newPayment.LeaseId ||
                        payment.FeeId != newPayment.FeeId || payment.DepositId != newPayment.DepositId)
                        throw new InvalidOperationException("New payment could not be identified for ledger posting");
                    var ledgerResponse = await _generalLedgerService.CreateLedgerEntryAsync(
                        organizationId, account!.Id, payment.Id, "Payment", Math.Abs(payment.Amount),
                        payment.PaymentDate, newPayment.DepositId.HasValue ? "Deposit Receipt" :
                            newPayment.FeeId.HasValue ? "Lease Fee Payment" : "Rent Payment",
                        payment.Reference ?? payment.LeaseId.ToString());
                    if (!ledgerResponse.Success)
                        throw new InvalidOperationException("Payment ledger posting failed: " + ledgerResponse.Message);
                }
                if (transaction != null) await transaction.CommitAsync();
            }
            catch (Exception ex)
            {
                response.Success = false;
                response.Message = ex.Message;
            }
            return (response, insertedPayment);
        }

        private async Task<Account?> ResolvePaymentAccount(long organizationId, long? feeId, long? depositId)
        {
            var account = depositId.HasValue
                ? await _accountMappingService.GetDepositLiabilityAccountAsync(organizationId)
                : feeId.HasValue
                    ? await _accountMappingService.GetFeeIncomeAccountAsync(organizationId)
                    : await _accountMappingService.GetRentIncomeAccountAsync(organizationId);
            var expected = depositId.HasValue ? EAccountType.Liability : EAccountType.Income;
            var code = depositId.HasValue ? "2100" : feeId.HasValue ? "4400" : "4000";
            return account?.OrganizationId == organizationId && account.IsActive && account.AccountType == expected && account.AccountCode == code
                ? account : null;
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

            // Serialize fee balance reads with the payment write on relational stores.
            await using var transaction = _dataContext.Database.IsRelational()
                ? await _dataContext.Database.BeginTransactionAsync(newPayment.FeeId.HasValue
                    ? System.Data.IsolationLevel.Serializable : System.Data.IsolationLevel.ReadCommitted)
                : null;
            if (newPayment.FeeId.HasValue)
            {
                // Same transaction-owned lease lock as Stripe intent creation/update. Lock before
                // reading balances so neither path can pass its availability check concurrently.
                if (_dataContext.Database.IsSqlServer())
                {
                    var resource = $"stripe-rent-reservation:lease:{newPayment.LeaseId}";
                    await _dataContext.Database.ExecuteSqlInterpolatedAsync($@"
DECLARE @lockResult int;
EXEC @lockResult = sys.sp_getapplock
    @Resource = {resource}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000;
IF @lockResult < 0
    THROW 51000, 'Could not acquire the rent-payment reservation lock.', 1;");
                }
                var fee = await _dataContext.LeaseFees.AsNoTracking()
                    .SingleOrDefaultAsync(f => f.Id == newPayment.FeeId.Value &&
                        f.LeaseId == newPayment.LeaseId && f.OrganizationId == organizationId);
                if (fee == null)
                    return ServiceResponse<List<LoadPaymentDto>>.CreateError("Fee does not belong to this lease", statusCode: 403);
                // Fail closed: even a partial manual write can invalidate an already issued
                // intent when its eventual capture is allocated. Do not treat Processing as free.
                var reserved = await _dataContext.StripeRentPayments.AsNoTracking().AnyAsync(p =>
                    p.LeaseId == newPayment.LeaseId && p.OrganizationId == organizationId &&
                    p.ChargeId == $"fee:{fee.Id}" &&
                    (p.Status == StripeRentPaymentStatus.Created || p.Status == StripeRentPaymentStatus.Processing));
                if (reserved)
                    return ServiceResponse<List<LoadPaymentDto>>.CreateError("Fee has an active online payment reservation", statusCode: 409);
                var feePayments = await _dataContext.Payments.AsNoTracking()
                    .Where(p => p.LeaseId == newPayment.LeaseId && p.OrganizationId == organizationId &&
                        p.FeeId == fee.Id)
                    .ToListAsync();
                var paid = brownstone_hub_api.Services.Payments.FeeCollection.Credited(feePayments);
                if (newPayment.Amount <= 0 || newPayment.Amount > Math.Max(0m, fee.Amount - paid))
                    return ServiceResponse<List<LoadPaymentDto>>.CreateError("Fee payment exceeds outstanding balance", statusCode: 409);
            }

            try
            {
                // This boundary is authoritative for manual rent records.
                // provider provenance, lifecycle state, or backdated occurrence time.
                newPayment.Method = "Manual Entry";
                newPayment.Status = "Completed";
                newPayment.StripePaymentIntentId = null;
                newPayment.StripePaymentMethodId = null;
                var (response, inserted) = await AddPaymentCore(newPayment);
                if (!response.Success)
                {
                    if (transaction is not null) await transaction.RollbackAsync();
                    return response;
                }

                if (newPayment.Amount > 0 && newPayment.FeeId is null && newPayment.DepositId is null &&
                    response.Data is { Count: > 0 } && activationRecorder is not null)
                {
                    var createdPaymentId = inserted?.Id ?? throw new InvalidOperationException("Inserted payment identity missing");
                    var now = (timeProvider ?? TimeProvider.System).GetUtcNow();
                    await activationRecorder.RecordAsync(new ActivationOccurrenceRequest(
                        organizationId,
                        ActivationMilestones.FirstRentRecordedOrPaid,
                        $"lease:{newPayment.LeaseId}",
                        now,
                        SourceEventType: "manual_payment",
                        SourceEventId: createdPaymentId.ToString(System.Globalization.CultureInfo.InvariantCulture),
                        ActorUserId: newPayment.CreatedByUserId > 0 ? newPayment.CreatedByUserId : null));
                }

                if (transaction is not null) await transaction.CommitAsync();
                return response;
            }
            catch (Exception ex)
            {
                if (transaction is not null) await transaction.RollbackAsync();
                _logger.LogError(ex, "Manual payment and activation occurrence transaction failed");
                return ServiceResponse<List<LoadPaymentDto>>.CreateError(
                    "Manual payment unavailable", statusCode: StatusCodes.Status503ServiceUnavailable);
            }
        }

        public async Task<ServiceResponse<LoadPaymentDto>> UpdatePayment(long paymentId, UpdatePaymentDto updatePayment, long organizationId)
        {
            var response = new ServiceResponse<LoadPaymentDto>();
            try
            {
                // Discover the lease only; re-read payment state after acquiring the shared lease lock.
                var target = await _dataContext.Payments.AsNoTracking()
                    .Where(p => p.Id == paymentId && p.Lease.Unit.Property.OrganizationId == organizationId)
                    .Select(p => new { p.LeaseId, p.FeeId }).SingleOrDefaultAsync();
                if (target == null)
                    return ServiceResponse<LoadPaymentDto>.CreateError("Payment not found", statusCode: 404);

                await using var transaction = _dataContext.Database.IsRelational()
                    ? await _dataContext.Database.BeginTransactionAsync(target.FeeId.HasValue
                        ? System.Data.IsolationLevel.Serializable : System.Data.IsolationLevel.ReadCommitted) : null;
                if (target.FeeId.HasValue && _dataContext.Database.IsSqlServer())
                {
                    var resource = $"stripe-rent-reservation:lease:{target.LeaseId}";
                    await _dataContext.Database.ExecuteSqlInterpolatedAsync($@"
DECLARE @lockResult int;
EXEC @lockResult = sys.sp_getapplock
    @Resource = {resource}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000;
IF @lockResult < 0
    THROW 51000, 'Could not acquire the rent-payment reservation lock.', 1;");
                }
                var paymentBeforeUpdate = await _dataContext.Payments.AsNoTracking()
                    .FirstOrDefaultAsync(p => p.Id == paymentId && p.LeaseId == target.LeaseId &&
                        p.Lease.Unit.Property.OrganizationId == organizationId);

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

                if (paymentBeforeUpdate.FeeId.HasValue)
                {
                    // Fee identity is immutable through this DTO. Reject inconsistent legacy rows rather
                    // than allowing a foreign fee to be credited to this organization's lease.
                    var fee = await _dataContext.LeaseFees.AsNoTracking().SingleOrDefaultAsync(f =>
                        f.Id == paymentBeforeUpdate.FeeId.Value && f.LeaseId == target.LeaseId &&
                        f.OrganizationId == organizationId);
                    if (fee == null || paymentBeforeUpdate.OrganizationId != organizationId ||
                        paymentBeforeUpdate.DepositId.HasValue || paymentBeforeUpdate.FeeId != target.FeeId)
                        return ServiceResponse<LoadPaymentDto>.CreateError("Fee does not belong to this lease", statusCode: 403);

                    var otherPayments = await _dataContext.Payments.AsNoTracking()
                        .Where(p => p.LeaseId == target.LeaseId && p.OrganizationId == organizationId &&
                            p.FeeId == fee.Id && p.Id != paymentId).ToListAsync();
                    var before = brownstone_hub_api.Services.Payments.FeeCollection.Credited(otherPayments.Append(paymentBeforeUpdate));
                    var proposed = new Payment
                    {
                        Id = paymentId, LeaseId = target.LeaseId, OrganizationId = organizationId,
                        FeeId = fee.Id, Amount = updatePayment.Amount ?? paymentBeforeUpdate.Amount,
                        Status = string.IsNullOrEmpty(updatePayment.Status) ? paymentBeforeUpdate.Status : updatePayment.Status,
                        Method = updatePayment.Method ?? paymentBeforeUpdate.Method,
                        StripePaymentIntentId = paymentBeforeUpdate.StripePaymentIntentId
                    };
                    // Manual edits must not manufacture provider loss/recovery adjustments.
                    if (brownstone_hub_api.Services.Payments.FeeCollection.IsAdjustment(proposed) !=
                        brownstone_hub_api.Services.Payments.FeeCollection.IsAdjustment(paymentBeforeUpdate))
                        return ServiceResponse<LoadPaymentDto>.CreateError("Fee adjustment cannot be manually reassigned", statusCode: 409);
                    var after = brownstone_hub_api.Services.Payments.FeeCollection.Credited(otherPayments.Append(proposed));
                    if (after > before)
                    {
                        var reserved = await _dataContext.StripeRentPayments.AsNoTracking().AnyAsync(p =>
                            p.LeaseId == target.LeaseId && p.OrganizationId == organizationId &&
                            p.ChargeId == $"fee:{fee.Id}" &&
                            (p.Status == StripeRentPaymentStatus.Created || p.Status == StripeRentPaymentStatus.Processing));
                        if (reserved)
                            return ServiceResponse<LoadPaymentDto>.CreateError("Fee has an active online payment reservation", statusCode: 409);
                        if (after > fee.Amount || proposed.Amount <= 0)
                            return ServiceResponse<LoadPaymentDto>.CreateError("Fee payment exceeds outstanding balance", statusCode: 409);
                    }
                }
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

                    if (paymentEntity != null)
                    {
                        var existingEntry = await _dataContext.GeneralLedgerEntries
                            .FirstOrDefaultAsync(e =>
                                e.OrganizationId == organizationId &&
                                e.TransactionId == paymentId &&
                                e.TransactionType == "Payment");

                        if (!string.Equals(paymentEntity.Status, "Completed", StringComparison.OrdinalIgnoreCase))
                        {
                            // Replaying Failed -> Failed is harmless; remove any stale posting too.
                            if (existingEntry != null)
                            {
                                _dataContext.GeneralLedgerEntries.Remove(existingEntry);
                                await _dataContext.SaveChangesAsync();
                            }
                        }
                        else
                        {
                            if (existingEntry == null)
                            {
                                var incomeAccount = await ResolvePaymentAccount(organizationId, paymentEntity.FeeId, paymentEntity.DepositId);
                                if (incomeAccount != null)
                                {
                                    var ledgerResponse = await _generalLedgerService.CreateLedgerEntryAsync(
                                        organizationId,
                                        incomeAccount.Id,
                                        paymentEntity.Id,
                                        "Payment",
                                        Math.Abs(paymentEntity.Amount),
                                        paymentEntity.PaymentDate,
                                        paymentEntity.DepositId.HasValue ? "Deposit Receipt" : paymentEntity.FeeId.HasValue ? "Lease Fee Payment" : "Rent Payment",
                                        paymentEntity.Reference ?? paymentEntity.LeaseId.ToString()
                                    );

                                    if (!ledgerResponse.Success)
                                        throw new InvalidOperationException("Payment ledger posting failed: " + ledgerResponse.Message);
                                }
                                else
                                    throw new InvalidOperationException("Payment accounting account unavailable");
                            }
                            else if (existingEntry != null)
                            {
                                var correctAccount = await ResolvePaymentAccount(organizationId, paymentEntity.FeeId, paymentEntity.DepositId);
                                if (correctAccount == null) throw new InvalidOperationException("Payment accounting account unavailable");
                                existingEntry.AccountId = correctAccount.Id;
                                existingEntry.Description = paymentEntity.DepositId.HasValue ? "Deposit Receipt" : paymentEntity.FeeId.HasValue ? "Lease Fee Payment" : "Rent Payment";
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
                    _logger.LogError(ledgerEx, "Error synchronizing ledger entry for payment {PaymentId}", paymentId);
                    response.Success = false;
                    response.StatusCode = 409;
                    response.Message = "Payment ledger synchronization failed";
                }
                if (transaction is not null)
                {
                    if (response.Success) await transaction.CommitAsync();
                    else await transaction.RollbackAsync();
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
                        && !tl.Lease.Unit.Property.IsDeleted
                        && tl.Lease.OrganizationId.HasValue
                        && tl.Tenant.OrganizationId == tl.Lease.OrganizationId
                        && tl.Lease.OrganizationId == tl.Lease.Unit.Property.OrganizationId
                        && tl.Lease.Unit.Property.Organization != null
                        && tl.Lease.Unit.Property.Organization.IsActive
                        && !tl.Lease.Unit.Property.Organization.IsDeleted)
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