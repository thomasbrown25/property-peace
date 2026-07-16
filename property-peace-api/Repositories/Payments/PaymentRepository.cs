using AutoMapper;
using AutoMapper.QueryableExtensions;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Utils;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Payments
{
    public class PaymentRepository(DataContext context, ILogger<PaymentRepository> logger, IMapper mapper) : IPaymentRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<PaymentRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public async Task<List<LoadPaymentDto>> AddPayment(AddPaymentDto newPayment)
        {
            var leaseId = newPayment.LeaseId;
            var paymentDate = newPayment.PaymentDate;
            var amount = newPayment.Amount;
            var method = newPayment.Method;

            try
            {
                var lease = await _context.Leases
                    .Include(l => l.Unit)
                    .ThenInclude(u => u.Property)
                    .FirstOrDefaultAsync(l => l.Id == leaseId) ?? throw new KeyNotFoundException($"Lease with ID {leaseId} not found");

                var payment = new Payment
                {
                    LeaseId = leaseId,
                    PropertyId = lease.Unit.Property.Id,
                    OrganizationId = lease.Unit.Property.OrganizationId,
                    PaymentDate = paymentDate,
                    Amount = amount,
                    Method = method,
                    Status = string.IsNullOrWhiteSpace(newPayment.Status) ? "Completed" : newPayment.Status,
                    Reference = newPayment.Reference,
                    StripePaymentIntentId = newPayment.StripePaymentIntentId,
                    StripePaymentMethodId = newPayment.StripePaymentMethodId,
                    SubmittedAt = string.Equals(newPayment.Status, "Processing", StringComparison.OrdinalIgnoreCase) ? DateTime.UtcNow : null,
                    CompletedAt = string.Equals(string.IsNullOrWhiteSpace(newPayment.Status) ? "Completed" : newPayment.Status, "Completed", StringComparison.OrdinalIgnoreCase) ? DateTime.UtcNow : null,
                    StripeStatusChangedAt = !string.IsNullOrWhiteSpace(newPayment.Status) ? DateTime.UtcNow : null,
                    CreatedByUserId = newPayment.CreatedByUserId,
                    FeeId = newPayment.FeeId,
                    DepositId = newPayment.DepositId
                };

                await _context.Payments.AddAsync(payment);
                await _context.SaveChangesAsync();

                // Return all payments for the lease after adding the new one
                var payments = await _context.Payments
                    .AsNoTracking()
                    .Where(p => p.LeaseId == leaseId)
                    .OrderByDescending(p => p.PaymentDate)
                    .ToListAsync();

                var paymentDtos = _mapper.Map<List<LoadPaymentDto>>(payments);

                // Update the lease's OverdueAmount using rent-only payments
                var rentPayments = await GetRentPaymentsByLeaseId(leaseId);
                await UpdateLeaseOverdueAmount(leaseId, lease, rentPayments);

                return paymentDtos;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding payment for lease ID {LeaseId}", leaseId);
                throw new Exception($"Error adding payment for lease ID {leaseId}", ex);
            }
        }

        public async Task<LoadPaymentDto> UpdatePayment(long paymentId, UpdatePaymentDto updatePayment, long organizationId)
        {
            try
            {
                var payment = await _context.Payments
                    .Include(p => p.Lease)
                        .ThenInclude(l => l.Unit)
                            .ThenInclude(u => u.Property)
                    .FirstOrDefaultAsync(p => p.Id == paymentId &&
                        (p.OrganizationId == organizationId || p.Lease.Unit.Property.OrganizationId == organizationId));

                if (payment == null)
                {
                    throw new KeyNotFoundException($"Payment with ID {paymentId} not found");
                }

                if (updatePayment.Amount.HasValue)
                {
                    payment.Amount = updatePayment.Amount.Value;
                }
                if (updatePayment.PaymentDate.HasValue)
                {
                    payment.PaymentDate = updatePayment.PaymentDate.Value;
                }
                if (updatePayment.Method != null)
                {
                    payment.Method = updatePayment.Method;
                }
                if (updatePayment.Reference != null)
                {
                    payment.Reference = updatePayment.Reference;
                }
                if (!string.IsNullOrEmpty(updatePayment.Status))
                {
                    payment.Status = updatePayment.Status;
                }
                payment.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                // Update the lease's OverdueAmount after editable payment fields change.
                if (payment.Lease != null)
                {
                    var rentPayments = await GetRentPaymentsByLeaseId(payment.LeaseId);
                    await UpdateLeaseOverdueAmount(payment.LeaseId, payment.Lease, rentPayments);
                }

                return _mapper.Map<LoadPaymentDto>(payment);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating payment ID {PaymentId}", paymentId);
                throw new Exception($"Error updating payment ID {paymentId}", ex);
            }
        }

        public async Task<bool> DeletePayment(long paymentId, long? userId)
        {
            try
            {
                var payment = await _context.Payments
                    .Include(p => p.Lease)
                        .ThenInclude(l => l.Unit)
                            .ThenInclude(u => u.Property)
                    .FirstOrDefaultAsync(p => p.Id == paymentId);

                if (payment == null)
                {
                    throw new KeyNotFoundException($"Payment with ID {paymentId} not found");
                }

                if (!userId.HasValue)
                {
                    throw new UnauthorizedAccessException("User ID is required to delete payments");
                }

                // Allow deletion if:
                // 1. Payment was created by the requesting user (manually recorded), OR
                // 2. The requesting user is the landlord who owns the property (for payments without CreatedByUserId or legacy payments)
                var isCreatedByUser = payment.CreatedByUserId.HasValue && payment.CreatedByUserId.Value == userId.Value;
                var isPropertyOwner = payment.Lease?.Unit?.Property?.LandlordId == userId.Value;

                if (!isCreatedByUser && !isPropertyOwner)
                {
                    throw new UnauthorizedAccessException("You can only delete payments that you manually recorded or payments for properties you own");
                }

                var leaseId = payment.LeaseId;
                var lease = payment.Lease; // Use already loaded lease

                _context.Payments.Remove(payment);
                await _context.SaveChangesAsync();

                // Update the lease's OverdueAmount after deletion (using rent-only payments)
                if (lease != null)
                {
                    var rentPayments = await GetRentPaymentsByLeaseId(leaseId);
                    await UpdateLeaseOverdueAmount(leaseId, lease, rentPayments);
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting payment ID {PaymentId}", paymentId);
                throw;
            }
        }

        public async Task<List<LoadPaymentDto>> GetPaymentsByPropertyId(long propertyId, DateTime start, DateTime end)
        {
            try
            {
                var payments = await _context.Payments
                    .AsNoTracking()
                    .Include(p => p.Lease)
                        .ThenInclude(l => l.Unit)
                            .ThenInclude(u => u.Property)
                    .Include(p => p.Fee)
                    .Where(p => p.PropertyId == propertyId &&
                                !p.Lease.Unit.Property.IsDeleted &&
                                !p.Lease.IsDeleted &&
                                p.PaymentDate >= start &&
                                p.PaymentDate < end)
                    .OrderByDescending(p => p.PaymentDate)
                    .ToListAsync();

                return _mapper.Map<List<LoadPaymentDto>>(payments);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving payments for property {PropertyId} between {Start} and {End}", propertyId, start, end);
                throw new Exception("Error retrieving payments", ex);
            }
        }

        public async Task<Dictionary<long, List<LoadPaymentDto>>> GetPaymentsByPropertyIds(List<long> propertyIds, DateTime start, DateTime end)
        {
            try
            {
                var payments = await _context.Payments
                    .AsNoTracking()
                    .Include(p => p.Lease)
                        .ThenInclude(l => l.Unit)
                            .ThenInclude(u => u.Property)
                    .Include(p => p.Fee)
                    .Where(p => propertyIds.Contains(p.PropertyId) &&
                                !p.Lease.Unit.Property.IsDeleted &&
                                !p.Lease.IsDeleted &&
                                p.PaymentDate >= start &&
                                p.PaymentDate < end)
                    .OrderByDescending(p => p.PaymentDate)
                    .ToListAsync();

                return payments
                    .GroupBy(p => p.PropertyId)
                    .ToDictionary(g => g.Key, g => _mapper.Map<List<LoadPaymentDto>>(g.ToList()));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving payments for property IDs between {Start} and {End}", start, end);
                throw new Exception("Error retrieving payments", ex);
            }
        }

        public async Task<List<LoadPaymentDto>> GetPaymentsByLeaseId(long leaseId)
        {
            try
            {
                var payments = await _context.Payments
                    .Include(p => p.Lease)
                    .Include(p => p.Fee)
                    .Include(p => p.StripePaymentMethod)
                    .Where(p => p.LeaseId == leaseId && !p.Lease.IsDeleted)
                    .OrderByDescending(p => p.PaymentDate)
                    .ToListAsync();

                return _mapper.Map<List<LoadPaymentDto>>(payments);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving payments for lease ID {LeaseId}", leaseId);
                throw new Exception("Error retrieving payments", ex);
            }
        }

        public async Task<Dictionary<long, List<LoadPaymentDto>>> GetPaymentsByLeaseIds(List<long> leaseIds)
        {
            try
            {
                var payments = await _context.Payments
                    .Include(p => p.Lease)
                    .Include(p => p.Fee)
                    .Where(p => leaseIds.Contains(p.LeaseId) && !p.Lease.IsDeleted)
                    .OrderByDescending(p => p.PaymentDate)
                    .ToListAsync();

                // Group by LeaseId and map each group to DTOs
                var groupedPayments = payments
                    .GroupBy(p => p.LeaseId)
                    .ToDictionary(
                        g => g.Key,
                        g => _mapper.Map<List<LoadPaymentDto>>(g.ToList())
                    );

                return groupedPayments;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving payments for lease IDs {LeaseIds}", string.Join(",", leaseIds));
                throw new Exception("Error retrieving payments", ex);
            }
        }

        public async Task<List<LoadPaymentDto>> GetLifetimePaymentsByPropertyId(long propertyId)
        {
            try
            {
                var payments = await _context.Payments
                    .AsNoTracking()
                    .Include(p => p.Lease)
                        .ThenInclude(l => l.Unit)
                            .ThenInclude(u => u.Property)
                    .Where(p => p.Lease.Unit.PropertyId == propertyId &&
                                !p.Lease.Unit.Property.IsDeleted &&
                                !p.Lease.IsDeleted)
                    .OrderByDescending(p => p.PaymentDate)
                    .ToListAsync();

                return _mapper.Map<List<LoadPaymentDto>>(payments);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lifetime payments for property ID {PropertyId}", propertyId);
                throw new Exception($"Error retrieving lifetime payments for property ID {propertyId}", ex);
            }
        }

        public async Task<List<LoadPaymentDto>> GetLifetimePaymentsByLandlordId(long landlordId)
        {
            try
            {
                var payments = await _context.Payments
                    .AsNoTracking()
                    .Include(p => p.Lease)
                        .ThenInclude(l => l.Unit)
                        .ThenInclude(u => u.Property)
                    .Include(p => p.Deposit)
                    .Where(p => p.Lease.Unit.Property.LandlordId == landlordId &&
                                !p.Lease.Unit.Property.IsDeleted &&
                                !p.Lease.IsDeleted)
                    .OrderByDescending(p => p.PaymentDate)
                    .ToListAsync();

                return _mapper.Map<List<LoadPaymentDto>>(payments);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lifetime payments for landlord ID {LandlordId}", landlordId);
                throw new Exception($"Error retrieving lifetime payments for landlord ID {landlordId}", ex);
            }
        }

        public async Task<List<LoadPaymentDto>> GetLifetimePaymentsByOrganizationId(long organizationId)
        {
            try
            {
                var payments = await _context.Payments
                    .AsNoTracking()
                    .Include(p => p.Lease)
                        .ThenInclude(l => l.Unit)
                        .ThenInclude(u => u.Property)
                    .Where(p => (p.OrganizationId == organizationId || p.Lease.Unit.Property.OrganizationId == organizationId) &&
                                !p.Lease.Unit.Property.IsDeleted &&
                                !p.Lease.IsDeleted)
                    .OrderByDescending(p => p.PaymentDate)
                    .ToListAsync();

                return _mapper.Map<List<LoadPaymentDto>>(payments);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lifetime payments for organization ID {OrganizationId}", organizationId);
                throw new Exception($"Error retrieving lifetime payments for organization ID {organizationId}", ex);
            }
        }

        public async Task<List<LoadPaymentDto>> GetRentPaymentsByLeaseId(long leaseId)
        {
            try
            {
                var payments = await _context.Payments
                    .Include(p => p.Lease)
                    .Where(p => p.LeaseId == leaseId && !p.Lease.IsDeleted && p.FeeId == null && p.DepositId == null)
                    .OrderByDescending(p => p.PaymentDate)
                    .ToListAsync();

                return _mapper.Map<List<LoadPaymentDto>>(payments);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving rent payments for lease ID {LeaseId}", leaseId);
                throw new Exception("Error retrieving rent payments", ex);
            }
        }

        public async Task<Dictionary<long, List<LoadPaymentDto>>> GetRentPaymentsByLeaseIds(List<long> leaseIds)
        {
            try
            {
                var payments = await _context.Payments
                    .Include(p => p.Lease)
                    .Where(p => leaseIds.Contains(p.LeaseId) && !p.Lease.IsDeleted && p.FeeId == null && p.DepositId == null)
                    .OrderByDescending(p => p.PaymentDate)
                    .ToListAsync();

                var groupedPayments = payments
                    .GroupBy(p => p.LeaseId)
                    .ToDictionary(
                        g => g.Key,
                        g => _mapper.Map<List<LoadPaymentDto>>(g.ToList())
                    );

                return groupedPayments;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving rent payments for lease IDs {LeaseIds}", string.Join(",", leaseIds));
                throw new Exception("Error retrieving rent payments", ex);
            }
        }

        public async Task<List<LoadPaymentDto>> GetLifetimeRentPaymentsByPropertyId(long propertyId)
        {
            try
            {
                var payments = await _context.Payments
                    .AsNoTracking()
                    .Include(p => p.Lease)
                        .ThenInclude(l => l.Unit)
                            .ThenInclude(u => u.Property)
                    .Where(p => p.Lease.Unit.PropertyId == propertyId &&
                                !p.Lease.Unit.Property.IsDeleted &&
                                !p.Lease.IsDeleted &&
                                p.FeeId == null &&
                                p.DepositId == null)
                    .OrderByDescending(p => p.PaymentDate)
                    .ToListAsync();

                return _mapper.Map<List<LoadPaymentDto>>(payments);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lifetime rent payments for property ID {PropertyId}", propertyId);
                throw new Exception($"Error retrieving lifetime rent payments for property ID {propertyId}", ex);
            }
        }

        public async Task<List<LoadPaymentDto>> GetLifetimeRentPaymentsByOrganizationId(long organizationId)
        {
            try
            {
                var payments = await _context.Payments
                    .AsNoTracking()
                    .Include(p => p.Lease)
                        .ThenInclude(l => l.Unit)
                        .ThenInclude(u => u.Property)
                    .Where(p => (p.OrganizationId == organizationId || p.Lease.Unit.Property.OrganizationId == organizationId) &&
                                !p.Lease.Unit.Property.IsDeleted &&
                                !p.Lease.IsDeleted &&
                                p.FeeId == null &&
                                p.DepositId == null)
                    .OrderByDescending(p => p.PaymentDate)
                    .ToListAsync();

                return _mapper.Map<List<LoadPaymentDto>>(payments);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lifetime rent payments for organization ID {OrganizationId}", organizationId);
                throw new Exception($"Error retrieving lifetime rent payments for organization ID {organizationId}", ex);
            }
        }

        public async Task<List<LoadPaymentDto>> GetLifetimeRentPaymentsByLandlordId(long landlordId)
        {
            try
            {
                var payments = await _context.Payments
                    .AsNoTracking()
                    .Include(p => p.Lease)
                        .ThenInclude(l => l.Unit)
                        .ThenInclude(u => u.Property)
                    .Include(p => p.Deposit)
                    .Where(p => p.Lease.Unit.Property.LandlordId == landlordId &&
                                !p.Lease.Unit.Property.IsDeleted &&
                                !p.Lease.IsDeleted &&
                                p.FeeId == null &&
                                p.DepositId == null)
                    .OrderByDescending(p => p.PaymentDate)
                    .ToListAsync();

                return _mapper.Map<List<LoadPaymentDto>>(payments);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lifetime rent payments for landlord ID {LandlordId}", landlordId);
                throw new Exception($"Error retrieving lifetime rent payments for landlord ID {landlordId}", ex);
            }
        }

        public async Task<List<LoadPaymentDto>> GetAllPaymentsByOrganizationId(long organizationId, long? propertyId = null, long? unitId = null)
        {
            try
            {
                var query = _context.Payments
                    .AsNoTracking()
                    .Include(p => p.Lease)
                        .ThenInclude(l => l.Unit)
                        .ThenInclude(u => u.Property)
                    .Include(p => p.Fee)
                    .Where(p => (p.OrganizationId == organizationId || p.Lease.Unit.Property.OrganizationId == organizationId) &&
                                !p.Lease.Unit.Property.IsDeleted &&
                                !p.Lease.IsDeleted);

                if (propertyId.HasValue)
                {
                    query = query.Where(p => p.Lease.Unit.PropertyId == propertyId.Value);
                }

                if (unitId.HasValue)
                {
                    query = query.Where(p => p.Lease.UnitId == unitId.Value);
                }

                var payments = await query
                    .OrderByDescending(p => p.PaymentDate)
                    .ToListAsync();

                return _mapper.Map<List<LoadPaymentDto>>(payments);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving payments for organization ID {OrganizationId}, propertyId: {PropertyId}, unitId: {UnitId}", organizationId, propertyId, unitId);
                throw new Exception($"Error retrieving payments", ex);
            }
        }

        public async Task<int> DeletePaymentsByLeaseIds(List<long> leaseIds)
        {
            try
            {
                var payments = await _context.Payments
                    .Where(p => leaseIds.Contains(p.LeaseId))
                    .ToListAsync();

                _context.Payments.RemoveRange(payments);
                await _context.SaveChangesAsync();

                return payments.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting payments for lease IDs: {LeaseIds}", string.Join(", ", leaseIds));
                throw new Exception("Error deleting payments", ex);
            }
        }

        public async Task<List<TenantPaymentHistoryItemDto>> GetPaymentHistoryByTenantId(long tenantId)
        {
            try
            {
                var leaseIds = await _context.TenantLeases
                    .Where(tl => tl.TenantId == tenantId)
                    .Select(tl => tl.LeaseId)
                    .ToListAsync();

                if (leaseIds.Count == 0)
                    return [];

                var payments = await _context.Payments
                    .AsNoTracking()
                    .Include(p => p.Lease)
                        .ThenInclude(l => l.Unit)
                            .ThenInclude(u => u.Property)
                    .Include(p => p.Fee)
                    .Include(p => p.Deposit)
                    .Include(p => p.StripePaymentMethod)
                    .Where(p => leaseIds.Contains(p.LeaseId) && !p.Lease.IsDeleted)
                    .OrderBy(p => p.PaymentDate)
                    .ToListAsync();

                var result = new List<TenantPaymentHistoryItemDto>();

                foreach (var leaseId in leaseIds.Distinct())
                {
                    var leasePayments = payments.Where(p => p.LeaseId == leaseId).ToList();
                    var lease = leasePayments.FirstOrDefault()?.Lease;
                    if (lease == null) continue;

                    var unitName = lease.Unit?.Name;
                    var propertyName = lease.Unit?.Property?.Name;

                    var rentPayments = leasePayments.Where(p => p.FeeId == null && p.DepositId == null).OrderBy(p => p.PaymentDate).ToList();
                    var rentDueDates = new List<DateTime>();
                    if (lease.StartDate.HasValue && lease.EndDate.HasValue && lease.RentDueDay.HasValue)
                    {
                        rentDueDates = RentCalculator.GetRentDueDatesForLease(
                            lease.StartDate.Value,
                            lease.EndDate.Value,
                            lease.RentDueDay);
                    }

                    var rentDueIndex = 0;

                    foreach (var p in leasePayments)
                    {
                        var paymentDate = p.PaymentDate.Date;
                        DateTime? dueDate = null;
                        var isOnTime = true;
                        string paymentType;
                        string? feeName = null;

                        if (p.FeeId != null && p.Fee != null)
                        {
                            paymentType = "Fee";
                            feeName = p.Fee.Name;
                            dueDate = p.Fee.DueDate.Date;
                            isOnTime = paymentDate <= dueDate.Value;
                        }
                        else if (p.DepositId != null)
                        {
                            paymentType = "Deposit";
                            dueDate = null;
                            isOnTime = true;
                        }
                        else
                        {
                            paymentType = "Rent";
                            if (rentDueIndex < rentDueDates.Count)
                            {
                                dueDate = rentDueDates[rentDueIndex].Date;
                                isOnTime = paymentDate <= dueDate.Value;
                                rentDueIndex++;
                            }
                        }

                        result.Add(new TenantPaymentHistoryItemDto
                        {
                            Id = p.Id,
                            LeaseId = p.LeaseId,
                            Amount = p.Amount,
                            PaymentDate = p.PaymentDate,
                            DueDate = dueDate,
                            IsOnTime = isOnTime,
                            PaymentType = paymentType,
                            Status = p.Status,
                            StripePaymentIntentId = p.StripePaymentIntentId,
                            StripePaymentMethodId = p.StripePaymentMethodId,
                            StripePaymentMethodType = p.StripePaymentMethod?.Type,
                            StripePaymentMethodBrand = p.StripePaymentMethod?.Brand,
                            StripePaymentMethodLast4 = p.StripePaymentMethod?.Last4,
                            StripePaymentMethodBankName = p.StripePaymentMethod?.BankName,
                            StripePaymentMethodWalletType = p.StripePaymentMethod?.WalletType,
                            StripeChargeId = p.StripeChargeId,
                            StripeDisputeId = p.StripeDisputeId,
                            SubmittedAt = p.SubmittedAt,
                            CompletedAt = p.CompletedAt,
                            FailedAt = p.FailedAt,
                            CanceledAt = p.CanceledAt,
                            DisputedAt = p.DisputedAt,
                            FeeName = feeName,
                            UnitName = unitName,
                            PropertyName = propertyName
                        });
                    }
                }

                return result.OrderByDescending(x => x.PaymentDate).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving payment history for tenant ID {TenantId}", tenantId);
                throw new Exception("Error retrieving payment history for tenant", ex);
            }
        }

        /// <summary>
        /// Updates the lease's OverdueAmount field based on current payments
        /// </summary>
        private async Task UpdateLeaseOverdueAmount(long leaseId, Models.Lease lease, List<LoadPaymentDto> payments)
        {
            try
            {
                // Draft leases do not count towards overdue
                if (lease.LeaseAgreement?.IsDrafted == true)
                {
                    lease.OverdueAmount = 0;
                    await _context.SaveChangesAsync();
                    return;
                }

                // Convert Lease entity to LoadLeaseDto for calculation
                var leaseDto = new LoadLeaseDto
                {
                    Id = lease.Id,
                    StartDate = lease.StartDate,
                    EndDate = lease.EndDate,
                    RentAmount = lease.RentAmount,
                    RentFrequency = lease.RentFrequency ?? "Monthly",
                    RentDueDay = lease.RentDueDay,
                    IsActive = lease.IsActive
                };

                // Calculate overdue amount
                var overdueAmount = RentCalculator.CalculateOverdueForLease(leaseDto, payments);

                // Update the lease entity
                lease.OverdueAmount = overdueAmount;
                await _context.SaveChangesAsync();

                _logger.LogInformation("Updated OverdueAmount for lease {LeaseId} to {OverdueAmount}", leaseId, overdueAmount);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating OverdueAmount for lease {LeaseId}", leaseId);
                // Don't throw - this is a background update, shouldn't fail the payment operation
            }
        }
    }
}
