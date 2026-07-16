using AutoMapper;
using brownstone_hub_api.Dtos.Household;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Utils;

namespace brownstone_hub_api.Services.HouseholdService
{
    public class HouseholdService(
        ITenantRepository tenantRepository,
        ILeaseRepository leaseRepository,
        IPaymentRepository paymentRepository,
        ILogger<HouseholdService> logger,
        IMapper mapper
    ) : IHouseholdService
    {
        private readonly ITenantRepository _tenantRepository = tenantRepository;
        private readonly ILeaseRepository _leaseRepository = leaseRepository;
        private readonly IPaymentRepository _paymentRepository = paymentRepository;
        private readonly ILogger<HouseholdService> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public async Task<ServiceResponse<List<LoadHouseholdDto>>> GetHouseholdsByLandlordId(long landlordId)
        {
            try
            {
                // ✅ Load leases with related Property, Unit, and Tenants in one go if possible
                var leases = await _leaseRepository.GetLeasesByLandlordId(landlordId);

                if (leases == null || leases.Count == 0)
                {
                    return new ServiceResponse<List<LoadHouseholdDto>>
                    {
                        Data = [],
                        Message = "No households found."
                    };
                }

                // ✅ Gather all leaseIds first
                var leaseIds = leases.Select(l => l.Id).ToList();

                // ✅ Fetch all payments in one query, grouped by LeaseId
                var paymentsByLease = await _paymentRepository.GetRentPaymentsByLeaseIds(leaseIds);

                var households = leases.Select(lease =>
                {
                    var tenants = lease.Tenants?.Select(t => new LoadTenantDto
                    {
                        Id = t.Id,
                        Firstname = t.Firstname,
                        Lastname = t.Lastname,
                        Email = t.Email,
                        PhoneNumber = t.PhoneNumber,
                        UserId = t.UserId,
                        CreatedAt = t.CreatedAt,
                        IsActive = t.IsActive
                    }).ToList() ?? [];

                    var payments = paymentsByLease.TryGetValue(lease.Id, out var list) ? list : [];
                    var balanceDue = RentCalculator.GetAmountDueNow(lease, payments);

                    return new LoadHouseholdDto
                    {
                        LeaseId = lease.Id,
                        PropertyName = lease.PropertyName,
                        PropertyType = lease.PropertyType,
                        UnitName = lease.UnitName,
                        LeaseStartDate = lease.StartDate,
                        LeaseEndDate = lease.EndDate,
                        Tenants = tenants,
                        BalanceDue = balanceDue
                    };
                }).ToList();

                return new ServiceResponse<List<LoadHouseholdDto>>
                {
                    Data = households,
                    Message = "Households retrieved successfully."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving households for landlord {LandlordId}", landlordId);
                return ServiceResponse<List<LoadHouseholdDto>>.CreateError("Error retrieving households", ex.Message);
            }
        }

    }
}
